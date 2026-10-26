/**
 * Cloudflare Turnstile, managed mode: usually invisible, a checkbox when the browser looks
 * automated (D4, D5). Each token is single-use; remount with a new `key` for another.
 */

import { useEffect, useRef } from "react";

const PRODUCTION_SITEKEY = "0x4AAAAAAFmxre763B87jAhQ";
/** Cloudflare's always-pass test key, for a page served from this machine. */
const LOCAL_SITEKEY = "1x00000000000000000000AA";
const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile")));
    script.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

const sitekey = () => (["localhost", "127.0.0.1"].includes(location.hostname) ? LOCAL_SITEKEY : PRODUCTION_SITEKEY);

export function Turnstile({ onToken, language }: { onToken: (token: string | null) => void; language: string }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(onToken);
  useEffect(() => {
    latest.current = onToken;
  });

  useEffect(() => {
    let id: string | null = null;
    let api: TurnstileApi | null = null;
    let cancelled = false;
    loadTurnstile()
      .then((t) => {
        if (cancelled || !host.current) return;
        api = t;
        id = t.render(host.current, {
          sitekey: sitekey(),
          language,
          theme: "light",
          callback: (token: string) => latest.current(token),
          "expired-callback": () => latest.current(null),
          "error-callback": () => latest.current(null),
        });
      })
      .catch(() => latest.current(null));
    return () => {
      cancelled = true;
      if (api && id) api.remove(id);
    };
  }, [language]);

  return <div ref={host} className="min-h-0" />;
}
