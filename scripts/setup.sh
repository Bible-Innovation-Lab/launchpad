#!/usr/bin/env bash
#
# scripts/setup.sh — first-time provisioning for a freshly forked launchpad.
#
# What it does:
#   1. Prompts for an app-id (subdomain-safe slug)
#   2. Writes it to app.config.json
#   3. Calls the BIL provisioning service to import this repo into Vercel,
#      attach <app-id>.bibleinnovationlab.org, and inject env vars
#   4. Prints the live URL and opens it in your default browser
#
# Run once per repo. Re-running is safe (provisioning service is idempotent).

set -euo pipefail

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
      gh)  echo "  Install: brew install gh   (or see https://cli.github.com)" ;;
      jq)  echo "  Install: brew install jq" ;;
      curl) echo "  Install: pre-installed on macOS; on Linux: apt install curl" ;;
    esac
    exit 1
  fi
}

require bun
require gh
require curl

# --- Repo detection ----------------------------------------------------------

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "${RED}ERROR${RESET}: setup.sh must be run from inside the cloned repo."
  exit 1
fi

REPO_FULL_NAME=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")
if [ -z "$REPO_FULL_NAME" ]; then
  echo "${RED}ERROR${RESET}: couldn't read GitHub repo info. Run 'gh auth login' first."
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

# Denylist
case "$APP_ID" in
  www|api|admin|app|auth|mail|ftp|blog|docs|status|dashboard|youversion|yv|bibleinnovationlab|bil|internal|staging|dev|test|demo)
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

# --- Call provisioning service ----------------------------------------------

PROVISIONING_URL="${BIL_PROVISIONING_URL:-https://provisioning.bibleinnovationlab.org/provision}"
GH_TOKEN=$(gh auth token 2>/dev/null || echo "")

if [ -z "$GH_TOKEN" ]; then
  echo "${RED}ERROR${RESET}: couldn't read GitHub auth token. Run 'gh auth login'."
  exit 1
fi

echo ""
echo "Calling provisioning service at $PROVISIONING_URL ..."
echo "${DIM}(This imports the repo into Vercel, attaches the subdomain, and sets env vars.)${RESET}"

RESPONSE=$(curl -sS -w "\n%{http_code}" \
  -X POST "$PROVISIONING_URL" \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"repo\":\"$REPO_FULL_NAME\",\"app_id\":\"$APP_ID\"}" \
  || echo "CURL_FAILED")

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
  403)
    echo "${RED}PROVISIONING_403${RESET}: not authorized."
    echo "$BODY" | jq -r '.error // .message // .' 2>/dev/null || echo "$BODY"
    echo ""
    echo "Likely causes:"
    echo "  - You're not a member of the Bible-Innovation-Lab GitHub org"
    echo "  - Your gh auth token expired (run: gh auth refresh)"
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
