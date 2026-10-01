// Credenciais administrativas são configuradas no servidor, fora do cadastro público.
export const manualApproval = process.env.ACCESS_APPROVAL_MODE === "manual";
export function adminAccounts() {
  if (!process.env.ADMIN_ACCOUNTS) return [];
  let entries;
  try {
    entries = JSON.parse(process.env.ADMIN_ACCOUNTS);
  } catch {
    throw new Error("ADMIN_ACCOUNTS deve ser um JSON válido.");
  }
  if (!Array.isArray(entries) || entries.length !== 3)
    throw new Error(
      "Configure exatamente três administradores em ADMIN_ACCOUNTS.",
    );
  const emails = new Set();
  const accounts = entries.map((a) => {
    if (
      !a ||
      typeof a.email !== "string" ||
      typeof a.name !== "string" ||
      !a.name.trim() ||
      a.name.length > 100
    )
      throw new Error("Administrador inválido em ADMIN_ACCOUNTS.");
    const email = a.email.trim().toLowerCase();
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      emails.has(email) ||
      !/^[a-f0-9]{36}:[a-f0-9]{128}$/.test(a.passwordHash || "")
    )
      throw new Error(
        "E-mails únicos e hashes válidos são obrigatórios em ADMIN_ACCOUNTS.",
      );
    emails.add(email);
    return { email, name: a.name.trim(), passwordHash: a.passwordHash };
  });
  return accounts;
}
if (
  process.env.ACCESS_APPROVAL_MODE &&
  !["manual", "email"].includes(process.env.ACCESS_APPROVAL_MODE)
)
  throw new Error("ACCESS_APPROVAL_MODE deve ser manual ou email.");
// Configuração incompleta nunca abre acesso administrativo.
const configured = adminAccounts();
if (manualApproval && configured.length !== 3)
  throw new Error(
    "Configure ADMIN_ACCOUNTS antes de ativar a aprovação manual.",
  );
