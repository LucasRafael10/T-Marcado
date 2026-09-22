// Only fixed diagnostics reach logs: provider bodies may contain personal data.
export function emailDiagnostic(error) {
  const hints = {
    400: "Revise o formato do remetente e destinatário.",
    401: "Confira a chave RESEND_API_KEY.",
    403: "Confira a chave, a permissão de envio, o domínio verificado e a restrição de destinatário de teste.",
    422: "Confira os campos do e-mail e o domínio do remetente.",
    429: "Limite de envio atingido. Confira a quota e aguarde antes de tentar novamente.",
  };
  if (error?.name === "TimeoutError") return "Tempo de resposta da Resend excedido.";
  if (Number.isInteger(error?.resendStatus))
    return `Resend HTTP ${error.resendStatus}. ${hints[error.resendStatus] || "Confira o serviço e os registros no painel Resend."}`;
  return "Falha no envio. Confira conexão, RESEND_API_KEY, EMAIL_FROM e os registros no painel Resend.";
}

export async function sendEmail(to, subject, text, html) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error("Configure RESEND_API_KEY e EMAIL_FROM no Render.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const error = new Error("Falha no envio pela Resend.");
    error.resendStatus = response.status;
    throw error;
  }
}
