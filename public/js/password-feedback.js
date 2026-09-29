const passwordInput = document.getElementById("f-password"),
  repeatInput = document.getElementById("f-password-confirm");
function updatePasswordFeedback() {
  const p = passwordInput.value;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) =>
    r.test(p),
  ).length;
  const common =
    /^(password|senha|123456|qwerty|abcdef|111111)/i.test(p) ||
    /^(.)\1+$/.test(p);
  const score = !p
    ? 0
    : p.length < 8 || common
      ? 1
      : p.length >= 14 && classes >= 2
        ? 3
        : 2;
  const label = [
    "Digite uma senha com pelo menos 8 caracteres.",
    "Fraca — evite sequências e use uma senha mais longa.",
    "Moderada — aumente o comprimento para melhorar.",
    "Forte — boa combinação de comprimento e variedade.",
  ][score];
  const meter = document.getElementById("password-strength");
  meter.value = score;
  meter.dataset.score = score;
  meter.setAttribute("aria-valuetext", label);
  document.getElementById("password-strength-text").textContent = label;
  const match = document.getElementById("password-match");
  match.textContent = !repeatInput.value
    ? "Repita a senha para confirmar."
    : p === repeatInput.value
      ? "✓ As senhas conferem."
      : "As senhas ainda não conferem.";
  match.dataset.state = repeatInput.value
    ? p === repeatInput.value
      ? "match"
      : "mismatch"
    : "empty";
  repeatInput.setAttribute(
    "aria-invalid",
    String(Boolean(repeatInput.value) && p !== repeatInput.value),
  );
  repeatInput.setCustomValidity(
    repeatInput.value && p !== repeatInput.value
      ? "As senhas precisam ser iguais."
      : "",
  );
}
passwordInput.addEventListener("input", updatePasswordFeedback);
repeatInput.addEventListener("input", updatePasswordFeedback);
passwordInput.form.addEventListener("reset", () =>
  setTimeout(updatePasswordFeedback, 0),
);
updatePasswordFeedback();
