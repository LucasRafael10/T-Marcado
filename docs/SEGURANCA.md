# Segurança do Tá Marcado

Revisão em 22/09/2026. Código testado localmente com PGlite e Resend simulada. Não é teste de invasão nem atestado da configuração de produção.

## Implementado

- Confirmação de e-mail obrigatória: token aleatório, somente hash no banco, validade de 24 horas, consumo atômico e uso único. O dono do e-mail define sua própria senha ao confirmar, revogando sessões e recuperações anteriores. Contas existentes também precisam comprovar o e-mail.
- Cadastro não cria sessão antes da confirmação. Colaboradores recebem link para definir a própria senha. Reenvio tem intervalo e resposta genérica para contas inexistentes/já verificadas.
- Recuperação válida também comprova o e-mail e revoga confirmações pendentes.
- Limites de tentativas persistidos e atualizados atomicamente no PostgreSQL, compartilhados entre instâncias, inclusive em falhas de login. Cabeçalhos de proxy não são confiados por padrão.
- Script para papel de banco exclusivo, sem privilégios administrativos ou de alteração de schema. RLS permite acesso ao papel servidor; isolamento entre organizadores continua sendo responsabilidade das verificações da API, cobertas por testes.
- Validação do certificado TLS do PostgreSQL; configure DATABASE_CA_CERT quando necessário.
- CSP sem JavaScript inline, bloqueio de iframe/objetos, HSTS em HTTPS e política de permissões.
- Limite de corpo em bytes e scrypt assíncrono compatível com hashes existentes.
- .gitignore evita commit local acidental de .env; não protege uploads manuais pela interface do GitHub.

## Instalação obrigatória

Siga [ATIVAR-SEGURANCA.md](ATIVAR-SEGURANCA.md) antes do merge. O script não troca sozinho a conexão do Render nem configura remetente no Resend. A conexão e o envio reais ainda precisam ser validados.

## Riscos ainda presentes

- Links de convidados são credenciais: quem possui o link acessa seus dados. Não há regeneração/revogação pela interface.
- Recuperação envia e-mail em segundo plano sem fila persistente: reinícios podem interromper o envio. Confirmações aguardam o resultado do Resend, mas também não têm fila de retentativas.
- Limites globais podem bloquear usuários legítimos durante abuso; não substituem proteção de borda contra DDoS. Valide a cadeia de proxies antes de habilitar identificação por X-Forwarded-For.
- O papel servidor ainda acessa dados de diferentes organizadores, necessários à API; não é isolamento por usuário no banco.

Ative 2FA nas contas externas, mantenha dependências atualizadas e preserve backups. Nenhum sistema tem garantia absoluta contra invasões.
