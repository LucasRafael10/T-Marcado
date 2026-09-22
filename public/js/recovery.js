const form = document.getElementById("recoveryForm");
const message = document.getElementById("message");
const resetting = Boolean(document.getElementById("password"));
const token = new URLSearchParams(location.hash.slice(1)).get("token");
if (resetting) {
  history.replaceState(null, "", location.pathname);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    form.hidden = true;
    message.textContent =
      "Link inválido. Solicite um novo link de recuperação.";
  }
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (
    resetting &&
    document.getElementById("password").value !==
      document.getElementById("confirm").value
  ) {
    message.textContent = "As senhas precisam ser iguais.";
    return;
  }
  const button = form.querySelector("button");
  button.disabled = true;
  message.textContent = "Aguarde…";
  try {
    const response = await fetch(
      `/api/${resetting ? "reset-password" : "forgot-password"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          resetting
            ? { token, password: document.getElementById("password").value }
            : { email: document.getElementById("email").value },
        ),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Não foi possível concluir.");
    message.textContent = data.message;
    form.hidden = true;
    form.reset();
  } catch (error) {
    message.textContent =
      error.message || "Confira sua conexão e tente novamente.";
  } finally {
    button.disabled = false;
  }
});
