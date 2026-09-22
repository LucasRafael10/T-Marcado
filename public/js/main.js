function openEventForm() {
  showModal("eventModal");
}
function closeEventForm() {
  hideModal("eventModal");
}
function toggleEnvelope() {
  const el = $("envelope");
  el.classList.toggle("open");
  el.setAttribute("aria-expanded", el.classList.contains("open"));
}
document.addEventListener("DOMContentLoaded", () => {
  const envelope = $("envelope");
  envelope.setAttribute("role", "button");
  envelope.tabIndex = 0;
  envelope.setAttribute("aria-label", "Abrir ou fechar exemplo de convite");
  envelope.setAttribute("aria-expanded", "false");
  envelope.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleEnvelope();
    }
  };
  if (
    "IntersectionObserver" in window &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.1 },
    );
    document
      .querySelectorAll(".step,.trust-item,.gift-card,.chaos-card")
      .forEach((el) => {
        el.classList.add("reveal");
        observer.observe(el);
      });
  }
  $("eventForm").onsubmit = (e) => {
    e.preventDefault();
    action(e.submitter, async () => {
      await api("/register", "POST", {
        nome: $("f-nome").value,
        email: $("f-email").value,
        password: $("f-password").value,
        titulo: $("f-titulo").value,
        tipo: $("f-tipo").value,
        data: $("f-data").value,
        prazo: $("f-prazo").value,
        local: $("f-local").value,
      });
      location.href = "painel.html";
    });
  };
});
