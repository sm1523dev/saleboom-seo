# Production — Azure

Populated when ready to move from Pi dev to Azure production.

## Target architecture

| Layer            | Azure service                          |
|------------------|----------------------------------------|
| Compute (web)    | Azure App Service (Linux container)    |
| Compute (worker) | Azure Functions v4 (Node.js)           |
| Queue            | Azure Queue Storage                    |
| Database         | Azure Database for PostgreSQL Flexible |
| Storage          | Azure Blob Storage                     |
| AI               | Azure OpenAI                           |
| Crawler          | Firecrawl (cloud or self-hosted ACI)   |
| Secrets          | Azure Key Vault                        |
| CI/CD            | GitHub Actions → Azure (OIDC, no keys) |

## Adapter env vars

```
QUEUE_PROVIDER=azure-queue
STORAGE_PROVIDER=azure-blob
AUTH_PROVIDER=authjs
CRAWL_PROVIDER=firecrawl
AI_PROVIDER=azure
```

## Migration checklist

- [ ] Provision Azure Storage Account → get AZURE_STORAGE_CONNECTION_STRING
- [ ] Provision Azure Database for PostgreSQL → get DATABASE_URL
- [ ] Provision Azure OpenAI → get endpoint + key + deployment
- [ ] Configure Azure App Service with container image from GHCR
- [ ] Deploy Azure Functions from azure-functions/ directory
- [ ] Set NEXT_PUBLIC_APP_URL to production domain
- [ ] Point production DNS to Azure App Service
