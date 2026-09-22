let selectedRole = "noiva";
function selectRole(role) {
  selectedRole = role;
  ["tabNoiva", "tabCerimonialista"].forEach((id, i) => {
    const active = (i === 0) === (role === "noiva");
    $(id).classList.toggle("active", active);
    $(id).setAttribute("aria-pressed", String(active));
  });
  $("loginSub").textContent =
    role === "noiva"
      ? "Entre para organizar o seu evento."
      : "Entre para acompanhar os eventos dos seus clientes.";
}
document.addEventListener("DOMContentLoaded", () => {
  $("tabNoiva").onclick = () => selectRole("noiva");
  $("tabCerimonialista").onclick = () => selectRole("cerimonialista");
  $("loginForm").onsubmit = (e) => {
    e.preventDefault();
    action(e.submitter, async () => {
      try {
        const result = await api("/login", "POST", {
          email: $("emailInput").value,
          password: $("senhaInput").value,
          role: selectedRole,
        });
        location.href =
          result.role === "noiva" ? "painel.html" : "cerimonialista.html";
      } catch (err) {
        $("loginError").textContent = err.message;
        $("loginError").classList.add("show");
      }
    });
  };
});
