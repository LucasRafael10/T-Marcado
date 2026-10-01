import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

test("reabrir recuperação na mesma aba restaura o formulário e usa o novo token", async () => {
  const callbacks = {},
    requests = [],
    button = { disabled: false },
    form = {
      hidden: false,
      resets: 0,
      reset() {
        this.resets++;
      },
      querySelector() {
        return button;
      },
      addEventListener(name, callback) {
        callbacks[name] = callback;
      },
    },
    message = { dataset: {}, textContent: "" },
    password = { value: "NovaSenhaDeTeste!123" },
    fields = {
      recoveryForm: form,
      message,
      password,
      confirm: { ...password },
    },
    location = {
      hash: "#token=" + "a".repeat(64),
      pathname: "/redefinir-senha.html",
    };
  vm.runInNewContext(
    readFileSync(new URL("../public/js/recovery.js", import.meta.url), "utf8"),
    {
      document: { body: { dataset: {} }, getElementById: (id) => fields[id] },
      location,
      history: {
        replaceState() {
          location.hash = "";
        },
      },
      URLSearchParams,
      window: {
        addEventListener(name, callback) {
          callbacks[name] = callback;
        },
      },
      fetch: async (url, options) => {
        requests.push({ url, body: JSON.parse(options.body) });
        return { ok: true, json: async () => ({ message: "Senha alterada." }) };
      },
    },
  );
  assert.equal(location.hash, "");
  await callbacks.submit({ preventDefault() {} });
  assert.equal(form.hidden, true);
  assert.equal(requests[0].body.token, "a".repeat(64));

  // Navegação só pelo fragmento não recarrega o documento no navegador.
  location.hash = "#token=" + "b".repeat(64);
  callbacks.hashchange();
  assert.equal(form.hidden, false);
  assert.equal(message.textContent, "");
  assert.equal(location.hash, "");
  await callbacks.submit({ preventDefault() {} });
  assert.equal(requests[1].body.token, "b".repeat(64));

  location.hash = "#token=invalido";
  callbacks.hashchange();
  assert.equal(form.hidden, true);
  assert.match(message.textContent, /Link inválido/);
  assert.equal(requests.length, 2);
});
