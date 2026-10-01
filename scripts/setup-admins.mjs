import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { hash } from "../src/passwords.mjs";
const filenames = ["admin-config.json", "admin-credentials.txt"];
if (filenames.some(existsSync))
  throw new Error(
    "Já existem arquivos de configuração. Guarde-os em local seguro e remova-os antes de gerar novas credenciais.",
  );
const rl = createInterface({ input, output }),
  accounts = [],
  credentials = [],
  emails = new Set();
try {
  console.log(
    "Configuração dos três administradores. As senhas serão geradas localmente; não as envie ao chat ou ao GitHub.",
  );
  for (let i = 1; i <= 3; i++) {
    let name, email;
    do {
      name = (await rl.question(`Nome do administrador ${i}: `)).trim();
    } while (!name || name.length > 100);
    do {
      email = (await rl.question(`E-mail do administrador ${i}: `))
        .trim()
        .toLowerCase();
    } while (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      emails.has(email)
    );
    emails.add(email);
    const password = randomBytes(24).toString("base64url");
    accounts.push({ name, email, passwordHash: await hash(password) });
    credentials.push(
      `${name}\nE-mail: ${email}\nSenha administrativa: ${password}`,
    );
  }
  writeFileSync(filenames[0], JSON.stringify(accounts), {
    mode: 0o600,
    flag: "wx",
  });
  writeFileSync(
    filenames[1],
    "CONFIDENCIAL — guarde em um gerenciador de senhas e apague este arquivo após distribuir cada senha individualmente.\n\n" +
      credentials.join("\n\n") +
      "\n",
    { mode: 0o600, flag: "wx" },
  );
  console.log(
    "Pronto. Copie o conteúdo de admin-config.json para ADMIN_ACCOUNTS no Render. As senhas individuais estão em admin-credentials.txt. Esses arquivos são ignorados pelo Git; não os publique.",
  );
} finally {
  rl.close();
}
