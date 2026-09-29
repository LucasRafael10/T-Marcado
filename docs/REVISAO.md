# Segurança: estado do código documentado

Referência: cadastro simplificado `fa95b45`, 29/09/2026. Este texto substitui a revisão antiga que ainda listava correções já implementadas. Não é certificação de segurança nem inspeção das configurações privadas do serviço publicado.

## Proteções existentes

| Proteção | Onde está | O que faz |
| --- | --- | --- |
| Hash de senha assíncrono com scrypt | `passwords.mjs` | Evita guardar senha legível e não bloqueia o processamento síncrono do servidor |
| Validação no servidor | `api.mjs`, `validation.mjs` | Confere campos independentemente do navegador |
| Consultas parametrizadas | `database.mjs` | Separa valores recebidos dos comandos SQL |
| Permissões por evento | `auth.mjs` | Confere organizador, cerimonialista e convidado |
| Cookie HttpOnly e SameSite=Strict | `auth.mjs` | Restringe uso do cookie; Secure é aplicado com HTTPS |
| Confirmação do e-mail | `email-verification.mjs` | Exige token e, para organizador, sessão correspondente |
| Tokens de e-mail com hash, prazo e uso único | Módulos de confirmação/recuperação | Reduz reutilização e exposição no banco |
| Limites compartilhados no banco | `rate-limit.mjs` | Mantém contadores entre processos e reinícios |
| TLS com validação | `database.mjs` | Verifica o certificado da conexão ao banco |
| Conta do banco restrita | Migração 005 e `server.mjs` | Separa execução de administração |
| Cabeçalhos HTTP | `server.mjs` | Bloqueia scripts inline, enquadramento e outras fontes não permitidas |
| Limite de corpo em bytes | `api.mjs` | Rejeita requisições grandes demais |

Scripts inline são bloqueados; estilos inline ainda são permitidos pela política atual. Imagens são limitadas a PNG/JPEG/WebP, até 2 MB decodificados, com verificação básica de formato e assinatura.

## Limites que continuam existindo

- A role do servidor pode operar nos dados das nove tabelas. O isolamento dos organizadores é aplicado pela API, não por uma role de banco por pessoa.
- O limite por endereço usa a conexão recebida; atrás de proxy, várias pessoas podem compartilhar o mesmo limite. Há limites por e-mail em algumas operações. Isso não substitui proteção contra DDoS.
- O envio de e-mail não tem fila persistente nem reentrega automática garantida.
- A barra de senha é uma estimativa simples, não uma consulta a vazamentos nem teste criptográfico.
- Logs de diagnóstico não equivalem a um histórico completo de auditoria.
- Links de convidados dão acesso ao convite correspondente; devem ser compartilhados individualmente.
- Revisão visual, carga remota, backups e configuração real das contas externas precisam de verificação própria.

## Observações conhecidas

Algumas mensagens de `server.mjs` na base publicada foram salvas com acentos incorretos, como `invÃ¡lido`. Isso é um problema de codificação de texto; este pacote de documentação não altera o servidor.

O script de demonstração precisa ser adaptado ao fluxo atual de confirmação; veja [VALIDACAO.md](VALIDACAO.md). Documentar a limitação não significa que ela foi corrigida.
