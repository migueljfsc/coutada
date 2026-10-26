import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { AccountProvider } from "./account/AccountProvider";
import { I18nProvider } from "./i18n/react";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <AccountProvider>
        <App />
      </AccountProvider>
    </I18nProvider>
  </StrictMode>,
);
