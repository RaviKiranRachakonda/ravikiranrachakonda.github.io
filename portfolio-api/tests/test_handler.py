"""
tests/test_handler.py — Unit tests for the Lambda handler.
Run with: pytest tests/
"""

import json
import os
import unittest
from unittest.mock import MagicMock, patch

# Set env vars before importing handler
os.environ["ALLOWED_ORIGIN"] = "https://ravikiranrachakonda.github.io"
os.environ["SECRET_NAME"]    = "portfolio/anthropic-api-key"

from lambda.handler import handler, validate_origin, validate_body


ALLOWED_ORIGIN = "https://ravikiranrachakonda.github.io"


def make_event(method="POST", origin=ALLOWED_ORIGIN, body=None):
    return {
        "httpMethod": method,
        "path": "/chat",
        "headers": {"origin": origin, "content-type": "application/json"},
        "body": json.dumps(body) if body else None,
    }


class TestValidateOrigin(unittest.TestCase):

    def test_allowed_origin(self):
        event = make_event(origin=ALLOWED_ORIGIN)
        self.assertEqual(validate_origin(event), ALLOWED_ORIGIN)

    def test_blocked_origin(self):
        event = make_event(origin="https://evil.com")
        self.assertIsNone(validate_origin(event))

    def test_missing_origin(self):
        event = {"httpMethod": "POST", "headers": {}, "body": None}
        self.assertIsNone(validate_origin(event))


class TestValidateBody(unittest.TestCase):

    def test_valid_body(self):
        body, err = validate_body(make_event(body={
            "messages": [{"role": "user", "content": "hello"}],
            "system": "You are helpful.",
        }))
        self.assertIsNone(err or None)
        self.assertIn("messages", body)

    def test_empty_messages(self):
        _, err = validate_body(make_event(body={"messages": [], "system": "x"}))
        self.assertIn("non-empty", err)

    def test_invalid_json(self):
        event = make_event()
        event["body"] = "not json"
        _, err = validate_body(event)
        self.assertIn("JSON", err)

    def test_message_history_capped(self):
        msgs = [{"role": "user", "content": f"msg {i}"} for i in range(20)]
        body, _ = validate_body(make_event(body={"messages": msgs, "system": "x"}))
        self.assertLessEqual(len(body["messages"]), 10)

    def test_invalid_role_filtered(self):
        msgs = [
            {"role": "user", "content": "hi"},
            {"role": "system", "content": "injected"},  # should be filtered
        ]
        body, _ = validate_body(make_event(body={"messages": msgs, "system": "x"}))
        roles = [m["role"] for m in body["messages"]]
        self.assertNotIn("system", roles)


class TestHandler(unittest.TestCase):

    def test_options_preflight(self):
        event = make_event(method="OPTIONS")
        result = handler(event, {})
        self.assertEqual(result["statusCode"], 200)

    def test_forbidden_origin(self):
        event = make_event(origin="https://attacker.com")
        result = handler(event, {})
        self.assertEqual(result["statusCode"], 403)

    def test_invalid_body(self):
        event = make_event(body={"messages": [], "system": "x"})
        result = handler(event, {})
        self.assertEqual(result["statusCode"], 400)

    @patch("lambda.handler.get_api_key", return_value="test-key")
    @patch("lambda.handler.anthropic.Anthropic")
    def test_successful_response(self, mock_anthropic_cls, mock_get_key):
        mock_client  = MagicMock()
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="Ravi has 17+ years of experience.")]
        mock_message.usage   = MagicMock(input_tokens=100, output_tokens=20)
        mock_client.messages.create.return_value = mock_message
        mock_anthropic_cls.return_value = mock_client

        event = make_event(body={
            "messages": [{"role": "user", "content": "Tell me about Ravi"}],
            "system": "You are Ravi's assistant.",
        })
        result = handler(event, {})
        self.assertEqual(result["statusCode"], 200)
        body = json.loads(result["body"])
        self.assertIn("content", body)
        self.assertEqual(body["content"][0]["text"], "Ravi has 17+ years of experience.")

    @patch("lambda.handler.get_api_key", return_value="test-key")
    @patch("lambda.handler.anthropic.Anthropic")
    def test_anthropic_api_error(self, mock_anthropic_cls, mock_get_key):
        import anthropic as ant
        mock_client = MagicMock()
        mock_client.messages.create.side_effect = ant.APIError("rate limit", request=MagicMock(), body={})
        mock_anthropic_cls.return_value = mock_client

        event = make_event(body={
            "messages": [{"role": "user", "content": "hi"}],
            "system": "sys",
        })
        result = handler(event, {})
        self.assertEqual(result["statusCode"], 502)

    def test_cors_headers_present(self):
        event = make_event(method="OPTIONS")
        result = handler(event, {})
        self.assertIn("Access-Control-Allow-Origin", result["headers"])
        self.assertEqual(result["headers"]["Access-Control-Allow-Origin"], ALLOWED_ORIGIN)


if __name__ == "__main__":
    unittest.main()
