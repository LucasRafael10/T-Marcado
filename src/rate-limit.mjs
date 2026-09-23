import { createHash } from "node:crypto";
import { get, run } from "./database.mjs";
import { fail } from "./validation.mjs";
// Atomic UPSERT uses the database clock and persists across processes/restarts.
export async function consume(key, max = 30, windowMs = 60000) {
  const digest = createHash("sha256").update(key).digest("hex");
  const row = await get(
    `INSERT INTO rate_limits(key,hits,expires)
    VALUES(?,1,(extract(epoch from clock_timestamp())*1000)::bigint + ?)
    ON CONFLICT(key) DO UPDATE SET
    hits=CASE WHEN rate_limits.expires <= (extract(epoch from clock_timestamp())*1000)::bigint THEN 1 ELSE LEAST(rate_limits.hits+1,1000000) END,
    expires=CASE WHEN rate_limits.expires <= (extract(epoch from clock_timestamp())*1000)::bigint THEN EXCLUDED.expires ELSE rate_limits.expires END
    RETURNING hits`,
    digest,
    windowMs,
  );
  if (Number(row.hits) > max)
    fail(429, "Muitas tentativas. Aguarde um minuto.");
}
export async function limit(req, key, max) {
  // Do not trust client-supplied forwarding headers. Shared proxy IP is conservative.
  await consume(key + ":" + req.socket.remoteAddress, max);
}
export async function cleanRates() {
  await run(
    "DELETE FROM rate_limits WHERE expires < (extract(epoch from clock_timestamp())*1000)::bigint",
  );
}
