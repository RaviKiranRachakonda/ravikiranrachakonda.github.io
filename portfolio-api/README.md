# portfolio-api

AI chat backend for [ravikiranrachakonda.github.io](https://ravikiranrachakonda.github.io)

**Stack:** Python · AWS Lambda · API Gateway · Secrets Manager · SAM · Anthropic Claude

---

## Architecture

```
Browser (chat.js)
    │
    │ POST /chat  (Origin: ravikiranrachakonda.github.io)
    ▼
API Gateway  ──── CORS policy + Resource policy (layer 1 & 2)
    │
    ▼
Lambda (handler.py)  ──── Origin validation (layer 3)
    │                ──── CloudWatch logs
    │
    ├──► Secrets Manager  (ANTHROPIC_API_KEY)
    │
    └──► Anthropic API (claude-sonnet-4)
```

**Security — 3 layers of access control:**
1. **CORS policy** — API Gateway only accepts requests from the allowed origin
2. **Resource policy** — AWS-level enforcement, blocks non-browser clients
3. **Lambda validation** — double-checks origin header inside the function

---

## Repo Structure

```
portfolio-api/
├── lambda/
│   ├── handler.py          # Lambda entry point + business logic
│   └── requirements.txt    # anthropic, boto3
├── infrastructure/
│   └── template.yaml       # SAM template (API Gateway + Lambda + IAM)
├── tests/
│   └── test_handler.py     # Unit tests (pytest)
└── README.md
```

---

## Setup & Deploy

### Prerequisites
- AWS CLI configured (`aws configure`)
- SAM CLI installed (`brew install aws-sam-cli`)
- Python 3.12+

### 1. Store your Anthropic API key in Secrets Manager
```bash
aws secretsmanager create-secret \
  --name portfolio/anthropic-api-key \
  --secret-string '{"ANTHROPIC_API_KEY":"sk-ant-YOUR_KEY_HERE"}'
```

### 2. Build & deploy
```bash
cd infrastructure
sam build
sam deploy --guided
```

SAM will prompt you for stack name, region, and parameters. On completion it prints:
```
Outputs:
  ApiEndpoint = https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/chat
```

### 3. Paste the endpoint into your frontend
In `portfolio-site/js/main.js`:
```js
const CONFIG = {
  API_ENDPOINT: "https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/prod/chat",
};
```

---

## Running Tests
```bash
pip install pytest anthropic boto3
pytest tests/ -v
```

---

## Updating the Lambda
```bash
cd infrastructure
sam build && sam deploy
```

Changes go live in ~30 seconds.

---

## Cost Estimate (portfolio traffic)
| Service | Free tier | Est. cost |
|---|---|---|
| Lambda | 1M requests/mo | $0 |
| API Gateway | 1M requests/mo (12 mo) | $0 |
| Secrets Manager | — | ~$0.40/mo |
| Anthropic API | — | ~$0.01–0.10/mo |

**Total: < $1/month**
