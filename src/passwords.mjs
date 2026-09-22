import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
export const id = () => randomBytes(18).toString("hex");
export const hash = (password) => {
  const salt = id();
  return salt + ":" + scryptSync(password, salt, 64).toString("hex");
};
export function verify(password, stored) {
  const [salt, key] = stored.split(":");
  return timingSafeEqual(
    scryptSync(password, salt, 64),
    Buffer.from(key, "hex"),
  );
}
