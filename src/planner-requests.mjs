import { get, all, run } from "./database.mjs";
import { id } from "./passwords.mjs";
import { fail, txt } from "./validation.mjs";
import { manualApproval } from "./admin-config.mjs";

const activeOwner = manualApproval
  ? "u.account_status='approved'"
  : "u.email_verified=true";

// Durante a atualização do banco, os eventos já existentes continuam disponíveis.
export async function requirePlannerRequests() {
  const ready = await get(
    "SELECT to_regclass('public.planner_requests') AS table_name",
  );
  if (!ready.table_name)
    fail(
      503,
      "As solicitações de cerimonialista estão temporariamente indisponíveis. Entre em contato com a equipe.",
    );
}

// O chamador mantém a transação e o bloqueio do evento (ou acaba de criá-lo).
export async function requestPlanner(eid, rawEmail) {
  await requirePlannerRequests();
  const email = txt(rawEmail, "E-mail da cerimonialista", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fail(400, "Informe um e-mail válido para a cerimonialista.");
  const planner = await get(
    "SELECT id,role,account_status FROM users WHERE email=?",
    email,
  );
  if (
    !planner ||
    planner.role !== "cerimonialista" ||
    (manualApproval && planner.account_status === "rejected")
  )
    fail(
      400,
      "Não encontramos uma conta de cerimonialista disponível com esse e-mail. Peça que ela se cadastre como cerimonialista e confira o endereço.",
    );
  if (
    await get(
      "SELECT event_id FROM access WHERE event_id=? AND user_id=?",
      eid,
      planner.id,
    )
  )
    return {
      status: "accepted",
      message: "Esta cerimonialista já tem acesso ao evento.",
    };
  const previous = await get(
    "SELECT id,status FROM planner_requests WHERE event_id=? AND planner_id=?",
    eid,
    planner.id,
  );
  if (previous?.status === "pending")
    return {
      status: "pending",
      message:
        "A solicitação já foi enviada. Aguarde a resposta da cerimonialista.",
    };
  await run(
    `INSERT INTO planner_requests(id,event_id,planner_id,status,requested_at) VALUES(?,?,?,'pending',?)
     ON CONFLICT(event_id,planner_id) DO UPDATE SET id=EXCLUDED.id,status='pending',requested_at=EXCLUDED.requested_at,reviewed_at=NULL`,
    id(),
    eid,
    planner.id,
    Date.now(),
  );
  return {
    status: "pending",
    message:
      "Solicitação enviada. O evento será liberado para a cerimonialista quando ela aceitar.",
  };
}

export async function plannerInbox(u) {
  if (u.role !== "cerimonialista")
    fail(403, "Esta área é exclusiva para cerimonialistas.");
  await requirePlannerRequests();
  // Antes do aceite, somente os dados necessários para reconhecer o pedido.
  return all(
    `SELECT r.id,r.event_id,r.requested_at,e.titulo,e.tipo,e.data,u.nome AS cliente_nome,u.email AS cliente_email
     FROM planner_requests r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=e.owner
     WHERE r.planner_id=? AND r.status='pending' AND ${activeOwner} ORDER BY r.requested_at DESC,r.id`,
    u.id,
  );
}

export async function respondToPlannerRequest(u, eid, b) {
  if (u.role !== "cerimonialista")
    fail(403, "Somente a cerimonialista pode responder ao pedido.");
  if (
    !["accepted", "rejected"].includes(b.decision) ||
    typeof b.requestId !== "string"
  )
    fail(400, "Escolha aceitar ou recusar a solicitação.");
  await requirePlannerRequests();
  const request = await get(
    `SELECT r.id,r.status FROM planner_requests r JOIN events e ON e.id=r.event_id JOIN users u ON u.id=e.owner
     WHERE r.id=? AND r.event_id=? AND r.planner_id=? AND ${activeOwner}`,
    b.requestId,
    eid,
    u.id,
  );
  if (!request) fail(404, "Solicitação não encontrada. Atualize a lista.");
  if (request.status !== "pending")
    fail(409, "Esta solicitação já foi respondida. Atualize a lista.");
  await run(
    "UPDATE planner_requests SET status=?,reviewed_at=? WHERE id=?",
    b.decision,
    Date.now(),
    request.id,
  );
  if (b.decision === "accepted")
    await run(
      "INSERT INTO access(event_id,user_id) VALUES(?,?) ON CONFLICT DO NOTHING",
      eid,
      u.id,
    );
  return {
    message:
      b.decision === "accepted"
        ? "Cliente aceita. O evento já está disponível em Seus eventos."
        : "Solicitação recusada. O evento não foi vinculado.",
  };
}

export async function ownerPlannerRequests(eid) {
  await requirePlannerRequests();
  return all(
    `SELECT u.email,u.nome,r.status FROM planner_requests r JOIN users u ON u.id=r.planner_id WHERE r.event_id=?
     UNION ALL
     SELECT u.email,u.nome,'accepted' AS status FROM access a JOIN users u ON u.id=a.user_id WHERE a.event_id=?
     AND NOT EXISTS(SELECT 1 FROM planner_requests r WHERE r.event_id=a.event_id AND r.planner_id=a.user_id)
     ORDER BY email`,
    eid,
    eid,
  );
}
