let EVENTS = [],
  currentEvent = null,
  currentStatusFilter = "todos",
  currentInvite = null;
function eventPath() {
  return "/events/" + currentEvent.id;
}
async function refresh() {
  EVENTS = await api("/events");
  const requested =
    currentEvent?.id || new URLSearchParams(location.search).get("evento");
  currentEvent = EVENTS.find((e) => e.id === requested) || EVENTS[0];
  if (!currentEvent) {
    notice("Crie um evento pela página inicial.");
    return;
  }
  $("eventSelect").innerHTML = EVENTS.map(
    (e) => `<option value="${e.id}">${escapeHTML(e.titulo)}</option>`,
  ).join("");
  $("eventSelect").value = currentEvent.id;
  $("eventTitle").textContent =
    currentEvent.titulo + " · " + dateLabel(currentEvent.data);
  const old = $("groupFilter").value;
  $("groupFilter").innerHTML =
    '<option value="todos">Todos os grupos</option>' +
    [...new Set(currentEvent.guests.map((g) => g.grupo))]
      .map((g) => `<option>${escapeHTML(g)}</option>`)
      .join("");
  $("groupFilter").value = [...$("groupFilter").options].some(
    (o) => o.value === old,
  )
    ? old
    : "todos";
  applyEventTheme(currentEvent.cor);
  updateStats();
  renderTable();
  renderGifts();
}
function updateStats() {
  const g = currentEvent.guests;
  $("statTotal").textContent = g.length;
  for (const status of ["confirmado", "recusado", "pendente", "aprovacao"])
    $("stat" + status[0].toUpperCase() + status.slice(1)).textContent =
      g.filter((x) => x.status === status).length;
  $("seatCount").textContent =
    g
      .filter((x) => x.status === "confirmado")
      .reduce((n, x) => n + x.lugares, 0) +
    " pessoas confirmadas (incluindo crianças)";
}
function filteredGuests() {
  const search = normalize($("searchInput").value.trim()),
    group = $("groupFilter").value;
  return currentEvent.guests.filter(
    (g) =>
      (currentStatusFilter === "todos" || g.status === currentStatusFilter) &&
      (group === "todos" || g.grupo === group) &&
      (!search ||
        normalize(g.nome).includes(search) ||
        (g.telefone.includes(search.replace(/\D/g, "")) && /\d/.test(search))),
  );
}
function renderTable() {
  const list = filteredGuests();
  $("guestTableBody").innerHTML = list
    .map((g) => {
      const actions = `<td class="row-actions"><button class="row-action" data-invite="${g.id}">Convite</button><button class="row-action" data-edit="${g.id}">Editar</button>${g.status === "aprovacao" ? `<button class="row-action" data-approve="${g.id}">Aprovar</button>` : ""}</td>`;
      return (
        "<tr>" +
        guestRow(g, actions).replace(
          "</td>",
          "</td><td>" + escapeHTML(g.grupo) + "</td>",
        ) +
        "</tr>"
      );
    })
    .join("");
  $("emptyState").style.display = list.length ? "none" : "block";
}
function setStatusFilter(status) {
  currentStatusFilter = status;
  document.querySelectorAll(".stat-card").forEach((c) => {
    c.classList.toggle("active", c.dataset.filter === status);
    c.setAttribute("aria-pressed", String(c.dataset.filter === status));
  });
  renderTable();
}
function inviteLink(g) {
  const url = new URL("convite.html", location.href);
  url.searchParams.set("evento", currentEvent.id);
  if (g) url.searchParams.set("token", g.token);
  return url.href;
}
function openInviteMessage(gid) {
  currentInvite = currentEvent.guests.find((g) => g.id === gid);
  $("inviteModalGuestName").textContent = currentInvite.nome;
  $("inviteMessageText").value =
    `Oi, ${currentInvite.nome}! 💌\n\nVocê está convidado(a) para ${currentEvent.titulo}.\n📅 ${dateLabel(currentEvent.data)}\n📍 ${currentEvent.local}\n\nConfirme até ${dateLabel(currentEvent.prazo)}:\n${inviteLink(currentInvite)}`;
  $("testInvite").href = inviteLink(currentInvite);
  $("invitePhotoTools").hidden = !currentEvent.imagem;
  $("invitePhoto").src = currentEvent.imagem || "";
  $("downloadPhoto").href = currentEvent.imagem || "";
  $("downloadPhoto").download =
    "convite." +
    (currentEvent.imagem?.match(/^data:image\/(\w+)/)?.[1] || "png");
  if (currentEvent.dresscode)
    $("inviteMessageText").value += "\n\nDress code: " + currentEvent.dresscode;
  if (currentEvent.presskit)
    $("inviteMessageText").value +=
      "\nVocê também pode informar seu endereço para receber o press kit pelo link.";
  showModal("inviteModal");
}
function closeInviteModal() {
  hideModal("inviteModal");
}
function sendViaWhatsApp() {
  window.open(
    "https://wa.me/55" +
      currentInvite.telefone +
      "?text=" +
      encodeURIComponent($("inviteMessageText").value),
    "_blank",
    "noopener,noreferrer",
  );
}
function openGuest(gid) {
  const g = currentEvent.guests.find((g) => g.id === gid);
  $("guestForm").reset();
  $("guestId").value = g?.id || "";
  $("guestModalTitle").textContent = g
    ? "Editar convidado"
    : "Adicionar convidado";
  for (const key of ["nome", "telefone", "grupo", "limite"])
    $("g-" + key).value = g?.[key] || (key === "limite" ? 1 : "");
  showModal("guestModal");
}
function renderGifts() {
  $("managedGifts").innerHTML = currentEvent.gifts.length
    ? currentEvent.gifts
        .map(
          (f) =>
            `<li><span>${escapeHTML(f.nome)} · ${money(f.valor)}</span><strong>${f.reservado_por ? "Reservado por " + escapeHTML(f.reservado_por) : "Disponível"}</strong></li>`,
        )
        .join("")
    : "<li>Nenhum presente cadastrado.</li>";
}
function exportCSV() {
  const list = filteredGuests(),
    rows = [
      [
        "Nome",
        "Telefone",
        "Grupo",
        "Status",
        "Pessoas",
        "Restrição",
        "Crianças",
        "Resposta",
        "Recado",
        "Endereço para press kit",
      ],
      ...list.map((g) => [
        g.nome,
        g.telefone,
        g.grupo,
        STATUS_LABEL[g.status],
        g.lugares,
        g.restricao,
        g.criancas,
        dateLabel(g.respondido),
        g.recado,
        g.endereco,
      ]),
    ];
  const csv =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            let s = String(value ?? "");
            if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
            return '"' + s.replace(/"/g, '""') + '"';
          })
          .join(";"),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = "convidados.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
document.addEventListener("DOMContentLoaded", () =>
  action(null, async () => {
    const me = await api("/me");
    if (me.role !== "noiva") {
      location.href = "cerimonialista.html";
      return;
    }
    await refresh();
    $("eventSelect").onchange = () => {
      currentEvent = EVENTS.find((e) => e.id === $("eventSelect").value);
      action(null, refresh);
    };
    $("searchInput").oninput = renderTable;
    $("groupFilter").onchange = renderTable;
    document.querySelectorAll(".stat-card").forEach((c) => {
      c.tabIndex = 0;
      c.setAttribute("role", "button");
      c.onclick = () => setStatusFilter(c.dataset.filter);
      c.onkeydown = (e) => {
        if (["Enter", " "].includes(e.key)) {
          e.preventDefault();
          c.click();
        }
      };
    });
    setStatusFilter("todos");
    $("btnNaoRespondeu").onclick = () => setStatusFilter("pendente");
    $("btnLimpar").onclick = () => {
      $("searchInput").value = "";
      $("groupFilter").value = "todos";
      setStatusFilter("todos");
    };
    $("guestTableBody").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.invite) openInviteMessage(b.dataset.invite);
      if (b.dataset.edit) openGuest(b.dataset.edit);
      if (b.dataset.approve)
        action(b, async () => {
          await api(eventPath() + "/guests/" + b.dataset.approve, "PATCH", {
            approve: true,
          });
          await refresh();
          notice(
            "Cadastro aprovado. Envie o convite individual para a pessoa confirmar.",
          );
        });
    };
    $("addGuest").onclick = () => openGuest();
    $("guestForm").onsubmit = (e) => {
      e.preventDefault();
      action(e.submitter, async () => {
        const gid = $("guestId").value;
        await api(
          eventPath() + "/guests" + (gid ? "/" + gid : ""),
          gid ? "PATCH" : "POST",
          {
            nome: $("g-nome").value,
            telefone: $("g-telefone").value,
            grupo: $("g-grupo").value,
            limite: Number($("g-limite").value),
          },
        );
        hideModal("guestModal");
        await refresh();
        notice("Convidado salvo.");
      });
    };
    $("exportCSV").onclick = exportCSV;
    $("exportPDF").onclick = () => window.print();
    $("copyInvite").onclick = () =>
      action(null, async () => {
        await navigator.clipboard.writeText($("inviteMessageText").value);
        notice("Mensagem copiada.");
      });
    $("publicInvite").onclick = () =>
      window.open(inviteLink(), "_blank", "noopener,noreferrer");
    $("editEvent").onclick = () => {
      for (const key of ["titulo", "data", "prazo", "local"])
        $("e-" + key).value = currentEvent[key];
      $("e-cor").value = currentEvent.cor;
      $("e-dresscode").value = currentEvent.dresscode;
      $("e-presskit").checked = currentEvent.presskit;
      $("e-imagem").value = "";
      pendingImage = currentEvent.imagem;
      previewImage();
      showModal("editEventModal");
    };
    $("editEventForm").onsubmit = (e) => {
      e.preventDefault();
      action(e.submitter, async () => {
        await api(eventPath(), "PATCH", {
          cor: $("e-cor").value,
          dresscode: $("e-dresscode").value,
          presskit: $("e-presskit").checked,
          imagem: pendingImage,
          ...Object.fromEntries(
            ["titulo", "data", "prazo", "local"].map((key) => [
              key,
              $("e-" + key).value,
            ]),
          ),
        });
        hideModal("editEventModal");
        await refresh();
        notice("Evento atualizado.");
      });
    };
    $("giftForm").onsubmit = (e) => {
      e.preventDefault();
      action(e.submitter, async () => {
        await api(eventPath() + "/gifts", "POST", {
          nome: $("giftName").value,
          valor: Number($("giftValue").value),
        });
        $("giftForm").reset();
        await refresh();
        notice("Presente adicionado.");
      });
    };
    $("accessForm").onsubmit = (e) => {
      e.preventDefault();
      action(e.submitter, async () => {
        await api(eventPath() + "/access", "POST", {
          nome: $("accessName").value,
          email: $("accessEmail").value,

        });
        $("accessForm").reset();
        notice(
          "Acesso de leitura concedido. Compartilhe as credenciais diretamente com a pessoa.",
        );
      });
    };
    $("refreshData").onclick = () => action($("refreshData"), refresh);
    setInterval(() => {
      if (!document.hidden && !document.querySelector(".modal-overlay.open"))
        action(null, refresh);
    }, 15000);
  }),
);

let pendingImage = "";
function previewImage() {
  $("imagePreview").hidden = !pendingImage;
  if (pendingImage) $("imagePreview").src = pendingImage;
  else $("imagePreview").removeAttribute("src");
}
$("removeImage").onclick = () => {
  pendingImage = "";
  $("e-imagem").value = "";
  previewImage();
};
$("e-imagem").onchange = () =>
  action(null, async () => {
    const file = $("e-imagem").files[0];
    if (!file) return;
    const save = $("editEventForm").querySelector(
      'button[type="submit"], button.btn',
    );
    save.disabled = true;
    try {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 2 * 1024 * 1024
      )
        throw new Error("Escolha uma imagem PNG, JPEG ou WebP de até 2 MB.");
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(new Error("Não foi possível ler a imagem."));
        reader.readAsDataURL(file);
      });
      const img = new Image();
      img.src = data;
      await img.decode();
      pendingImage = data;
      previewImage();
    } finally {
      save.disabled = false;
      $("e-imagem").value = "";
    }
  });
$("sharePhoto").onclick = () =>
  action($("sharePhoto"), async () => {
    const [header, encoded] = currentEvent.imagem.split(",");
    const mime = header.slice(5, header.indexOf(";"));
    const file = new File(
      [Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0))],
      "convite." + mime.split("/")[1],
      { type: mime },
    );
    const data = { files: [file], text: $("inviteMessageText").value };
    if (!navigator.canShare?.(data)) {
      notice("Baixe a foto e anexe no WhatsApp junto da mensagem copiada.");
      return;
    }
    try {
      await navigator.share(data);
    } catch (err) {
      if (err.name !== "AbortError") throw err;
    }
  });
