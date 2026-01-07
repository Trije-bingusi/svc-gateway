#!/usr/bin/env bash
# =====================================================================
# Script: config.sh
# Description: Loads environment variables from the /scripts/.env file
#              and defines a function for retrieving secrets from Azure
#              Key Vault identified by the KEYVAULT_NAME env variable.
# Usage: source ./scripts/utils/config.sh
# =====================================================================


SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/../.env"

if [[ -z "${KEYVAULT_NAME:-}" ]]; then
  echo "ERROR: The KEYVAULT_NAME environment variable is not set." >&2
  exit 1
fi

get_secret() {
    local secret_name="$1"
    local keyvault_name=${2:-$KEYVAULT_NAME}
    local secret_value=$(
        az keyvault secret show \
            --vault-name "$keyvault_name" \
            --name "$secret_name" \
            --query value \
            --output tsv
    )
    echo "$secret_value"
}
