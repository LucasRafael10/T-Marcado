import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { api } from "./src/api.mjs";
import { fail } from "./src/validation.mjs";
import { get, close } from "./src/database.mjs";
import { port, appOrigin } from "./src/config.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
await get("SELECT id FROM users LIMIT 1");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host;
    if (req.url !== "/health" && host !== new URL(appOrigin).host)
      fail(403, "Host inválido. Confira APP_ORIGIN.");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'",
    );
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname === "/health") {
      await get("SELECT 1 AS ok");
      res.end("ok");
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      const result = await api(req, res, url);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(result));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      fail(405, "Método não permitido.");
    const rel = decodeURIComponent(
      url.pathname === "/" ? "/index.html" : url.pathname,
    );
    const file = path.resolve(root, "public", "." + rel);
    if (
      !file.startsWith(path.join(root, "public") + path.sep) ||
      !mime[path.extname(file)] ||
      !existsSync(file)
    )
      fail(404, "Arquivo não encontrado.");
    res.setHeader("Content-Type", mime[path.extname(file)]);
    res.end(req.method === "HEAD" ? undefined : readFileSync(file));
  } catch (err) {
    if (err.code === "23505") {
      err.status = 409;
      err.message = "Já existe um cadastro com estes dados.";
    }
    res.statusCode = err.status || 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify({
        error: err.status
          ? err.message
          : "Não foi possível concluir. Tente novamente.",
      }),
    );
    if (!err.status) console.error(err);
  }
});
server.listen(port, "0.0.0.0", () =>
  console.log(`Tá Marcado disponível em ${appOrigin}`),
);
export { server };

for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(async () => {
      await close();
      process.exit(0);
    }),
  );
