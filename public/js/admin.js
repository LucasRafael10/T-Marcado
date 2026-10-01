const $ = (id) => document.getElementById(id);
let activeTab = "accounts",
  page = 1,
  generation = 0,
  selected = null;
const titles = {
  accounts: [
    "Contas para analisar",
    "Confira os dados antes de liberar o acesso.",
  ],
  resets: [
    "Pedidos de troca de senha",
    "Aprove, recuse ou renove um link autorizado.",
  ],
  audit: [
    "Histórico de decisões",
    "Veja quem realizou cada ação e a justificativa registrada.",
  ],
};
const actions = {
  admin_login: "Entrada na administração",
  account_approved: "Conta aprovada",
  account_rejected: "Conta recusada",
  recovery_link_issued: "Link de recuperação emitido",
  recovery_rejected: "Recuperação recusada",
  password_reset_completed: "Senha alterada pelo titular",
};
const statusLabels = {
  pending: "Pendente",
  approved: "Aprovado",
  rejected: "Recusado",
  completed: "Concluído",
};
function message(id, text, error = false) {
  $(id).textContent = text;
  $(id).dataset.state = error ? "error" : "success";
}
async function request(path, body) {
  const r = await fetch("/api/admin/" + path, {
    cache: "no-store",
    ...(body !== undefined
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await r.json();
  if (!r.ok) {
    const e = new Error(data.error || "Não foi possível concluir.");
    e.status = r.status;
    throw e;
  }
  return data;
}
function node(tag, text, className) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (className) n.className = className;
  return n;
}
function date(value) {
  return new Date(Number(value)).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
function signedOut() {
  generation++;
  $("dashboard").hidden = true;
  $("login-view").hidden = false;
  $("admin-password").value = "";
  $("rows").replaceChildren();
  $("decision-dialog").close();
  $("link-dialog").close();
}
async function signedIn(admin) {
  $("login-view").hidden = true;
  $("dashboard").hidden = false;
  $("admin-name").textContent = admin.name;
  $("admin-address").textContent = admin.email;
  await refresh();
}
function decision(item, action) {
  selected = { item, action, tab: activeTab };
  $("decision-form").reset();
  message("decision-message", "");
  const approve = action === "approve",
    account = activeTab === "accounts";
  $("decision-title").textContent = approve
    ? account
      ? "Aprovar esta conta?"
      : "Autorizar a troca de senha?"
    : account
      ? "Recusar esta conta?"
      : "Recusar este pedido?";
  $("decision-person").textContent = item.nome + " · " + item.email;
  $("decision-explanation").textContent = approve
    ? account
      ? "A pessoa poderá entrar com a senha que já cadastrou."
      : "Você receberá um link válido por 30 minutos. Entregue-o ao titular por um canal conhecido. Gerar outro invalida o anterior."
    : "Registre o motivo da recusa. Esta ação não altera a senha da pessoa.";
  $("identity-label").hidden = !approve;
  $("identity-confirmed").required = approve;
  $("confirm-decision").textContent = approve
    ? "Confirmar aprovação"
    : "Confirmar recusa";
  $("decision-dialog").showModal();
}
function render(items) {
  $("rows").replaceChildren();
  if (!items.length) {
    const empty = node("div", undefined, "empty");
    empty.append(
      node("strong", page > 1 ? "Fim da lista." : "Tudo em dia por aqui."),
      node(
        "p",
        page > 1
          ? "Volte para consultar os registros anteriores."
          : "Nenhum registro nesta lista. Clique em Atualizar para consultar novos pedidos.",
      ),
    );
    $("rows").append(empty);
  }
  for (const item of items) {
    const row = node(
        "article",
        undefined,
        "row" + (activeTab === "audit" ? " audit-row" : ""),
      ),
      person = node("div", undefined, "person");
    if (activeTab === "audit") {
      person.append(
        node("strong", actions[item.action] || item.action),
        node(
          "p",
          (item.actor.startsWith("user:") ? "Titular da conta" : item.actor) +
            (item.target_email ? "\nConta: " + item.target_email : ""),
        ),
      );
      if (item.note) person.append(node("p", item.note));
      const when = node("time", date(item.created_at));
      when.dateTime = new Date(Number(item.created_at)).toISOString();
      row.append(person, when);
    } else {
      person.append(
        node("strong", item.nome),
        node("p", item.email),
        node(
          "small",
          activeTab === "accounts"
            ? (item.role === "noiva"
                ? "Organizador de evento"
                : "Cerimonialista") +
                " · Cadastro em " +
                date(item.created_at)
            : (item.kind === "activation"
                ? "Ativação de cerimonialista"
                : "Recuperação de senha") +
                " · " +
                date(item.requested_at),
        ),
      );
      const status = item.account_status || item.status,
        badge = node("span", statusLabels[status], "badge");
      badge.dataset.status = status;
      if (activeTab === "resets" && status === "approved")
        badge.textContent =
          Number(item.expires) > Date.now()
            ? "Link autorizado até " + date(item.expires)
            : "Link expirado";
      person.append(node("br"), badge);
      row.append(person);
      if (activeTab === "resets" || status === "pending") {
        const buttons = node("div", undefined, "row-actions"),
          reject = node("button", "Recusar", "reject"),
          approve = node(
            "button",
            status === "approved" ? "Gerar novo link" : "Aprovar",
            "primary",
          );
        reject.addEventListener("click", () => decision(item, "reject"));
        approve.addEventListener("click", () => decision(item, "approve"));
        buttons.append(reject, approve);
        row.append(buttons);
      }
    }
    $("rows").append(row);
  }
  $("page-label").textContent = "Página " + page;
  $("previous").disabled = page === 1;
  $("next").disabled = items.length < 25;
}
async function refresh() {
  const current = ++generation;
  $("refresh").disabled = true;
  $("rows").setAttribute("aria-busy", "true");
  message("dashboard-message", "");
  $("queue-title").textContent = titles[activeTab][0];
  $("queue-description").textContent = titles[activeTab][1];
  $("filter-label").hidden = activeTab !== "accounts";
  document.querySelectorAll("[data-tab]").forEach((b) => {
    if (b.dataset.tab === activeTab) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
  });
  try {
    const [summary, list] = await Promise.all([
      request("summary"),
      request(
        activeTab +
          "?page=" +
          page +
          (activeTab === "accounts"
            ? "&status=" + $("account-filter").value
            : ""),
      ),
    ]);
    if (current !== generation) return;
    for (const name of ["accounts", "resets", "decisions"])
      $("count-" + name).textContent = summary[name];
    render(list.items);
  } catch (e) {
    if (current !== generation) return;
    if (e.status === 401) {
      signedOut();
      message("login-message", "Sua sessão expirou. Entre novamente.", true);
    } else {
      $("rows").replaceChildren();
      message("dashboard-message", e.message, true);
    }
  } finally {
    if (current === generation) {
      $("refresh").disabled = false;
      $("rows").removeAttribute("aria-busy");
    }
  }
}
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = e.currentTarget.querySelector("button");
  button.disabled = true;
  message("login-message", "");
  try {
    const admin = await request("login", {
      email: $("admin-email").value,
      password: $("admin-password").value,
    });
    $("admin-password").value = "";
    await signedIn(admin);
  } catch (error) {
    message("login-message", error.message, true);
  } finally {
    button.disabled = false;
  }
});
$("logout").addEventListener("click", async () => {
  try {
    await request("logout", {});
    signedOut();
    message("login-message", "Sessão encerrada.");
  } catch (e) {
    if (e.status === 401) signedOut();
    else message("dashboard-message", e.message, true);
  }
});
document.querySelectorAll("[data-tab]").forEach((b) =>
  b.addEventListener("click", () => {
    activeTab = b.dataset.tab;
    page = 1;
    refresh();
  }),
);
$("refresh").addEventListener("click", refresh);
$("account-filter").addEventListener("change", () => {
  page = 1;
  refresh();
});
$("previous").addEventListener("click", () => {
  if (page > 1) {
    page--;
    refresh();
  }
});
$("next").addEventListener("click", () => {
  page++;
  refresh();
});
$("cancel-decision").addEventListener("click", () =>
  $("decision-dialog").close(),
);
$("decision-dialog").addEventListener("close", () => {
  $("decision-password").value = "";
});
$("decision-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { item, action, tab } = selected,
    button = $("confirm-decision");
  button.disabled = true;
  $("cancel-decision").disabled = true;
  message("decision-message", "");
  try {
    const result = await request(`${tab}/${item.id}/${action}`, {
      password: $("decision-password").value,
      note: $("decision-note").value,
      identityConfirmed: $("identity-confirmed").checked,
    });
    $("decision-dialog").close();
    if (result.url) {
      $("link-person").textContent = item.nome + " · " + item.email;
      $("recovery-link").value = result.url;
      $("link-expiry").textContent =
        "Válido até " + date(result.expires) + ". Uso único.";
      message("copy-message", "");
      $("link-dialog").showModal();
    }
    await refresh();
    message("dashboard-message", result.message);
  } catch (error) {
    message("decision-message", error.message, true);
  } finally {
    $("decision-password").value = "";
    button.disabled = false;
    $("cancel-decision").disabled = false;
  }
});
$("decision-dialog").addEventListener("cancel", (e) => {
  if ($("confirm-decision").disabled) e.preventDefault();
});
$("close-link").addEventListener("click", () => $("link-dialog").close());
$("link-dialog").addEventListener("close", () => {
  $("recovery-link").value = "";
});
$("copy-link").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("recovery-link").value);
    message(
      "copy-message",
      "Link copiado. Entregue somente ao titular confirmado.",
    );
  } catch {
    $("recovery-link").select();
    message("copy-message", "Selecione e copie o link manualmente.", true);
  }
});
request("me")
  .then(signedIn)
  .catch((e) => {
    if (e.status !== 401) message("login-message", e.message, true);
  });
