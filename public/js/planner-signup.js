$("plannerSignup").addEventListener("submit", (e) => {
  e.preventDefault();
  action(e.submitter, async () => {
    $("signupError").classList.remove("show");
    try {
      const result = await api("/register", "POST", {
        role: "cerimonialista",
        nome: $("f-nome").value,
        email: $("f-email").value,
        password: $("f-password").value,
        passwordConfirm: $("f-password-confirm").value,
      });
      location.href =
        "aguarde-confirmacao.html?envio=" +
        encodeURIComponent(result.emailStatus || "unknown") +
        (result.mode === "manual" ? "&approval=manual" : "");
    } catch (error) {
      $("signupError").textContent = error.message;
      $("signupError").classList.add("show");
    }
  });
});
