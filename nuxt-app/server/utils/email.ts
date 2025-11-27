// server/utils/email.ts
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendAlertEmail(opts: {
  to: string | string[];
  subject: string;
  title: string;
  message: string;
}) {
  const fromAddr = (process.env.MAIL_FROM || "").trim();
  const fromName = (process.env.MAIL_NAME || "CheckBus Alertas").trim();
  const fromHeader = `${fromName} <${fromAddr}>`;

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5">
      <h2>${opts.title}</h2>
      <div>${opts.message}</div>
      <hr />
      <small>Este mensaje fue generado automáticamente por CheckBus.</small>
    </div>
  `;

  const { error } = await resend.emails.send({
    from: fromHeader,
    to: opts.to,
    subject: opts.subject,
    html,
  });

  if (error) {
    console.error("Error enviando correo:", error);
    throw new Error(`No se pudo enviar el correo: ${error.message}`);
  }
}
