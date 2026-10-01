import { randomBytes } from "node:crypto";
import { adminAccounts, manualApproval } from "./admin-config.mjs";
import { get, all, run, transaction } from "./database.mjs";
import { verify, hash, id } from "./passwords.mjs";
import { fail } from "./validation.mjs";
import { secureCookie } from "./config.mjs";
import { limit, consume } from "./rate-limit.mjs";
import { digest, audit, issueManualLink } from "./manual-recovery.mjs";
const duration = 8 * 60 * 60 * 1000;
const dummyHash = await hash(randomBytes(32).toString("hex"));
const cookieToken = (req) =>
  (req.headers.cookie || "").match(
    /(?:^|;\s*)tm_admin=([a-f0-9]{64})(?:;|$)/,
  )?.[1];
function requireConfigured() {
  if (adminAccounts().length !== 3)
    fail(503, "A administração ainda não foi configurada pelo responsável.");
}
export async function adminSession(req) {
  requireConfigured();
  const token = cookieToken(req);
  if (!token) return null;
  const session = await get(
    "SELECT admin_email,credential_version FROM admin_sessions WHERE token_hash=? AND expires>?",
    digest(token),
    Date.now(),
  );
  const account =
    session && adminAccounts().find((a) => a.email === session.admin_email);
  if (!account || session.credential_version !== digest(account.passwordHash))
    return null;
  return account;
}
async function requireAdmin(req) {
  return (
    (await adminSession(req)) ||
    fail(401, "Entre com sua conta de administrador.")
  );
}
function pageOffset(url) {
  const page = Number(url.searchParams.get("page") || 1);
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
    fail(400, "Página inválida.");
  return { page, offset: (page - 1) * 25 };
}
async function confirmation(req, admin, b, approve) {
  await limit(req, "admin-decisions", 20);
  await consume("admin-reauth:" + admin.email, 10);
  if (
    typeof b.password !== "string" ||
    b.password.length > 256 ||
    !(await verify(b.password, admin.passwordHash))
  )
    fail(401, "Confirme sua senha administrativa para continuar.");
  if (approve && b.identityConfirmed !== true)
    fail(400, "Confira a identidade da pessoa antes de aprovar.");
  const note = typeof b.note === "string" ? b.note.trim() : "";
  if (note.length < 8 || note.length > 500)
    fail(
      400,
      "Registre uma justificativa de 8 a 500 caracteres, sem senhas ou documentos.",
    );
  return note;
}
export async function adminRoute(req, res, url, b) {
  requireConfigured();
  const p = url.pathname,
    m = req.method;
  if (p === "/api/admin/login" && m === "POST") {
    await limit(req, "admin-login", 8);
    const email =
      typeof b.email === "string"
        ? b.email.trim().toLowerCase().slice(0, 254)
        : "";
    await consume("admin-login-account:" + email, 8);
    const account = adminAccounts().find((a) => a.email === email);
    const password =
      typeof b.password === "string" && b.password.length <= 256
        ? b.password
        : "";
    const valid = await verify(password, account?.passwordHash || dummyHash);
    if (!account || !valid)
      fail(401, "E-mail ou senha administrativa incorretos.");
    const token = randomBytes(32).toString("hex");
    await transaction(async () => {
      await run("DELETE FROM admin_sessions WHERE expires<?", Date.now());
      const old = cookieToken(req);
      if (old)
        await run("DELETE FROM admin_sessions WHERE token_hash=?", digest(old));
      await run(
        "INSERT INTO admin_sessions(token_hash,admin_email,credential_version,expires,created_at) VALUES(?,?,?,?,?)",
        digest(token),
        email,
        digest(account.passwordHash),
        Date.now() + duration,
        Date.now(),
      );
      await audit(email, "admin_login", null);
    });
    res.setHeader(
      "Set-Cookie",
      `tm_admin=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${duration / 1000}${secureCookie}`,
    );
    return { name: account.name, email: account.email };
  }
  const admin = await requireAdmin(req);
  if (p === "/api/admin/me" && m === "GET")
    return {
      name: admin.name,
      email: admin.email,
      mode: manualApproval ? "manual" : "email",
    };
  if (p === "/api/admin/logout" && m === "POST") {
    await run(
      "DELETE FROM admin_sessions WHERE token_hash=?",
      digest(cookieToken(req)),
    );
    res.setHeader(
      "Set-Cookie",
      `tm_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${secureCookie}`,
    );
    return { ok: true };
  }
  if (!manualApproval)
    fail(503, "Ative ACCESS_APPROVAL_MODE=manual para usar as aprovações.");
  if (p === "/api/admin/summary" && m === "GET")
    return await get(
      `SELECT
  (SELECT count(*) FROM users WHERE account_status='pending') AS accounts,
  (SELECT count(*) FROM manual_access_requests WHERE status='pending') AS resets,
  (SELECT count(*) FROM admin_audit WHERE action IN ('account_approved','account_rejected','recovery_link_issued','recovery_rejected') AND created_at>?) AS decisions`,
      Date.now() - 86400000,
    );
  if (p === "/api/admin/accounts" && m === "GET") {
    const status = url.searchParams.get("status") || "pending";
    if (!["pending", "approved", "rejected"].includes(status))
      fail(400, "Status inválido.");
    const { page, offset } = pageOffset(url);
    return {
      page,
      items: await all(
        "SELECT id,nome,email,role,account_status,created_at FROM users WHERE account_status=? ORDER BY created_at DESC,id LIMIT 25 OFFSET ?",
        status,
        offset,
      ),
    };
  }
  if (p === "/api/admin/resets" && m === "GET") {
    const { page, offset } = pageOffset(url);
    return {
      page,
      items: await all(
        `SELECT r.id,r.kind,r.status,r.requested_at,r.expires,u.nome,u.email
    FROM manual_access_requests r JOIN users u ON u.id=r.user_id
    WHERE r.status IN ('pending','approved') ORDER BY r.requested_at DESC,r.id LIMIT 25 OFFSET ?`,
        offset,
      ),
    };
  }
  if (p === "/api/admin/audit" && m === "GET") {
    const { page, offset } = pageOffset(url);
    return {
      page,
      items: await all(
        `SELECT a.id,a.actor,a.action,a.target_id,a.note,a.created_at,COALESCE(u.email,ru.email) AS target_email FROM admin_audit a LEFT JOIN users u ON u.id=a.target_id LEFT JOIN manual_access_requests r ON r.id=a.target_id LEFT JOIN users ru ON ru.id=r.user_id ORDER BY a.created_at DESC,a.id LIMIT 25 OFFSET ?`,
        offset,
      ),
    };
  }
  const target = p.match(
    /^\/api\/admin\/(accounts|resets)\/([a-f0-9]{36})\/(approve|reject)$/,
  );
  if (target && m === "POST") {
    const [, type, targetId, decision] = target;
    const note = await confirmation(req, admin, b, decision === "approve");
    return transaction(async () => {
      if (type === "accounts") {
        const user = await get(
          "SELECT id,role,account_status FROM users WHERE id=? FOR UPDATE",
          targetId,
        );
        if (!user) fail(404, "Conta não encontrada.");
        if (user.account_status !== "pending")
          fail(409, "Esta conta já foi analisada. Atualize a lista.");
        await run(
          "UPDATE users SET account_status=? WHERE id=?",
          decision === "approve" ? "approved" : "rejected",
          targetId,
        );
        await run("DELETE FROM email_verifications WHERE user_id=?", targetId);
        await run("DELETE FROM password_resets WHERE user_id=?", targetId);
        await audit(
          admin.email,
          decision === "approve" ? "account_approved" : "account_rejected",
          targetId,
          note,
        );
        if (decision === "reject")
          await run("DELETE FROM sessions WHERE user_id=?", targetId);
        if (decision === "approve" && user.role === "cerimonialista") {
          const requestId = id();
          await run(
            "INSERT INTO manual_access_requests(id,user_id,kind,status,requested_at) VALUES(?,?,'activation','pending',?)",
            requestId,
            targetId,
            Date.now(),
          );
          return issueManualLink(requestId, targetId, admin.email, note);
        }
        return {
          message:
            decision === "approve"
              ? "Conta aprovada. A pessoa já pode entrar com a senha cadastrada."
              : "Conta recusada.",
        };
      }
      const candidate = await get(
        "SELECT user_id FROM manual_access_requests WHERE id=?",
        targetId,
      );
      if (!candidate) fail(404, "Pedido não encontrado.");
      const user = await get(
        "SELECT id,account_status FROM users WHERE id=? FOR UPDATE",
        candidate.user_id,
      );
      const request = await get(
        "SELECT id,status FROM manual_access_requests WHERE id=? FOR UPDATE",
        targetId,
      );
      if (!request || !["pending", "approved"].includes(request.status))
        fail(409, "Este pedido já foi finalizado.");
      if (decision === "reject") {
        await run(
          "UPDATE manual_access_requests SET status='rejected',token_hash=NULL,expires=NULL,reviewed_at=?,reviewed_by=? WHERE id=?",
          Date.now(),
          admin.email,
          targetId,
        );
        await audit(admin.email, "recovery_rejected", targetId, note);
        return { message: "Pedido recusado. A senha atual foi preservada." };
      }
      if (user.account_status !== "approved")
        fail(403, "A conta precisa estar aprovada antes da recuperação.");
      return issueManualLink(targetId, user.id, admin.email, note);
    });
  }
  fail(404, "Operação administrativa não encontrada.");
}
