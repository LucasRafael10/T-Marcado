const mode = document.body.dataset.mode;
const form = document.getElementById("recoveryForm");
const message = document.getElementById("message");
const resetting = Boolean(document.getElementById("password"));
const token = new URLSearchParams(location.hash.slice(1)).get("token");
if (resetting) {
  history.replaceState(null, "", location.pathname);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    form.hidden = true;
    message.dataset.state = "error";
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
    message.dataset.state = "error";
    message.textContent = "As senhas precisam ser iguais.";
    return;
  }
  const button = form.querySelector("button");
  button.disabled = true;
  message.dataset.state = "loading";
  message.textContent = "Aguarde…";
  try {
    const response = await fetch(
      `/api/${mode === "verify" ? "confirm-email" : mode === "resend" ? "resend-verification" : resetting ? "reset-password" : "forgot-password"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          resetting
            ? {
                token,
                password: document.getElementById("password").value,
                passwordConfirm: document.getElementById("confirm").value,
              }
            : { email: document.getElementById("email").value },
        ),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error || "Não foi possível concluir.");
    message.dataset.state = "success";
    message.textContent = data.message;
    form.hidden = true;
    form.reset();
  } catch (error) {
    message.dataset.state = "error";
    message.textContent =
      error.message || "Confira sua conexão e tente novamente.";
  } finally {
    button.disabled = false;
  }
});
