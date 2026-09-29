const message = document.getElementById("message"),
  button = document.getElementById("resend");
const initialStatus = new URLSearchParams(location.search).get("envio");
const initialMessages = {
  sent: "O serviço de e-mail aceitou o envio. Confira a caixa de entrada e o spam.",
  failed:
    "Sua conta está salva, mas não foi possível confirmar o envio do e-mail. Use Reenviar link; se persistir, contate o suporte.",
  cooldown:
    "Já houve uma solicitação recente. Aguarde o contador para reenviar.",
};
if (initialMessages[initialStatus])
  message.textContent = initialMessages[initialStatus];
let nextSend = 0,
  sending = false,
  ready = false,
  stopped = false;
function renderButton() {
  const secs = Math.max(0, Math.ceil((nextSend - Date.now()) / 1000));
  button.disabled = stopped || !ready || sending || secs > 0;
  button.textContent = sending
    ? "Enviando…"
    : secs
      ? `Reenviar em ${secs}s`
      : "Reenviar link";
}
const ticker = setInterval(renderButton, 1000);
function expireSession() {
  stopped = true;
  clearInterval(ticker);
  message.textContent =
    "Sua sessão expirou. Entre com o e-mail e a senha do cadastro para continuar.";
  renderButton();
}
async function check() {
  try {
    const r = await fetch("/api/verification-status", { cache: "no-store" });
    if (r.status === 401) {
      expireSession();
      return;
    }
    if (r.ok) {
      const d = await r.json();
      document.getElementById("pending-email").textContent = d.email;
      if (d.verified) {
        stopped = true;
        clearInterval(ticker);
        location.replace(
          d.role === "noiva" ? "painel.html" : "cerimonialista.html",
        );
        return;
      }
      // O prazo vem do servidor, inclusive após atualizar a página.
      if (!sending) nextSend = Date.now() + (d.retryAfter || 0) * 1000;
      ready = true;
      renderButton();
    } else if (!ready) {
      message.textContent =
        "Não foi possível consultar sua conta. Tentaremos novamente em alguns segundos.";
    }
  } catch {
    if (!ready)
      message.textContent =
        "Não foi possível conectar. Verifique sua conexão; tentaremos novamente.";
  }
  if (!stopped) setTimeout(check, 5000);
}
button.addEventListener("click", async () => {
  if (button.disabled || sending || stopped) return;
  sending = true;
  renderButton();
  message.textContent = "Solicitando o envio do link…";
  try {
    const r = await fetch("/api/resend-pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (r.status === 401) {
      expireSession();
      return;
    }
    const d = await r.json();
    if (!r.ok)
      throw new Error(d.error || "Não foi possível reenviar. Tente novamente.");
    nextSend = Date.now() + (d.retryAfter || 0) * 1000;
    message.textContent =
      d.message || "Não foi possível confirmar o envio. Tente novamente.";
  } catch (e) {
    message.textContent =
      e.message || "Não foi possível reenviar. Tente novamente.";
  } finally {
    sending = false;
    renderButton();
  }
});
renderButton();
check();
