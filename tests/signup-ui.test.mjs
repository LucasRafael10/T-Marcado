import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const script = (n) =>
  readFileSync(new URL("../public/js/" + n, import.meta.url), "utf8");
function element() {
  return {
    value: "",
    dataset: {},
    listeners: {},
    setAttribute(k, v) {
      this[k] = v;
    },
    setCustomValidity(v) {
      this.validityMessage = v;
    },
    addEventListener(k, f) {
      this.listeners[k] = f;
    },
  };
}
test("indicador ao digitar: fraca, moderada, forte e confirmação acessível", () => {
  const els = Object.fromEntries(
    [
      "f-password",
      "f-password-confirm",
      "password-strength",
      "password-strength-text",
      "password-match",
    ].map((k) => [k, element()]),
  );
  els["f-password"].form = element();
  vm.runInNewContext(script("password-feedback.js"), {
    document: { getElementById: (k) => els[k] },
    setTimeout,
  });
  for (const [password, label] of [
    ["12345678", "Fraca"],
    ["FlorAzul2026", "Moderada"],
    ["FloresNoJardim!2026", "Forte"],
  ]) {
    els["f-password"].value = password;
    els["f-password"].listeners.input();
    assert.match(els["password-strength-text"].textContent, new RegExp(label));
  }
  els["f-password-confirm"].value = "outra";
  els["f-password-confirm"].listeners.input();
  assert.equal(els["f-password-confirm"]["aria-invalid"], "true");
  assert.ok(els["f-password-confirm"].validityMessage);
  els["f-password-confirm"].value = "FloresNoJardim!2026";
  els["f-password-confirm"].listeners.input();
  assert.equal(els["f-password-confirm"].validityMessage, "");
  assert.match(els["password-match"].textContent, /senhas conferem/);
  els["f-password"].value = "mudou";
  els["f-password"].listeners.input();
  assert.ok(els["f-password-confirm"].validityMessage);
});
test("link confirma automaticamente sem enviar senha e abre painel", async () => {
  const els = { message: element(), plannerForm: element() };
  els.plannerForm.hidden = true;
  let redirected;
  const calls = [];
  vm.runInNewContext(script("confirm-verification.js"), {
    document: { getElementById: (k) => els[k] },
    URLSearchParams,
    history: { replaceState() {} },
    location: {
      hash: "#token=" + "a".repeat(64),
      pathname: "/confirmar-email.html",
      replace: (u) => (redirected = u),
    },
    fetch: async (url, opts) => {
      calls.push({ url, data: JSON.parse(opts.body) });
      return {
        ok: true,
        json: async () =>
          url.includes("verification-info")
            ? { needsPassword: false, sameBrowser: true }
            : { role: "noiva", message: "Confirmado" },
      };
    },
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(redirected, "painel.html");
  assert.equal(els.plannerForm.hidden, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].data.password, undefined);
});
test("link em outro navegador não ativa conta nem pede uma nova senha", async () => {
  const els = { message: element(), plannerForm: element() };
  els.plannerForm.hidden = true;
  let calls = 0;
  vm.runInNewContext(script("confirm-verification.js"), {
    document: { getElementById: (k) => els[k] },
    URLSearchParams,
    history: { replaceState() {} },
    location: {
      hash: "#token=" + "a".repeat(64),
      pathname: "/confirmar-email.html",
    },
    fetch: async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({ needsPassword: false, sameBrowser: false }),
      };
    },
  });
  await new Promise((r) => setImmediate(r));
  assert.equal(calls, 1);
  assert.equal(els.plannerForm.hidden, true);
  assert.match(els.message.textContent, /mesmo navegador/);
});

test("reenvio mostra falha real, bloqueia cliques duplicados e respeita o prazo do servidor", async () => {
  const els = {
    message: element(),
    resend: element(),
    "pending-email": element(),
  };
  let tick,
    release,
    attempts = 0;
  vm.runInNewContext(script("wait-verification.js"), {
    document: { getElementById: (k) => els[k] },
    location: { search: "?envio=failed", replace() {} },
    URLSearchParams,
    Date,
    setInterval: (f) => {
      tick = f;
      return 1;
    },
    clearInterval() {},
    setTimeout() {},
    fetch: async (url) => {
      if (url.includes("verification-status"))
        return {
          ok: true,
          json: async () => ({
            email: "test@example.com",
            verified: false,
            retryAfter: 0,
          }),
        };
      attempts++;
      return new Promise((resolve) => {
        release = resolve;
      });
    },
  });
  assert.match(els.message.textContent, /não foi possível confirmar/);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(els.resend.disabled, false);
  const pending = els.resend.listeners.click();
  tick();
  assert.equal(els.resend.disabled, true);
  assert.equal(els.resend.textContent, "Enviando…");
  await els.resend.listeners.click();
  assert.equal(attempts, 1);
  release({
    ok: true,
    json: async () => ({
      emailStatus: "failed",
      retryAfter: 0,
      message: "Falha ao enviar. Tente novamente.",
    }),
  });
  await pending;
  assert.match(els.message.textContent, /Falha ao enviar/);
  assert.equal(els.resend.disabled, false);
  const retry = els.resend.listeners.click();
  release({
    ok: true,
    json: async () => ({
      emailStatus: "cooldown",
      retryAfter: 37,
      message: "Aguarde 37 segundos.",
    }),
  });
  await retry;
  assert.match(els.message.textContent, /37 segundos/);
  assert.equal(els.resend.disabled, true);
  assert.match(els.resend.textContent, /Reenviar em 3[67]s/);
});
