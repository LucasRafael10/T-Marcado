const message = document.getElementById("message"),
  button = document.getElementById("resend");
let nextSend = Date.now() + 60000;
const ticker = setInterval(() => {
  const secs = Math.max(0, Math.ceil((nextSend - Date.now()) / 1000));
  button.disabled = secs > 0;
  button.textContent = secs ? `Reenviar em ${secs}s` : "Reenviar link";
}, 1000);
async function check() {
  try {
    const r = await fetch("/api/verification-status", { cache: "no-store" });
    if (r.status === 401) {
      message.textContent =
        "Sua sessão expirou. Entre com o e-mail e a senha do cadastro para continuar.";
      clearInterval(ticker);
      button.disabled = true;
      return;
    }
    if (r.ok) {
      const d = await r.json();
      document.getElementById("pending-email").textContent = d.email;
      if (d.verified) {
        clearInterval(ticker);
        location.replace(
          d.role === "noiva" ? "painel.html" : "cerimonialista.html",
        );
        return;
      }
    }
  } catch {}
  setTimeout(check, 5000);
}
button.addEventListener("click", async () => {
  nextSend = Date.now() + 60000;
  button.disabled = true;
  try {
    const r = await fetch("/api/resend-pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    message.textContent =
      "Solicitamos outro envio. Confira seu e-mail e a pasta de spam.";
  } catch (e) {
    message.textContent =
      e.message || "Não foi possível reenviar. Tente novamente.";
  }
});
check();
