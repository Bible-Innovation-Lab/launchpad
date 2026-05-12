/**
 * modules/push — enable-push button.
 * Copy to components/EnablePushButton.tsx to use.
 */

"use client";

import { useEffect, useState } from "react";
import { isPushSupported, subscribeToPush } from "@/lib/push";
import { track } from "@/lib/analytics/client";

export default function EnablePushButton({ appName }: { appName: string }) {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<"idle" | "subscribed" | "denied" | "unsupported">("idle");

  useEffect(() => {
    isPushSupported().then((ok) => {
      setSupported(ok);
      if (!ok) setState("unsupported");
    });
  }, []);

  async function onEnable() {
    track("push_prompt_shown");
    const sub = await subscribeToPush();
    if (sub) {
      setState("subscribed");
      track("push_subscribed");
    } else {
      setState("denied");
      track("push_denied");
    }
  }

  if (state === "subscribed") return <p className="text-sm text-zinc-500">{appName} notifications enabled</p>;
  if (state === "denied") return <p className="text-sm text-zinc-500">You can re-enable in your browser settings.</p>;
  if (state === "unsupported") {
    return (
      <p className="text-sm text-zinc-500">
        Push isn't supported on this browser. iOS users: add to home screen first.
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={!supported}
      onClick={onEnable}
      className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
    >
      Get daily reminders
    </button>
  );
}
