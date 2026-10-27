/**
 * Who this browser is and how the app is set up, behind the menu button: signing in or out, this
 * phone's name, moving to another device, installing, the language, and erasing everything.
 */

import { useState, type ReactNode } from "react";
import { ChartColumn, Download, FileArchive, LogOut, Smartphone, Trash2, UserRound } from "lucide-react";
import { useAccount } from "../account/context";
import { useI18n } from "../i18n/context";
import { LOCALES } from "../i18n/core";
import { save } from "../lib/download";
import { useInstall } from "../lib/useInstall";
import { myData } from "../share/myData";
import { navigate } from "../share/routes";
import { Dialog } from "./Dialog";
import { RailButton } from "./RailButton";
import { primaryButton, secondaryButton } from "./ui";

export type AccountActions = {
  signIn: () => void;
  register: () => void;
  transfer: () => void;
  signOut: () => void;
  deleteAccount: () => void;
  deleteDevice: () => void;
};

/** The letter the menu button wears: the account's or the phone's name, or none. */
function useInitial(): string | null {
  const { me } = useAccount();
  const name = me?.user?.displayName ?? me?.user?.email ?? me?.device?.username;
  return name ? name.trim().charAt(0).toLocaleUpperCase() : null;
}

function Row({
  icon,
  children,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: ReactNode;
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 w-full items-center gap-3 rounded-[8px] px-2 text-left text-[16px] font-semibold active:bg-cal-deep disabled:opacity-60 ${danger ? "text-[#a32a1d]" : ""}`}
    >
      <span className="flex size-6 shrink-0 items-center justify-center" aria-hidden>
        {icon}
      </span>
      {children}
    </button>
  );
}

export function AccountSheet({ actions, onClose }: { actions: AccountActions; onClose: () => void }) {
  const { t, locale, setLocale } = useI18n();
  const { me } = useAccount();
  const { installed, install, iosHint } = useInstall();
  const initial = useInitial();
  const [exporting, setExporting] = useState<"idle" | "busy" | "failed">("idle");
  const exportData = async () => {
    if (!me) return;
    setExporting("busy");
    const blob = await myData(me);
    if (!blob) return setExporting("failed");
    save(`coutada-${new Date().toISOString().slice(0, 10)}.zip`, blob);
    setExporting("idle");
  };
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <Dialog title={t("menu.title")} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-azinho text-[20px] font-bold text-white" aria-hidden>
            {initial ?? <UserRound size={24} />}
          </span>
          <div className="min-w-0">
            {me?.user ? (
              <>
                <p className="truncate text-[17px] font-bold">{me.user.displayName ?? me.user.email}</p>
                <p className="truncate text-[14px] text-xisto-soft">{me.user.email}</p>
              </>
            ) : me?.device ? (
              <>
                <p className="truncate text-[17px] font-bold">{me.device.username}</p>
                <p className="text-[14px] text-xisto-soft">{t("menu.thisPhone")}</p>
              </>
            ) : (
              <p className="text-[15px] leading-snug text-xisto-soft">{t("account.none")}</p>
            )}
          </div>
        </div>

        {!me?.user && (
          <div className="flex flex-col gap-2">
            {me?.device && <p className="text-[14px] leading-snug text-xisto-soft">{t("account.anonymous", { name: me.device.username })}</p>}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={act(actions.signIn)} className={secondaryButton}>
                {t("menu.signIn")}
              </button>
              <button type="button" onClick={act(actions.register)} className={primaryButton}>
                {t("account.register")}
              </button>
            </div>
          </div>
        )}

        <div className="-mx-2 flex flex-col">
          <Row icon={<Smartphone size={20} />} onClick={act(actions.transfer)}>
            {me?.device ? t("transfer.title") : t("transfer.haveCode")}
          </Row>
          {(me?.user || me?.device) && (
            <Row icon={<FileArchive size={20} />} disabled={exporting === "busy"} onClick={() => void exportData()}>
              {t(exporting === "busy" ? "menu.exporting" : "menu.export")}
            </Row>
          )}
          {exporting === "failed" && (
            <p role="alert" className="px-2 pb-2 text-[14px] text-[#a32a1d]">
              {t("menu.exportFailed")}
            </p>
          )}
          {!installed && install && (
            <Row icon={<Download size={20} />} onClick={() => void install()}>
              {t("install.app")}
            </Row>
          )}
          {iosHint && <p className="px-2 pb-2 text-[14px] leading-snug text-xisto-soft">{t("install.iosHint")}</p>}
          <div className="flex min-h-12 items-center justify-between gap-3 px-2">
            <span className="text-[16px] font-semibold">{t("app.locale")}</span>
            <div role="group" aria-label={t("app.locale")} className="inline-flex rounded-xl bg-cal-deep p-1">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={l === locale}
                  onClick={() => setLocale(l)}
                  className="min-h-11 min-w-14 rounded-lg px-3 text-[15px] font-semibold text-xisto-soft aria-pressed:bg-cal aria-pressed:text-xisto aria-pressed:shadow-sm"
                >
                  {t(`locale.${l}`)}
                </button>
              ))}
            </div>
          </div>
          {me?.user?.admin && (
            <Row icon={<ChartColumn size={20} />} onClick={act(() => navigate("/admin"))}>
              {t("menu.admin")}
            </Row>
          )}
          {me?.user && (
            <Row icon={<LogOut size={20} />} onClick={act(actions.signOut)}>
              {t("account.signOut")}
            </Row>
          )}
        </div>

        <button type="button" onClick={act(() => navigate("/privacidade"))} className="min-h-11 self-start text-[15px] font-semibold text-azinho-ink underline-offset-4 hover:underline">
          {t("privacy.link")}
        </button>

        {(me?.user || me?.device) && (
          <div className="-mx-2 border-t border-rule pt-3">
            <Row icon={<Trash2 size={20} />} danger onClick={act(me?.user ? actions.deleteAccount : actions.deleteDevice)}>
              {me?.user ? t("account.delete") : t("device.delete")}
            </Row>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** The round button in the map's corner that opens the account and settings. */
export function MenuButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  const initial = useInitial();
  return (
    <RailButton label={t("menu.title")} aria-haspopup="dialog" onClick={onClick} className="rounded-full text-[19px] font-bold">
      {initial ?? <UserRound size={22} strokeWidth={2.2} />}
    </RailButton>
  );
}
