# Infrastructure (IaC)

This placeholder directory will house infrastructure as code definitions for the CRM.

## Planned Stack

- AWS API Gateway (REST) fronting Lambda (Fastify wrapper)
- AWS Lambda for API execution (@crm/api packaged bundle)
- AWS RDS PostgreSQL (prod/staging), SQLite for local dev
- AWS S3 for static Web (or CloudFront + S3) and file storage staging
- AWS Secrets Manager or SSM Parameter Store for JWT secret, DB credentials
- AWS IAM roles for least-privilege Lambda execution

## Tools Under Evaluation

- Terraform for cross-environment reproducibility
- CDK for higher-level constructs (optional mix)

## Next Steps

1. Create `main.tf` with providers and remote state backend.
2. Define API Gateway + Lambda module.
3. Add RDS (Postgres) module for staging.
4. Configure outputs consumed by deployment pipeline.

For now this is a stub; implementation planned in Phase 1 Week 2.
