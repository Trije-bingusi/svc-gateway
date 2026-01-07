# svc-gateway

Microservice for the API gateway.


## Prerequisites
- Docker Desktop/Engine
- Bash (Git Bash/WSL/macOS/Linux)
- Azure CLI (`az login --use-device-code`). Ensure the correct subscription is selected using `az account set --subscription "your-subscription-id"`.


## Local Development
The service can be run locally using Docker Compose.
```bash
cp .env.example .env  # Edit the .env if needed
docker compose up --build -d
```


## Buld and Deploy to AKS

> **Note:** Deploying to AKS from a local machine is not recommended. Deployments are done through a CI/CD pipeline on merges to the `main` branch. This section is left here for reference only. When developing new features, use local Docker Compose setup described in the [Local Development](#local-development) section.

First, make sure the correct `KEYVAULT_NAME` and `K8S_NAMESPACE` from the [shared-infractructure](https://github.com/Trije-bingusi/shared-infrastructure) repo is set in the [`./scripts/.env`](./scripts/.env) file. Set other variables as needed. You can use the provided [`./scripts/.env.example`](./scripts/.env.example) as a template, which already has the correct values for deployment to the development cluster.

To package the app as a Docker image and push it to ACR, use the [`./scripts/deploy/build.sh`](./scripts/deploy/build.sh) script.
```sh
./scripts/deploy/build.sh
```
Upon success, the image will be pushed to ACR and the immutable image tag printed. Use this tag to deplot to the AKS cluster using the [`./scripts/deploy/deploy.sh`](./scripts/deploy/deploy.sh) script:
```sh
./scripts/deploy/deploy.sh <image-tag>
```

## TODO / Fixes

- (Optional) Add **TLS support** in Helm ingress configuration for secure HTTPS access.
- Replace raw ingress IP usage with a **proper DNS domain** (e.g., `gateway.local` or real cluster domain).
- Ensure upstream service URLs work for both envs using **environment-specific Helm values** or dynamic config.
