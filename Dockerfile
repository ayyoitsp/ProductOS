# ProductOS — the instance, as a container.
#
# ⛔ CONFIG BY ENV VAR ONLY. The image deploys unchanged to ACA, Cloud Run, Fly, Railway or Render;
# the host stays a swappable decision and no platform-proprietary primitive gets baked in.
#
#   DATABASE_URL              required. ⛔ The instance refuses to start without it
#   PORT                      default 4100
#   PRODUCTOS_SINGLE_ACCOUNT  set to run for one account — the local case, same image, same API
#
# Build:  docker build -t productos .
# Run:    docker run -e DATABASE_URL=... -p 4100:4100 productos
#
# ---------------------------------------------------------------------------
# ⛔ THE IMAGE IS A PURE FUNCTION OF THE LOCKFILE. KEEP IT THAT WAY.
#
# Four stages, and `deps` is the one that matters: nothing in it comes from anywhere but
# package.json and package-lock.json. That single invariant is what buys everything else —
# `dev` can bind-mount source over a dependency-only image so a code change costs a process
# restart instead of a build, and every stack on the machine can share ONE image because the
# image holds no stack's code.
#
# The consequence to protect: the only question a developer ever has to ask is "did I change
# dependencies?" The day something non-derivable from the lockfile gets baked in here, every
# `make up` becomes a rebuild again and nobody will know why.
#
#   deps     node_modules, from the lockfile, nothing else
#   dev      deps + a watcher. NO SOURCE — it arrives as a bind mount
#   build    deps + tsconfig + src → dist
#   runtime  production deps + dist + bin + drizzle          (the default target)
# ---------------------------------------------------------------------------

# ⛔ PINNED TO AN ALPINE RELEASE, NOT THE FLOATING `-alpine` TAG.
#
# Lifted from bilrost-workers, whose Dockerfile carries an incident report about this: the bare
# `-slim` tag silently rebased bookworm→trixie under them and swapped LibreOffice 7.4 for 25.x,
# which is not a thing anybody debugs quickly. A floating tag means the image changes on a day
# nobody touched it, and the git history says nothing happened.
FROM node:22-alpine3.22 AS deps
WORKDIR /app

# ⛔ `npm ci`, NOT `npm install` — and the lockfile is not optional here.
#
# `install` is free to resolve something newer than the lockfile, which makes the image a
# function of the day it was built. `ci` fails outright if package.json and the lockfile
# disagree, which is the failure you want: loud, at build time, naming the file.
#
# ⛔ THE CACHE IS A MOUNT, SO IT IS NEVER BAKED IN. The downloads persist across builds on the
#    machine and add nothing to the layer. Needs BuildKit, which is the default in Docker's
#    current engine — `make` forces it on anyway for engines where it is not.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# ⛔ NO `COPY src` IN THIS STAGE, DELIBERATELY. Source arrives as a bind mount from the checkout
# (see docker-compose.dev.yml), so the running container serves the files you are editing and a
# change costs a `tsx` restart — about a second — instead of a build.
#
# Carries devDependencies, because `tsx` is one. That is the trade: a dev image is bigger than
# runtime and never ships anywhere.
FROM deps AS dev
WORKDIR /app
ENV NODE_ENV=development
# ⛔ Root in this stage only. The bind mount brings the host's uid, and `USER node` against a
#    directory owned by somebody else is a permission error that reads like a missing file.
EXPOSE 4100
CMD ["npx", "tsx", "watch", "src/v2/store/boot.ts"]

# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app
# Least-to-most change frequency, so editing a source file does not re-resolve the tree above.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
FROM node:22-alpine3.22 AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# ⛔ Production deps only — the build tier is gone, and `drizzle-kit` and PGlite have no business
#    in a running instance. PGlite in particular is how the tests get a real Postgres; shipping it
#    would put a second database engine in the image for nothing.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist
COPY bin ./bin
# ⛔ The migrations are part of the image, not something fetched at boot. `migrationsDir()` walks up
#    from dist/ to find them, and an instance that cannot find them would look like an empty database.
COPY drizzle ./drizzle

# ⛔ Not root. A process that only ever reads its own code and talks to Postgres has no use for it.
USER node

EXPOSE 4100

# ⛔ The platform's own probe, in the image, so a broken instance is detected the same way
#    everywhere rather than only where somebody remembered to configure it.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4100)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/v2/store/boot.js"]
