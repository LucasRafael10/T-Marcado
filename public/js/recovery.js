const mode = document.body.dataset.mode;
const form = document.getElementById("recoveryForm");
const message = document.getElementById("message");
const resetting = Boolean(document.getElementById("password"));
let token;
function loadResetLink() {
  token = new URLSearchParams(location.hash.slice(1)).get("token");
  history.replaceState(null, "", location.pathname);
  form.reset();
  form.hidden = false;
  message.dataset.state = "";
  message.textContent = "";
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    form.hidden = true;
    message.dataset.state = "error";
    message.textContent =
      "Link inválido. Solicite um novo link de recuperação.";
  }
}
if (resetting) {
  loadResetLink();
  window.addEventListener("hashchange", loadResetLink);
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

if (!resetting) {
  fetch("/api/access-policy", { cache: "no-store" })
    .then((r) => {
      if (!r.ok) throw new Error();
      return r.json();
    })
    .then((policy) => {
      if (policy.mode === "manual") {
        if (mode === "resend") {
          form.hidden = true;
          message.textContent =
            "O cadastro agora é aprovado pela equipe. Entre com seu e-mail e senha para acompanhar a análise.";
        } else {
          document.querySelector(".login-sub").textContent =
            "Informe o e-mail cadastrado. A equipe analisará o pedido e, após conferir sua identidade, fornecerá um link temporário para você escolher uma nova senha.";
        }
      }
    })
    .catch(() => {});
}
