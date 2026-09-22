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
      normalize(g.nome + " " + g.telefone).includes(q),
  );
  $("detailTableBody").innerHTML = list
    .map((g) => "<tr>" + guestRow(g) + "</tr>")
    .join("");
  $("detailEmptyState").style.display = list.length ? "none" : "block";
}
function openEventDetail(id) {
  currentEventId = id;
  currentDetailStatusFilter = "todos";
  $("detailSearch").value = "";
  const ev = EVENTS.find((e) => e.id === id);
  $("detailTitle").textContent = ev.titulo;
  $("detailSub").textContent = dateLabel(ev.data) + " · " + ev.local;
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
}
document.addEventListener("DOMContentLoaded", () =>
  action(null, async () => {
    const me = await api("/me");
    $("plannerName").textContent = me.nome;
    await refresh();
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
