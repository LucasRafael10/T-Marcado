import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { get, run } from "./database.mjs";
import { fail } from "./validation.mjs";

// Default is fail-closed: forwarded headers are untrusted unless the deployment
// explicitly configures how many proxies it controls between client and app.
export function clientAddress(req) {
  const hops = Number(process.env.TRUST_PROXY_HOPS || 0);
  if (Number.isInteger(hops) && hops > 0 && hops <= 8) {
    const forwarded = String(req.headers["x-forwarded-for"] || "").split(",").map((s) => s.trim());
    const candidate = forwarded[forwarded.length - hops];
    if (candidate && isIP(candidate)) return candidate;
  }
  return req.socket.remoteAddress || "unknown";
}

let nextCleanup = 0;
export async function rateLimit(scope, identity, max, seconds = 60) {
  const bucket = createHash("sha256").update(`${scope}\0${identity}`).digest("hex");
  // PostgreSQL clock + atomic upsert: all instances and restarts share counters.
  const row = await get(`INSERT INTO rate_limits(bucket,hits,expires_at)
    VALUES(?,1,(floor(extract(epoch from clock_timestamp()) / ?) + 1) * ?)
    ON CONFLICT(bucket) DO UPDATE SET
      hits=CASE WHEN rate_limits.expires_at <= extract(epoch from clock_timestamp())
        THEN 1 ELSE LEAST(rate_limits.hits::bigint + 1,2147483647)::integer END,
      expires_at=CASE WHEN rate_limits.expires_at <= extract(epoch from clock_timestamp())
        THEN EXCLUDED.expires_at ELSE rate_limits.expires_at END
    RETURNING hits`, bucket, seconds, seconds);
  if (Number(row.hits) > max) fail(429, "Muitas tentativas. Aguarde alguns minutos e tente novamente.");
  if (Date.now() > nextCleanup) {
    nextCleanup = Date.now() + 60000;
    await run(`DELETE FROM rate_limits WHERE bucket IN (
      SELECT bucket FROM rate_limits WHERE expires_at < extract(epoch from clock_timestamp()) - 3600 LIMIT 1000
    )`);
  }
}

export async function limitRequest(req, path, body) {
  // Must run OUTSIDE business transactions, so a rejected login or rollback
  // never undoes the counter. These limits do not rely only on client IP.
  const account = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0,254) : "";
  const auth = ["/api/login", "/api/register", "/api/forgot-password", "/api/reset-password", "/api/request-verification", "/api/verify-email"].includes(path);
  if (auth) {
    await rateLimit("auth-service", "all", 300);
    await rateLimit("auth-ip", clientAddress(req), 120);
    if (account) await rateLimit(path, account, path === "/api/login" ? 12 : 5, 300);
    if (path === "/api/register") await rateLimit("registration-ip", clientAddress(req), 20, 300);
    if (typeof body.token === "string") await rateLimit(path, body.token.slice(0,128), 10, 300);
  } else if (req.method !== "GET") {
    await rateLimit("write-service", "all", 1200);
    await rateLimit("write-ip", clientAddress(req), 240);
    if (/\/self-register$/.test(path)) await rateLimit("self-register", path + ":" + clientAddress(req), 10, 300);
  }
}
