"""
handler.py — AWS Lambda entry point for the portfolio chat API.
Origin/CORS enforcement is handled entirely by API Gateway.
Lambda focuses purely on validation and Bedrock invocation.
"""

import json
import logging
import os

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ── Config ──────────────────────────────────────────────────────────────────
ALLOWED_ORIGIN  = os.environ.get("ALLOWED_ORIGIN", "https://ravikiranrachakonda.github.io")
MODEL           = os.environ.get("MODEL_ID", "us.anthropic.claude-haiku-4-5-20251001-v1:0")
MAX_TOKENS      = 1024
MAX_MSG_HISTORY = 10

# ── Bedrock client — reused across warm invocations ─────────────────────────
bedrock = boto3.client("bedrock-runtime")


# ── CORS + response helpers ──────────────────────────────────────────────────
def cors_headers() -> dict:
    return {
        "Access-Control-Allow-Origin":  ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    }


def make_response(status: int, body: dict) -> dict:
    return {
        "statusCode": status,
        "headers":    {**cors_headers(), "Content-Type": "application/json"},
        "body":       json.dumps(body),
    }


# ── Validation ───────────────────────────────────────────────────────────────
def validate_body(event: dict) -> tuple[dict | None, str]:
    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return None, "Invalid JSON body"

    messages = body.get("messages", [])
    system   = body.get("system", "")

    if not isinstance(messages, list) or not messages:
        return None, "messages must be a non-empty list"
    if not isinstance(system, str):
        return None, "system must be a string"

    clean_messages = [
        {"role": m["role"], "content": str(m["content"])[:4000]}
        for m in messages[-MAX_MSG_HISTORY:]
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]

    if not clean_messages:
        return None, "No valid messages after sanitization"

    return {"messages": clean_messages, "system": system[:8000]}, ""


# ── Lambda handler ───────────────────────────────────────────────────────────
def handler(event: dict, context) -> dict:
    logger.info(f"Request: method={event.get('httpMethod')} path={event.get('path')}")

    # Handle CORS preflight
    if event.get("httpMethod") == "OPTIONS":
        return make_response(200, {})

    # Validate request body
    body, err = validate_body(event)
    if err:
        return make_response(400, {"error": err})

    # Call Bedrock
    try:
        bedrock_body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens":        MAX_TOKENS,
            "system":            body["system"],
            "messages":          body["messages"],
        }

        bedrock_response = bedrock.invoke_model(
            modelId     = MODEL,
            body        = json.dumps(bedrock_body),
            contentType = "application/json",
            accept      = "application/json",
        )

        result      = json.loads(bedrock_response["body"].read())
        text_output = result["content"][0]["text"]

        logger.info(f"Bedrock response received — {len(text_output)} chars")

        return make_response(200, {"content": [{"type": "text", "text": text_output}]})

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg  = e.response.get("Error", {}).get("Message", str(e))
        logger.error(f"Bedrock ClientError [{error_code}]: {error_msg}")
        return make_response(502, {"error": "Upstream API error",
                                   "detail": f"{error_code}: {error_msg}"})

    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return make_response(500, {"error": "Internal server error"})
