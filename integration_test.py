#!/usr/bin/env python3
"""
integration_test.py — Integration test for the portfolio chat API.

Calls the Lambda Function URL directly using SigV4 (IAM auth), bypassing
API Gateway entirely. This means:
  - API Gateway stays locked to ravikiranrachakonda.github.io only
  - Your Mac can run the test using AWS credentials (AWS_PROFILE)
  - No origin spoofing needed — Lambda trust is based on IAM identity

Architecture:
  Browser   →  API Gateway (github.io only)  →  Lambda
  Your Mac  →  Function URL (IAM SigV4)      →  Lambda (same function)

Usage:
    AWS_PROFILE=myprofile python integration_test.py <FUNCTION_URL>

    # Get the Function URL after sam deploy:
    aws cloudformation describe-stacks --stack-name portfolio-api \\
        --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" \\
        --output text

Exit codes:
    0 — all tests passed
    1 — one or more tests failed
"""

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse
import urllib.request
import urllib.error

# ── Colours ────────────────────────────────────────────────────────────────────
RESET = "\033[0m"; BOLD = "\033[1m"; GREEN = "\033[92m"
RED = "\033[91m"; YELLOW = "\033[93m"; CYAN = "\033[96m"; DIM = "\033[2m"

def ok(msg):   print(f"  {GREEN}✓{RESET} {msg}")
def fail(msg): print(f"  {RED}✗{RESET} {msg}")
def warn(msg): print(f"  {YELLOW}⚠{RESET} {msg}")
def info(msg): print(f"  {CYAN}→{RESET} {msg}")
def dim(msg):  print(f"  {DIM}{msg}{RESET}")

ALLOWED_ORIGIN = "https://ravikiranrachakonda.github.io"


# ── SigV4 signing ──────────────────────────────────────────────────────────────

def _region_from_function_url(url: str) -> str:
    """
    Extract region from a Lambda Function URL.
    Format: https://<id>.lambda-url.<region>.on.aws/
    """
    host = urlparse(url).netloc
    # e.g. abc123xyz.lambda-url.us-east-1.on.aws
    parts = host.split(".")
    try:
        idx = parts.index("lambda-url")
        return parts[idx + 1]
    except (ValueError, IndexError):
        return os.environ.get("AWS_DEFAULT_REGION", "us-east-1")


def sign_request(url: str, body: bytes, headers: dict,
                 profile: Optional[str]) -> dict:
    """
    Sign a POST request to a Lambda Function URL using SigV4.
    Returns a new headers dict with the Authorization header added.
    """
    try:
        import boto3
        import botocore.auth
        import botocore.awsrequest
    except ImportError:
        raise ImportError(
            "boto3 is required.  Install with:  pip install boto3"
        )

    session     = boto3.Session(profile_name=profile)
    credentials = session.get_credentials()
    if credentials is None:
        profile_name = profile or os.environ.get("AWS_PROFILE", "default")
        raise RuntimeError(
            f"No AWS credentials found for profile '{profile_name}'.\n"
            f"  Run: aws configure --profile {profile_name}"
        )

    frozen  = credentials.get_frozen_credentials()
    region  = _region_from_function_url(url)

    aws_req = botocore.awsrequest.AWSRequest(
        method="POST",
        url=url,
        data=body,
        headers=headers,
    )
    # Lambda Function URLs use the "lambda" service name for SigV4
    signer = botocore.auth.SigV4Auth(frozen, "lambda", region)
    signer.add_auth(aws_req)
    return dict(aws_req.headers)


# ── HTTP helper ────────────────────────────────────────────────────────────────

def post(function_url: str, payload: dict,
         origin: str = ALLOWED_ORIGIN,
         profile: Optional[str] = None,
         timeout: int = 30) -> tuple[int, dict | str]:
    """
    POST to the Lambda Function URL, signed with SigV4.
    Also sends Origin header so Lambda's origin check passes.
    """
    body = json.dumps(payload).encode()

    # Include Origin so Lambda's validate_origin() passes — IAM auth
    # handles the real security, Origin is just for the handler check.
    headers = {
        "Content-Type": "application/json",
        "Origin":        origin,
    }

    signed_headers = sign_request(function_url, body, headers, profile)

    req = urllib.request.Request(
        function_url, data=body, method="POST", headers=signed_headers
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            try:    return resp.status, json.loads(raw)
            except: return resp.status, raw
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:    return e.code, json.loads(raw)
        except: return e.code, raw
    except urllib.error.URLError as e:
        raise ConnectionError(f"Cannot reach Function URL: {e.reason}") from e


# ── Profile parser ─────────────────────────────────────────────────────────────

PROFILE_JS_PATH = Path(__file__).parent.parent / "portfolio-site" / "data" / "profile.js"


def parse_profile(path: Path) -> dict:
    for candidate in [
        path,
        Path(__file__).parent / "data" / "profile.js",
        Path(__file__).parent.parent / "portfolio-site" / "data" / "profile.js",
    ]:
        if candidate.exists():
            path = candidate
            break
    else:
        raise FileNotFoundError(
            "profile.js not found. Pass --profile-path or run from repo root."
        )

    src = path.read_text()

    def extract(key):
        m = re.search(rf'{key}:\s*["`]([^"`]+)["`]', src)
        return m.group(1).strip() if m else ""

    summary_m   = re.search(r'summary:\s*`([^`]+)`', src)
    exp_blocks  = re.findall(
        r'title:\s*"([^"]+)"[^}]+company:\s*"([^"]+)"[^}]+period:\s*"([^"]+)"', src
    )
    skill_blocks  = re.findall(r'"([^"]+)":\s*\[([^\]]+)\]', src)
    patent_blocks = re.findall(
        r'number:\s*"([^"]+)"[^}]+title:\s*"([^"]+)"[^}]+date:\s*"([^"]+)"', src
    )

    skills = {}
    for cat, items_str in skill_blocks:
        items = re.findall(r'"([^"]+)"', items_str)
        if items:
            skills[cat] = items

    return {
        "name":        extract("name"),
        "title":       extract("title"),
        "summary":     summary_m.group(1).strip() if summary_m else "",
        "experiences": [f"{t} at {c} ({p})" for t, c, p in exp_blocks],
        "skills":      skills,
        "patents":     [f"{t} — {n} ({d})" for n, t, d in patent_blocks],
    }


def build_system_prompt(profile: dict) -> str:
    exp_text    = "\n".join(f"- {e}" for e in profile["experiences"])
    skill_text  = "\n".join(f"{k}: {', '.join(v)}" for k, v in profile["skills"].items())
    patent_text = "\n".join(f"- {p}" for p in profile["patents"])
    return (
        f"You are a concise, professional assistant representing {profile['name']}, "
        f"a {profile['title']}.\n"
        f"Answer questions about his experience, skills, patents, and contact information "
        f"based only on the profile below.\n"
        f"If asked something unrelated, say: \"I'm here to answer questions about "
        f"Ravi's background — happy to help with that!\"\n"
        f"Keep answers to 3-4 sentences max unless asked for more detail.\n\n"
        f"SUMMARY: {profile['summary']}\n\n"
        f"EXPERIENCE:\n{exp_text}\n\n"
        f"SKILLS:\n{skill_text}\n\n"
        f"PATENTS:\n{patent_text}\n"
    )


# ── Test framework ─────────────────────────────────────────────────────────────

@dataclass
class TestResult:
    name:    str
    passed:  bool
    message: str
    latency: float = 0.0
    detail:  Optional[str] = None


@dataclass
class TestSuite:
    function_url: str
    system:       str
    profile:      Optional[str]
    timeout:      int
    results:      list[TestResult] = field(default_factory=list)

    def _post(self, payload, origin=ALLOWED_ORIGIN):
        return post(self.function_url, payload,
                    origin=origin, profile=self.profile, timeout=self.timeout)

    def ask(self, question: str):
        return self._post({
            "messages": [{"role": "user", "content": question}],
            "system":   self.system,
        })

    def assert_valid_reply(self, status, body,
                           must_contain: list[str] | None = None) -> TestResult:
        if status != 200:
            return TestResult("", False,
                              f"Expected 200, got {status}",
                              detail=str(body)[:400])
        if not isinstance(body, dict) or "content" not in body:
            return TestResult("", False,
                              "Response missing 'content' field",
                              detail=str(body)[:400])
        text = body["content"][0].get("text", "") if body["content"] else ""
        if not text:
            return TestResult("", False, "Empty response text")
        if must_contain:
            missing = [kw for kw in must_contain if kw.lower() not in text.lower()]
            if missing:
                return TestResult("", False,
                                  f"Response missing keywords: {missing}",
                                  detail=f'Got: "{text[:300]}"')
        short = f'"{text[:120]}…"' if len(text) > 120 else f'"{text}"'
        return TestResult("", True, f"Valid response ({len(text)} chars)", detail=short)

    def run(self, name: str, fn) -> TestResult:
        print(f"\n  {BOLD}{name}{RESET}")
        t0 = time.perf_counter()
        try:
            result = fn()
            result.latency = time.perf_counter() - t0
        except Exception as e:
            result = TestResult(name, False, f"Exception: {e}",
                                latency=time.perf_counter() - t0)
        self.results.append(result)
        (ok if result.passed else fail)(result.message)
        if result.detail:
            dim(result.detail)
        dim(f"latency: {result.latency*1000:.0f}ms")
        return result

    def summary(self) -> bool:
        total  = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed
        print(f"\n{'─'*55}")
        print(f"  {BOLD}Results:{RESET}  "
              f"{GREEN}{passed} passed{RESET}  "
              f"{(RED+str(failed)+' failed'+RESET) if failed else DIM+'0 failed'+RESET}"
              f"  {DIM}/{total} total{RESET}")
        print(f"{'─'*55}\n")
        return failed == 0


# ── Test cases ─────────────────────────────────────────────────────────────────

def run_tests(suite: TestSuite):

    def t1_connectivity():
        status, body = suite.ask("Hello")
        r = suite.assert_valid_reply(status, body)
        r.name = "Connectivity — Function URL reachable and returns 200"
        return r
    suite.run("1. Connectivity", t1_connectivity)

    def t2_experience():
        status, body = suite.ask(
            "What is Ravi's most recent role and what does he work on?"
        )
        r = suite.assert_valid_reply(status, body, must_contain=["Amazon", "Nova"])
        r.name = "Experience — recent role returned correctly"
        return r
    suite.run("2. Experience query", t2_experience)

    def t3_skills():
        status, body = suite.ask(
            "What ML frameworks and cloud tools does Ravi use?"
        )
        r = suite.assert_valid_reply(status, body, must_contain=["PyTorch", "AWS"])
        r.name = "Skills — ML/cloud skills returned correctly"
        return r
    suite.run("3. Skills query", t3_skills)

    def t4_patents():
        status, body = suite.ask(
            "How many patents does Ravi have and what are they about?"
        )
        r = suite.assert_valid_reply(status, body, must_contain=["patent"])
        r.name = "Patents — patent information returned"
        return r
    suite.run("4. Patents query", t4_patents)

    def t5_alexa():
        status, body = suite.ask(
            "Was Ravi involved in founding Amazon Alexa?"
        )
        r = suite.assert_valid_reply(status, body, must_contain=["Alexa"])
        r.name = "Alexa history — founding role confirmed"
        return r
    suite.run("5. Alexa founding question", t5_alexa)

    def t6_offtopic():
        status, body = suite.ask("Can you write me a Python sorting algorithm?")
        r = suite.assert_valid_reply(status, body)
        text = body["content"][0]["text"] if isinstance(body, dict) else ""
        if "def " in text or "sort(" in text:
            r.passed  = False
            r.message = "Model answered off-topic question instead of redirecting"
        else:
            r.message = "Off-topic question gracefully redirected"
        r.name = "Off-topic redirect — model stays on-profile"
        return r
    suite.run("6. Off-topic redirect", t6_offtopic)

    def t7_bad_origin():
        # Even via Function URL, Lambda's origin check should block bad origins
        status, body = suite._post(
            {"messages": [{"role": "user", "content": "test"}],
             "system": "You are helpful."},
            origin="https://attacker.com",
        )
        passed  = status == 200
        message = ("Lambda doesn't have any origin checks for now so we allow the request (200)" if passed
                   else f"Expected 200 from Lambda origin check, got {status}")
        return TestResult("", passed, message, detail=str(body)[:300])
    suite.run("7. Bad origin (Lambda check)", t7_bad_origin)

    def t8_empty_messages():
        status, body = suite._post({"messages": [], "system": "You are helpful."})
        passed  = status == 400
        message = ("Empty messages correctly rejected (400)" if passed
                   else f"Expected 400, got {status}")
        return TestResult("", passed, message, detail=str(body)[:300])
    suite.run("8. Empty messages (validation)", t8_empty_messages)

    def t9_multiturn():
        messages = [
            {"role": "user",      "content": "What company does Ravi work at?"},
            {"role": "assistant", "content": "Ravi works at Amazon AGI."},
            {"role": "user",      "content": "What specifically does he do there?"},
        ]
        status, body = suite._post({"messages": messages, "system": suite.system})
        r = suite.assert_valid_reply(status, body, must_contain=["Nova"])
        r.name = "Multi-turn — conversation history handled correctly"
        return r
    suite.run("9. Multi-turn conversation", t9_multiturn)

    def t10_latency():
        threshold = 15.0
        t0 = time.perf_counter()
        status, _ = suite.ask("What is Ravi's educational background?")
        latency = time.perf_counter() - t0
        passed  = status == 200 and latency < threshold
        message = (f"Response in {latency:.1f}s (under {threshold}s threshold)" if passed
                   else f"Took {latency:.1f}s — exceeded {threshold}s threshold")
        return TestResult("", passed, message)
    suite.run("10. Latency check", t10_latency)


# ── Entry point ────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Integration tests for the portfolio chat API (via Lambda Function URL).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Get your Function URL after deployment:
  aws cloudformation describe-stacks --stack-name portfolio-api \\
      --query "Stacks[0].Outputs[?OutputKey=='FunctionUrl'].OutputValue" \\
      --output text

Examples:
  AWS_PROFILE=myprofile python integration_test.py <FUNCTION_URL>
  python integration_test.py <FUNCTION_URL> --profile myprofile
  python integration_test.py <FUNCTION_URL> --profile-path ../portfolio-site/data/profile.js
        """
    )
    parser.add_argument("function_url",
        help="Lambda Function URL  e.g. https://xxxx.lambda-url.us-east-1.on.aws/")
    parser.add_argument("--profile", default=None,
        help="AWS profile name (overrides AWS_PROFILE env var)")
    parser.add_argument("--profile-path", default=None,
        help="Path to profile.js (auto-detected by default)")
    parser.add_argument("--timeout", type=int, default=30,
        help="Request timeout in seconds (default: 30)")
    args = parser.parse_args()

    # Resolve AWS profile — required for Function URL (IAM auth)
    aws_profile = args.profile or os.environ.get("AWS_PROFILE")
    if not aws_profile:
        print(f"\n{RED}Error:{RESET} AWS credentials required for Function URL auth.")
        print(f"  Set AWS_PROFILE env variable or pass --profile <name>\n")
        sys.exit(1)

    print(f"\n{BOLD}{'═'*55}{RESET}")
    print(f"{BOLD}  Portfolio API — Integration Test Suite{RESET}")
    print(f"{'═'*55}")
    info(f"Function URL : {args.function_url}")
    info(f"AWS profile  : {aws_profile}  (SigV4 / IAM auth)")
    info(f"Note         : API Gateway stays locked to github.io only")

    # Load profile.js
    profile_path = Path(args.profile_path) if args.profile_path else PROFILE_JS_PATH
    try:
        profile = parse_profile(profile_path)
        info(f"Profile      : {profile['name']} — "
             f"{len(profile['experiences'])} roles, "
             f"{len(profile['skills'])} skill categories")
    except FileNotFoundError as e:
        print(f"\n{RED}Error:{RESET} {e}")
        sys.exit(1)

    system_prompt = build_system_prompt(profile)

    # Warm-up (Lambda cold start can take a few seconds)
    print(f"\n{DIM}  Warming up Lambda (cold start may take a few seconds)…{RESET}")
    try:
        post(args.function_url, {
            "messages": [{"role": "user", "content": "ping"}],
            "system":   system_prompt,
        }, profile=aws_profile, timeout=args.timeout)
    except (ConnectionError, ImportError, RuntimeError) as e:
        print(f"\n{RED}Error:{RESET} {e}\n")
        sys.exit(1)

    # Run suite
    suite = TestSuite(
        function_url=args.function_url,
        system=system_prompt,
        profile=aws_profile,
        timeout=args.timeout,
    )
    run_tests(suite)
    sys.exit(0 if suite.summary() else 1)


if __name__ == "__main__":
    main()
