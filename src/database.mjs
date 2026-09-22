import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import pg from "pg";

const context = new AsyncLocalStorage();
let pool;

// PostgreSQL embutido exclusivamente para testes, sem acessar o Supabase real.
if (process.env.NODE_ENV === "test" && process.env.TEST_DATABASE === "pglite") {
  const { PGlite } = await import("@electric-sql/pglite");
  pool = new PGlite();
  await pool.exec(
    readFileSync(
      new URL("../supabase/migrations/001_initial.sql", import.meta.url),
      "utf8",
    ),
  );
  await pool.exec(
    readFileSync(
      new URL("../supabase/migrations/003_invite_options.sql", import.meta.url),
      "utf8",
    ),
  );
} else {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Defina DATABASE_URL com a conexão Session pooler do Supabase. Consulte README.md.",
    );

  const connection = new URL(process.env.DATABASE_URL);
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    connection.searchParams.delete(key);

  pool = new pg.Pool({
    connectionString: connection.toString(),
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    ssl: {
      // Necessário no Render/Supabase quando a cadeia inclui certificado intermediário autoassinado.
      rejectUnauthorized: false,
    },
  });

  pool.on("error", (err) =>
    console.error("Conexão com banco interrompida:", err.code),
  );
}

// SQL usa parâmetros posicionais; nenhum valor recebido é interpolado.
function parameters(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function query(sql, args) {
  return (context.getStore() || pool).query(parameters(sql), args);
}

export async function get(sql, ...args) {
  return (await query(sql, args)).rows[0];
}

export async function all(sql, ...args) {
  return (await query(sql, args)).rows;
}

export async function run(sql, ...args) {
  const result = await query(sql, args);
  return { changes: result.rowCount ?? result.affectedRows ?? 0 };
}

export async function transaction(fn) {
  if (context.getStore()) return fn();
  if (pool instanceof pg.Pool) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await context.run(client, fn);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  return pool.transaction((tx) => context.run(tx, fn));
}

export async function executeMigration(sql) {
  if (pool instanceof pg.Pool) return pool.query(sql);
  return pool.exec(sql);
}

export async function close() {
  if (pool instanceof pg.Pool) await pool.end();
  else await pool.close();
}
