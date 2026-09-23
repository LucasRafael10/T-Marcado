import { createHash, randomBytes } from "node:crypto";
import { get, run, transaction } from "./database.mjs";
import { hash } from "./passwords.mjs";
import { appOrigin } from "./config.mjs";
import { fail } from "./validation.mjs";
import { sendEmail, emailDiagnostic } from "./email.mjs";
import {
  resetEmailHtml,
  passwordChangedEmailHtml,
} from "./email-templates.mjs";

const digest = (token) => createHash("sha256").update(token).digest("hex");
const message =
  "Se houver uma conta com este e-mail, enviaremos as instruções. Confira também a pasta de spam.";

export async function requestReset(email) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  )
    fail(400, "Informe um e-mail válido.");
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    fail(
      503,
      "Recuperação de senha indisponível. Contate o responsável pelo site.",
    );
  email = email.trim().toLowerCase();
  // O envio assíncrono mantém a mesma resposta para contas existentes e inexistentes.
  void deliverReset(email).catch(() =>
    console.error("Não foi possível processar a recuperação de senha."),
  );
  return { message };
}

async function deliverReset(email) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = digest(token);
  const user = await transaction(async () => {
    const user = await get(
      "SELECT id,email FROM users WHERE email=? FOR UPDATE",
      email,
    );
    if (!user) return null;
    const prior = await get(
      "SELECT requested_at FROM password_resets WHERE user_id=?",
      user.id,
    );
    if (prior && Number(prior.requested_at) > Date.now() - 60000) return null;
    await run(
      "INSERT INTO password_resets(user_id,token_hash,expires,requested_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET token_hash=EXCLUDED.token_hash,expires=EXCLUDED.expires,requested_at=EXCLUDED.requested_at",
      user.id,
      tokenHash,
      Date.now() + 1800000,
      Date.now(),
    );
    return user;
  });
  if (!user) return;
  try {
    const resetUrl = `${appOrigin}/redefinir-senha.html#token=${token}`;
    await sendEmail(
      user.email,
      "Redefina sua senha — Tá Marcado",
      `Recebemos um pedido para trocar sua senha.\n\nAbra este link, válido por 30 minutos:\n${resetUrl}\n\nSe você não solicitou, ignore este e-mail. Sua senha permanece igual.`,
      resetEmailHtml(resetUrl),
    );
  } catch (error) {
    console.error(emailDiagnostic(error));
    await run("DELETE FROM password_resets WHERE token_hash=?", tokenHash);
    console.error(
      "Falha no envio pelo Resend. Confira a chave, o remetente e os registros no painel do Resend.",
    );
  }
}

export async function resetPassword(token, password) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    fail(400, "Link inválido ou expirado. Solicite outro.");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 256 ||
    password !== password.trim()
  )
    fail(400, "Use de 8 a 256 caracteres, sem espaços no início ou fim.");
  const tokenHash = digest(token);
  const user = await transaction(async () => {
    const candidate = await get(
      "SELECT user_id FROM password_resets WHERE token_hash=?",
      tokenHash,
    );
    if (!candidate) fail(400, "Link inválido ou expirado. Solicite outro.");
    const user = await get(
      "SELECT id,email FROM users WHERE id=? FOR UPDATE",
      candidate.user_id,
    );
    const valid = await get(
      "DELETE FROM password_resets WHERE user_id=? AND token_hash=? AND expires>? RETURNING user_id",
      user.id,
      tokenHash,
      Date.now(),
    );
    if (!valid) fail(400, "Link inválido ou expirado. Solicite outro.");
    await run(
      "UPDATE users SET password=?,email_verified=true WHERE id=?",
      await hash(password),
      user.id,
    );
    await run("DELETE FROM sessions WHERE user_id=?", user.id);
    await run("DELETE FROM email_verifications WHERE user_id=?", user.id);
    return user;
  });
  void sendEmail(
    user.email,
    "Sua senha foi alterada — Tá Marcado",
    "Sua senha foi alterada. Entre novamente no site com a nova senha. Se não foi você, solicite uma nova recuperação e contate o responsável pelo site.",
    passwordChangedEmailHtml(),
  ).catch(() =>
    console.error("Falha ao enviar confirmação da troca de senha."),
  );
  return { message: "Senha alterada. Entre com sua nova senha." };
}
