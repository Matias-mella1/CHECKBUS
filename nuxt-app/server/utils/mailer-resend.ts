// server/utils/mailer-resend.ts
import { Resend } from "resend";

// VARIABLES DE ENTORNO (sin useRuntimeConfig)
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const MAIL_FROM = (process.env.MAIL_FROM || "").trim();
const MAIL_NAME = (process.env.MAIL_NAME || "CheckBus").trim();
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || "https://checkbus.cl").trim();

// Inicializar cliente Resend
const resend = new Resend(RESEND_API_KEY);

export async function sendPasswordResetEmail(opts: {
  to: string;
  nombre: string;
  token: string;
  username?: string;
}) {
  const link = `${PUBLIC_APP_URL}/set-password?token=${encodeURIComponent(opts.token)}`;

  const fromHeader = `${MAIL_NAME} <${MAIL_FROM}>`;

  const html = `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#0b1120;border-radius:18px;padding:28px 24px;border:1px solid #1f2937;box-shadow:0 18px 45px rgba(15,23,42,0.7);font-family:system-ui,-apple-system,sans-serif;color:#e5e7eb;">
          
          <tr>
            <td align="center" style="padding-bottom:22px;border-bottom:1px solid #1f2937;">
              <img 
                src="https://mi-sistema-logo-publico.s3.us-east-2.amazonaws.com/logo-app.png"
                alt="CheckBus"
                style="max-width:160px;max-height:60px;margin-bottom:6px;display:block;"
              />
              <div style="font-size:12px;color:#9ca3af;margin-top:4px;">Sistema de Gestión de Flota</div>
            </td>
          </tr>

          <tr>
            <td style="padding-top:20px;padding-bottom:4px;">
              <h1 style="margin:0 0 10px;font-size:22px;font-weight:600;color:#f9fafb;">
                ¡Hola ${opts.nombre}!
              </h1>

              <p style="font-size:14px;color:#d1d5db;margin:0 0 10px;">
                Tu cuenta ha sido creada en <strong style="color:#f9fafb;">CheckBus</strong>.
              </p>

              <div style="background:#111827;padding:12px;border-radius:12px;border:1px solid #1f2937;margin-bottom:18px;">
                <p style="margin:0;font-size:13px;color:#9ca3af;">
                  ${opts.username ? `<strong style="color:#f9fafb;">Usuario:</strong> ${opts.username}<br>` : ""}
                  <strong style="color:#f9fafb;">Correo:</strong> ${opts.to}
                </p>
              </div>

              <p style="font-size:14px;color:#9ca3af;margin:0 0 14px;">
                Para definir tu contraseña haz clic aquí:
              </p>

              <a href="${link}" target="_blank"
                style="display:inline-block;background:linear-gradient(135deg,#22c55e,#22d3ee);color:#0b1120;padding:12px 22px;border-radius:999px;text-decoration:none;font-size:14px;font-weight:600;margin-bottom:18px;">
                Definir contraseña
              </a>

              <p style="font-size:12px;color:#9ca3af;margin:0 0 8px;">
                Si el botón no funciona, usa este enlace:
              </p>
              <p style="font-size:12px;color:#22d3ee;margin:0 0 18px;word-break:break-all;">
                <a href="${link}" target="_blank" style="color:#22d3ee;">${link}</a>
              </p>

              <div style="background:#020617;border-radius:12px;padding:10px 12px;border:1px dashed #1e293b;margin-bottom:20px;">
                <p style="margin:0;font-size:11px;color:#9ca3af;">
                  ⏱ <strong>Este enlace expira en 24 horas.</strong>
                </p>
              </div>

              <p style="font-size:12px;color:#6b7280;margin:0;">
                Si no solicitaste esta cuenta, ignora este mensaje.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding-top:20px;border-top:1px solid #1f2937;text-align:center;">
              <p style="font-size:11px;color:#4b5563;margin:0 0 4px;">
                Correo automático – no responder.
              </p>
              <p style="font-size:11px;color:#4b5563;margin:0;">
                © ${new Date().getFullYear()} CheckBus
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  `;

  const { error } = await resend.emails.send({
    from: fromHeader,
    to: opts.to,
    subject: "Bienvenido a CheckBus — Define tu contraseña",
    html,
  });

  if (error) {
    console.error("Resend ERROR:", error);
    throw new Error(error.message || "Error enviando correo");
  }
}
