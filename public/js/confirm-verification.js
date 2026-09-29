const message = document.getElementById("message"),
  form = document.getElementById("plannerForm");
const token = new URLSearchParams(location.hash.slice(1)).get("token");
history.replaceState(null, "", location.pathname);
async function post(path, data) {
  const r = await fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Não foi possível confirmar.");
  return d;
}
async function activate(data) {
  const d = await post("confirm-email", { token, ...data });
  message.textContent = d.message;
  location.replace(d.role === "noiva" ? "painel.html" : "cerimonialista.html");
}
async function start() {
  try {
    const d = await post("verification-info", { token });
    if (d.needsPassword) {
      form.hidden = false;
      message.textContent = "Defina sua senha para aceitar o convite.";
    } else if (!d.sameBrowser) {
      message.textContent =
        "Abra o link original da mensagem no mesmo navegador em que fez o cadastro. Sua senha não precisa ser definida novamente.";
    } else await activate({});
  } catch (e) {
    message.textContent = e.message;
  }
}
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await activate({
      password: document.getElementById("password").value,
      passwordConfirm: document.getElementById("confirm").value,
    });
  } catch (e) {
    message.textContent = e.message;
  } finally {
    button.disabled = false;
  }
});
start();
