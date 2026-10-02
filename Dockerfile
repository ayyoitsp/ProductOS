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

FROM node:22-alpine AS build
WORKDIR /app

# Dependencies first, so a source change does not re-resolve the tree.
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
# ⛔ Production deps only — the build tier is gone, and `drizzle-kit` and PGlite have no business
#    in a running instance. PGlite in particular is how the tests get a real Postgres; shipping it
#    would put a second database engine in the image for nothing.
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

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
