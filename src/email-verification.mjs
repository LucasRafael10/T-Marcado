import { createHash, randomBytes } from "node:crypto";
import { get, run, transaction } from "./database.mjs";
import { hash } from "./passwords.mjs";
import { fail } from "./validation.mjs";
import { appOrigin } from "./config.mjs";
import { sendEmail, emailDiagnostic } from "./email.mjs";
import { verificationEmailHtml } from "./email-templates.mjs";
const digest = (token) => createHash("sha256").update(token).digest("hex");
export const verificationMessage =
  "Se a conta precisar de confirmação, enviaremos um link. Confira sua caixa de entrada e spam.";
export function requireEmail() {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    fail(503, "Envio de e-mail indisponível. Tente mais tarde.");
}
export async function sendVerification(email) {
  const token = randomBytes(32).toString("hex"),
    tokenHash = digest(token);
  const recipient = await transaction(async () => {
    const u = await get(
      "SELECT id,email,email_verified FROM users WHERE email=? FOR UPDATE",
      email,
    );
    if (!u || u.email_verified) return null;
    const old = await get(
      "SELECT requested_at FROM email_verifications WHERE user_id=?",
      u.id,
    );
    if (old && Number(old.requested_at) > Date.now() - 60000) return null;
    await run(
      `INSERT INTO email_verifications(user_id,token_hash,expires,requested_at) VALUES(?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires=EXCLUDED.expires,requested_at=EXCLUDED.requested_at`,
      u.id,
      tokenHash,
      Date.now() + 1800000,
      Date.now(),
    );
    return u;
  });
  if (!recipient) return;
  try {
    const url = `${appOrigin}/confirmar-email.html#token=${token}`;
    await sendEmail(
      email,
      "Confirme seu e-mail — Tá Marcado",
      `Confirme seu e-mail e defina sua senha pessoal. Link válido por 30 minutos e uso único:\n${url}\nSe você não reconhece o cadastro ou convite, ignore esta mensagem.`,
      verificationEmailHtml(url),
    );
  } catch (error) {
    await run("DELETE FROM email_verifications WHERE token_hash=?", tokenHash);
    console.error(emailDiagnostic(error));
  }
}
export function requestVerification(email) {
  requireEmail();
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  )
    fail(400, "Informe um e-mail válido.");
  void sendVerification(email.trim().toLowerCase()).catch(() =>
    console.error("Falha ao processar confirmação de e-mail."),
  );
  return { message: verificationMessage };
}
export async function confirmEmail(token, password, confirmation) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    fail(400, "Link inválido ou expirado. Solicite outro.");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 256 ||
    password !== password.trim() ||
    password !== confirmation
  )
    fail(
      400,
      "Use de 8 a 256 caracteres e confirme a mesma senha, sem espaços no início ou fim.",
    );
  const tokenHash = digest(token);
  const candidate = await get(
    "SELECT user_id FROM email_verifications WHERE token_hash=? AND expires>?",
    tokenHash,
    Date.now(),
  );
  if (!candidate) fail(400, "Link inválido ou expirado. Solicite outro.");
  const passwordHash = await hash(password);
  await transaction(async () => {
    await get("SELECT id FROM users WHERE id=? FOR UPDATE", candidate.user_id);
    const valid = await get(
      "DELETE FROM email_verifications WHERE user_id=? AND token_hash=? AND expires>? RETURNING user_id",
      candidate.user_id,
      tokenHash,
      Date.now(),
    );
    if (!valid) fail(400, "Link inválido ou expirado. Solicite outro.");
    // The mailbox owner chooses a new secret; a pre-registered password cannot survive activation.
    await run(
      "UPDATE users SET email_verified=true,password=? WHERE id=?",
      passwordHash,
      candidate.user_id,
    );
    await run("DELETE FROM sessions WHERE user_id=?", candidate.user_id);
    await run("DELETE FROM password_resets WHERE user_id=?", candidate.user_id);
  });
  return {
    message: "E-mail confirmado e senha definida. Entre com sua senha pessoal.",
  };
}
