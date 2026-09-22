import { createHash, randomBytes } from "node:crypto";
import { get, run, transaction } from "./database.mjs";
import { appOrigin } from "./config.mjs";
import { fail } from "./validation.mjs";
import { hash } from "./passwords.mjs";
import { sendEmail, emailDiagnostic } from "./email.mjs";
import { verificationEmailHtml } from "./email-templates.mjs";

const digest = (token) => createHash("sha256").update(token).digest("hex");
export const verificationMessage = "Se houver uma conta aguardando confirmação, enviaremos um link. Confira sua caixa de entrada e o spam.";
export function requireEmailDelivery() {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    fail(503, "O envio de confirmação está indisponível. Tente novamente mais tarde.");
}

export async function requestVerification(email) {
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    fail(400, "Informe um e-mail válido.");
  requireEmailDelivery();
  const token = randomBytes(32).toString("hex");
  const tokenHash = digest(token);
  const user = await transaction(async () => {
    const user = await get("SELECT id,email,email_verified FROM users WHERE email=? FOR UPDATE", email.trim().toLowerCase());
    if (!user || user.email_verified) return null;
    const prior = await get("SELECT requested_at FROM email_verifications WHERE user_id=?", user.id);
    if (prior && Number(prior.requested_at) > Date.now() - 60000) return null;
    await run(`INSERT INTO email_verifications(user_id,token_hash,expires,requested_at) VALUES(?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires=EXCLUDED.expires,requested_at=EXCLUDED.requested_at`,
      user.id,tokenHash,Date.now()+86400000,Date.now());
    return user;
  });
  if (user) {
    const url = `${appOrigin}/confirmar-email.html#token=${token}`;
    try {
      await sendEmail(user.email, "Confirme seu e-mail — Tá Marcado",
        `Confirme seu e-mail e defina sua senha para entrar no Tá Marcado.\n\nO link vale por 24 horas e só pode ser usado uma vez:\n${url}\n\nSe você não pediu este cadastro, ignore a mensagem. Não compartilhe este link.`, verificationEmailHtml(url));
    } catch (error) {
      await run("DELETE FROM email_verifications WHERE token_hash=?", tokenHash);
      console.error(emailDiagnostic(error));
      fail(503, "Não foi possível enviar a confirmação agora. Tente reenviar a confirmação em alguns minutos.");
    }
  }
  return { message: verificationMessage };
}

export async function verifyEmail(token, password, passwordConfirm) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) fail(400, "Link inválido ou expirado. Solicite outro.");
  if (typeof password !== "string" || password.length < 8 || password.length > 256 || password !== password.trim())
    fail(400, "Use de 8 a 256 caracteres, sem espaços no início ou fim.");
  if (password !== passwordConfirm) fail(400, "As senhas precisam ser iguais.");
  const tokenHash = digest(token);
  await transaction(async () => {
    const candidate = await get("SELECT user_id FROM email_verifications WHERE token_hash=?", tokenHash);
    if (!candidate) fail(400, "Link inválido ou expirado. Solicite outro.");
    await get("SELECT id FROM users WHERE id=? FOR UPDATE", candidate.user_id);
    const valid = await get("DELETE FROM email_verifications WHERE user_id=? AND token_hash=? AND expires>? RETURNING user_id", candidate.user_id, tokenHash, Date.now());
    if (!valid) fail(400, "Link inválido ou expirado. Solicite outro.");
    // The mailbox owner sets their own password. The initial creator's password
    // and any existing session can never remain as a pre-hijack capability.
    await run("UPDATE users SET email_verified=true,password=? WHERE id=?", await hash(password), valid.user_id);
    await run("DELETE FROM sessions WHERE user_id=?", valid.user_id);
    await run("DELETE FROM password_resets WHERE user_id=?", valid.user_id);
  });
  return { message: "E-mail confirmado! Entre com a senha que você acabou de definir." };
}
