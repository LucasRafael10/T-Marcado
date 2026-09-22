import { run } from "./database.mjs";
import { id, hash } from "./passwords.mjs";
export async function user(nome, email, password, role) {
  const uid = id();
  await run(
    "INSERT INTO users(id,nome,email,password,role) VALUES(?,?,?,?,?)",
    uid,
    nome,
    email,
    await hash(password),
    role,
  );
  return uid;
}
export async function event(owner, titulo, tipo, data, local, prazo) {
  const eid = id();
  await run(
    "INSERT INTO events(id,owner,titulo,tipo,data,local,prazo) VALUES(?,?,?,?,?,?,?)",
    eid,
    owner,
    titulo,
    tipo,
    data,
    local,
    prazo,
  );
  return eid;
}
export async function guest(eid, g) {
  const gid = id();
  await run(
    "INSERT INTO guests(id,event_id,token,nome,telefone,grupo,limite,status,lugares,restricao,criancas,respondido) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
    gid,
    eid,
    id(),
    g.nome,
    g.telefone,
    g.grupo || "Sem grupo",
    g.limite || 2,
    g.status || "pendente",
    g.lugares || 0,
    g.restricao || "",
    g.criancas || 0,
    g.respondido || "",
  );
  return gid;
}
