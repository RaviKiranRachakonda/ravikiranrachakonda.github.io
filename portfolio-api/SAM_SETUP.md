# SAM CLI Setup Guide

Step-by-step to get from zero to a deployed Lambda. Takes ~20 minutes.

**Architecture overview:**
```
Browser (ravikiranrachakonda.github.io)
    │
    ▼
API Gateway  ←── CORS + rate limiting (locked to github.io)
    │
    ▼
Lambda  ──►  AWS Bedrock (Claude)
                 ↑
            IAM role auth — no API keys needed
```

No Secrets Manager. No Anthropic API keys. Auth is handled entirely via the Lambda's IAM role.

---

## Step 1 — Install Prerequisites

### AWS CLI
```bash
# macOS
brew install awscli

# Verify
aws --version
```

### SAM CLI
```bash
# macOS (recommended)
brew tap aws/tap
brew install aws-sam-cli

# Verify
sam --version
# Should print: SAM CLI, version 1.x.x
```

### Docker (required by SAM for local testing)
Download from docker.com/products/docker-desktop and install.

---

## Step 2 — Configure AWS CLI

You'll need an IAM user with programmatic access.

**In the AWS Console:**
1. Go to **IAM → Users → Create user**
2. Name it `portfolio-deploy`
3. Attach policy: `AdministratorAccess` (or a scoped policy for Lambda + API Gateway + Bedrock + IAM + CloudWatch)
4. Go to **Security credentials → Create access key**
5. Choose **CLI** use case
6. Download the CSV — you won't see the secret again

**Back in your terminal:**
```bash
aws configure --profile portfolio
# AWS Access Key ID: paste from CSV
# AWS Secret Access Key: paste from CSV
# Default region: us-east-1  (or your preferred region)
# Default output format: json
```

Verify it works:
```bash
aws sts get-caller-identity --profile portfolio
# Should print your account ID and user ARN
```

---

## Step 3 — Enable Bedrock Model Access

Lambda calls AWS Bedrock directly using its IAM role — no API keys needed. But you do need to enable the Claude model in your AWS account first (one-time setup).

**Enable model access in the AWS Console:**
1. Go to **AWS Console → Bedrock → Model access**
2. Click **Manage model access** (or **Enable specific models**)
3. Find **Anthropic → Claude Haiku** and check the box
4. Click **Submit**
5. Wait 1-2 minutes — status changes to **Access granted**

**Enable via CLI (if you have marketplace permissions):**
```bash
# List available offer tokens
aws bedrock list-foundation-model-agreement-offers \
  --model-id anthropic.claude-haiku-4-5-20251001-v1:0 \
  --profile portfolio \
  --output json

# Accept the agreement using the offer token from above
aws bedrock create-foundation-model-agreement \
  --model-id anthropic.claude-haiku-4-5-20251001-v1:0 \
  --offer-token <offer-token-from-above> \
  --profile portfolio
```

**Verify access:**
```bash
aws bedrock list-foundation-models \
  --by-provider Anthropic \
  --region us-east-1 \
  --profile portfolio \
  --query "modelSummaries[?contains(modelId,'haiku')].{ID:modelId,Status:modelLifecycle.status}" \
  --output table
```

Look for `ACTIVE` status. Note: newer Claude models (3.5+) require an **inference profile** —
use `us.anthropic.claude-haiku-4-5-20251001-v1:0` (note the `us.` prefix) as the `MODEL_ID`.

---

## Step 4 — Deploy

```bash
cd portfolio-api/infrastructure

# Build (packages Lambda + dependencies)
sam build

# First deploy — interactive, saves config to samconfig.toml
sam deploy --guided
```

SAM will ask:

| Prompt | Answer |
|---|---|
| Stack name | `portfolio-api` |
| AWS Region | `us-east-1` |
| AllowedOrigin | `https://ravikiranrachakonda.github.io` |
| Environment | `prod` |
| Confirm changes | `Y` |
| Allow IAM role creation | `Y` |
| Save config | `Y` |

At the end you'll see:
```
Outputs:
  ApiEndpoint  = https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/chat
  FunctionUrl  = https://xxxx.lambda-url.us-east-1.on.aws/
  ChatFunctionArn = arn:aws:lambda:...
```

**Copy both URLs.**

---

## Step 5 — Wire it to the frontend

Open `portfolio-site/js/main.js` and paste the API Gateway URL:

```js
const CONFIG = {
  API_ENDPOINT: "https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/chat",
};
```

Push to GitHub — done. The chat widget on your site is now live.

---

## Step 6 — Run Integration Tests

The integration test targets the **Lambda Function URL** directly (bypasses API Gateway)
using your AWS credentials via SigV4. This keeps API Gateway locked exclusively to the
GitHub Pages domain.

```bash
cd portfolio-api

# Get the Function URL from the deploy output, then:
AWS_PROFILE=portfolio python integration_test.py \
  https://xxxx.lambda-url.us-east-1.on.aws/

# Or fetch it automatically:
FUNCTION_URL=$(aws cloudformation describe-stacks \
  --stack-name portfolio-api \
  --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" \
  --output text --profile portfolio)

AWS_PROFILE=portfolio python integration_test.py $FUNCTION_URL
```

Run this after every `sam deploy` to verify the backend is healthy.

---

## Subsequent Deploys

After the first deploy, future updates are just:
```bash
cd portfolio-api/infrastructure
sam build && sam deploy
```

Then re-run the integration test to confirm everything still works.

---

## Troubleshooting

**502 Upstream API error**
Check CloudWatch logs:
```bash
aws logs tail /aws/lambda/portfolio-chat-prod \
  --since 15m --format short --profile portfolio
```
Common causes:
- Model access not enabled in Bedrock console → go to Step 3
- Wrong `MODEL_ID` — newer models need `us.` prefix for inference profiles
- IAM policy `Resource` ARN doesn't match the model being invoked

**403 from API Gateway**
- Browser `Referer` header must match `https://ravikiranrachakonda.github.io/*`
- Resource policy uses `StringLike` with wildcard to handle trailing slash

**403 from Function URL**
- Must sign requests with SigV4 using valid AWS credentials
- Check `AWS_PROFILE` is set correctly

**Testing Locally (optional)**
```bash
# Requires Docker running
cd portfolio-api/infrastructure
sam local start-api

# In another terminal
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://ravikiranrachakonda.github.io" \
  -d '{"messages":[{"role":"user","content":"What did Ravi work on?"}],"system":"You are Ravis assistant."}'
```
