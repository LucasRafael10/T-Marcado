import { get, all, run, transaction } from "./database.mjs";
import { appOrigin, secureCookie } from "./config.mjs";
import { id, verify } from "./passwords.mjs";
import { user, event, guest } from "./repository.mjs";
import { auth, allowed, guestAuth, loginCookie } from "./auth.mjs";
import { requestReset, resetPassword } from "./password-reset.mjs";
import {
  fail,
  txt,
  phone,
  integer,
  date,
  norm,
  today,
  deadline,
} from "./validation.mjs";
const rates = new Map();
function limit(req, key, max = 30) {
  const k = req.socket.remoteAddress + key,
    now = Date.now();
  for (const [entry, value] of rates)
    if (value.until < now) rates.delete(entry);
  let r = rates.get(k);
  if (!r || r.until < now) r = { n: 0, until: now + 60000 };
  rates.set(k, r);
  if (++r.n > max) fail(429, "Muitas tentativas. Aguarde um minuto.");
}
async function body(req) {
  const max =
    req.method === "PATCH" && /^\/api\/events\/[a-f0-9]+(?:\?|$)/.test(req.url)
      ? 3000000
      : 100000;
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > max) fail(413, "Dados muito grandes.");
  }
  try {
    return JSON.parse(data || "{}");
  } catch {
    fail(400, "Dados inválidos.");
  }
}
export async function api(req, res, url) {
  const p = url.pathname,
    m = req.method;
  if (m !== "GET" && req.headers.origin !== appOrigin)
    fail(403, "Origem da solicitação inválida.");
  const b = m === "GET" ? {} : await body(req);
  if (!b || typeof b !== "object" || Array.isArray(b))
    fail(400, "Dados inválidos.");
  const eventId = p.match(/^\/api\/events\/([a-f0-9]+)(?:\/|$)/)?.[1];
  if (eventId && m !== "GET") {
    // Serializa alterações do mesmo evento, inclusive confirmação e reserva.
    return transaction(async () => {
      await get("SELECT id FROM events WHERE id=? FOR UPDATE", eventId);
      return route(req, res, url, b);
    });
  }
  return route(req, res, url, b);
}

async function route(req, res, url, b) {
  const p = url.pathname,
    m = req.method;
  if (p === "/api/forgot-password" && m === "POST") {
    limit(req, "forgot-password", 10);
    return requestReset(b.email);
  }
  if (p === "/api/reset-password" && m === "POST") {
    limit(req, "reset-password", 10);
    return resetPassword(b.token, b.password);
  }
  if (p === "/api/login" && m === "POST") {
    limit(req, "login", 12);
    const u = await get(
      "SELECT * FROM users WHERE email=?",
      String(b.email || "")
        .trim()
        .toLowerCase(),
    );
    if (
      !u ||
      typeof b.password !== "string" ||
      b.password.length > 256 ||
      !verify(b.password, u.password) ||
      u.role !== b.role
    )
      fail(401, "E-mail, senha ou perfil incorreto.");
    await loginCookie(res, u.id);
    return { role: u.role };
  }
  if (p === "/api/logout" && m === "POST") {
    const token = (req.headers.cookie || "").match(
      /tm_session=([a-f0-9]+)/,
    )?.[1];
    if (token) await run("DELETE FROM sessions WHERE token=?", token);
    res.setHeader(
      "Set-Cookie",
      `tm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`,
    );
    return { ok: true };
  }
  if (p === "/api/register" && m === "POST") {
    limit(req, "register", 10);
    const nome = txt(b.nome, "Nome"),
      email = txt(b.email, "E-mail").toLowerCase(),
      password = txt(b.password, "Senha", 256);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8)
      fail(
        400,
        "Informe um e-mail válido e uma senha com pelo menos 8 caracteres.",
      );
    if (typeof b.passwordConfirm !== "string" || password !== b.passwordConfirm)
      fail(400, "As senhas precisam ser iguais.");
    if (await get("SELECT id FROM users WHERE email=?", email))
      fail(409, "Este e-mail já tem conta. Use Entrar.");
    const data = date(b.data, "Data"),
      prazo = date(b.prazo, "Prazo");
    if (prazo > data || data < today())
      fail(400, "Confira a data do evento e o prazo de confirmação.");
    const titulo = txt(b.titulo, "Nome do evento"),
      tipo = txt(b.tipo, "Tipo"),
      local = txt(b.local, "Local");
    const uid = await transaction(async () => {
      const uid = await user(nome, email, password, "noiva");
      await event(uid, titulo, tipo, data, local, prazo);
      return uid;
    });
    await loginCookie(res, uid);
    return { ok: true };
  }
  if (p === "/api/me" && m === "GET") return await auth(req);
  if (p === "/api/events" && m === "GET") {
    const u = await auth(req);
    return Promise.all(
      (
        await all(
          "SELECT DISTINCT e.* FROM events e LEFT JOIN access a ON a.event_id=e.id WHERE e.owner=? OR a.user_id=? ORDER BY e.data",
          u.id,
          u.id,
        )
      ).map(async (e) => ({
        ...e,
        guests: (
          await all("SELECT * FROM guests WHERE event_id=? ORDER BY nome", e.id)
        ).map((g) => {
          if (e.owner !== u.id) delete g.token;
          return g;
        }),
        gifts: await all(
          "SELECT f.*,g.nome AS reservado_por FROM gifts f LEFT JOIN guests g ON g.id=f.guest_id WHERE f.event_id=?",
          e.id,
        ),
      })),
    );
  }
  const match = p.match(/^\/api\/events\/([a-f0-9]+)(?:\/(.*))?$/);
  if (match) {
    const [, eid, action] = match;
    if (action === "public" && m === "GET") {
      const e =
        (await get(
          "SELECT id,titulo,tipo,data,local,prazo,cor,imagem,dresscode,presskit FROM events WHERE id=?",
          eid,
        )) || fail(404, "Evento não encontrado.");
      const g = url.searchParams.get("token")
        ? await guestAuth(eid, url.searchParams.get("token"))
        : null;
      return {
        event: e,
        guest: g
          ? {
              nome: g.nome,
              limite: g.limite,
              status: g.status,
              lugares: g.lugares,
              criancas: g.criancas,
              restricao: g.restricao,
              recado: g.recado,
              endereco: g.endereco,
            }
          : null,
      };
    }
    if (action === "identify" && m === "POST") {
      limit(req, "identify", 15);
      const g = await guestAuth(eid, b.token);
      if (norm(String(b.nome || "")) !== norm(g.nome))
        fail(400, "Digite o nome completo que aparece no seu convite.");
      return {
        nome: g.nome,
        limite: g.limite,
        status: g.status,
        lugares: g.lugares,
        criancas: g.criancas,
        restricao: g.restricao,
        recado: g.recado,
        endereco: g.endereco,
      };
    }
    if (action === "self-register" && m === "POST") {
      limit(req, "self-register", 10);
      const e =
        (await get("SELECT * FROM events WHERE id=?", eid)) ||
        fail(404, "Evento não encontrado.");
      deadline(e);
      const nome = txt(b.nome, "Nome"),
        telefone = phone(b.telefone);
      if (
        await get(
          "SELECT id FROM guests WHERE event_id=? AND telefone=?",
          eid,
          telefone,
        )
      )
        fail(
          409,
          "Já existe um cadastro com este telefone. Peça seu link ao organizador.",
        );
      await guest(eid, { nome, telefone, status: "aprovacao", limite: 1 });
      return { ok: true };
    }
    if (action === "response" && m === "POST") {
      const e =
        (await get("SELECT * FROM events WHERE id=?", eid)) ||
        fail(404, "Evento não encontrado.");
      deadline(e);
      const g = await guestAuth(eid, b.token);
      if (g.status === "aprovacao")
        fail(403, "Seu cadastro precisa ser aprovado antes de confirmar.");
      if (!["confirmado", "recusado"].includes(b.status))
        fail(400, "Escolha se vai ao evento.");
      const yes = b.status === "confirmado",
        lugares = yes ? integer(b.lugares, 1, g.limite, "Pessoas") : 0,
        criancas = yes ? integer(b.criancas, 0, lugares, "Crianças") : 0;
      const recado = String(b.recado || "").trim(),
        restricao = yes ? String(b.restricao || "").trim() : "";
      if (recado.length > 1000 || restricao.length > 160)
        fail(400, "Reduza o tamanho da mensagem.");
      const endereco = e.presskit
        ? String(b.endereco ?? g.endereco).trim()
        : g.endereco;
      if (endereco.length > 600)
        fail(400, "Endereço: máximo de 600 caracteres.");
      await transaction(async () => {
        await run(
          "UPDATE guests SET status=?,lugares=?,criancas=?,restricao=?,recado=?,respondido=?,endereco=? WHERE id=?",
          b.status,
          lugares,
          criancas,
          restricao,
          recado,
          today(),
          endereco,
          g.id,
        );
        if (!yes)
          await run("UPDATE gifts SET guest_id=NULL WHERE guest_id=?", g.id);
      });
      return { ok: true };
    }
    if (action === "gifts" && m === "GET") {
      const g = await guestAuth(eid, url.searchParams.get("token"));
      return (
        await all(
          "SELECT id,nome,valor,guest_id FROM gifts WHERE event_id=?",
          eid,
        )
      ).map((f) => ({
        id: f.id,
        nome: f.nome,
        valor: f.valor,
        reservado: !!f.guest_id,
        meu: f.guest_id === g.id,
      }));
    }
    if (action?.startsWith("reserve/") && m === "POST") {
      const g = await guestAuth(eid, b.token);
      const e = await get("SELECT * FROM events WHERE id=?", eid);
      deadline(e);
      if (g.status !== "confirmado")
        fail(403, "Confirme sua presença antes de reservar.");
      const fid = action.slice(8);
      if (b.cancel) {
        const result = await run(
          "UPDATE gifts SET guest_id=NULL WHERE id=? AND event_id=? AND guest_id=?",
          fid,
          eid,
          g.id,
        );
        if (!result.changes) fail(409, "Esta reserva não é sua.");
      } else {
        const result = await run(
          "UPDATE gifts SET guest_id=? WHERE id=? AND event_id=? AND guest_id IS NULL",
          g.id,
          fid,
          eid,
        );
        if (!result.changes)
          fail(409, "Este presente já foi reservado. Atualize a lista.");
      }
      return { ok: true };
    }
    const e = await allowed(req, eid, m !== "GET");
    if (!action && m === "PATCH") {
      const titulo = txt(b.titulo, "Nome"),
        local = txt(b.local, "Local"),
        data = date(b.data, "Data"),
        prazo = date(b.prazo, "Prazo");
      if (prazo > data) fail(400, "O prazo não pode ser depois do evento.");
      const cor = b.cor ?? e.cor,
        imagem = b.imagem ?? e.imagem,
        dresscode = b.dresscode ?? e.dresscode,
        presskit = b.presskit ?? e.presskit;
      if (typeof cor !== "string" || !/^#[0-9a-f]{6}$/i.test(cor))
        fail(400, "Cor inválida.");
      if (typeof dresscode !== "string" || dresscode.length > 1000)
        fail(400, "Dress code: máximo de 1000 caracteres.");
      if (typeof presskit !== "boolean")
        fail(400, "Opção de press kit inválida.");
      if (typeof imagem !== "string" || imagem.length > 2800000)
        fail(400, "Imagem muito grande (máximo 2 MB).");
      if (imagem) {
        const match = imagem.match(
          /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/,
        );
        if (!match) fail(400, "Envie uma imagem PNG, JPEG ou WebP.");
        const bytes = Buffer.from(match[2], "base64");
        const valid =
          match[1] === "png"
            ? bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
            : match[1] === "jpeg"
              ? bytes.subarray(0, 3).toString("hex") === "ffd8ff"
              : bytes.toString("ascii", 0, 4) === "RIFF" &&
                bytes.toString("ascii", 8, 12) === "WEBP";
        if (!valid || bytes.length > 2 * 1024 * 1024)
          fail(400, "Imagem inválida ou maior que 2 MB.");
      }
      await run(
        "UPDATE events SET titulo=?,local=?,data=?,prazo=?,cor=?,imagem=?,dresscode=?,presskit=? WHERE id=?",
        titulo,
        local,
        data,
        prazo,
        cor,
        imagem,
        dresscode.trim(),
        presskit,
        eid,
      );
      return { ok: true };
    }
    if (action === "guests" && m === "POST") {
      const nome = txt(b.nome, "Nome"),
        telefone = phone(b.telefone),
        grupo = txt(b.grupo || "Sem grupo", "Grupo"),
        limite = integer(b.limite, 1, 30, "Limite");
      if (
        await get(
          "SELECT id FROM guests WHERE event_id=? AND telefone=?",
          eid,
          telefone,
        )
      )
        fail(409, "Este telefone já está na lista.");
      await guest(eid, { nome, telefone, grupo, limite });
      return { ok: true };
    }
    if (action?.startsWith("guests/") && m === "PATCH") {
      const gid = action.slice(7),
        g =
          (await get(
            "SELECT * FROM guests WHERE id=? AND event_id=?",
            gid,
            eid,
          )) || fail(404, "Convidado não encontrado.");
      if (b.approve) {
        if (g.status !== "aprovacao") fail(409, "Cadastro já analisado.");
        await run("UPDATE guests SET status='pendente' WHERE id=?", gid);
      } else {
        const nome = txt(b.nome, "Nome"),
          telefone = phone(b.telefone),
          grupo = txt(b.grupo || "Sem grupo", "Grupo"),
          limite = integer(b.limite, Math.max(1, g.lugares), 30, "Limite");
        if (
          await get(
            "SELECT id FROM guests WHERE event_id=? AND telefone=? AND id<>?",
            eid,
            telefone,
            gid,
          )
        )
          fail(409, "Telefone já cadastrado.");
        await run(
          "UPDATE guests SET nome=?,telefone=?,grupo=?,limite=? WHERE id=?",
          nome,
          telefone,
          grupo,
          limite,
          gid,
        );
      }
      return { ok: true };
    }
    if (action === "gifts" && m === "POST") {
      const nome = txt(b.nome, "Presente");
      if (
        typeof b.valor !== "number" ||
        !Number.isFinite(b.valor) ||
        b.valor < 0 ||
        b.valor > 1000000
      )
        fail(400, "Valor inválido.");
      await run(
        "INSERT INTO gifts VALUES(?,?,?,?,NULL)",
        id(),
        eid,
        nome,
        b.valor,
      );
      return { ok: true };
    }
    if (action === "access" && m === "POST") {
      const email = txt(b.email, "E-mail").toLowerCase();
      let u = await get("SELECT * FROM users WHERE email=?", email);
      if (!u) {
        const password = txt(b.password, "Senha inicial", 256);
        if (password.length < 8 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
          fail(400, "Use e-mail válido e senha de pelo menos 8 caracteres.");
        u = {
          id: await user(
            txt(b.nome, "Nome"),
            email,
            password,
            "cerimonialista",
          ),
          role: "cerimonialista",
        };
      }
      if (u.role !== "cerimonialista")
        fail(400, "Esta conta não é de cerimonialista.");
      await run(
        "INSERT INTO access VALUES(?,?) ON CONFLICT DO NOTHING",
        eid,
        u.id,
      );
      return { ok: true };
    }
  }
  fail(404, "Página ou operação não encontrada.");
}
