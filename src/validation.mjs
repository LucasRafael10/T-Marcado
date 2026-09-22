export const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export const txt = (v, label, max = 160) => {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    fail(400, `${label}: preencha corretamente (até ${max} caracteres).`);
  return v.trim();
};
export const phone = (v) => {
  const n = String(v || "")
    .replace(/\D/g, "")
    .replace(/^55(?=\d{10,11}$)/, "");
  if (!/^\d{10,11}$/.test(n))
    fail(400, "Informe um telefone com DDD (10 ou 11 dígitos).");
  return n;
};
export const integer = (v, min, max, label) => {
  if (!Number.isInteger(v) || v < min || v > max)
    fail(400, `${label}: informe um número inteiro entre ${min} e ${max}.`);
  return v;
};
export const date = (v, label) => {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v || "") ||
    !Number.isFinite(Date.parse(v + "T12:00:00Z")) ||
    new Date(v + "T12:00:00Z").toISOString().slice(0, 10) !== v
  )
    fail(400, `${label} inválida.`);
  return v;
};
export const norm = (s) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function deadline(e) {
  if (today() > e.prazo)
    fail(409, "O prazo de confirmação encerrou. Fale com o organizador.");
}
