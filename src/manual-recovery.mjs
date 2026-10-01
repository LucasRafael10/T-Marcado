import { createHash, randomBytes } from "node:crypto";
import { get, run, transaction } from "./database.mjs";
import { hash, id } from "./passwords.mjs";
import { fail } from "./validation.mjs";
import { appOrigin } from "./config.mjs";
export const digest = (value) =>
  createHash("sha256").update(value).digest("hex");
export async function audit(actor, action, targetId, note = "") {
  await run(
    "INSERT INTO admin_audit(id,actor,action,target_id,note,created_at) VALUES(?,?,?,?,?,?)",
    id(),
    actor,
    action,
    targetId,
    note,
    Date.now(),
  );
}
export async function requestManualReset(email) {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  )
    fail(400, "Informe um e-mail válido.");
  email = email.trim().toLowerCase();
  // Mesma operação/resposta para endereços existentes e inexistentes. Sem token no retorno.
  await run(
    `INSERT INTO manual_access_requests(id,user_id,kind,status,requested_at)
    SELECT ?,u.id,'password_reset','pending',? FROM users u
    WHERE u.email=? AND u.account_status='approved'
    AND NOT EXISTS(SELECT 1 FROM manual_access_requests r WHERE r.user_id=u.id AND
      (r.status='pending' OR (r.status='approved' AND r.expires>?) OR r.requested_at>?))
    ON CONFLICT DO NOTHING`,
    id(),
    Date.now(),
    email,
    Date.now(),
    Date.now() - 60000,
  );
  return {
    message:
      "Se houver uma conta habilitada com esse e-mail, o pedido ficará disponível para análise da equipe. Entre em contato com o responsável pelo Tá Marcado para confirmar sua identidade e receber as instruções. Nenhuma senha foi alterada.",
  };
}
// Chamada dentro da transação de aprovação; o link é exibido somente uma vez ao administrador.
export async function issueManualLink(requestId, userId, actor, note) {
  const token = randomBytes(32).toString("hex"),
    expires = Date.now() + 1800000;
  await run(
    "UPDATE manual_access_requests SET token_hash=NULL,expires=NULL,status='rejected' WHERE user_id=? AND id<>? AND status='approved'",
    userId,
    requestId,
  );
  await run("DELETE FROM password_resets WHERE user_id=?", userId);
  await run(
    "UPDATE manual_access_requests SET status='approved',token_hash=?,expires=?,reviewed_at=?,reviewed_by=? WHERE id=?",
    digest(token),
    expires,
    Date.now(),
    actor,
    requestId,
  );
  await audit(actor, "recovery_link_issued", requestId, note);
  return {
    message:
      "Link autorizado. Entregue somente à pessoa cuja identidade você conferiu.",
    url: `${appOrigin}/redefinir-senha.html#token=${token}`,
    expires,
  };
}
export async function resetManually(token, password, confirmation) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    fail(400, "Link inválido ou expirado. Contate a equipe.");
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 256 ||
    password !== password.trim() ||
    password !== confirmation
  )
    fail(400, "Use de 8 a 256 caracteres e confirme a mesma senha.");
  const tokenHash = digest(token);
  const candidate = await get(
    "SELECT user_id FROM manual_access_requests WHERE token_hash=? AND status='approved' AND expires>?",
    tokenHash,
    Date.now(),
  );
  if (!candidate) fail(400, "Link inválido ou expirado. Contate a equipe.");
  const passwordHash = await hash(password);
  await transaction(async () => {
    const user = await get(
      "SELECT id,account_status FROM users WHERE id=? FOR UPDATE",
      candidate.user_id,
    );
    if (!user || user.account_status !== "approved")
      fail(403, "Esta conta ainda não está aprovada.");
    const valid = await get(
      "UPDATE manual_access_requests SET status='completed',token_hash=NULL,completed_at=? WHERE user_id=? AND token_hash=? AND status='approved' AND expires>? RETURNING id",
      Date.now(),
      user.id,
      tokenHash,
      Date.now(),
    );
    if (!valid) fail(400, "Link inválido ou expirado. Contate a equipe.");
    await run("UPDATE users SET password=? WHERE id=?", passwordHash, user.id);
    await run("DELETE FROM sessions WHERE user_id=?", user.id);
    await run("DELETE FROM password_resets WHERE user_id=?", user.id);
    await run("DELETE FROM email_verifications WHERE user_id=?", user.id);
    await audit("user:" + user.id, "password_reset_completed", valid.id);
  });
  return {
    message:
      "Senha alterada. Entre com sua nova senha. Todas as sessões anteriores foram encerradas.",
  };
}
