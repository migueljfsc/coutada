/**
 * The verification and reset emails, through Resend (D4). The Worker has no locale (D3): the
 * client says which language it reads in, and anything else reads as Portuguese.
 */

export type MailLang = "pt" | "en";
export type Purpose = "verify" | "reset";

export const mailLang = (value: unknown): MailLang => (value === "en" ? "en" : "pt");

const COPY: Record<MailLang, Record<Purpose, { subject: string; body: string; action: string }>> = {
  pt: {
    verify: {
      subject: "Confirme o seu email no Coutada",
      body: "Abra esta ligação para confirmar o seu endereço e concluir a definição da palavra-passe do Coutada. Expira em 24 horas.",
      action: "Confirmar email",
    },
    reset: {
      subject: "Redefinir a palavra-passe do Coutada",
      body: "Abra esta ligação para escolher uma nova palavra-passe do Coutada. Expira em 1 hora.",
      action: "Escolher nova palavra-passe",
    },
  },
  en: {
    verify: {
      subject: "Confirm your email for Coutada",
      body: "Open this link to confirm your address and finish setting your Coutada password. It expires in 24 hours.",
      action: "Confirm email",
    },
    reset: {
      subject: "Reset your Coutada password",
      body: "Open this link to choose a new Coutada password. It expires in 1 hour.",
      action: "Choose a new password",
    },
  },
};

const IGNORE: Record<MailLang, string> = {
  pt: "Se não pediu isto, ignore este email e nada será alterado.",
  en: "If you did not ask for this, ignore this email and nothing will change.",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function composeMail(purpose: Purpose, lang: MailLang, link: string) {
  const copy = COPY[lang][purpose];
  return {
    subject: copy.subject,
    text: `${copy.body}\n\n${link}\n\n${IGNORE[lang]}\n`,
    html:
      `<p>${escapeHtml(copy.body)}</p>` +
      `<p><a href="${escapeHtml(link)}">${escapeHtml(copy.action)}</a></p>` +
      `<p style="color:#666;font-size:12px">${escapeHtml(IGNORE[lang])}</p>`,
  };
}

/** Throws on failure; callers send from `waitUntil` and log, so the reply never says which case it was. */
export async function sendMail(env: Env, to: string, mail: { subject: string; text: string; html: string }): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], ...mail }),
  });
  if (!response.ok) throw new Error(`mail_failed_${response.status}`);
}
