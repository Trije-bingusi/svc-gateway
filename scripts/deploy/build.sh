#!/usr/bin/env bash
# =====================================================================
# Script: build.sh
# Description: Builds the Docker image for svc-gateway and pushes it to
#              Azure Container Registry, retrieving configuration from
#              the Key Vault identified by the KEYVAULT_NAME env variable.
# Usage: ./scripts/deploy/build.sh
# =====================================================================

set -euo pipefail

# Retrieve configuration from the Key Vault
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../utils/config.sh"

echo "Retrieving configuration from the ${KEYVAULT_NAME} Key Vault secrets"
RG_NAME=$(get_secret "rg-name")
ACR_LOGIN_SERVER=$(get_secret "acr-login-server")

# Setup buildx
if ! docker buildx inspect multiarch >/dev/null 2>&1; then
  docker buildx create --use --name multiarch >/dev/null
else
  docker buildx use multiarch >/dev/null
fi

# Authenticate to Azure Container Registry
echo "Logging into ACR $ACR_LOGIN_SERVER in resource group $RG_NAME"
az acr login -g "$RG_NAME" -n "$ACR_LOGIN_SERVER"

# Build and push the Docker image
TIMESTAMP=$(date -u +%Y%m%d-%H%M%S)
IMAGE_TAG="${IMAGE_TAG:-${IMAGE_TAG_PREFIX}-${TIMESTAMP}}"
echo "Building & pushing:"
echo "  ${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}"

ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT_DIR"

docker buildx build \
  --platform "$IMAGE_PLATFORMS" \
  -t "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}" \
  --push .

# Retrieve digest to get immutable image reference
IMAGE_DIGEST=$(docker buildx imagetools inspect \
    "${ACR_LOGIN_SERVER}/${IMAGE_NAME}:${IMAGE_TAG}" | \
    awk '/Digest:/ {print $2; exit}'
)

if [[ -n "$IMAGE_DIGEST" ]]; then
  echo
  echo "Immutable digest for this build:"
  echo "${ACR_LOGIN_SERVER}/${IMAGE_NAME}@${IMAGE_DIGEST}"
fi
