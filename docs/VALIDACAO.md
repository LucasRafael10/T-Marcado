# Testar e conferir o projeto

## Resultado disponível

Na preparação do cadastro simplificado em 29/09/2026, `npm test` informou **22 testes aprovados, zero falhas**. Esse número inclui o teste agrupador da API. A atualização atual é somente de documentação: não representa uma nova execução dos testes do sistema.

| Arquivo | Cobertura |
| --- | --- |
| `tests/integration.test.mjs` | Cadastro, sessões, confirmação, senha original, isolamento, convidados, presentes, recuperação, banco, limites e role restrita |
| `tests/email.test.mjs` | HTML de recuperação, envio Resend simulado e diagnóstico de falhas |
| `tests/signup-ui.test.mjs` | Estados da barra, confirmação de senha e scripts de ativação com DOM simulado |

Os testes usam PGlite, um PostgreSQL embutido, e uma Resend simulada. Não enviam e-mail real nem consultam o banco de produção. O PGlite serializa operações internamente: os cenários concorrentes não substituem ensaios com múltiplas conexões PostgreSQL remotas.

A revisão visual no navegador ficou pendente por indisponibilidade do executável de teste. Os testes de interface verificam comportamento de scripts, não aparência final em todos os tamanhos de tela.

## Rodar testes

Na pasta do projeto, com Node compatível com `package.json` (mínimo declarado: 22.13):

```sh
npm ci
npm test
```

Para executar o servidor normalmente, use `npm start` com as variáveis e banco configurados. Esse comando usa a conexão que você fornecer; não é automaticamente um ambiente de testes.

## Atenção ao npm run preview

O script `scripts/preview.mjs` cria dados temporários e desativa o envio pela Resend. Porém, cria a conta sem marcar `email_verified` e não configura envio. Por isso, o login da demonstração não conclui o fluxo atual de confirmação. Use os testes automatizados para verificar a API; não trate esse preview como demonstração completa do cadastro. Nenhuma correção nesse script está incluída neste pacote.

## Conferir após publicar o cadastro

1. Verifique deploy Live e `/health` respondendo `ok`.
2. Crie uma conta de teste com e-mail que você controla.
3. Digite senhas diferentes e iguais; observe texto e barra.
4. Conclua o cadastro e confira que a espera não pede o e-mail de novo.
5. Abra o link no mesmo navegador; confira que não pede outra senha e abre o painel.
6. Saia e entre com a senha original.
7. Confira recuperação de senha e acesso de cerimonialista.
8. Faça uma conferência no celular e no computador.

Use banco e endereços de teste para não misturar verificações com dados de clientes. Não publique capturas com senhas, URI, chaves ou links individuais completos.
