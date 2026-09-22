const $ = (id) => document.getElementById(id);
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const dateLabel = (value) =>
  value ? new Date(value + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const normalize = (value) =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const money = (value) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const STATUS_LABEL = {
  confirmado: "Confirmado",
  recusado: "Recusado",
  pendente: "Pendente",
  aprovacao: "Aguardando aprovação",
};
async function api(url, method = "GET", data) {
  const res = await fetch("/api" + url, {
    method,
    headers: method === "GET" ? {} : { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await res.json();
  if (!res.ok) {
    if (
      res.status === 401 &&
      ["/painel.html", "/cerimonialista.html"].includes(location.pathname)
    )
      location.href = "login.html";
    throw new Error(result.error || "Falha na solicitação.");
  }
  return result;
}
function notice(message, error = false) {
  let box = $("appNotice");
  if (!box) {
    box = document.createElement("div");
    box.id = "appNotice";
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    document.body.append(box);
  }
  box.textContent = message;
  box.classList.toggle("error", error);
  box.hidden = false;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => (box.hidden = true), 7000);
}
async function action(button, fn) {
  if (button?.disabled) return;
  if (button) button.disabled = true;
  try {
    await fn();
  } catch (e) {
    notice(e.message, true);
  } finally {
    if (button) button.disabled = false;
  }
}
function showModal(id) {
  const el = $(id);
  el._previous = document.activeElement;
  el.classList.add("open");
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-modal", "true");
  el.setAttribute(
    "aria-label",
    el.querySelector("h3")?.textContent || "Formulário",
  );
  document.body.style.overflow = "hidden";
  setTimeout(
    () => el.querySelector("input,textarea,select,button")?.focus(),
    0,
  );
}
function hideModal(id) {
  const el = $(id);
  el.classList.remove("open");
  document.body.style.overflow = "";
  el._previous?.focus();
}
function guestRow(g, actions = "") {
  return `<td><div class="guest-name">${escapeHTML(g.nome)}</div><div class="guest-sub">${escapeHTML(g.telefone)}</div>${g.endereco ? `<div class="guest-sub">Press kit: ${escapeHTML(g.endereco)}</div>` : ""}</td><td><span class="badge ${g.status}">${STATUS_LABEL[g.status]}</span></td><td>${g.lugares || "—"}</td><td>${escapeHTML(g.restricao || "—")}</td><td>${g.criancas || "—"}</td><td>${dateLabel(g.respondido)}</td>${actions}`;
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("a[data-logout]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      action(null, async () => {
        await api("/logout", "POST", {});
        location.href = "login.html";
      });
    }),
  );
  document.querySelectorAll(".modal-overlay").forEach((el) =>
    el.addEventListener("click", (e) => {
      if (e.target === el) hideModal(el.id);
    }),
  );
  document.querySelectorAll("input[placeholder]").forEach((el) => {
    if (!el.labels?.length && !el.getAttribute("aria-label"))
      el.setAttribute("aria-label", el.placeholder);
  });
  document.addEventListener("keydown", (e) => {
    const modal = document.querySelector(".modal-overlay.open");
    if (!modal) return;
    if (e.key === "Escape") hideModal(modal.id);
    if (e.key === "Tab") {
      const list = [
        ...modal.querySelectorAll("button,input,select,textarea,a[href]"),
      ].filter((el) => !el.disabled && el.getClientRects().length);
      const first = list[0],
        last = list.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
});

function applyEventTheme(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color || "")) return;
  const rgb = color
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16));
  const mix = (target, amount) =>
    "#" +
    rgb
      .map((v) =>
        Math.round(v * (1 - amount) + target * amount)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("");
  // Dark accents preserve legibility even when a very light color is selected.
  const luminance = rgb.map((v) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const light =
    luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722 >
    0.18;
  const values = {
    green: light ? mix(0, 0.55) : color,
    "green-deep": mix(0, 0.65),
    gold: mix(0, 0.55),
    rose: mix(0, 0.5),
    "gold-soft": mix(255, 0.6),
    paper: mix(255, 0.94),
    "paper-raised": mix(255, 0.98),
    line: mix(255, 0.72),
  };
  for (const [name, value] of Object.entries(values))
    document.documentElement.style.setProperty("--" + name, value);
}
