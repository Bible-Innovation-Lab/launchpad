"use client";

/**
 * @bil/launchpad/feedback — drop-in feedback modal.
 *
 * Controlled pop-up that asks "How would you rate this game?" with a 5-star
 * picker and a free-form "Any feedback?" textarea. Submitting fires a single
 * PostHog event (default name `feedback_submitted`) via the existing
 * `@bil/launchpad/analytics/client` beacon — no extra deps, no extra HTTP
 * surface, same fire-and-forget posture as every other launchpad event.
 *
 * Pairs with the auto-tracked analytics package: events flow through
 * /api/analytics so the proxy's `_lp_aid` cookie distinct_id and the
 * `$useragent` / `$ip` enrichment apply automatically.
 *
 * @example
 *   "use client";
 *   import { useState } from "react";
 *   import { FeedbackModal } from "@bil/launchpad/feedback";
 *
 *   export function FeedbackButton() {
 *     const [open, setOpen] = useState(false);
 *     return (
 *       <>
 *         <button onClick={() => setOpen(true)}>Give feedback</button>
 *         <FeedbackModal open={open} onClose={() => setOpen(false)} />
 *       </>
 *     );
 *   }
 *
 * Defaults match the canonical request ("How would you rate this game?",
 * "Any feedback?") but every label is overridable so non-game apps can
 * reuse the same component.
 */

import { useCallback, useEffect, useState } from "react";
import { track, type JSONValue } from "../analytics/client";

export interface FeedbackModalProps {
  /** Whether the modal is currently visible. */
  open: boolean;
  /** Called when the user dismisses the modal (X, overlay, Esc, or post-submit). */
  onClose: () => void;
  /** Question above the stars. Defaults to "How would you rate this game?". */
  question?: string;
  /** Header above the textarea. Defaults to "Any feedback?". */
  feedbackHeader?: string;
  /** Submit button text. Defaults to "Submit". */
  submitLabel?: string;
  /** PostHog event name fired on submit. Defaults to `feedback_submitted`. */
  eventName?: string;
  /** Extra properties merged into the analytics event (e.g. `{ surface: "post-game" }`). */
  extraProps?: Record<string, JSONValue>;
  /** Optional callback after the event is fired (e.g. show a toast). */
  onSubmit?: (result: { rating: number; feedback: string }) => void;
}

export function FeedbackModal({
  open,
  onClose,
  question = "How would you rate this game?",
  feedbackHeader = "Any feedback?",
  submitLabel = "Submit",
  eventName = "feedback_submitted",
  extraProps,
  onSubmit,
}: FeedbackModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Reset on every (re)open so a previous session's draft doesn't leak in.
  useEffect(() => {
    if (open) {
      setRating(0);
      setHover(0);
      setFeedback("");
      setSubmitted(false);
    }
  }, [open]);

  // Esc-to-close. Only attached while open so we don't pin a global listener.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = useCallback(() => {
    if (rating < 1) return; // require at least 1 star to send the event
    const trimmed = feedback.trim();
    track(eventName, {
      rating,
      feedback: trimmed || null,
      ...(extraProps ?? {}),
    });
    onSubmit?.({ rating, feedback: trimmed });
    setSubmitted(true);
    // Brief "thanks" frame, then dismiss. 900ms ≈ enough to register without feeling sticky.
    window.setTimeout(onClose, 900);
  }, [rating, feedback, eventName, extraProps, onSubmit, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Feedback"
      onClick={onClose}
      style={overlayStyle}
    >
      <div onClick={(e) => e.stopPropagation()} style={panelStyle}>
        <button
          type="button"
          aria-label="Close feedback"
          onClick={onClose}
          style={closeStyle}
        >
          ×
        </button>

        {submitted ? (
          <div style={thanksStyle}>Thanks for your feedback!</div>
        ) : (
          <>
            <h2 style={questionStyle}>{question}</h2>

            <div role="radiogroup" aria-label="Rating" style={starsRowStyle}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = (hover || rating) >= n;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onFocus={() => setHover(n)}
                    onBlur={() => setHover(0)}
                    onClick={() => setRating(n)}
                    style={{
                      ...starButtonStyle,
                      color: filled ? "#fbbf24" : "#d1d5db",
                    }}
                  >
                    ★
                  </button>
                );
              })}
            </div>

            <label style={labelStyle}>
              <span style={labelTextStyle}>{feedbackHeader}</span>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                style={textareaStyle}
              />
            </label>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={rating < 1}
              style={{
                ...submitStyle,
                opacity: rating < 1 ? 0.5 : 1,
                cursor: rating < 1 ? "not-allowed" : "pointer",
              }}
            >
              {submitLabel}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Inline styles keep the package zero-CSS — no PostCSS / Tailwind / styled-jsx
// pipeline required on the consumer. Trade-off: students can't restyle via
// className. If that becomes a real ask, expose className overrides per slot.

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
  padding: 16,
};

const panelStyle: React.CSSProperties = {
  position: "relative",
  background: "#ffffff",
  color: "#111111",
  borderRadius: 12,
  padding: "32px 24px 24px",
  width: "100%",
  maxWidth: 400,
  boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};

const closeStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  background: "transparent",
  border: "none",
  fontSize: 24,
  lineHeight: 1,
  cursor: "pointer",
  color: "#6b7280",
  width: 32,
  height: 32,
  borderRadius: 6,
};

const questionStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 18,
  fontWeight: 600,
  textAlign: "center",
};

const starsRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 4,
  marginBottom: 20,
};

const starButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  fontSize: 32,
  cursor: "pointer",
  padding: 4,
  lineHeight: 1,
  transition: "color 120ms ease",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 16,
};

const labelTextStyle: React.CSSProperties = {
  display: "block",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 6,
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  resize: "vertical",
  borderRadius: 8,
  border: "1px solid #d1d5db",
  padding: 8,
  fontFamily: "inherit",
  fontSize: 14,
  boxSizing: "border-box",
};

const submitStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 16px",
  background: "#111111",
  color: "#ffffff",
  border: "none",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
};

const thanksStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "20px 0",
  fontSize: 16,
  fontWeight: 500,
};
