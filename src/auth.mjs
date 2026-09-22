import { get, run } from "./database.mjs";
import { id } from "./passwords.mjs";
import { fail } from "./validation.mjs";
import { secureCookie } from "./config.mjs";
export async function session(req) {
  const token = (req.headers.cookie || "").match(
    /(?:^|;\s*)tm_session=([a-f0-9]+)/,
  )?.[1];
  return (
    token &&
    (await get(
      "SELECT u.id,u.nome,u.email,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=? AND s.expires>? AND u.email_verified=true",
      token,
      Date.now(),
    ))
  );
}
export async function auth(req) {
  return (
    (await session(req)) || fail(401, "Entre na sua conta para continuar.")
  );
}
export async function allowed(req, eid, write = false) {
  const u = await auth(req),
    e = await get("SELECT * FROM events WHERE id=?", eid);
  if (
    !e ||
    !(
      e.owner === u.id ||
      (!write &&
        (await get(
          "SELECT * FROM access WHERE event_id=? AND user_id=?",
          eid,
          u.id,
        )))
    )
  )
    fail(403, "Você não tem permissão para este evento.");
  return e;
}
export async function guestAuth(eid, token) {
  return (
    (await get(
      "SELECT * FROM guests WHERE event_id=? AND token=?",
      eid,
      token || "",
    )) ||
    fail(404, "Convite não encontrado. Peça o link individual ao organizador.")
  );
}
export async function loginCookie(res, uid) {
  const token = id();
  await run("DELETE FROM sessions WHERE expires<?", Date.now());
  await run(
    "INSERT INTO sessions VALUES(?,?,?)",
    token,
    uid,
    Date.now() + 86400000,
  );
  res.setHeader(
    "Set-Cookie",
    `tm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secureCookie}`,
  );
}
