#!/usr/bin/env bash
# =====================================================================
# Script: authenticate.sh
# Description: Authenticates to an Azure AKS cluster identified by the
#              AKS_NAME and RG_NAME environment variables.
# Usage: Set AKS_NAME and RG_NAME environment variables (can be done by
#        sourcing config.sh), then source this script.

# Check that parameters are provided as environment variables
if [[ -z "${AKS_NAME:-}" ]]; then
    echo "Error: AKS_NAME environment variable is not set."
    exit 1
fi

if [[ -z "${RG_NAME:-}" ]]; then
    echo "Error: RG_NAME environment variable is not set."
    exit 1
fi

# Authenticate to the AKS cluster
echo "Authenticating to AKS cluster '$AKS_NAME' in resource group '$RG_NAME'"
az aks get-credentials -n "$AKS_NAME" -g "$RG_NAME" --overwrite-existing

# Verify authentication
if kubectl version >/dev/null 2>&1; then
    echo "Successfully authenticated to AKS cluster '$AKS_NAME'."
else
    echo "Failed to authenticate to AKS cluster '$AKS_NAME'."
    exit 1
fi
