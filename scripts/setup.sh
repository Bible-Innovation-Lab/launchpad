#!/usr/bin/env bash
#
# scripts/setup.sh — first-time provisioning for a freshly forked launchpad.
#
# What it does:
#   1. Detects the repo from `git remote` (no gh-cli needed)
#   2. Prompts for an app-id (subdomain-safe slug)
#   3. Walks the GitHub OAuth device flow to get a short-lived access token
#      scoped to read:org — the student never sees a token in their .env
#   4. Writes app.config.json
#   5. Calls the BIL provisioning service to import this repo into Vercel,
#      attach <app-id>.bibleinnovationlab.org, and inject env vars
#   6. Prints the live URL and opens it in your default browser
#
# Run once per repo. Re-running is safe (provisioning service is idempotent
# on the same repo + app-id).

set -euo pipefail

# Public BIL OAuth App client ID (NOT a secret — it identifies the OAuth app
# to GitHub but does not grant any access on its own). Override with
# BIL_OAUTH_CLIENT_ID=... for testing against a different app.
BIL_OAUTH_CLIENT_ID_DEFAULT="Ov23li4A72C4iVmRkkbX"
BIL_OAUTH_CLIENT_ID="${BIL_OAUTH_CLIENT_ID:-$BIL_OAUTH_CLIENT_ID_DEFAULT}"

PROVISIONING_URL="${BIL_PROVISIONING_URL:-https://provisioning.bibleinnovationlab.org/provision}"

# Colors (only if stdout is a tty)
if [ -t 1 ]; then
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  RED=$'\033[31m'
  BOLD=$'\033[1m'
  DIM=$'\033[2m'
  RESET=$'\033[0m'
else
  GREEN= YELLOW= RED= BOLD= DIM= RESET=
fi

# --- Prerequisites -----------------------------------------------------------

require() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "${RED}ERROR${RESET}: '$1' is required but not installed."
    case "$1" in
      bun) echo "  Install: curl -fsSL https://bun.sh/install | bash" ;;
      jq)  echo "  Install: brew install jq" ;;
      curl) echo "  Install: pre-installed on macOS; on Linux: apt install curl" ;;
    esac
    exit 1
  fi
}

require bun
require curl
require jq

# --- Repo detection ----------------------------------------------------------

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "${RED}ERROR${RESET}: setup.sh must be run from inside the cloned repo."
  exit 1
fi

# Parse owner/name out of `git remote get-url origin` — handles both
# https://github.com/owner/repo(.git)? and git@github.com:owner/repo(.git)?
ORIGIN_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$ORIGIN_URL" ]; then
  echo "${RED}ERROR${RESET}: no 'origin' git remote found. This script must run from a fork."
  exit 1
fi

REPO_FULL_NAME=$(echo "$ORIGIN_URL" \
  | sed -E 's#^https?://[^/]+/##; s#^git@[^:]+:##; s#\.git$##')

if ! [[ "$REPO_FULL_NAME" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]]; then
  echo "${RED}ERROR${RESET}: couldn't parse 'owner/repo' from origin URL: $ORIGIN_URL"
  exit 1
fi

echo "${BOLD}BIL Launchpad — setup${RESET}"
echo "Repo: $REPO_FULL_NAME"
echo ""

# --- App-id prompt -----------------------------------------------------------

DEFAULT_APPID=$(echo "$REPO_FULL_NAME" | cut -d/ -f2 | tr '[:upper:]' '[:lower:]' | tr '_' '-')
read -r -p "App id [${DEFAULT_APPID}]: " APP_ID
APP_ID=${APP_ID:-$DEFAULT_APPID}

if ! [[ "$APP_ID" =~ ^[a-z][a-z0-9-]{2,30}$ ]]; then
  echo "${RED}ERROR${RESET}: app-id must match ^[a-z][a-z0-9-]{2,30}$ (lowercase, dashes only, 3-31 chars)."
  exit 1
fi

# Denylist — keep in sync with bil-provisioning/lib/validation.ts (server is
# authoritative; this just gives a faster error before the round-trip).
case "$APP_ID" in
  www|api|admin|app|auth|mail|ftp|blog|docs|status|dashboard|youversion|yv|bibleinnovationlab|bil|internal|staging|dev|test|demo|hello|help|contact|about|login|signin|signup|register|public|private|root|system|provisioning)
    echo "${RED}ERROR${RESET}: '$APP_ID' is reserved. Pick a different name."
    exit 1
    ;;
esac

# --- Write app.config.json ---------------------------------------------------

cat > app.config.json <<EOF
{
  "app_id": "$APP_ID",
  "repo": "$REPO_FULL_NAME",
  "subdomain": "${APP_ID}.bibleinnovationlab.org"
}
EOF
echo "${GREEN}✓${RESET} Wrote app.config.json"
echo ""

# --- GitHub OAuth device flow -----------------------------------------------
#
# Why device flow: students don't need to install/configure gh-cli, don't need
# a shared bearer token in the launchpad, and the token they get is short-
# lived (8 hours default) and scoped to read:org only. The OAuth app client
# secret stays on the bil-provisioning server side and never touches student
# machines.

echo "${BOLD}Authorize with GitHub${RESET} (one-time per setup run)"
echo ""

DEVICE_RESPONSE=$(curl -sS -X POST https://github.com/login/device/code \
  -H "Accept: application/json" \
  -d "client_id=$BIL_OAUTH_CLIENT_ID" \
  -d "scope=read:org")

DEVICE_CODE=$(echo "$DEVICE_RESPONSE" | jq -r '.device_code // empty')
USER_CODE=$(echo "$DEVICE_RESPONSE" | jq -r '.user_code // empty')
VERIFY_URI=$(echo "$DEVICE_RESPONSE" | jq -r '.verification_uri // empty')
# GitHub returns interval in seconds; we must honour it (and slow_down).
POLL_INTERVAL=$(echo "$DEVICE_RESPONSE" | jq -r '.interval // 5')
EXPIRES_IN=$(echo "$DEVICE_RESPONSE" | jq -r '.expires_in // 900')

if [ -z "$DEVICE_CODE" ] || [ -z "$USER_CODE" ] || [ -z "$VERIFY_URI" ]; then
  echo "${RED}ERROR${RESET}: GitHub didn't return a device code. Response:"
  echo "$DEVICE_RESPONSE"
  exit 1
fi

echo "  1. Open: ${BOLD}$VERIFY_URI${RESET}"
echo "  2. Enter code: ${BOLD}$USER_CODE${RESET}"
echo ""
echo "  ${DIM}(Code expires in $((EXPIRES_IN / 60)) min. Polling every ${POLL_INTERVAL}s...)${RESET}"

# Open the verification URL in the browser if possible.
if command -v open >/dev/null 2>&1; then
  open "$VERIFY_URI" 2>/dev/null || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$VERIFY_URI" 2>/dev/null || true
fi

# Poll the token endpoint until we get an access_token, error out, or expire.
DEADLINE=$(( $(date +%s) + EXPIRES_IN ))
ACCESS_TOKEN=""
while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  sleep "$POLL_INTERVAL"
  TOKEN_RESPONSE=$(curl -sS -X POST https://github.com/login/oauth/access_token \
    -H "Accept: application/json" \
    -d "client_id=$BIL_OAUTH_CLIENT_ID" \
    -d "device_code=$DEVICE_CODE" \
    -d "grant_type=urn:ietf:params:oauth:grant-type:device_code")

  ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token // empty')
  if [ -n "$ACCESS_TOKEN" ]; then
    break
  fi

  ERROR=$(echo "$TOKEN_RESPONSE" | jq -r '.error // empty')
  case "$ERROR" in
    authorization_pending) ;; # keep polling silently
    slow_down)
      # GitHub asks us to back off. The new interval is in the response.
      POLL_INTERVAL=$(echo "$TOKEN_RESPONSE" | jq -r '.interval // (.interval + 5)')
      ;;
    access_denied)
      echo "${RED}ERROR${RESET}: you denied the authorization request. Re-run setup.sh to try again."
      exit 1
      ;;
    expired_token)
      echo "${RED}ERROR${RESET}: device code expired before authorization. Re-run setup.sh."
      exit 1
      ;;
    unsupported_grant_type|incorrect_client_credentials|incorrect_device_code)
      echo "${RED}ERROR${RESET}: GitHub rejected the device flow (${ERROR})."
      echo "Likely a bug in setup.sh or a mis-configured OAuth app. Open an issue."
      exit 1
      ;;
    "")
      echo "${YELLOW}WARN${RESET}: unexpected GitHub response — $TOKEN_RESPONSE"
      ;;
    *)
      echo "${RED}ERROR${RESET}: GitHub returned error '$ERROR'."
      exit 1
      ;;
  esac
done

if [ -z "$ACCESS_TOKEN" ]; then
  echo "${RED}ERROR${RESET}: timed out waiting for authorization. Re-run setup.sh."
  exit 1
fi

echo ""
echo "${GREEN}✓${RESET} Authorized"
echo ""

# --- Call provisioning service ----------------------------------------------

echo "Calling provisioning service at $PROVISIONING_URL ..."
echo "${DIM}(Imports the repo into Vercel, attaches the subdomain, sets env vars.)${RESET}"

RESPONSE=$(curl -sS -w "\n%{http_code}" \
  -X POST "$PROVISIONING_URL" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"repo\":\"$REPO_FULL_NAME\",\"app_id\":\"$APP_ID\"}" \
  || echo -e "\nCURL_FAILED")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "CURL_FAILED" ] || [ -z "$HTTP_CODE" ]; then
  echo ""
  echo "${YELLOW}WARN${RESET}: couldn't reach provisioning service."
  echo ""
  echo "Fallback: ask the BIL platform team to provision manually:"
  echo "  - Import $REPO_FULL_NAME into the BIL Vercel team"
  echo "  - Attach domain: ${APP_ID}.bibleinnovationlab.org"
  echo "  - Set env vars: APP_ID=$APP_ID, POSTHOG_KEY=<team key>"
  exit 1
fi

case "$HTTP_CODE" in
  200|201)
    URL=$(echo "$BODY" | jq -r '.url // empty')
    if [ -z "$URL" ]; then URL="https://${APP_ID}.bibleinnovationlab.org"; fi
    echo ""
    echo "${GREEN}════════════════════════════════════════════════════════════${RESET}"
    echo "${GREEN}  ✓ Live at: $URL${RESET}"
    echo "${GREEN}════════════════════════════════════════════════════════════${RESET}"
    echo ""
    echo "Next steps:"
    echo "  • Edit ${BOLD}app/page.tsx${RESET} — that's your home page"
    echo "  • Run ${BOLD}bun run dev${RESET} to develop locally"
    echo "  • Read ${BOLD}docs/RECIPES.md${RESET} for common patterns"
    echo ""
    # Open the live URL
    if command -v open >/dev/null 2>&1; then open "$URL"; fi
    ;;
  409)
    # already_provisioned (same repo / same app-id) — friendly re-run path.
    URL=$(echo "$BODY" | jq -r '.url // empty')
    PROJECT=$(echo "$BODY" | jq -r '.project_id // empty')
    if [ -z "$URL" ]; then URL="https://${APP_ID}.bibleinnovationlab.org"; fi
    echo ""
    echo "${YELLOW}Already provisioned${RESET}: $URL (project: $PROJECT)"
    echo "${DIM}No-op — this repo + app-id is already wired up.${RESET}"
    if command -v open >/dev/null 2>&1; then open "$URL"; fi
    ;;
  401)
    echo "${RED}PROVISIONING_401${RESET}: authentication failed."
    echo "$BODY" | jq -r '.error // .message // .' 2>/dev/null || echo "$BODY"
    echo ""
    echo "The OAuth token GitHub gave us was rejected. Re-run setup.sh."
    exit 1
    ;;
  403)
    echo "${RED}PROVISIONING_403${RESET}: not authorized."
    echo "$BODY" | jq -r '.error // .message // .' 2>/dev/null || echo "$BODY"
    echo ""
    echo "Likely causes:"
    echo "  - You're not a member of the Bible-Innovation-Lab GitHub org"
    echo "  - Your GitHub account hasn't accepted the org invite yet"
    exit 1
    ;;
  400)
    echo "${RED}Provisioning rejected${RESET}: $BODY"
    exit 1
    ;;
  *)
    echo "${RED}Unexpected response ($HTTP_CODE)${RESET}: $BODY"
    echo "See docs/TROUBLESHOOTING.md."
    exit 1
    ;;
esac
