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
