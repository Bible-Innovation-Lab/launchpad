#!/usr/bin/env bash
#
# scripts/doctor.sh — health check for local + deployed environment.
# Run anytime something feels off.

set -uo pipefail

if [ -t 1 ]; then
  GREEN=$'\033[32m'
  YELLOW=$'\033[33m'
  RED=$'\033[31m'
  RESET=$'\033[0m'
else
  GREEN= YELLOW= RED= RESET=
fi

pass() { echo "  ${GREEN}✓${RESET} $1"; }
warn() { echo "  ${YELLOW}!${RESET} $1"; }
fail() { echo "  ${RED}✗${RESET} $1"; FAILED=1; }

FAILED=0

echo "BIL Launchpad — doctor"
echo ""

# Bun
if command -v bun >/dev/null 2>&1; then
  pass "bun $(bun --version)"
else
  fail "bun not installed (curl -fsSL https://bun.sh/install | bash)"
fi

# Node (Next.js still wants node for some tooling)
if command -v node >/dev/null 2>&1; then
  pass "node $(node --version)"
else
  warn "node not installed (optional but recommended)"
fi

# Git
if command -v git >/dev/null 2>&1; then
  pass "git $(git --version | awk '{print $3}')"
else
  fail "git not installed"
fi

# jq (used by setup.sh to parse GitHub device-flow responses + provisioning responses)
if command -v jq >/dev/null 2>&1; then
  pass "jq $(jq --version)"
else
  fail "jq not installed (needed for setup.sh; brew install jq)"
fi

# curl (used by setup.sh's GitHub OAuth device flow + provisioning call)
if command -v curl >/dev/null 2>&1; then
  pass "curl $(curl --version | head -1 | awk '{print $2}')"
else
  fail "curl not installed (pre-installed on macOS; on Linux: apt install curl)"
fi

# Node modules
if [ -d node_modules ]; then
  pass "node_modules present"
else
  fail "node_modules missing (run: bun install)"
fi

# Env vars (non-blocking)
echo ""
echo "Env vars (.env.local):"
if [ -f .env.local ]; then
  pass ".env.local exists"
  if grep -q "^APP_ID=" .env.local 2>/dev/null; then
    pass "APP_ID set"
  else
    warn "APP_ID not set (defaults to 'unknown')"
  fi
  # Analytics intentionally not checked here. Local dev never sends to
  # PostHog — events log to the terminal regardless of POSTHOG_KEY state.
  # In production, bil-provisioning injects POSTHOG_KEY into Vercel.
else
  warn ".env.local doesn't exist (copy .env.example to .env.local)"
fi

# app.config.json
echo ""
echo "Provisioning state:"
if [ -f app.config.json ]; then
  pass "app.config.json present"
  if command -v jq >/dev/null 2>&1; then
    APP_ID=$(jq -r '.app_id // empty' app.config.json 2>/dev/null)
    SUB=$(jq -r '.subdomain // empty' app.config.json 2>/dev/null)
    [ -n "$APP_ID" ] && pass "app_id: $APP_ID"
    [ -n "$SUB" ] && pass "subdomain: $SUB"
  fi
else
  warn "app.config.json missing (run: ./scripts/setup.sh)"
fi

# TypeScript
echo ""
echo "TypeScript:"
if [ -f tsconfig.json ]; then
  pass "tsconfig.json present"
else
  fail "tsconfig.json missing"
fi

# Quick typecheck
echo ""
echo "Typecheck (this may take a moment)..."
if bunx tsc --noEmit 2>&1 | grep -q "error"; then
  fail "tsc reported errors. Run: bunx tsc --noEmit"
else
  pass "tsc clean"
fi

echo ""
if [ "$FAILED" = "1" ]; then
  echo "${RED}One or more checks failed.${RESET} See above."
  exit 1
fi
echo "${GREEN}All checks passed.${RESET}"
