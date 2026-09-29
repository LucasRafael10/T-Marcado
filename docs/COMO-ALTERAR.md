# Onde alterar cada parte

Comece pelo que deseja mudar, não pelo tamanho do arquivo.

| Quero alterar… | Abra primeiro | Confira também |
| --- | --- | --- |
| Texto da página inicial | `public/index.html` | `public/css/style.css` |
| Cores e fontes | `public/css/tokens.css` | CSS da página e `refinements.css` |
| Logo | `public/logo-mark.svg` | Tags de imagem nos HTML e `base.css` |
| Campos do cadastro | `public/index.html` | `main.js` e `/api/register` em `api.mjs` |
| Barra de força da senha | `public/js/password-feedback.js` | `public/css/base.css` |
| Regra mínima de senha | `src/api.mjs` | `password-reset.mjs`, `email-verification.mjs` e atributos dos formulários |
| Espera após cadastrar | `public/aguarde-confirmacao.html` | `wait-verification.js` |
| Ação do link de confirmação | `src/email-verification.mjs` | `confirm-verification.js` e `auth.mjs` |
| Texto e botão do e-mail | `src/email-templates.mjs` | Texto simples em `email-verification.mjs` ou `password-reset.mjs` |
| Tela de login | `public/login.html` | `login.js` e `/api/login` |
| Painel e filtros | `public/painel.html` | `painel.js`, `painel.css` |
| Convite | `public/convite.html` | `convite.js`, `convite.css` |
| Acesso do cerimonialista | `src/auth.mjs` | Rota `/access` em `api.mjs` |
| Prazo ou quantidade de convidados | `src/api.mjs` | `validation.mjs` e restrições SQL |
| Frequência de tentativas | Chamadas a `limit`/`consume` em `src/api.mjs` | `src/rate-limit.mjs` |
| Endereço do site ou banco | Variáveis do Render | `src/config.mjs` e `src/database.mjs` |

## Exemplo: trocar o texto de um botão

1. Abra o HTML da página.
2. Procure o texto visível do botão.
3. Troque o texto entre as tags, preservando `id`, `class` e `data-action`.
4. Salve o arquivo em UTF-8 para conservar os acentos.
5. Confira a página no computador e no celular.

Não coloque o trecho HTML no final do arquivo sem localizar o elemento existente. IDs conectam os campos ao JavaScript; removê-los pode quebrar a ação.

## Exemplo: adicionar um campo de verdade

Um campo que precisa ser salvo normalmente exige quatro alterações: HTML para mostrar, JavaScript para enviar, API para validar e gravar, banco para armazenar. Se for apenas ajuda visual, como a barra de senha, não precisa de coluna nova.

## Como ler uma função

```js
const nome = txt(b.nome, "Nome");
```

`b` contém os dados recebidos da tela. `b.nome` é o campo enviado. `txt` confere se ele é um texto preenchido e dentro do limite. Se for inválido, a função interrompe a operação com uma mensagem.

```js
const u = await auth(req);
```

`req` é o pedido recebido. `auth` confere a sessão e a confirmação do e-mail. `await` espera a consulta terminar. Sem acesso válido, a função devolve um erro em vez de continuar.

## Rotina de alteração

Edite uma parte de cada vez. Para regras de conta, acesso ou banco, execute `npm test`. Depois publique todos os arquivos relacionados no mesmo commit. Confira o deploy e o fluxo alterado. Uma mudança visual não exige rodar SQL.

As senhas, a URI do banco e as chaves de API ficam no ambiente do servidor. O diretório `public` é acessível pelo navegador e nunca deve recebê-las.
