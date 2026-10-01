let EVENTS = [],
  currentEventId = null,
  currentDetailStatusFilter = "todos";
function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(date + "T00:00:00") - today) / 86400000);
}
function renderEventList() {
  const search = normalize($("eventSearch").value);
  const list = [...EVENTS]
    .sort(
      (a, b) =>
        (daysUntil(a.data) < 0) - (daysUntil(b.data) < 0) ||
        a.data.localeCompare(b.data),
    )
    .filter((e) => normalize(e.titulo + " " + e.tipo).includes(search));
  $("eventGrid").innerHTML = list.length
    ? list
        .map((e) => {
          const days = daysUntil(e.data);
          return `<button class="event-card" data-event="${e.id}"><span class="tipo">${escapeHTML(e.tipo)}</span><span class="titulo">${escapeHTML(e.titulo)}</span><span class="conta">${dateLabel(e.data)} · ${escapeHTML(e.local)}</span><span class="days-badge ${days < 0 ? "past" : days <= 30 ? "soon" : ""}">${days === 0 ? "É hoje!" : days < 0 ? "Evento encerrado" : `Faltam ${days} dias`}</span><span class="mini-stats">${["confirmado", "recusado", "pendente", "aprovacao"].map((s) => `<span class="mini-stat ${s}"><strong>${e.guests.filter((g) => g.status === s).length}</strong>${STATUS_LABEL[s]}</span>`).join("")}</span></button>`;
        })
        .join("")
    : "<p>Nenhum evento encontrado.</p>";
}
function renderDetailTable() {
  const ev = EVENTS.find((e) => e.id === currentEventId);
  if (!ev) return;
  const q = normalize($("detailSearch").value);
  const list = ev.guests.filter(
    (g) =>
      (currentDetailStatusFilter === "todos" ||
        g.status === currentDetailStatusFilter) &&
      (normalize(g.nome + " " + g.telefone).includes(q) ||
        (/\d/.test(q) && g.telefone.includes(q.replace(/\D/g, "")))),
  );
  $("detailTableBody").innerHTML = list
    .map((g) => "<tr>" + guestRow(g) + "</tr>")
    .join("");
  $("detailEmptyState").style.display = list.length ? "none" : "block";
}
function renderEventInformation(ev) {
  $("eventInformation").innerHTML =
    `<p><strong>Cliente:</strong> ${escapeHTML(ev.cliente_nome)} · ${escapeHTML(ev.cliente_email)}</p><p><strong>Confirmações até:</strong> ${dateLabel(ev.prazo)}</p><p><strong>Traje:</strong> ${escapeHTML(ev.dresscode || "Não informado")}</p><h3>Lista de presentes</h3>${ev.gifts.length ? "<ul>" + ev.gifts.map((g) => `<li>${escapeHTML(g.nome)} · ${money(g.valor)} · ${escapeHTML(g.reservado_por ? "Reservado por " + g.reservado_por : "Disponível")}</li>`).join("") + "</ul>" : "<p>Nenhum presente cadastrado.</p>"}`;
}
async function refreshRequests() {
  try {
    const requests = await api("/planner-requests");
    $("plannerRequests").innerHTML = requests.length
      ? requests
          .map(
            (r) =>
              `<article class="request-card"><h3>${escapeHTML(r.cliente_nome)}</h3><p>${escapeHTML(r.cliente_email)}</p><p><strong>${escapeHTML(r.titulo)}</strong><br>${dateLabel(r.data)} · ${escapeHTML(r.tipo)}</p><div class="request-actions"><button class="btn" data-request="${r.id}" data-event="${r.event_id}" data-decision="accepted">Aceitar cliente</button><button class="chip-btn" data-request="${r.id}" data-event="${r.event_id}" data-decision="rejected">Recusar</button></div></article>`,
          )
          .join("")
      : "<p>Nenhuma solicitação pendente. Peça à cliente que informe o e-mail da sua conta no evento dela.</p>";
  } catch (error) {
    $("plannerRequests").textContent = error.message;
  }
}
function openEventDetail(id) {
  currentEventId = id;
  currentDetailStatusFilter = "todos";
  $("detailSearch").value = "";
  const ev = EVENTS.find((e) => e.id === id);
  $("detailTitle").textContent = ev.titulo;
  $("detailSub").textContent = dateLabel(ev.data) + " · " + ev.local;
  renderEventInformation(ev);
  $("eventListSection").style.display = "none";
  $("detailPanel").classList.add("show");
  document
    .querySelectorAll(".detail-chip")
    .forEach((c) => c.classList.toggle("active", c.dataset.status === "todos"));
  renderDetailTable();
  $("backToList").focus();
}
async function refresh() {
  EVENTS = await api("/events");
  renderEventList();
  renderDetailTable();
  if (currentEventId) {
    const ev = EVENTS.find((e) => e.id === currentEventId);
    if (ev) {
      $("detailTitle").textContent = ev.titulo;
      $("detailSub").textContent = dateLabel(ev.data) + " · " + ev.local;
      renderEventInformation(ev);
    } else {
      currentEventId = null;
      $("eventListSection").style.display = "block";
      $("detailPanel").classList.remove("show");
      $("detailTableBody").replaceChildren();
      $("eventInformation").replaceChildren();
    }
  }
  await refreshRequests();
}
document.addEventListener("DOMContentLoaded", () =>
  action(null, async () => {
    const me = await api("/me");
    if (me.role !== "cerimonialista") {
      location.href = "painel.html";
      return;
    }
    $("plannerName").textContent = me.nome;
    await refresh();
    $("refreshRequests").onclick = () => action($("refreshRequests"), refresh);
    $("plannerRequests").onclick = (e) => {
      const button = e.target.closest("[data-request]");
      if (!button) return;
      action(button, async () => {
        const result = await api(
          "/events/" + button.dataset.event + "/access-response",
          "POST",
          {
            requestId: button.dataset.request,
            decision: button.dataset.decision,
          },
        );
        await refresh();
        notice(result.message);
      });
    };
    $("eventSearch").oninput = renderEventList;
    $("detailSearch").oninput = renderDetailTable;
    $("eventGrid").onclick = (e) => {
      const card = e.target.closest("[data-event]");
      if (card) openEventDetail(card.dataset.event);
    };
    $("backToList").onclick = () => {
      currentEventId = null;
      $("eventListSection").style.display = "block";
      $("detailPanel").classList.remove("show");
      $("eventSearch").focus();
    };
    document.querySelectorAll(".detail-chip").forEach(
      (c) =>
        (c.onclick = () => {
          currentDetailStatusFilter = c.dataset.status;
          document
            .querySelectorAll(".detail-chip")
            .forEach((x) => x.classList.toggle("active", x === c));
          renderDetailTable();
        }),
    );
    setInterval(() => {
      if (!document.hidden) action(null, refresh);
    }, 15000);
  }),
);
