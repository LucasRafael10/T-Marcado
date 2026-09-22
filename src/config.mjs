export const port = Number(process.env.PORT || 4173);
export const appOrigin =
  process.env.APP_ORIGIN ||
  (process.env.NODE_ENV === "production"
    ? process.env.RENDER_EXTERNAL_URL
    : `http://localhost:${port}`);
if (!appOrigin || new URL(appOrigin).origin !== appOrigin)
  throw new Error("Defina APP_ORIGIN como a URL completa, sem barra final.");
if (process.env.NODE_ENV === "production" && !appOrigin.startsWith("https://"))
  throw new Error("APP_ORIGIN deve usar HTTPS em produção.");
export const secureCookie = appOrigin.startsWith("https://") ? "; Secure" : "";
