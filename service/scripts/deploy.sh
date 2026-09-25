#!/usr/bin/env bash
# Deploy to Azure Container Apps.
#
# Credentials are read from .env locally and stored as ACA *secrets* — never as
# plain env vars, which are readable by anyone with read access on the resource.
set -euo pipefail
cd "$(dirname "$0")/.."

RG="${RG:-productos-trial}"
APP="${APP:-productos}"
ENVIRONMENT="${ENVIRONMENT:-productos-env}"
LOCATION="${LOCATION:-eastus2}"

DB=$(grep '^DATABASE_URL' .env | cut -d= -f2- | tr -d '"')
S=$(grep '^PRODUCTOS_SECRET' .env | cut -d= -f2 | tr -d '"')
H=$(grep '^PRODUCTOS_HUMAN_SECRET' .env | cut -d= -f2 | tr -d '"')

echo "→ building and deploying $APP to $RG ($LOCATION)"
az containerapp up \
  --name "$APP" --resource-group "$RG" --location "$LOCATION" \
  --environment "$ENVIRONMENT" --source . \
  --ingress external --target-port 4100

echo "→ storing credentials as secrets"
az containerapp secret set -n "$APP" -g "$RG" \
  --secrets "db-url=$DB" "app-secret=$S" "human-secret=$H" >/dev/null

# min-replicas 1: scale-to-zero cold starts break long-lived MCP/SSE
# connections. Costs a little; removes a confusing class of bug.
echo "→ wiring secretrefs, pinning replicas"
az containerapp update -n "$APP" -g "$RG" \
  --min-replicas 1 --max-replicas 3 \
  --set-env-vars \
    "DATABASE_URL=secretref:db-url" \
    "PRODUCTOS_SECRET=secretref:app-secret" \
    "PRODUCTOS_HUMAN_SECRET=secretref:human-secret" \
    "PORT=4100" >/dev/null

FQDN=$(az containerapp show -n "$APP" -g "$RG" --query "properties.configuration.ingress.fqdn" -o tsv)
echo "→ deployed: https://$FQDN"
echo "→ verifying"
curl -fsS --max-time 30 "https://$FQDN/health" && echo
echo "→ run the suite:  BASE=https://$FQDN ./scripts/smoke.sh"
