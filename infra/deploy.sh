#!/usr/bin/env bash
# Deploys (or updates) one engagement's Azure resources.
# Usage:
#   ./infra/deploy.sh acme prod    # deploys with infra/parameters.acme.json

set -euo pipefail

CLIENT="${1:?usage: deploy.sh <client> [env]}"
ENV_NAME="${2:-prod}"
LOCATION="${LOCATION:-eastus2}"

PARAM_FILE="$(dirname "$0")/parameters.${CLIENT}.json"
TEMPLATE="$(dirname "$0")/main.bicep"

[ -f "$PARAM_FILE" ] || { echo "Missing parameter file: $PARAM_FILE"; exit 1; }

DEPLOY_NAME="audit-${CLIENT}-$(date +%Y%m%d%H%M%S)"
echo "Deploying $DEPLOY_NAME to $LOCATION (env=$ENV_NAME)…"

az deployment sub create \
  --location "$LOCATION" \
  --name    "$DEPLOY_NAME" \
  --template-file "$TEMPLATE" \
  --parameters "$PARAM_FILE" \
  --parameters env="$ENV_NAME" \
  --output table

echo
echo "=== Outputs ==="
az deployment sub show --name "$DEPLOY_NAME" --query 'properties.outputs' -o json
