import { readFileSync } from "node:fs";
import { executeMigration, close } from "../src/database.mjs";
try {
  await executeMigration(
    readFileSync(
      new URL("../supabase/migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("Estrutura do banco criada/verificada.");
  await executeMigration(
    readFileSync(
      new URL("../supabase/migrations/002_password_reset.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("Recuperação de senha configurada.");
  await executeMigration(
    readFileSync(
      new URL("../supabase/migrations/003_invite_options.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("Personalização dos convites configurada.");
  await executeMigration(
    readFileSync(
      new URL("../supabase/migrations/004_security.sql", import.meta.url),
      "utf8",
    ),
  );
} finally {
  await close();
}
