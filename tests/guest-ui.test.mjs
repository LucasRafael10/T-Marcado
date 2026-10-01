import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const script = (name) =>
  readFileSync(new URL("../public/js/" + name, import.meta.url), "utf8");
function invitation(api) {
  const fields = new Map();
  const el = (name) => {
    if (!fields.has(name))
      fields.set(name, {
        hidden: false,
        value: "",
        textContent: "",
        classList: { add() {}, remove() {}, toggle() {} },
      });
    return fields.get(name);
  };
  let ready, lastAction;
  vm.runInNewContext(script("convite.js"), {
    location: { search: "?evento=abc&token=def" },
    URLSearchParams,
    document: {
      addEventListener(_event, fn) {
        ready = fn;
      },
    },
    $: el,
    api,
    dateLabel: (value) => value,
    applyEventTheme() {},
    action(_button, fn) {
      return (lastAction = fn());
    },
  });
  return { el, ready: () => ready(), lastAction: () => lastAction };
}

test("convite inválido mantém explicação na tela e oculta formulários", async () => {
  const page = invitation(async () => {
    throw new Error("Convite não encontrado.");
  });
  await assert.rejects(page.ready(), /Convite não encontrado/);
  assert.equal(page.el("eventNames").textContent, "Convite indisponível");
  assert.equal(page.el("eventDetails").textContent, "Convite não encontrado.");
  assert.equal(page.el("nameForm").hidden, true);
  assert.equal(page.el("publicRegister").hidden, true);
});

test("erro na identificação preserva o atalho para solicitar cadastro", async () => {
  const page = invitation(async (path) => {
    if (path.includes("/identify"))
      throw new Error("Digite o nome do convite.");
    return {
      event: {
        titulo: "Evento",
        data: "2099-12-12",
        prazo: "2099-12-01",
        local: "Salão",
      },
      guest: { nome: "Maria" },
    };
  });
  let replacedHelp = false;
  Object.defineProperty(page.el("nameError"), "textContent", {
    set() {
      replacedHelp = true;
    },
  });
  await page.ready();
  page.el("nameForm").onsubmit({ preventDefault() {}, submitter: {} });
  await page.lastAction();
  assert.equal(
    page.el("nameErrorMessage").textContent,
    "Digite o nome do convite.",
  );
  assert.equal(replacedHelp, false);
  assert.equal(typeof page.el("notFoundLink").onclick, "function");
});

test("busca da cerimonialista encontra nome e telefone formatado sem ignorar o filtro", () => {
  const fields = {
    detailSearch: { value: "" },
    detailTableBody: { innerHTML: "" },
    detailEmptyState: { style: {} },
  };
  const context = vm.createContext({
    document: { addEventListener() {} },
    $: (id) => fields[id],
    normalize: (s) =>
      String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    guestRow: (g) => g.nome,
  });
  vm.runInContext(script("cerimonialista.js"), context);
  vm.runInContext(
    `EVENTS=[{id:'evento',guests:[{nome:'Ána Souza',telefone:'11900000000',status:'confirmado'},{nome:'Bruno',telefone:'11900000001',status:'pendente'}]}];currentEventId='evento';`,
    context,
  );
  for (const query of ["ana", "11900000000", "(11) 90000-0000"]) {
    fields.detailSearch.value = query;
    vm.runInContext("renderDetailTable()", context);
    assert.match(fields.detailTableBody.innerHTML, /Ána Souza/);
    assert.doesNotMatch(fields.detailTableBody.innerHTML, /Bruno/);
  }
  vm.runInContext(
    "currentDetailStatusFilter='pendente';renderDetailTable()",
    context,
  );
  assert.equal(fields.detailTableBody.innerHTML, "");
  assert.equal(fields.detailEmptyState.style.display, "block");
});
