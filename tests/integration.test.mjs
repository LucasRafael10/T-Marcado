import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import http from "node:http";

process.env.NODE_ENV = "test";
process.env.TEST_DATABASE = "pglite";
process.env.PORT = "0";
process.env.APP_ORIGIN = "https://gemeas-cerimonial-dgbq.onrender.com";
process.env.RESEND_API_KEY = "test-only";
process.env.EMAIL_FROM = "Teste <teste@example.com>";
const realFetch = globalThis.fetch;
const verificationMails = [];
globalThis.fetch = async (url, options) => {
  assert.equal(url, "https://api.resend.com/emails");
  verificationMails.push(JSON.parse(options.body));
  return { ok: true };
};
const { server } = await import("../server.mjs");
const db = await import("../src/database.mjs");
if (!server.listening) await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
const origin = process.env.APP_ORIGIN;
async function request(url, method = "GET", data, cookie = "", extra = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      base + url,
      {
        method,
        headers: {
          host: new URL(origin).host,
          origin,
          cookie,
          "content-type": "application/json",
          ...extra,
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          let value;
          try {
            value = JSON.parse(raw);
          } catch {
            value = raw;
          }
          const headers = new Headers();
          for (const [key, v] of Object.entries(res.headers))
            headers.set(key, Array.isArray(v) ? v.join(",") : v);
          resolve({
            status: res.statusCode,
            data: value,
            cookie: headers.get("set-cookie")?.split(";")[0],
            headers,
          });
        });
      },
    );
    req.on("error", reject);
    req.end(data === undefined ? undefined : JSON.stringify(data));
  });
}
const registration = (email) => ({
  nome: "Organizadora",
  email,
  password: "SenhaTeste123!",
  passwordConfirm: "SenhaTeste123!",
  titulo: "Casamento de teste",
  tipo: "Casamento",
  data: "2099-12-12",
  prazo: "2099-12-05",
  local: "Salão",
});

async function activate(email, password = "SenhaTeste123!") {
  const mail = verificationMails.findLast((mail) => mail.to.includes(email) && mail.subject.startsWith("Confirme"));
  assert.ok(mail, "confirmação enviada");
  const token = mail.text.match(/#token=([a-f0-9]{64})/)[1];
  const result = await request("/api/verify-email", "POST", { token, password, passwordConfirm: password });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return token;
}

test("Fluxos da API com PostgreSQL embutido", async (t) => {
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
    globalThis.fetch = realFetch;
  });
  let owner, other, eid, g1, g2, fid, planner;
  await t.test("páginas e arquivos privados", async () => {
    const home = await request("/");
    assert.equal(home.status, 200);
    assert.match(home.headers.get("content-security-policy"), /script-src 'self'; script-src-attr 'none'/);
    assert.doesNotMatch(home.headers.get("content-security-policy"), /script-src 'self' 'unsafe-inline'/);
    assert.equal(home.headers.get("x-frame-options"), "DENY");
    assert.equal(home.headers.get("strict-transport-security"), "max-age=31536000");
    assert.equal(
      (await request("/health", "GET", undefined, "", { host: "localhost" }))
        .status,
      200,
    );
    assert.equal((await request("/.env")).status, 404);
    assert.equal((await request("/server.mjs")).status, 404);
    assert.equal(
      (await request("/", "GET", undefined, "", { host: "evil.test" })).status,
      403,
    );
    const root = new URL("../public/", import.meta.url);
    for (const name of readdirSync(root).filter((n) => n.endsWith(".html"))) {
      const html = readFileSync(new URL(name, root), "utf8");
      assert.doesNotMatch(html, /\son\w+\s*=/i, `${name}: evento inline`);
      for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        if (match[1].startsWith("http")) continue;
        assert.ok(existsSync(new URL(match[1], root)), `${name}: ${match[1]}`);
        assert.equal((await request("/" + match[1])).status, 200);
      }
    }
  });
  await t.test("validação, cadastro e cookie HTTPS", async () => {
    assert.equal((await request("/api/me")).status, 401);
    assert.equal((await request("/api/register", "POST", null)).status, 400);
    assert.equal(
      (
        await request("/api/register", "POST", {
          ...registration("diferente@test.com"),
          passwordConfirm: "OutraSenha123!",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request("/api/register", "POST", { ...registration("semconfirmacao@test.com"), passwordConfirm: undefined })).status,
      400,
    );
    assert.equal(
      (
        await request("/api/register", "POST", {
          ...registration("bad@test.com"),
          data: "2099-99-99",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          "/api/register",
          "POST",
          registration("evil@test.com"),
          "",
          { origin: "https://evil.test" },
        )
      ).status,
      403,
    );
    const result = await request(
      "/api/register",
      "POST",
      registration("owner@test.com"),
    );
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.equal(result.cookie, undefined, "cadastro não cria sessão sem verificação");
    assert.equal((await request("/api/login", "POST", { email:"owner@test.com",password:"SenhaTeste123!",role:"noiva" })).status, 403);
    await activate("owner@test.com");
    const login = await request("/api/login", "POST", {email:"owner@test.com",password:"SenhaTeste123!",role:"noiva"});
    owner = login.cookie;
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /Secure/);
    assert.equal(
      (await request("/api/register", "POST", registration("owner@test.com")))
        .status,
      409,
    );
    await request("/api/register", "POST", registration("other@test.com"));
    await activate("other@test.com");
    other = (await request("/api/login", "POST", {email:"other@test.com",password:"SenhaTeste123!",role:"noiva"})).cookie;
    eid = (await request("/api/events", "GET", undefined, owner)).data[0].id;
    assert.notEqual(
      (
        await db.get(
          "SELECT password FROM users WHERE email=?",
          "owner@test.com",
        )
      ).password,
      "SenhaTeste123!",
    );
  });
  await t.test("isolamento entre organizadores e login", async () => {
    assert.equal(
      (
        await request(
          `/api/events/${eid}`,
          "PATCH",
          { titulo: "Invadido" },
          other,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await request("/api/login", "POST", {
          email: "owner@test.com",
          password: "errada",
          role: "noiva",
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await request("/api/login", "POST", {
          email: "owner@test.com",
          password: "SenhaTeste123!",
          role: "noiva",
        })
      ).status,
      200,
    );
  });
  await t.test("convidados, telefone duplicado e link inválido", async () => {
    for (const [nome, telefone] of [
      ["Maria", "65999990001"],
      ["João", "65999990002"],
    ])
      assert.equal(
        (
          await request(
            `/api/events/${eid}/guests`,
            "POST",
            { nome, telefone, grupo: "Família", limite: 2 },
            owner,
          )
        ).status,
        200,
      );
    assert.equal(
      (
        await request(
          `/api/events/${eid}/guests`,
          "POST",
          { nome: "Outra", telefone: "65999990001", limite: 2 },
          owner,
        )
      ).status,
      409,
    );
    const events = (await request("/api/events", "GET", undefined, owner)).data;
    [g1, g2] = events[0].guests;
    assert.equal(
      (await request(`/api/events/${eid}/gifts?token=invalido`)).status,
      404,
    );
    const info = (await request(`/api/events/${eid}/public?token=${g1.token}`))
      .data;
    assert.equal(info.guest.nome, g1.nome);
    assert.equal(info.guest.telefone, undefined);
  });
  await t.test("limites de pessoas e confirmação", async () => {
    assert.equal(
      (
        await request(`/api/events/${eid}/response`, "POST", {
          token: g1.token,
          status: "confirmado",
          lugares: 3,
          criancas: 0,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await request(`/api/events/${eid}/response`, "POST", {
          token: g1.token,
          status: "confirmado",
          lugares: 1,
          criancas: 2,
        })
      ).status,
      400,
    );
    for (const g of [g1, g2])
      assert.equal(
        (
          await request(`/api/events/${eid}/response`, "POST", {
            token: g.token,
            status: "confirmado",
            lugares: 2,
            criancas: 1,
            recado: "Até lá",
          })
        ).status,
        200,
      );
  });
  await t.test("reserva concorrente e liberação ao recusar", async () => {
    assert.equal(
      (
        await request(
          `/api/events/${eid}/gifts`,
          "POST",
          { nome: "Panelas", valor: 150.5 },
          owner,
        )
      ).status,
      200,
    );
    fid = (await request(`/api/events/${eid}/gifts?token=${g1.token}`)).data[0]
      .id;
    const results = await Promise.all(
      [g1, g2].map((g) =>
        request(`/api/events/${eid}/reserve/${fid}`, "POST", {
          token: g.token,
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const winner = results[0].status === 200 ? g1 : g2,
      loser = winner === g1 ? g2 : g1;
    assert.equal(
      (
        await request(`/api/events/${eid}/reserve/${fid}`, "POST", {
          token: loser.token,
          cancel: true,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await request(`/api/events/${eid}/response`, "POST", {
          token: winner.token,
          status: "recusado",
        })
      ).status,
      200,
    );
    assert.equal(
      (await request(`/api/events/${eid}/gifts?token=${g1.token}`)).data[0]
        .reservado,
      false,
    );
    // Uma recusa concorrente com uma nova reserva nunca deixa presente preso ao recusado.
    await Promise.all([
      request(`/api/events/${eid}/reserve/${fid}`, "POST", {
        token: loser.token,
      }),
      request(`/api/events/${eid}/response`, "POST", {
        token: loser.token,
        status: "recusado",
      }),
    ]);
    assert.equal(
      (await db.get("SELECT guest_id FROM gifts WHERE id=?", fid)).guest_id,
      null,
    );
  });
  await t.test("autocadastro exige aprovação", async () => {
    assert.equal(
      (
        await request(`/api/events/${eid}/self-register`, "POST", {
          nome: "Nova pessoa",
          telefone: "65999990003",
        })
      ).status,
      200,
    );
    const g = await db.get(
      "SELECT * FROM guests WHERE telefone=?",
      "65999990003",
    );
    assert.equal(
      (
        await request(`/api/events/${eid}/response`, "POST", {
          token: g.token,
          status: "confirmado",
          lugares: 1,
          criancas: 0,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await request(
          `/api/events/${eid}/guests/${g.id}`,
          "PATCH",
          { approve: true },
          owner,
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await request(`/api/events/${eid}/response`, "POST", {
          token: g.token,
          status: "confirmado",
          lugares: 1,
          criancas: 0,
        })
      ).status,
      200,
    );
  });
  await t.test("cerimonialista pode consultar, mas não editar", async () => {
    const access = {
      email: "planner@test.com",
      nome: "Cerimonialista",
      password: "SenhaTeste123!",
    };
    for (let i = 0; i < 2; i++)
      assert.equal(
        (await request(`/api/events/${eid}/access`, "POST", access, owner))
          .status,
        200,
      );
    assert.equal((await request("/api/login", "POST", {email:access.email,password:access.password,role:"cerimonialista"})).status, 401, "senha fornecida pelo organizador não dá acesso");
    await activate(access.email);
    planner = (
      await request("/api/login", "POST", {
        email: access.email,
        password: access.password,
        role: "cerimonialista",
      })
    ).cookie;
    const events = (await request("/api/events", "GET", undefined, planner))
      .data;
    assert.equal(events.length, 1);
    assert.equal(events[0].guests[0].token, undefined);
    assert.equal(
      (
        await request(
          `/api/events/${eid}/gifts`,
          "POST",
          { nome: "X", valor: 1 },
          planner,
        )
      ).status,
      403,
    );
  });
  await t.test(
    "personalização, imagem e endereço privado do press kit",
    async () => {
      const path = `/api/events/${eid}`;
      const settings = {
        ...registration("unused@test.com"),
        cor: "#824a93",
        dresscode: "Esporte fino",
        presskit: true,
        imagem:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=",
      };
      assert.equal((await request(path, "PATCH", settings, other)).status, 403);
      assert.equal(
        (await request(path, "PATCH", settings, planner)).status,
        403,
      );
      for (const invalid of [
        { cor: "red" },
        { presskit: "true" },
        { dresscode: "x".repeat(1001) },
        { imagem: "data:image/svg+xml;base64,PHN2Zz4=" },
        { imagem: "data:image/png;base64,YWJj" },
      ])
        assert.equal(
          (await request(path, "PATCH", { ...settings, ...invalid }, owner))
            .status,
          400,
        );
      assert.equal((await request(path, "PATCH", settings, owner)).status, 200);
      const pub = (await request(path + "/public")).data;
      assert.equal(pub.event.cor, settings.cor);
      assert.equal(pub.event.imagem, settings.imagem);
      assert.equal(pub.event.dresscode, settings.dresscode);
      assert.equal(pub.event.presskit, true);
      assert.equal(pub.guest, null);
      const response = {
        token: g1.token,
        status: "recusado",
        endereco: "CEP 78000-000, Rua das Flores, 10, Centro, Cuiabá/MT",
      };
      assert.equal(
        (
          await request(path + "/response", "POST", {
            ...response,
            endereco: "x".repeat(601),
          })
        ).status,
        400,
      );
      assert.equal(
        (await request(path + "/response", "POST", response)).status,
        200,
      );
      assert.equal(
        (await request(path + "/public?token=" + g1.token)).data.guest.endereco,
        response.endereco,
      );
      assert.equal(
        (
          await request(path + "/identify", "POST", {
            token: g1.token,
            nome: g1.nome,
          })
        ).data.endereco,
        response.endereco,
      );
      assert.equal(
        (await request(path + "/public?token=" + g2.token)).data.guest.endereco,
        "",
      );
      const owned = (await request("/api/events", "GET", undefined, owner))
        .data;
      assert.equal(
        owned.find((e) => e.id === eid).guests.find((g) => g.id === g1.id)
          .endereco,
        response.endereco,
      );
      // Older clients can update basic fields without losing personalization.
      assert.equal(
        (await request(path, "PATCH", registration("unused@test.com"), owner))
          .status,
        200,
      );
      assert.equal(
        (await request(path + "/public")).data.event.cor,
        settings.cor,
      );
      assert.equal(
        (
          await request(
            path,
            "PATCH",
            { ...settings, imagem: "", presskit: false },
            owner,
          )
        ).status,
        200,
      );
      assert.equal((await request(path + "/public")).data.event.imagem, "");
      assert.equal(
        (
          await request(path + "/response", "POST", {
            ...response,
            endereco: "ignorar",
          })
        ).status,
        200,
      );
      assert.equal(
        (await db.get("SELECT endereco FROM guests WHERE id=?", g1.id))
          .endereco,
        response.endereco,
      );
    },
  );
  await t.test("prazo, transação revertida e sessão invalidada", async () => {
    await assert.rejects(
      db.transaction(async () => {
        await db.run(
          "UPDATE events SET titulo=? WHERE id=?",
          "Não salvar",
          eid,
        );
        throw new Error("reverter");
      }),
    );
    assert.equal(
      (await db.get("SELECT titulo FROM events WHERE id=?", eid)).titulo,
      "Casamento de teste",
    );
    await db.run("UPDATE events SET prazo=? WHERE id=?", "2020-01-01", eid);
    assert.equal(
      (
        await request(`/api/events/${eid}/response`, "POST", {
          token: g1.token,
          status: "confirmado",
          lugares: 1,
          criancas: 0,
        })
      ).status,
      409,
    );
    assert.equal((await request("/api/logout", "POST", {}, owner)).status, 200);
    assert.equal(
      (await request("/api/me", "GET", undefined, owner)).status,
      401,
    );
  });
  await t.test(
    "recuperação de senha, entrega, expiração e sessões",
    async () => {
      await db.executeMigration(
        readFileSync(
          new URL(
            "../supabase/migrations/002_password_reset.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await db.executeMigration(
        readFileSync(
          new URL(
            "../supabase/migrations/002_password_reset.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      const sent = [];
      const originalFetch = globalThis.fetch;
      process.env.RESEND_API_KEY = "test-only";
      process.env.EMAIL_FROM = "Teste <teste@example.com>";
      globalThis.fetch = async (url, options) => {
        assert.equal(url, "https://api.resend.com/emails");
        sent.push(JSON.parse(options.body));
        return { ok: true };
      };
      const waitForMail = async (count) => {
        for (let i = 0; i < 200 && sent.length < count; i++)
          await new Promise((resolve) => setTimeout(resolve, 10));
        assert.equal(sent.length, count);
      };
      try {
        const known = await request("/api/forgot-password", "POST", {
          email: "owner@test.com",
        });
        await waitForMail(1);
        const unknown = await request("/api/forgot-password", "POST", {
          email: "missing@test.com",
        });
        assert.deepEqual(known.data, unknown.data);
        assert.equal(known.status, 200);
        const token = sent[0].text.match(/#token=([a-f0-9]{64})/)[1];
        assert.ok(
          sent[0].text.includes(origin + "/redefinir-senha.html#token="),
        );
        assert.ok(sent[0].html.includes(`href="${origin}/redefinir-senha.html#token=${token}"`));
        assert.match(sent[0].html, /Criar nova senha/);
        assert.equal(sent[0].to[0], "owner@test.com");
        const stored = await db.get(
          "SELECT * FROM password_resets WHERE user_id=(SELECT id FROM users WHERE email=?)",
          "owner@test.com",
        );
        assert.notEqual(stored.token_hash, token);
        await request("/api/forgot-password", "POST", {
          email: "owner@test.com",
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.equal(sent.length, 1);
        assert.equal(
          (
            await request("/api/reset-password", "POST", {
              token,
              password: "curta",
            })
          ).status,
          400,
        );
        await db.run(
          "UPDATE password_resets SET expires=0 WHERE token_hash=?",
          stored.token_hash,
        );
        assert.equal(
          (
            await request("/api/reset-password", "POST", {
              token,
              password: "NovaSenha123!",
            })
          ).status,
          400,
        );
        await db.run(
          "UPDATE password_resets SET expires=? WHERE token_hash=?",
          Date.now() + 60000,
          stored.token_hash,
        );
        const sessionBefore = (
          await request("/api/login", "POST", {
            email: "owner@test.com",
            password: "SenhaTeste123!",
            role: "noiva",
          })
        ).cookie;
        // Existing accounts can also prove mailbox ownership through recovery.
        await db.run("UPDATE users SET email_verified=false WHERE email=?", "owner@test.com");
        await db.run("INSERT INTO email_verifications(user_id,token_hash,expires,requested_at) SELECT id,?,?,? FROM users WHERE email=?", "legacy-verification-test", Date.now()+60000, Date.now(), "owner@test.com");
        assert.equal(
          (
            await request("/api/reset-password", "POST", {
              token,
              password: "NovaSenha123!",
            })
          ).status,
          200,
        );
        await waitForMail(2);
        assert.equal((await db.get("SELECT email_verified FROM users WHERE email=?", "owner@test.com")).email_verified, true);
        assert.equal(await db.get("SELECT user_id FROM email_verifications WHERE token_hash=?", "legacy-verification-test"), undefined);
        assert.match(sent[1].html, /Senha alterada/);
        assert.equal(
          (await request("/api/me", "GET", undefined, sessionBefore)).status,
          401,
        );
        assert.equal(
          (
            await request("/api/reset-password", "POST", {
              token,
              password: "OutraSenha123!",
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await request("/api/login", "POST", {
              email: "owner@test.com",
              password: "SenhaTeste123!",
              role: "noiva",
            })
          ).status,
          401,
        );
        assert.equal(
          (
            await request("/api/login", "POST", {
              email: "owner@test.com",
              password: "NovaSenha123!",
              role: "noiva",
            })
          ).status,
          200,
        );
        assert.equal((await db.all("SELECT * FROM password_resets")).length, 0);
        globalThis.fetch = async () => ({ ok: false, status: 403 });
        await request("/api/forgot-password", "POST", {
          email: "owner@test.com",
        });
        await new Promise((resolve) => setTimeout(resolve, 200));
        assert.equal((await db.all("SELECT * FROM password_resets")).length, 0);
        for (let i = 0; i < 11; i++)
          await request("/api/forgot-password", "POST", {
            email: "missing@test.com",
          });
        assert.equal(
          (
            await request("/api/forgot-password", "POST", {
              email: "missing@test.com",
            })
          ).status,
          429,
        );
      } finally {
        globalThis.fetch = originalFetch;
        process.env.RESEND_API_KEY = "test-only";
        process.env.EMAIL_FROM = "Teste <teste@example.com>";
      }
    },
  );
  await t.test(
    "RLS habilitada e restrição de integridade no PostgreSQL",
    async () => {
      await db.executeMigration("CREATE ROLE anon; CREATE ROLE authenticated;");
      await db.executeMigration(
        readFileSync(
          new URL("../supabase/migrations/001_initial.sql", import.meta.url),
          "utf8",
        ),
      );
      for (const role of ["anon", "authenticated"]) {
        await assert.rejects(
          db.transaction(async () => {
            await db.run(`SET LOCAL ROLE ${role}`);
            await db.all("SELECT * FROM users");
          }),
          { code: "42501" },
        );
      }
      const rows = await db.all(
        "SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('users','sessions','events','access','guests','gifts') AND relnamespace='public'::regnamespace",
      );
      assert.equal(rows.length, 6);
      assert.ok(rows.every((r) => r.relrowsecurity));
      await assert.rejects(
        db.run("UPDATE guests SET lugares=99 WHERE id=?", g1.id),
        { code: "23514" },
      );
    },
  );
  await t.test("confirmação: expiração, reenvio, posse do e-mail e uso único", async () => {
    const email = "unverified@test.com";
    assert.equal((await request("/api/register", "POST", registration(email))).status,200);
    let mail = verificationMails.findLast((m) => m.to.includes(email));
    let token = mail.text.match(/#token=([a-f0-9]{64})/)[1];
    const pending = await db.get("SELECT v.* FROM email_verifications v JOIN users u ON u.id=v.user_id WHERE u.email=?", email);
    assert.notEqual(pending.token_hash,token);
    await db.run("UPDATE email_verifications SET expires=0 WHERE user_id=?",pending.user_id);
    const payload = { token,password:"SenhaDefinitiva123!",passwordConfirm:"SenhaDefinitiva123!" };
    assert.equal((await request("/api/verify-email", "POST", payload)).status,400);
    await db.run("UPDATE email_verifications SET requested_at=0 WHERE user_id=?",pending.user_id);
    const original = globalThis.fetch;
    globalThis.fetch = async () => ({ok:false,status:403});
    try { assert.equal((await request("/api/request-verification","POST",{email})).status,503); }
    finally { globalThis.fetch=original; }
    assert.equal(await db.get("SELECT user_id FROM email_verifications WHERE user_id=?",pending.user_id),undefined);
    assert.equal((await request("/api/request-verification","POST",{email})).status,200);
    mail = verificationMails.findLast((m) => m.to.includes(email));
    token = mail.text.match(/#token=([a-f0-9]{64})/)[1];
    assert.equal((await request("/api/verify-email","POST",{...payload,token,passwordConfirm:"diferente"})).status,400);
    await db.run("INSERT INTO sessions(token,user_id,expires) VALUES(?,?,?)","a".repeat(36),pending.user_id,Date.now()+60000);
    const attempts = await Promise.all([1,2].map(() => request("/api/verify-email","POST",{...payload,token})));
    assert.deepEqual(attempts.map((r) => r.status).sort(),[200,400]);
    assert.equal((await db.get("SELECT email_verified FROM users WHERE id=?",pending.user_id)).email_verified,true);
    assert.equal((await db.all("SELECT * FROM sessions WHERE user_id=?",pending.user_id)).length,0);
    assert.equal((await request("/api/login","POST",{email,password:"SenhaTeste123!",role:"noiva"})).status,401);
    assert.equal((await request("/api/login","POST",{email,password:payload.password,role:"noiva"})).status,200);
    const known = await request("/api/request-verification","POST",{email});
    const unknown = await request("/api/request-verification","POST",{email:"absent@example.com"});
    assert.deepEqual(known.data,unknown.data);
    await db.executeMigration(readFileSync(new URL("../supabase/migrations/004_account_security.sql",import.meta.url),"utf8"));
    assert.equal((await db.get("SELECT email_verified FROM users WHERE id=?",pending.user_id)).email_verified,true,"migração idempotente não desfaz verificação");
  });
  await t.test("limites persistem entre instâncias e são atômicos", async () => {
    const { rateLimit, clientAddress } = await import("../src/rate-limit.mjs");
    const fresh = await import("../src/rate-limit.mjs?another-instance");
    await rateLimit("test-persistence","subject",2);
    await fresh.rateLimit("test-persistence","subject",2);
    await assert.rejects(rateLimit("test-persistence","subject",2),{status:429});
    const attempts=await Promise.allSettled(Array.from({length:8},()=>rateLimit("test-atomic","subject",3)));
    assert.equal(attempts.filter((r)=>r.status==="fulfilled").length,3);
    assert.ok(attempts.filter((r)=>r.status==="rejected").every((r)=>r.reason.status===429));
    const old=process.env.TRUST_PROXY_HOPS;
    try {
      delete process.env.TRUST_PROXY_HOPS;
      assert.equal(clientAddress({headers:{"x-forwarded-for":"1.2.3.4"},socket:{remoteAddress:"127.0.0.1"}}),"127.0.0.1");
      process.env.TRUST_PROXY_HOPS="1";
      assert.equal(clientAddress({headers:{"x-forwarded-for":"forged, 1.2.3.4"},socket:{remoteAddress:"127.0.0.1"}}),"1.2.3.4");
    } finally { if(old===undefined) delete process.env.TRUST_PROXY_HOPS; else process.env.TRUST_PROXY_HOPS=old; }
  });
  await t.test("papel do servidor acessa dados permitidos sem DDL nem privilégios administrativos", async () => {
    const sql=readFileSync(new URL("../supabase/setup_app_role.sql",import.meta.url),"utf8");
    await db.executeMigration(sql);
    await db.executeMigration(sql);
    const role=await db.get("SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolcanlogin FROM pg_roles WHERE rolname='tamarcado_app'");
    assert.ok(Object.values(role).every((v)=>v===false));
    await db.transaction(async()=>{
      await db.run("SET LOCAL ROLE tamarcado_app");
      assert.ok((await db.all("SELECT id FROM users")).length>0);
      await db.run("UPDATE users SET nome=nome WHERE email=?","owner@test.com");
      assert.equal((await db.get("SELECT has_schema_privilege(current_user,'public','CREATE') AS allowed")).allowed,false);
    });
    for(const sql of ["DROP TABLE guests", "CREATE TABLE public.forbidden(id int)", "DELETE FROM users"])
      await assert.rejects(db.transaction(async()=>{await db.run("SET LOCAL ROLE tamarcado_app");await db.run(sql);}),{code:"42501"});
    for(const role of ["anon","authenticated"])
      await assert.rejects(db.transaction(async()=>{await db.run(`SET LOCAL ROLE ${role}`);await db.all("SELECT * FROM email_verifications");}),{code:"42501"});
    await db.run("SET ROLE tamarcado_app");
    try {
      const email="restricted-role@test.com";
      assert.equal((await request("/api/register","POST",registration(email))).status,200);
      await activate(email);
      const login=await request("/api/login","POST",{email,password:"SenhaTeste123!",role:"noiva"});
      assert.equal(login.status,200);
      const events=await request("/api/events","GET",undefined,login.cookie);
      assert.equal(events.status,200);
      assert.equal(events.data.length,1);
      assert.equal((await request(`/api/events/${events.data[0].id}/guests`,"POST",{nome:"Convidado",telefone:"65999990090",grupo:"Família",limite:2},login.cookie)).status,200);
      assert.equal((await request("/api/logout","POST",{},login.cookie)).status,200);
    } finally { await db.run("RESET ROLE"); }
  });
});
