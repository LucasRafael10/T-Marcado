import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
export const id = () => randomBytes(18).toString("hex");
export async function hash(password) {
  const salt = id();
  return salt + ":" + (await derive(password, salt, 64)).toString("hex");
}
export async function verify(password, stored) {
  const [salt, key] = String(stored).split(":");
  if (!salt || !/^[a-f0-9]{128}$/.test(key || "")) return false;
  return timingSafeEqual(
    await derive(password, salt, 64),
    Buffer.from(key, "hex"),
  );
}
