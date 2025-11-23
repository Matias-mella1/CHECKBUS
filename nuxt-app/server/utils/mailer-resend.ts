import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(opts: {
  to: string;
  nombre: string;
  token: string;
  username?: string; // 👈 opcional para no romper otros usos
}) {
  const fromAddr = (process.env.MAIL_FROM || '').trim();
  const fromName = (process.env.MAIL_NAME || 'CheckBus').trim();
  const appUrl   = process.env.PUBLIC_APP_URL || 'https://checkbus.cl';
  const link     = `${appUrl}/set-password?token=${encodeURIComponent(opts.token)}`;

  const fromHeader = `${fromName} <${fromAddr}>`;

  const html = `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#0b1120;border-radius:18px;padding:28px 24px;border:1px solid #1f2937;box-shadow:0 18px 45px rgba(15,23,42,0.7);font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e5e7eb;">

          <!-- Encabezado / Logo -->
          <tr>
            <td align="center" style="padding-bottom:22px;border-bottom:1px solid #1f2937;">
              <img 
                src="https://mi-sistema-logo-publico.s3.us-east-2.amazonaws.com/logo-app.png"
                alt="CheckBus"
                style="max-width:160px;max-height:60px;margin-bottom:6px;display:block;"
              />

              <div style="font-size:12px;color:#9ca3af;margin-top:4px;">
                Sistema de Gestión de Flota
              </div>
            </td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="padding-top:20px;padding-bottom:4px;">
              <h1 style="margin:0 0 10px 0;font-size:22px;font-weight:600;color:#f9fafb;">
                ¡Hola ${opts.nombre}!
              </h1>

              <p style="margin:0 0 8px 0;font-size:14px;color:#d1d5db;">
                Tu cuenta ha sido creada en <strong style="color:#f9fafb;">CheckBus</strong>.
              </p>

              <!-- Datos del usuario -->
              <table cellpadding="0" cellspacing="0" style="margin:12px 0 18px 0;width:100%;">
                <tr>
                  <td style="background:#111827;padding:10px 14px;border-radius:12px;border:1px solid #1f2937;">
                    <p style="margin:0;font-size:13px;color:#9ca3af;">
                      ${
                        opts.username
                          ? `<strong style="color:#f9fafb;">Tu nombre de usuario es:</strong> ${opts.username}<br />`
                          : ''
                      }
                      <strong style="color:#f9fafb;">Correo registrado:</strong> ${opts.to}
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 18px 0;font-size:14px;color:#9ca3af;">
                Para comenzar a usar la plataforma, por favor define tu contraseña haciendo clic en el siguiente botón:
              </p>

              <!-- Botón -->
              <table cellpadding="0" cellspacing="0" style="margin:18px 0 10px 0;">
                <tr>
                  <td>
                    <a href="${link}" target="_blank"
                      style="
                        display:inline-block;
                        background:linear-gradient(135deg,#22c55e,#22d3ee);
                        color:#0b1120;
                        padding:12px 22px;
                        border-radius:999px;
                        text-decoration:none;
                        font-size:14px;
                        font-weight:600;
                        letter-spacing:0.02em;
                      ">
                      Definir contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Enlace alternativo -->
              <p style="margin:0 0 14px 0;font-size:12px;color:#9ca3af;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:
              </p>
              <p style="margin:0 0 18px 0;font-size:12px;word-break:break-all;color:#6b7280;">
                <a href="${link}" target="_blank" style="color:#22d3ee;text-decoration:none;">
                  ${link}
                </a>
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0;">
                <tr>
                  <td style="background:#020617;border-radius:12px;padding:10px 12px;border:1px dashed #1e293b;">
                    <p style="margin:0;font-size:11px;color:#9ca3af;">
                      ⏱ <strong>Importante:</strong> por seguridad, este enlace es válido por <strong>24 horas</strong>.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:16px 0 0 0;font-size:12px;color:#6b7280;">
                Si no solicitaste esta cuenta, puedes ignorar este mensaje.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:20px;border-top:1px solid #1f2937;text-align:center;">
              <p style="margin:0 0 4px 0;font-size:11px;color:#4b5563;">
                Este es un correo automático, por favor no respondas a este mensaje.
              </p>
              <p style="margin:0;font-size:11px;color:#4b5563;">
                © ${new Date().getFullYear()} CheckBus · Plataforma de gestión de transporte
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
    subject: 'Bienvenido a CheckBus 🚍 — Define tu contraseña',
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message || 'No se pudo enviar el correo'}`);
  }
}
