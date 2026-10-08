#!/usr/bin/env sh
# Print a connection URL with any transaction-pooler host rewritten to the direct endpoint.
#
# ⛔ pg_dump MUST NOT RUN THROUGH A TRANSACTION POOLER, AND THIS IS NOT A STYLE PREFERENCE.
#
# Every dump pg_dump writes begins with
#
#     SELECT pg_catalog.set_config('search_path', '', false);
#
# and that third argument `false` means SESSION-scoped, not transaction-scoped. Against a
# transaction pooler the server connection goes back into the pool still carrying an EMPTY
# search_path, and the next client to draw it inherits it. In `make deploy` the next client is the
# container we recreate about forty seconds later, whose first statement is
# `create table if not exists _productos_migrations` — which fails with 3F000, no schema has been
# selected to create in. That took staging down, and the deploy before it survived only by drawing
# a different connection.
#
# ⛔ So the backup step stops creating the hazard, rather than the app defending against it. The app
# defends too (`connection: { search_path: "public" }` in src/v2/store/server.ts) — belt and braces,
# because only one of the two is in a file somebody reads before editing the other.
#
# Neon spells the pooled endpoint `<endpoint>-pooler.<rest>`; dropping `-pooler` is the direct one.
# Anything that does not match is printed back unchanged, so a local or non-Neon URL is untouched.
printf '%s' "$1" | sed -E 's#(://[^/@]*@[^/.]*)-pooler\.#\1.#'
