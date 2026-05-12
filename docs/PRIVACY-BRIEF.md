# Privacy & Legal Review Brief

**Project:** Bible Innovation Lab (BIL) Launchpad
**Date prepared:** 2026-05-12
**Status:** Pending legal review
**Owner:** Scott Bouma, YouVersion
**Sponsoring entity:** Bible Innovation Lab, off-brand under YouVersion's umbrella program
**Audience for this brief:** YouVersion privacy/legal counsel
**One-line ask:** Confirm the US-only, server-side, anonymous-cookie analytics posture described below is sufficient for student products to begin accepting paid traffic.

---

## Purpose of the program

Over the summer, a small team of tech students will ship 50+ small daily-interaction Bible
mini-products under the Bible Innovation Lab (BIL) brand, each at its own subdomain of
`bibleinnovationlab.org`. The launchpad template described in this document is the shared
infrastructure they fork. The goal is to test whether AI-assisted product development plus
small paid-traffic experiments can find a product with measurable day-2 retention.

## Data collection summary

Each product collects the **minimum** data needed to measure traffic and day-2 retention. No
authenticated user data is collected by default. No payment data. No biometric data. No
sensitive personal information.

What is collected on every page load:

| Data | Mechanism | Retention | Why |
|---|---|---|---|
| Anonymous user ID (`_lp_aid` cookie) | First-party `HttpOnly` cookie, UUID v4 minted server-side at the edge. 2-year `Max-Age`. `SameSite=Lax`, `Secure` in prod. | 2 years (rolling) | Day-2 retention math (did this user return tomorrow?) |
| One-shot first-visit signal (`_lp_fv` cookie) | First-party `HttpOnly` cookie, value `1`, deleted by server on first analytics call. | <24 hours | Emit a single `first_visit` event when the cookie is minted |
| Approximate country | Vercel edge geo header (`x-vercel-ip-country`) | Per-event only; not stored alongside the cookie | US-only enforcement + dashboard slicing |
| User agent (parsed) | Server-side parse to `{browser, os}` strings | Per-event only | Diagnostic slicing |
| Event name + custom properties | Sent by the product's client beacon to `/api/track` | Per-event only | Product analytics (e.g., `puzzle_complete`) |

**Not collected:**
- IP address (it touches the edge for geo lookup, but is not logged or stored)
- Raw user agent (parsed and discarded server-side)
- Email, name, phone, location precision finer than country
- Anything from a third-party cookie

**Where the data goes:** the analytics endpoint forwards each event to PostHog (a third-party
analytics processor) under a BIL-owned PostHog organization. Storage is server-side at PostHog;
the client never receives a third-party tracking script.

## Geographic scope

**Version 1 is United States only.** Non-US traffic is geo-blocked at the edge (HTTP 307 to a
"coming soon" page) before any cookie is minted or any analytics event fires.

This decision sidesteps GDPR (EU), the UK GDPR, and most other consent-required regimes. The
EU `ePrivacy` Directive Article 5(3) is the binding requirement that would otherwise require a
consent banner for non-essential first-party cookies; by blocking EU traffic, no banner is
needed in v1.

An EU launch is a planned v2 milestone. It requires (a) a consent banner gate (no cookie minted,
no event fired until the user opts in) and (b) clarification on data residency for PostHog
(US region vs EU region).

## Cookie classification

| Cookie | Classification under California CCPA / EU ePrivacy | Notes |
|---|---|---|
| `_lp_aid` | "Functional / strictly necessary" arguable but conservative position is "Performance / Analytics" → requires consent under ePrivacy. **Mitigated by US-only scope.** | Anonymous, no PII, server-set, no fingerprinting |
| `_lp_fv` | One-shot signal, deleted after first analytics call | <24h lifespan, no PII |

We do not consider either cookie "advertising / targeting." No data is shared with ad networks.
No re-targeting pixels are injected (the launchpad's marketing instrumentation is generic UTM
attribution only).

## CCPA / state privacy law (US)

The California Consumer Privacy Act (CCPA) and analogous state laws (CO, CT, VA, UT, etc.)
generally apply to businesses meeting revenue or volume thresholds. The BIL program is unlikely
to meet those thresholds in v1, but products should still:

- Provide a "Privacy" link in the footer pointing to a simple privacy statement (template
  included as part of the launchpad's coming-soon page and root layout).
- Honor "Do Not Track" / Global Privacy Control browser signals by skipping cookie mint when
  GPC is present (planned for v1.1; not blocking).
- Provide an opt-out path — for v1, clearing browser cookies achieves this; no separate UI.

## Children's privacy (COPPA)

Products are not marketed to children under 13. The marketing strategy (paid traffic via adult-
targeted channels like Instagram and TikTok) does not target minors. If a product later changes
its marketing posture, COPPA compliance must be revisited.

## Third-party processors

| Vendor | Role | Data residency | DPA in place |
|---|---|---|---|
| Vercel | Hosting (US East / `iad1` region) | US | Yes (Vercel's standard terms) |
| PostHog | Analytics processing (US Cloud) | US | Yes (PostHog's standard DPA, signed at BIL org creation) |
| GitHub | Source code hosting | US | N/A — no user data flows through |
| GoDaddy | DNS only | US | N/A — no user data flows through |

## Authentication & user accounts (opt-in only)

The default launchpad does NOT authenticate users. Two opt-in modules exist for products
that need cross-device state:

- `modules/auth/` — Sign-in with Apple or Google via NextAuth.js. Personal data collected:
  email, display name, OAuth provider ID. Stored as JWT session (no database in v1).
- `modules/push/` — Web Push subscriptions. Stored in Vercel KV keyed by the anonymous
  user ID. Used solely to deliver daily notifications opted into by the user.

Products that enable either module must update their privacy statement to disclose the
additional data flows. The launchpad does not enable these by default; product owners
opt in per-product.

## Retention & deletion

- Anonymous user IDs are cycled when the user clears cookies. No identifier persists across
  cookie clears (this is a feature, not a bug — supports informal opt-out).
- Event-level data in PostHog: retained per PostHog's defaults (typically 7 years for paid
  tiers, configurable). BIL will set this to 1 year in PostHog settings as a v1 tightening.
- Subscription data (push module only): deleted automatically when a subscription returns
  a `410 Gone` from the push service (user revoked permission or uninstalled).

## Risk surface (worth flagging to legal)

1. **Subdomain takeover risk** — described in the provisioning service threat model
   (`scottbouma-launchpad-design-…md` § "Provisioning Service Threat Model"). Mitigated
   by explicit teardown of DNS records when products are sunset. Not a privacy issue per se
   but a brand-protection issue.
2. **PostHog free tier** — events flow to PostHog's US cloud. If PostHog ever introduces a
   policy change that conflicts with this brief, we need a re-review.
3. **Day-2 retention math under-counts ~10-30% on consumer mobile** due to Safari ITP cookie
   purges. This is a reporting limitation, not a privacy issue, but worth flagging because
   internal stakeholders may ask why our numbers look lower than industry benchmarks.

## Specific asks of legal counsel

1. **Confirm US-only + server-side anon-cookie analytics is acceptable** under YouVersion's
   privacy posture, without requiring a consent banner for v1.
2. **Confirm Vercel + PostHog as processors** meet YouVersion's vendor review bar for
   programs operating under the BIL brand.
3. **Approve a baseline privacy notice** for the BIL footer — Scott will draft and circulate
   separately once 1+2 are clear.
4. **Flag any concern** about the COPPA exposure, the cookie classification, or the
   sunset / data-deletion approach.

## Approval state

- [ ] Privacy / legal counsel reviewed
- [ ] Privacy notice text approved
- [ ] Cleared to accept paid traffic on student products

Until this is signed off, products may run in development mode and accept internal traffic only.
