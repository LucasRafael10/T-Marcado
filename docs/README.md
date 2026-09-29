# Tá Marcado — comece por aqui

Este é o guia de leitura do projeto, escrito para quem está conhecendo o código.

**Base deste guia:** código do cadastro simplificado, commit `fa95b45`, preparado em 29/09/2026. Isso identifica a versão explicada; não comprova que ela já foi publicada no Render. Este pacote altera somente a documentação.

## O que o site faz

O Tá Marcado organiza eventos, convidados, confirmações de presença, presentes e acesso de cerimonialistas. O organizador cria a conta e o evento. Cada convidado recebe um link individual. O cerimonialista acompanha apenas os eventos aos quais recebeu acesso.

## Entenda as quatro partes

| Parte | Explicação simples | Onde fica |
| --- | --- | --- |
| Tela | O que a pessoa vê e preenche | `public/` |
| Servidor | Confere os pedidos e decide o que pode ser feito | `server.mjs` e `src/` |
| Banco | Guarda contas, eventos e respostas | PostgreSQL no Supabase |
| E-mail | Envia confirmação e recuperação de senha | Resend, chamada por `src/email.mjs` |

GitHub guarda o código. Render executa o servidor. Supabase guarda os dados. Resend envia mensagens. Atualizar o GitHub e executar SQL no Supabase são ações diferentes.

## Ordem de leitura

1. [Mapa dos arquivos](MAPA-DO-CODIGO.md): descubra onde está cada coisa.
2. [Como os fluxos funcionam](FLUXOS.md): acompanhe um cadastro, login ou convite.
3. [Onde fazer alterações](COMO-ALTERAR.md): localize o arquivo certo para uma mudança.
4. [Banco de dados](BANCO-DE-DADOS.md): entenda as tabelas e suas relações.
5. [API](API.md): consulte os endereços usados pelas telas para falar com o servidor.
6. [Configuração e segurança](ATIVAR-SEGURANCA.md): entenda ambiente, permissões e implantação.
7. [E-mails](CONFIGURAR-RESEND.md): veja envio e diagnóstico.
8. [Testes](VALIDACAO.md): saiba o que foi verificado e como testar.
9. [Estado da segurança](REVISAO.md): veja proteções e limites conhecidos.
10. [Atualização do cadastro](ATUALIZAR-CADASTRO.md): consulte as mudanças mais recentes.

## Pequeno dicionário

| Termo | Significado neste projeto |
| --- | --- |
| HTML | Estrutura da página: títulos, campos e botões |
| CSS | Aparência: cores, tamanhos e espaçamentos |
| JavaScript | Ações e regras; `.js` está nas telas, `.mjs` identifica módulos usados pelo Node |
| Backend / servidor | Código executado no Render, fora do navegador do usuário |
| API | Conjunto de endereços que recebem pedidos das telas |
| JSON | Formato usado para enviar campos e respostas |
| SQL | Linguagem para consultar e alterar o banco |
| Migração | Arquivo SQL que cria ou atualiza a estrutura do banco |
| Sessão / cookie | Identificação temporária do navegador após cadastro ou login |
| Token | Código aleatório usado em um link ou sessão |
| Hash | Resultado usado para verificar um segredo sem armazená-lo em texto puro |
| Deploy | Publicação de uma versão executável no Render |
| Commit | Registro de um conjunto de alterações no Git |

## Como substituir esta pasta

Extraia o ZIP. Ele contém apenas `docs/`. Copie os arquivos para a pasta `docs` existente, substituindo os de mesmo nome e adicionando os novos. Não coloque outra pasta `docs` dentro dela. Não é necessário executar SQL nem alterar as variáveis do Render para atualizar estes textos.
