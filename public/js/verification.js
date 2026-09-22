const form = document.getElementById("verificationForm");
const message = document.getElementById("message");
const token = new URLSearchParams(location.hash.slice(1)).get("token");
const sent = new URLSearchParams(location.search).get("enviado") === "1";
history.replaceState(null, "", location.pathname);
const confirming = Boolean(token);
if (confirming) {
  document.getElementById("emailFields").hidden = true;
  document.getElementById("email").disabled = true;
  document.getElementById("passwordFields").hidden = false;
  document.getElementById("password").disabled = false;
  document.getElementById("confirm").disabled = false;
  document.getElementById("instructions").textContent = "Defina a senha que só você conhece para confirmar seu e-mail e ativar sua conta.";
  document.getElementById("submit").textContent = "Confirmar e ativar conta";
  if (!/^[a-f0-9]{64}$/.test(token)) {
    form.hidden = true;
    message.dataset.state = "error";
    message.textContent = "Link inválido. Use “Pedir outro link” abaixo para reenviar a confirmação.";
  }
} else if (sent) {
  message.dataset.state = "success";
  message.textContent = "Cadastro salvo. Abra o link que enviamos por e-mail para ativar sua conta. Confira também o spam.";
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.getElementById("submit");
  const password = document.getElementById("password").value;
  const passwordConfirm = document.getElementById("confirm").value;
  if (confirming && password !== passwordConfirm) {
    message.dataset.state = "error";
    message.textContent = "As senhas precisam ser iguais.";
    return;
  }
  button.disabled = true;
  try {
    const response = await fetch(`/api/${confirming ? "verify-email" : "request-verification"}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirming ? { token,password,passwordConfirm } : { email: document.getElementById("email").value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível concluir.");
    message.dataset.state = "success";
    message.textContent = data.message;
    form.reset();
    if (confirming) form.hidden = true;
  } catch (error) {
    message.dataset.state = "error";
    message.textContent = error.message || "Confira sua conexão e tente novamente.";
  } finally { button.disabled = false; }
});
