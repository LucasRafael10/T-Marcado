import test from "node:test";
import assert from "node:assert/strict";
import { sendEmail, emailDiagnostic } from "../src/email.mjs";

test("Resend: envio, falhas e diagnóstico sem dados sensíveis", async () => {
  const original = globalThis.fetch;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  try {
    delete process.env.RESEND_API_KEY;
    await assert.rejects(sendEmail("cliente@example.com", "Assunto", "Texto"), /Configure/);
    process.env.RESEND_API_KEY = "test-secret";
    process.env.EMAIL_FROM = "Gêmeas <teste@example.com>";
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(options.headers.Authorization, "Bearer test-secret");
      assert.deepEqual(JSON.parse(options.body), {
        from: process.env.EMAIL_FROM, to: ["cliente@example.com"], subject: "Assunto", text: "Texto",
      });
      assert.ok(options.signal instanceof AbortSignal);
      return { ok: true };
    };
    await sendEmail("cliente@example.com", "Assunto", "Texto");
    for (const status of [401, 403, 422, 429, 500]) {
      globalThis.fetch = async () => ({ok: false, status});
      await assert.rejects(sendEmail("cliente@example.com", "Assunto", "Texto"), error => {
        assert.ok(emailDiagnostic(error).includes(String(status)));
        assert.ok(!emailDiagnostic(error).includes("test-secret"));
        return true;
      });
    }
    assert.match(emailDiagnostic({name: "TimeoutError"}), /excedido/);
    assert.ok(!emailDiagnostic(new Error("token secreto")).includes("token secreto"));
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = key;
    if (from === undefined) delete process.env.EMAIL_FROM; else process.env.EMAIL_FROM = from;
  }
});
