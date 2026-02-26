# GitHub Secrets Configuration

To enable automated deployment via Railway, configure the following GitHub repository secrets:

## Setup Instructions

1. Go to: `https://github.com/your-org/TCES/settings/secrets/actions`
2. Click "New repository secret"
3. Add each secret below

## Required Secrets

### RAILWAY_TOKEN
- **Description**: Authentication token for Railway CLI
- **How to get**:
  1. Go to https://railway.app/account/tokens
  2. Create new token
  3. Copy and paste here
- **Required**: ✓ Yes (for automated deployment)

### RAILWAY_PROJECT_ID (Optional)
- **Description**: Railway project ID for auto-link
- **How to get**:
  1. Go to Railway dashboard
  2. Select your project
  3. Project ID in URL: `https://railway.app/project/{PROJECT_ID}`
- **Required**: ✗ No (useful if multiple projects)

## Optional Secrets (For Enhanced Features)

### AWS Credentials (if using S3)
```
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
S3_BUCKET_NAME
```

### Email Service (SendGrid)
```
SENDGRID_API_KEY
```

### Slack Notifications
```
SLACK_WEBHOOK_URL
```

## Testing Secrets

Verify secrets are set correctly by checking GitHub Actions run logs:
```
Settings → Actions → General → Workflow permissions
```

## Security Best Practices

1. **Rotate Tokens Regularly**
   - Change `RAILWAY_TOKEN` every 90 days
   - Revoke old tokens in Railway dashboard

2. **Use Read-Only Credentials**
   - For S3: Use IAM credentials with minimal permissions
   - For API tokens: Use service-specific tokens when available

3. **Never Commit Secrets**
   - Use `.env.local` for local development
   - Never add `.env` to git

4. **Audit Access**
   - Check GitHub Actions runs for failures
   - Monitor Railway deployments for unusual activity

## Deployment Workflow

When you push to `main`:

1. GitHub Actions runs CI/CD pipeline (`.github/workflows/ci-cd.yml`)
2. Tests and linting pass
3. Build succeeds
4. (Optional) Auto-deploy to Railway using `RAILWAY_TOKEN`

## Troubleshooting

### Deployment Fails with "Invalid Token"
- Check `RAILWAY_TOKEN` is current
- Regenerate token in Railway dashboard
- Update GitHub secret

### Secrets Not Loading in Actions
- Verify secret name matches workflow file
- Check Actions runner has access
- Review branch protection rules

### Rate Limiting Issues
- Railway API has rate limits
- Wait before retrying failed deployments
- Contact Railway support if limit exceeded

## References

- Railway Documentation: https://docs.railway.app
- GitHub Secrets Docs: https://docs.github.com/en/actions/security-guides/encrypted-secrets
- Railway Tokens: https://railway.app/account/tokens
