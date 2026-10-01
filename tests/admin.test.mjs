import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { hash, id, verify } from "../src/passwords.mjs";
process.env.NODE_ENV = "test";
process.env.TEST_DATABASE = "pglite";
process.env.PORT = "0";
process.env.APP_ORIGIN = "https://tamarcado.onrender.com";
process.env.ACCESS_APPROVAL_MODE = "manual";
delete process.env.RESEND_API_KEY;
delete process.env.EMAIL_FROM;
const admins = await Promise.all(
  [1, 2, 3].map(async (n) => ({
    name: "Sócio " + n,
    email: `admin${n}@example.com`,
    passwordHash: await hash("AdminForte!" + n),
  })),
);
process.env.ADMIN_ACCOUNTS = JSON.stringify(admins);
let emailAttempts = 0;
globalThis.fetch = async () => {
  emailAttempts++;
  throw new Error("Modo manual não deve enviar e-mail");
};
const { server } = await import("../server.mjs");
const db = await import("../src/database.mjs");
const { adminAccounts } = await import("../src/admin-config.mjs");
const { digest } = await import("../src/manual-recovery.mjs");
if (!server.listening) await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
async function request(path, method = "GET", data, cookie = "", headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      base + path,
      {
        method,
        headers: {
          host: "tamarcado.onrender.com",
          origin: process.env.APP_ORIGIN,
          "content-type": "application/json",
          cookie,
          ...headers,
        },
      },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (x) => (raw += x));
        res.on("end", () => {
          let value;
          try {
            value = JSON.parse(raw);
          } catch {
            value = raw;
          }
          resolve({
            status: res.statusCode,
            data: value,
            headers: res.headers,
            cookie: res.headers["set-cookie"]?.[0]?.split(";")[0],
          });
        });
      },
    );
    req.on("error", reject);
    req.end(data === undefined ? undefined : JSON.stringify(data));
  });
}
const registration = (email) => ({
  nome: "Titular <script>alert(1)</script>",
  email,
  password: "ClienteForte!123",
  passwordConfirm: "ClienteForte!123",
  titulo: "Evento",
  tipo: "Casamento",
  data: "2099-12-12",
  prazo: "2099-12-05",
  local: "Salão",
});
const decision = {
  password: "AdminForte!1",
  identityConfirmed: true,
  note: "Identidade conferida pelo contato conhecido.",
};
let adminCookie, clientCookie, uid, eid, resetId, token, plannerId;
const approve = (type, target, changes = {}) =>
  request(
    `/api/admin/${type}/${target}/approve`,
    "POST",
    { ...decision, ...changes },
    adminCookie,
  );
test("Administração manual: autorização e recuperação completa", async (t) => {
  t.after(async () => {
    await new Promise((r) => server.close(r));
    await db.close();
  });
  t.beforeEach(() => db.run("DELETE FROM rate_limits"));
  await t.test(
    "configuração exige exatamente três identidades únicas",
    async () => {
      const original = process.env.ADMIN_ACCOUNTS;
      for (const invalid of [
        "invalid",
        JSON.stringify(admins.slice(0, 2)),
        JSON.stringify([...admins, admins[0]]),
        JSON.stringify([admins[0], admins[0], admins[2]]),
        JSON.stringify([
          { ...admins[0], passwordHash: "abc" },
          ...admins.slice(1),
        ]),
      ]) {
        process.env.ADMIN_ACCOUNTS = invalid;
        assert.throws(adminAccounts);
      }
      process.env.ADMIN_ACCOUNTS = original;
      assert.equal(adminAccounts().length, 3);
    },
  );
  await t.test(
    "cadastro sem Resend permanece bloqueado ao entrar novamente",
    async () => {
      assert.deepEqual((await request("/api/access-policy")).data, {
        mode: "manual",
      });
      const r = await request(
        "/api/register",
        "POST",
        registration("cliente@example.com"),
      );
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.mode, "manual");
      assert.equal(r.data.pending, true);
      clientCookie = r.cookie;
      uid = (
        await db.get("SELECT id FROM users WHERE email='cliente@example.com'")
      ).id;
      eid = (await db.get("SELECT id FROM events WHERE owner=?", uid)).id;
      assert.equal(
        (await request("/api/events", "GET", undefined, clientCookie)).status,
        401,
      );
      const login = await request("/api/login", "POST", {
        email: "cliente@example.com",
        password: "ClienteForte!123",
        role: "noiva",
      });
      assert.equal(login.data.pending, true);
      clientCookie = login.cookie;
      assert.equal(
        (
          await request(
            "/api/verification-status",
            "GET",
            undefined,
            clientCookie,
          )
        ).data.status,
        "pending",
      );
      for (const path of [
        "/api/confirm-email",
        "/api/verification-info",
        "/api/resend-pending",
        "/api/resend-verification",
      ])
        assert.equal(
          (
            await request(
              path,
              "POST",
              { email: "cliente@example.com", token: "a".repeat(64) },
              clientCookie,
            )
          ).status,
          409,
        );
      assert.equal(
        (await request("/api/admin/accounts", "GET", undefined, clientCookie))
          .status,
        401,
      );
      assert.equal((await request("/api/admin/accounts")).status, 401);
      assert.equal(
        (
          await request("/api/admin/login", "POST", {
            email: "cliente@example.com",
            password: "ClienteForte!123",
          })
        ).status,
        401,
      );
      assert.equal(emailAttempts, 0);
    },
  );
  await t.test(
    "os três administradores entram; cookie separado e token armazenado como hash",
    async () => {
      for (let n = 1; n <= 3; n++) {
        const r = await request("/api/admin/login", "POST", {
          email: `admin${n}@example.com`,
          password: `AdminForte!${n}`,
        });
        assert.equal(r.status, 200);
        if (n === 1) adminCookie = r.cookie;
        assert.match(
          r.headers["set-cookie"][0],
          /HttpOnly; SameSite=Strict; Path=\/api\/admin; Max-Age=28800; Secure/,
        );
        const token = r.cookie.split("=")[1];
        assert.equal(token.length, 64);
        assert.ok(
          await db.get(
            "SELECT token_hash FROM admin_sessions WHERE token_hash=?",
            digest(token),
          ),
        );
        assert.equal(
          await db.get(
            "SELECT token_hash FROM admin_sessions WHERE token_hash=?",
            token,
          ),
          undefined,
        );
        assert.equal(
          (await request("/api/admin/me", "GET", undefined, r.cookie)).data
            .email,
          `admin${n}@example.com`,
        );
        assert.equal(
          (await request("/api/me", "GET", undefined, r.cookie)).status,
          401,
        );
      }
      const rows = await request(
        "/api/admin/accounts",
        "GET",
        undefined,
        adminCookie,
      );
      assert.equal(rows.data.items[0].id, uid);
      assert.equal(rows.data.items[0].password, undefined);
    },
  );
  await t.test(
    "aprovação exige senha, identidade, justificativa e origem correta",
    async () => {
      assert.equal(
        (await approve("accounts", uid, { password: "errada" })).status,
        401,
      );
      assert.equal(
        (await approve("accounts", uid, { identityConfirmed: false })).status,
        400,
      );
      assert.equal(
        (await approve("accounts", uid, { note: "curto" })).status,
        400,
      );
      assert.equal(
        (
          await request(
            `/api/admin/accounts/${uid}/approve`,
            "POST",
            decision,
            adminCookie,
            { origin: "https://evil.example" },
          )
        ).status,
        403,
      );
      assert.equal(
        (await db.get("SELECT account_status FROM users WHERE id=?", uid))
          .account_status,
        "pending",
      );
      const results = await Promise.all([
        approve("accounts", uid),
        approve("accounts", uid),
      ]);
      assert.deepEqual(results.map((x) => x.status).sort(), [200, 409]);
      const user = await db.get("SELECT * FROM users WHERE id=?", uid);
      assert.equal(user.account_status, "approved");
      assert.equal(user.email_verified, false);
      assert.ok(await verify("ClienteForte!123", user.password));
      assert.equal(
        (await request("/api/events", "GET", undefined, clientCookie)).status,
        200,
      );
      assert.equal(
        (
          await request(
            "/api/verification-status",
            "GET",
            undefined,
            clientCookie,
          )
        ).data.verified,
        true,
      );
      const audit = await request(
        "/api/admin/audit",
        "GET",
        undefined,
        adminCookie,
      );
      const approved = audit.data.items.filter(
        (x) => x.action === "account_approved",
      );
      assert.equal(approved.length, 1);
      assert.equal(approved[0].actor, "admin1@example.com");
      assert.equal(approved[0].target_email, "cliente@example.com");
    },
  );
  await t.test(
    "cadastro com e-mail administrativo não concede acesso e pode ser recusado",
    async () => {
      const r = await request(
        "/api/register",
        "POST",
        registration("admin1@example.com"),
      );
      assert.equal(r.status, 200);
      const target = (
        await db.get("SELECT id FROM users WHERE email='admin1@example.com'")
      ).id;
      assert.equal(
        (
          await request("/api/admin/login", "POST", {
            email: "admin1@example.com",
            password: "ClienteForte!123",
          })
        ).status,
        401,
      );
      assert.equal(
        (await request("/api/admin/summary", "GET", undefined, r.cookie))
          .status,
        401,
      );
      assert.equal(
        (
          await request(
            `/api/admin/accounts/${target}/reject`,
            "POST",
            decision,
            adminCookie,
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await request("/api/login", "POST", {
            email: "admin1@example.com",
            password: "ClienteForte!123",
            role: "noiva",
          })
        ).status,
        403,
      );
      assert.equal(
        (await request("/api/me", "GET", undefined, r.cookie)).status,
        401,
      );
      // Migração repetida não altera decisões existentes.
      await db.executeMigration(
        readFileSync(
          new URL(
            "../supabase/migrations/006_admin_approvals.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      );
      assert.equal(
        (await db.get("SELECT account_status FROM users WHERE id=?", target))
          .account_status,
        "rejected",
      );
    },
  );
  await t.test(
    "recuperação não revela existência nem altera a senha antes da aprovação",
    async () => {
      const before = (
        await db.get("SELECT password FROM users WHERE id=?", uid)
      ).password;
      const known = await request("/api/forgot-password", "POST", {
        email: "cliente@example.com",
      });
      const unknown = await request("/api/forgot-password", "POST", {
        email: "nao-existe@example.com",
      });
      assert.deepEqual(known.data, unknown.data);
      assert.equal(known.status, 200);
      await request("/api/forgot-password", "POST", {
        email: "cliente@example.com",
      });
      const rows = await db.all(
        "SELECT * FROM manual_access_requests WHERE user_id=?",
        uid,
      );
      assert.equal(rows.length, 1);
      resetId = rows[0].id;
      assert.equal(rows[0].token_hash, null);
      assert.equal(
        (await db.get("SELECT password FROM users WHERE id=?", uid)).password,
        before,
      );
      assert.equal(
        (
          await request("/api/reset-password", "POST", {
            token: "a".repeat(64),
            password: "OutraSenha!123",
            passwordConfirm: "OutraSenha!123",
          })
        ).status,
        400,
      );
      const r = await approve("resets", resetId);
      assert.equal(r.status, 200);
      token = new URL(r.data.url).hash.slice(7);
      assert.match(token, /^[a-f0-9]{64}$/);
      assert.ok(Number(r.data.expires) > Date.now());
      assert.ok(Number(r.data.expires) <= Date.now() + 1800000);
      const stored = await db.get(
        "SELECT token_hash FROM manual_access_requests WHERE id=?",
        resetId,
      );
      assert.equal(stored.token_hash, digest(token));
      assert.notEqual(stored.token_hash, token);
      assert.ok(
        !JSON.stringify(
          (await request("/api/admin/resets", "GET", undefined, adminCookie))
            .data,
        ).includes(token),
      );
      assert.equal(emailAttempts, 0);
    },
  );
  await t.test(
    "renovar invalida token anterior; recuperação é uso único e revoga sessões",
    async () => {
      const old = token,
        r = await approve("resets", resetId);
      assert.equal(r.status, 200);
      token = new URL(r.data.url).hash.slice(7);
      const body = (token) => ({
        token,
        password: "NovaSenha!123",
        passwordConfirm: "NovaSenha!123",
      });
      assert.equal(
        (await request("/api/reset-password", "POST", body(old))).status,
        400,
      );
      assert.equal(
        (
          await request("/api/reset-password", "POST", {
            ...body(token),
            passwordConfirm: "diferente",
          })
        ).status,
        400,
      );
      const results = await Promise.all([
        request("/api/reset-password", "POST", body(token)),
        request("/api/reset-password", "POST", body(token)),
      ]);
      assert.deepEqual(results.map((x) => x.status).sort(), [200, 400]);
      assert.equal(
        (await request("/api/me", "GET", undefined, clientCookie)).status,
        401,
      );
      assert.equal(
        (
          await request("/api/login", "POST", {
            email: "cliente@example.com",
            password: "ClienteForte!123",
            role: "noiva",
          })
        ).status,
        401,
      );
      const login = await request("/api/login", "POST", {
        email: "cliente@example.com",
        password: "NovaSenha!123",
        role: "noiva",
      });
      assert.equal(login.status, 200);
      assert.equal(login.data.pending, false);
      clientCookie = login.cookie;
      const u = await db.get(
        "SELECT email_verified FROM users WHERE id=?",
        uid,
      );
      assert.equal(u.email_verified, false);
      assert.equal(
        (
          await db.get(
            "SELECT status FROM manual_access_requests WHERE id=?",
            resetId,
          )
        ).status,
        "completed",
      );
    },
  );
  await t.test(
    "recusa e expiração invalidam recuperação, sem mudar a senha",
    async () => {
      await db.run(
        "UPDATE manual_access_requests SET requested_at=? WHERE user_id=?",
        Date.now() - 61000,
        uid,
      );
      await request("/api/forgot-password", "POST", {
        email: "cliente@example.com",
      });
      const row = await db.get(
        "SELECT id FROM manual_access_requests WHERE user_id=? AND status='pending'",
        uid,
      );
      const r = await approve("resets", row.id);
      const token = new URL(r.data.url).hash.slice(7);
      await db.run(
        "UPDATE manual_access_requests SET expires=? WHERE id=?",
        Date.now() - 1,
        row.id,
      );
      assert.equal(
        (
          await request("/api/reset-password", "POST", {
            token,
            password: "OutraSenha!123",
            passwordConfirm: "OutraSenha!123",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            `/api/admin/resets/${row.id}/reject`,
            "POST",
            decision,
            adminCookie,
          )
        ).status,
        200,
      );
      assert.equal((await approve("resets", row.id)).status, 409);
      assert.ok(
        await verify(
          "NovaSenha!123",
          (await db.get("SELECT password FROM users WHERE id=?", uid)).password,
        ),
      );
    },
  );
  await t.test(
    "cerimonialista convidado é aprovado e define a própria senha",
    async () => {
      const r = await request(
        `/api/events/${eid}/access`,
        "POST",
        { nome: "Cerimonial", email: "planner@example.com" },
        clientCookie,
      );
      assert.equal(r.status, 200, JSON.stringify(r.data));
      assert.equal(r.data.verificationEmail, undefined);
      plannerId = (
        await db.get("SELECT id FROM users WHERE email='planner@example.com'")
      ).id;
      const approved = await approve("accounts", plannerId);
      assert.equal(approved.status, 200);
      const token = new URL(approved.data.url).hash.slice(7);
      assert.equal(
        (
          await request("/api/reset-password", "POST", {
            token,
            password: "Planejador!123",
            passwordConfirm: "Planejador!123",
          })
        ).status,
        200,
      );
      const login = await request("/api/login", "POST", {
        email: "planner@example.com",
        password: "Planejador!123",
        role: "cerimonialista",
      });
      assert.equal(login.status, 200);
      assert.equal(login.data.pending, false);
      assert.equal(
        (await request("/api/events", "GET", undefined, login.cookie)).data[0]
          .id,
        eid,
      );
      assert.equal(
        (
          await request(
            `/api/events/${eid}/guests`,
            "POST",
            { nome: "X" },
            login.cookie,
          )
        ).status,
        403,
      );
      assert.equal(emailAttempts, 0);
    },
  );
  await t.test(
    "expiração, rotação de credencial e logout bloqueiam sessões",
    async () => {
      const r = await request("/api/admin/login", "POST", {
        email: admins[1].email,
        password: "AdminForte!2",
      });
      const old = process.env.ADMIN_ACCOUNTS;
      process.env.ADMIN_ACCOUNTS = JSON.stringify([
        admins[0],
        { ...admins[1], passwordHash: await hash("OutraCredencial!123") },
        admins[2],
      ]);
      assert.equal(
        (await request("/api/admin/me", "GET", undefined, r.cookie)).status,
        401,
      );
      process.env.ADMIN_ACCOUNTS = old;
      await db.run(
        "UPDATE admin_sessions SET expires=? WHERE token_hash=?",
        Date.now() - 1,
        digest(r.cookie.split("=")[1]),
      );
      assert.equal(
        (await request("/api/admin/me", "GET", undefined, r.cookie)).status,
        401,
      );
      const logout = await request(
        "/api/admin/logout",
        "POST",
        {},
        adminCookie,
      );
      assert.equal(logout.status, 200);
      assert.match(logout.headers["set-cookie"][0], /Max-Age=0/);
      assert.equal(
        (await request("/api/admin/accounts", "GET", undefined, adminCookie))
          .status,
        401,
      );
    },
  );
  await t.test(
    "tentativas administrativas excessivas são bloqueadas",
    async () => {
      for (let i = 0; i < 8; i++)
        assert.equal(
          (
            await request("/api/admin/login", "POST", {
              email: "admin1@example.com",
              password: "errada",
            })
          ).status,
          401,
        );
      assert.equal(
        (
          await request("/api/admin/login", "POST", {
            email: "admin1@example.com",
            password: "AdminForte!1",
          })
        ).status,
        429,
      );
    },
  );
  await t.test(
    "RLS protege tabelas e auditoria não permite alteração ou exclusão pela aplicação",
    async () => {
      await db.executeMigration("CREATE ROLE anon; CREATE ROLE authenticated;");
      for (const filename of [
        "005_runtime_role.sql",
        "006_admin_approvals.sql",
      ])
        await db.executeMigration(
          readFileSync(
            new URL("../supabase/migrations/" + filename, import.meta.url),
            "utf8",
          ),
        );
      await db.transaction(async () => {
        await db.run("SET LOCAL ROLE tamarcado_app");
        assert.ok((await db.all("SELECT id FROM admin_audit")).length);
        await db.run(
          "INSERT INTO admin_audit(id,actor,action,created_at) VALUES(?,?,?,?)",
          id(),
          "test",
          "test",
          Date.now(),
        );
      });
      for (const sql of [
        "DELETE FROM admin_audit",
        "UPDATE admin_audit SET note='alterado'",
        "TRUNCATE admin_audit",
      ])
        await assert.rejects(
          db.transaction(async () => {
            await db.run("SET LOCAL ROLE tamarcado_app");
            await db.run(sql);
          }),
        );
      for (const role of ["anon", "authenticated"])
        for (const table of [
          "admin_sessions",
          "manual_access_requests",
          "admin_audit",
        ])
          await assert.rejects(
            db.transaction(async () => {
              await db.run(`SET LOCAL ROLE ${role}`);
              await db.all(`SELECT * FROM ${table}`);
            }),
          );
    },
  );
});
