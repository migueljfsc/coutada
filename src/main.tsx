import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { AccountProvider } from "./account/AccountProvider";
import { I18nProvider } from "./i18n/react";
import { parseRoute } from "./share/routes";
import { count, pageEvent } from "./share/usage";

// The service worker keeps the app and its imagery on the phone (D19). Not in development, where
// it would serve yesterday's build.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  void navigator.serviceWorker.register("/sw.js", { type: "module" }).catch(() => undefined);
}

// Once per load, here rather than in an effect, which StrictMode runs twice (D26).
const page = pageEvent(parseRoute(location.pathname, location.search).kind);
if (page) count(page);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <AccountProvider>
        <App />
      </AccountProvider>
    </I18nProvider>
  </StrictMode>,
);
