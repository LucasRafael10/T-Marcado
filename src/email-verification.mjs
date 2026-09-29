import { createHash, randomBytes } from "node:crypto";
import { get, run, transaction } from "./database.mjs";
import { loginCookie } from "./auth.mjs";
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
      "SELECT id,email,email_verified,role FROM users WHERE email=? FOR UPDATE",
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
      `Confirme seu e-mail${recipient.role === "cerimonialista" ? " e defina sua senha pessoal" : " no mesmo navegador usado no cadastro; sua senha já foi definida"}. Link válido por 30 minutos e uso único:\n${url}\nSe você não reconhece o cadastro ou convite, ignore esta mensagem.`,
      verificationEmailHtml(url, recipient.role === "cerimonialista"),
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

async function candidateFor(token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    fail(400, "Link inválido ou expirado. Solicite outro.");
  const c = await get(
    "SELECT v.user_id,u.role FROM email_verifications v JOIN users u ON u.id=v.user_id WHERE v.token_hash=? AND v.expires>?",
    digest(token),
    Date.now(),
  );
  if (!c) fail(400, "Link inválido ou expirado. Solicite outro.");
  return c;
}
export async function verificationInfo(token, browser) {
  const c = await candidateFor(token);
  return {
    needsPassword: c.role === "cerimonialista",
    sameBrowser: browser?.id === c.user_id,
  };
}
export async function confirmEmail(
  token,
  password,
  confirmation,
  browser,
  res,
) {
  const c = await candidateFor(token),
    planner = c.role === "cerimonialista";
  if (!planner && browser?.id !== c.user_id)
    fail(
      403,
      "Abra este link no navegador em que fez o cadastro. Se perdeu o acesso, entre com sua senha ou use Esqueci minha senha.",
    );
  let passwordHash;
  if (planner) {
    if (
      typeof password !== "string" ||
      password.length < 8 ||
      password.length > 256 ||
      password !== password.trim() ||
      password !== confirmation
    )
      fail(400, "Use de 8 a 256 caracteres e confirme a mesma senha.");
    passwordHash = await hash(password);
  }
  await transaction(async () => {
    await get("SELECT id FROM users WHERE id=? FOR UPDATE", c.user_id);
    if (
      !planner &&
      !(await get(
        "SELECT token FROM sessions WHERE user_id=? AND token=? AND expires>?",
        c.user_id,
        browser.token,
        Date.now(),
      ))
    )
      fail(403, "Sessão expirada. Entre novamente.");
    const valid = await get(
      "DELETE FROM email_verifications WHERE user_id=? AND token_hash=? AND expires>? RETURNING user_id",
      c.user_id,
      digest(token),
      Date.now(),
    );
    if (!valid) fail(400, "Link inválido ou expirado. Solicite outro.");
    if (planner)
      await run(
        "UPDATE users SET email_verified=true,password=? WHERE id=?",
        passwordHash,
        c.user_id,
      );
    else
      await run("UPDATE users SET email_verified=true WHERE id=?", c.user_id);
    await run("DELETE FROM password_resets WHERE user_id=?", c.user_id);
    if (planner) await run("DELETE FROM sessions WHERE user_id=?", c.user_id);
    else
      await run(
        "DELETE FROM sessions WHERE user_id=? AND token<>?",
        c.user_id,
        browser.token,
      );
  });
  if (planner && res) await loginCookie(res, c.user_id);
  return { message: "E-mail confirmado! Abrindo seu painel…", role: c.role };
}
