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
process.env.EMAIL_FROM = "test@example.com";
const sent = [];
globalThis.fetch = async (_url, options) => {
  sent.push(JSON.parse(options.body));
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

async function activation(email) {
  let mail;
  for (let i = 0; i < 100; i++) {
    mail = sent.findLast(
      (m) => m.to[0] === email && m.subject.includes("Confirme"),
    );
    if (mail) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  assert.ok(mail, "E-mail de confirmação enviado");
  const token = mail.text.match(/token=([a-f0-9]{64})/)[1];
  const result = await request("/api/confirm-email", "POST", {
    token,
    password: "SenhaTeste123!",
    passwordConfirm: "SenhaTeste123!",
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(
    (
      await request("/api/confirm-email", "POST", {
        token,
        password: "SenhaTeste123!",
        passwordConfirm: "SenhaTeste123!",
      })
    ).status,
    400,
  );
  return token;
}
async function signIn(email, role = "noiva") {
  return request("/api/login", "POST", {
    email,
    password: "SenhaTeste123!",
    role,
  });
}
test("Fluxos da API com PostgreSQL embutido", async (t) => {
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    await db.close();
  });
  t.beforeEach(async () => {
    await db.run("DELETE FROM rate_limits");
  });
  let owner, other, eid, g1, g2, fid, planner;
  await t.test("páginas e arquivos privados", async () => {
    assert.equal((await request("/")).status, 200);
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
      for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
        if (match[1].startsWith("http")) continue;
        assert.ok(existsSync(new URL(match[1], root)), `${name}: ${match[1]}`);
        assert.equal((await request("/" + match[1])).status, 200);
      }
    }
  });
  await t.test(
    "CSP sem scripts inline e limite de corpo em bytes UTF-8",
    async () => {
      const page = await request("/");
      const csp = page.headers.get("content-security-policy");
      assert.match(csp, /script-src 'self';/);
      assert.match(csp, /object-src 'none'/);
      assert.equal(page.headers.get("x-frame-options"), "DENY");
      for (const name of readdirSync(
        new URL("../public/", import.meta.url),
      ).filter((n) => n.endsWith(".html"))) {
        const html = readFileSync(
          new URL("../public/" + name, import.meta.url),
          "utf8",
        );
        assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
      }
      assert.equal(
        (
          await request("/api/login", "POST", {
            email: "a@test.com",
            password: "😀".repeat(26000),
          })
        ).status,
        413,
      );
    },
  );
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
        await request("/api/register", "POST", {
          ...registration("semconfirmacao@test.com"),
          passwordConfirm: undefined,
        })
      ).status,
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
    assert.equal(result.cookie, undefined);
    assert.equal((await signIn("owner@test.com")).status, 403);
    await activation("owner@test.com");
    const login = await signIn("owner@test.com");
    owner = login.cookie;
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /Secure/);
    assert.equal(
      (await request("/api/register", "POST", registration("owner@test.com")))
        .status,
      200,
    );
    await await request(
      "/api/register",
      "POST",
      registration("other@test.com"),
    );
    await activation("other@test.com");
    other = (await signIn("other@test.com")).cookie;
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
    assert.equal((await signIn(access.email, "cerimonialista")).status, 401);
    await activation(access.email);
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
        assert.ok(
          sent[0].html.includes(
            `href="${origin}/redefinir-senha.html#token=${token}"`,
          ),
        );
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
        delete process.env.RESEND_API_KEY;
        delete process.env.EMAIL_FROM;
      }
    },
  );
  await t.test(
    "expiração, reenvio e falha de entrega da confirmação",
    async () => {
      const { user } = await import("../src/repository.mjs");
      const { sendVerification, confirmEmail } =
        await import("../src/email-verification.mjs");
      process.env.RESEND_API_KEY = "test-only";
      process.env.EMAIL_FROM = "test@example.com";
      const uid = await user(
        "Teste",
        "expire@test.com",
        "SenhaInicial123!",
        "noiva",
      );
      await sendVerification("expire@test.com");
      const token1 = sent.at(-1).text.match(/token=([a-f0-9]{64})/)[1];
      const stored = await db.get(
        "SELECT * FROM email_verifications WHERE user_id=?",
        uid,
      );
      assert.notEqual(stored.token_hash, token1);
      await db.run(
        "UPDATE email_verifications SET expires=0,requested_at=0 WHERE user_id=?",
        uid,
      );
      await assert.rejects(
        confirmEmail(token1, "NovaSenha123!", "NovaSenha123!"),
        { status: 400 },
      );
      await sendVerification("expire@test.com");
      const token2 = sent.at(-1).text.match(/token=([a-f0-9]{64})/)[1];
      await assert.rejects(
        confirmEmail(token1, "NovaSenha123!", "NovaSenha123!"),
        { status: 400 },
      );
      const results = await Promise.allSettled([
        confirmEmail(token2, "NovaSenha123!", "NovaSenha123!"),
        confirmEmail(token2, "NovaSenha123!", "NovaSenha123!"),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        (await db.get("SELECT email_verified FROM users WHERE id=?", uid))
          .email_verified,
        true,
      );
      const { verify } = await import("../src/passwords.mjs");
      assert.equal(
        await verify(
          "SenhaInicial123!",
          (await db.get("SELECT password FROM users WHERE id=?", uid)).password,
        ),
        false,
      );
      const failUid = await user(
        "Fail",
        "fail@test.com",
        "SenhaInicial123!",
        "noiva",
      );
      const previous = globalThis.fetch;
      globalThis.fetch = async () => ({ ok: false, status: 403 });
      try {
        await sendVerification("fail@test.com");
      } finally {
        globalThis.fetch = previous;
      }
      assert.equal(
        await db.get(
          "SELECT * FROM email_verifications WHERE user_id=?",
          failUid,
        ),
        undefined,
      );
    },
  );
  await t.test(
    "limite compartilhado atômico e persistente entre módulos",
    async () => {
      const { consume } = await import("../src/rate-limit.mjs");
      const { consume: second } =
        await import("../src/rate-limit.mjs?second-instance");
      const outcomes = await Promise.allSettled(
        Array.from({ length: 20 }, (_, i) =>
          (i % 2 ? consume : second)("shared-test", 5),
        ),
      );
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 5);
      assert.ok(
        outcomes
          .filter((r) => r.status === "rejected")
          .every((r) => r.reason.status === 429),
      );
      await db.run("UPDATE rate_limits SET expires=0");
      await second("shared-test", 5);
    },
  );
  await t.test(
    "role restrita executa aplicação mas não DDL nem acesso anônimo",
    async () => {
      await db.executeMigration(
        readFileSync(
          new URL(
            "../supabase/migrations/005_runtime_role.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      await db.transaction(async () => {
        await db.run("SET LOCAL ROLE tamarcado_app");
        assert.ok((await db.all("SELECT id FROM users")).length > 0);
        await db.run(
          "INSERT INTO rate_limits(key,hits,expires) VALUES('role-test',1,1)",
        );
        await db.run("UPDATE rate_limits SET hits=2 WHERE key='role-test'");
        await db.run("DELETE FROM rate_limits WHERE key='role-test'");
        const { user } = await import("../src/repository.mjs");
        const uid = await user(
          "Role",
          "role@test.com",
          "SenhaTeste123!",
          "noiva",
        );
        await db.run("DELETE FROM users WHERE id=?", uid);
      });
      for (const sql of [
        "DROP TABLE users CASCADE",
        "ALTER TABLE users ADD COLUMN malicious text",
        "CREATE TABLE public.malicious(id int)",
        "CREATE ROLE malicious",
        "TRUNCATE rate_limits",
      ]) {
        await assert.rejects(
          db.transaction(async () => {
            await db.run("SET LOCAL ROLE tamarcado_app");
            await db.run(sql);
          }),
          { code: "42501" },
        );
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
});
