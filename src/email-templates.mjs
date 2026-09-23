const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char],
  );

function layout(title, content) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — Tá Marcado</title></head>
<body style="margin:0;padding:0;background:#f5efe2;color:#212f24;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${title} — Tá Marcado</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#f5efe2;"><tr><td align="center" style="padding:40px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;border-collapse:collapse;">
      <tr><td style="padding:0 0 22px;color:#1c2e23;font-family:Georgia,serif;font-size:30px;font-weight:bold;letter-spacing:-.5px;">Tá Marcado<span style="color:#b0813f;">.</span></td></tr>
      <tr><td style="padding:34px 30px;background:#fbf8f0;border:1px solid #d8c9a5;border-radius:12px;">
        ${content}
      </td></tr>
      <tr><td style="padding:22px 12px;color:#647064;text-align:center;font-size:12px;line-height:1.6;">Tá Marcado · Organização de eventos com carinho e simplicidade</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export function resetEmailHtml(url) {
  const safeUrl = escapeHtml(url);
  return layout(
    "Redefina sua senha",
    `
    <p style="margin:0 0 12px;color:#886027;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">Segurança da sua conta</p>
    <h1 style="margin:0 0 16px;color:#1c2e23;font-family:Georgia,serif;font-size:32px;line-height:1.2;">Redefina sua senha</h1>
    <p style="margin:0 0 24px;color:#3d4a3c;font-size:16px;line-height:1.65;">Recebemos um pedido para trocar a senha da sua conta. Clique no botão abaixo para criar uma nova senha.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr><td style="background:#2f4a3a;border-radius:8px;">
      <a href="${safeUrl}" style="display:inline-block;padding:15px 24px;color:#ffffff;font-size:15px;font-weight:bold;text-align:center;text-decoration:none;">Criar nova senha</a>
    </td></tr></table>
    <p style="margin:24px 0 8px;color:#3d4a3c;font-size:14px;line-height:1.6;"><strong>O link vale por 30 minutos</strong> e só pode ser usado uma vez.</p>
    <p style="margin:0 0 8px;color:#3d4a3c;font-size:13px;line-height:1.6;">Se o botão não funcionar, copie este endereço e cole no navegador:</p>
    <p style="margin:0;overflow-wrap:anywhere;word-break:break-all;color:#2f4a3a;font-size:13px;line-height:1.6;"><a href="${safeUrl}" style="color:#2f4a3a;text-decoration:underline;">${safeUrl}</a></p>
    <hr style="margin:26px 0;border:0;border-top:1px solid #d8c9a5;">
    <p style="margin:0;color:#647064;font-size:13px;line-height:1.6;">Não pediu essa troca? Ignore este e-mail. Sua senha continuará a mesma.</p>
  `,
  );
}

export function passwordChangedEmailHtml() {
  return layout(
    "Sua senha foi alterada",
    `
    <p style="margin:0 0 12px;color:#886027;font-size:12px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">Segurança da sua conta</p>
    <h1 style="margin:0 0 16px;color:#1c2e23;font-family:Georgia,serif;font-size:32px;line-height:1.2;">Senha alterada</h1>
    <p style="margin:0 0 18px;color:#3d4a3c;font-size:16px;line-height:1.65;">A senha da sua conta no Tá Marcado foi alterada. Você já pode entrar novamente com a nova senha.</p>
    <hr style="margin:24px 0;border:0;border-top:1px solid #d8c9a5;">
    <p style="margin:0;color:#647064;font-size:13px;line-height:1.6;">Não foi você? Solicite outra recuperação de senha e entre em contato com o responsável pelo site.</p>
  `,
  );
}

export function verificationEmailHtml(url) {
  const safe = escapeHtml(url);
  return layout(
    "Confirme seu e-mail",
    `<h1 style="color:#1c2e23;font-family:Georgia,serif;">Seu acesso ao Tá Marcado</h1><p>Confirme este e-mail e defina sua senha pessoal para organizar ou acompanhar eventos.</p><p><a href="${safe}" style="display:inline-block;padding:16px 24px;background:#2f4a3a;color:white;text-decoration:none;border-radius:8px;">Confirmar e definir senha</a></p><p>Link válido por 30 minutos, de uso único.</p><p>Se o botão não abrir, copie este endereço:</p><p style="word-break:break-all;">${safe}</p><p>Não reconhece o cadastro ou convite? Ignore este e-mail.</p>`,
  );
}
