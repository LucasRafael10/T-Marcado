const params = new URLSearchParams(location.search),
  eventId = params.get("evento"),
  token = params.get("token");
let currentGuest = null,
  currentResponse = null,
  currentQty = 1,
  eventInfo = null;
const eventPath = () => "/events/" + eventId;
function goToStep(id) {
  document
    .querySelectorAll(".step-panel")
    .forEach((el) => (el.hidden = el.id !== id));
  const index = id === "step3" ? 2 : id === "step2" ? 1 : 0;
  document.querySelectorAll(".progress-dots .dot").forEach((el, i) => {
    el.classList.toggle("active", i === index);
    el.classList.toggle("done", i < index);
  });
  const panel = $(id);
  panel.tabIndex = -1;
  panel.focus();
}
function selectResponse(value) {
  currentResponse = value;
  for (const [id, status] of [
    ["btnVou", "confirmado"],
    ["btnNaoVou", "recusado"],
  ]) {
    $(id).classList.toggle("selected", status === value);
    $(id).classList.toggle(
      status === "confirmado" ? "yes" : "no",
      status === value,
    );
    $(id).setAttribute("aria-pressed", status === value);
  }
  const yes = value === "confirmado";
  $("confirmFields").classList.toggle("show", yes);
  $("naoVouFields").classList.toggle("show", !yes);
  $("criancasInput").disabled = !yes;
}
function changeQty(delta) {
  currentQty = Math.max(1, Math.min(currentGuest.limite, currentQty + delta));
  $("qtyValue").textContent = currentQty;
  $("qtyMinus").disabled = currentQty <= 1;
  $("qtyPlus").disabled = currentQty >= currentGuest.limite;
  $("criancasInput").max = currentQty;
}
function openConfirm() {
  currentQty = Math.max(1, currentGuest.lugares || 1);
  $("greeting").textContent = "Oi, " + currentGuest.nome.split(" ")[0] + "!";
  $("limiteInfo").textContent =
    `Seu convite permite até ${currentGuest.limite} pessoa(s), incluindo você e as crianças.`;
  $("restricaoInput").value = currentGuest.restricao || "";
  $("criancasInput").value = currentGuest.criancas || 0;
  $("recadoInput").value = currentGuest.recado || "";
  $("recadoNaoVouInput").value = currentGuest.recado || "";
  $("enderecoInput").value = currentGuest.endereco || "";
  changeQty(0);
  if (["confirmado", "recusado"].includes(currentGuest.status))
    selectResponse(currentGuest.status);
  goToStep("step2");
}
async function loadGifts() {
  const gifts = await api(eventPath() + "/gifts?token=" + token);
  $("giftChoices").innerHTML = gifts.length
    ? gifts
        .map(
          (g) =>
            `<article class="gift-option"><div><strong>${escapeHTML(g.nome)}</strong><p>${money(g.valor)} · ${g.meu ? "Reservado por você" : g.reservado ? "Reservado" : "Disponível"}</p></div><button class="chip-btn" data-gift="${g.id}" data-cancel="${g.meu}" ${g.reservado && !g.meu ? "disabled" : ""}>${g.meu ? "Cancelar reserva" : g.reservado ? "Indisponível" : "Reservar"}</button></article>`,
        )
        .join("")
    : "<p>A lista de presentes ainda não foi cadastrada.</p>";
}
document.addEventListener("DOMContentLoaded", () =>
  action(null, async () => {
    if (!eventId) {
      $("eventNames").textContent = "Abra seu link de convite";
      $("eventDetails").textContent =
        "Peça ao organizador o link individual do seu evento.";
      $("nameForm").hidden = true;
      return;
    }
    const info = await api(
      eventPath() + "/public" + (token ? "?token=" + token : ""),
    );
    eventInfo = info.event;
    currentGuest = info.guest;
    applyEventTheme(eventInfo.cor);
    $("eventPhoto").hidden = !eventInfo.imagem;
    if (eventInfo.imagem) $("eventPhoto").src = eventInfo.imagem;
    $("dresscodeSection").hidden = !eventInfo.dresscode;
    $("dresscodeText").textContent = eventInfo.dresscode;
    $("presskitFields").hidden = !eventInfo.presskit;
    $("enderecoInput").disabled = !eventInfo.presskit;
    $("eventNames").textContent = eventInfo.titulo;
    $("eventDetails").textContent =
      `${dateLabel(eventInfo.data)} · ${eventInfo.local} · Confirme até ${dateLabel(eventInfo.prazo)}`;
    if (currentGuest) $("nameInput").value = currentGuest.nome;
    if (!token) {
      $("nameForm").hidden = true;
      $("publicRegister").hidden = false;
    }
    $("nameForm").onsubmit = (e) => {
      e.preventDefault();
      action(e.submitter, async () => {
        try {
          currentGuest = await api(eventPath() + "/identify", "POST", {
            token,
            nome: $("nameInput").value,
          });
          if (currentGuest.status === "aprovacao")
            throw new Error("Seu cadastro aguarda aprovação do organizador.");
          $("nameError").classList.remove("show");
          openConfirm();
        } catch (err) {
          $("nameError").textContent = err.message;
          $("nameError").classList.add("show");
        }
      });
    };
    $("publicRegister").onclick = () => goToStep("stepNotFound");
    $("notFoundLink").onclick = (e) => {
      e.preventDefault();
      goToStep("stepNotFound");
    };
    $("backName").onclick = () => goToStep("step1");
    $("selfRegisterForm").onsubmit = (e) => {
      e.preventDefault();
      action(e.submitter, async () => {
        await api(eventPath() + "/self-register", "POST", {
          nome: $("srNome").value,
          telefone: $("srTelefone").value,
        });
        $("doneIcon").textContent = "⏳";
        $("doneTitle").textContent = "Cadastro enviado";
        $("doneSub").textContent =
          "O organizador precisa aprovar seu cadastro e enviar seu link individual. Depois disso, você poderá confirmar a presença.";
        $("summaryBox").textContent =
          $("srNome").value + " · Aguardando aprovação";
        $("editButton").hidden = true;
        $("giftSection").hidden = true;
        goToStep("step3");
      });
    };
    $("btnVou").onclick = () => selectResponse("confirmado");
    $("btnNaoVou").onclick = () => selectResponse("recusado");
    $("qtyMinus").onclick = () => changeQty(-1);
    $("qtyPlus").onclick = () => changeQty(1);
    $("confirmForm").onsubmit = (e) => {
      e.preventDefault();
      action(e.submitter, async () => {
        if (!currentResponse)
          throw new Error("Selecione “Vou” ou “Não vou” antes de confirmar.");
        const yes = currentResponse === "confirmado";
        const response = {
          token,
          endereco: eventInfo.presskit ? $("enderecoInput").value : undefined,
          status: currentResponse,
          lugares: yes ? currentQty : 0,
          criancas: yes ? Number($("criancasInput").value) : 0,
          restricao: yes ? $("restricaoInput").value : "",
          recado: $(yes ? "recadoInput" : "recadoNaoVouInput").value,
        };
        await api(eventPath() + "/response", "POST", response);
        Object.assign(currentGuest, response);
        $("doneIcon").textContent = yes ? "🎉" : "💌";
        $("doneTitle").textContent = yes
          ? "Presença confirmada!"
          : "Obrigado por avisar";
        $("doneSub").textContent =
          "Sua resposta foi salva. Você pode editar até " +
          dateLabel(eventInfo.prazo) +
          ".";
        $("summaryBox").textContent =
          currentGuest.nome +
          "\n" +
          (yes
            ? `${currentQty} pessoa(s) · ${response.criancas} criança(s)\nRestrição: ${response.restricao || "Nenhuma"}`
            : "Não vai comparecer") +
          (response.recado ? "\nRecado: " + response.recado : "") +
          (response.endereco
            ? "\nEndereço para press kit: " + response.endereco
            : "");
        $("editButton").hidden = false;
        $("giftSection").hidden = !yes;
        goToStep("step3");
        if (yes) await loadGifts();
      });
    };
    $("editButton").onclick = openConfirm;
    $("giftChoices").onclick = (e) => {
      const b = e.target.closest("[data-gift]");
      if (b)
        action(b, async () => {
          await api(eventPath() + "/reserve/" + b.dataset.gift, "POST", {
            token,
            cancel: b.dataset.cancel === "true",
          });
          await loadGifts();
          notice("Reserva atualizada.");
        });
    };
  }),
);
