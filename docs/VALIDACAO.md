# Validação desta entrega

Executada em 14/09/2026, com Node.js 22.15.0 e PostgreSQL embutido via PGlite. Dez cenários de integração passaram; o runner informa onze testes ao incluir o teste pai.

- Páginas e referências locais a CSS/JS acessíveis; arquivos do servidor e `.env` não são publicados.
- Cadastro, rejeição de datas inválidas, origem externa bloqueada e cookie HttpOnly/Secure.
- Login válido/inválido e isolamento entre organizadores.
- Convidados, telefone duplicado, token inválido e redução dos dados retornados publicamente.
- Limites de lugares/crianças e confirmação.
- Duas reservas simultâneas produzem um sucesso e um conflito; recusa libera a reserva; reserva concorrente com recusa não deixa presente reservado ao recusado.
- Autocadastro exige aprovação.
- Cerimonialista consulta apenas evento autorizado e não consegue editar.
- Prazo expirado, rollback de transação e logout.
- RLS habilitada nas seis tabelas e restrições de integridade verificadas no mecanismo PostgreSQL.

Os testes acessaram a API HTTP real do servidor local e executaram a migração SQL real no PGlite. Não usaram o pool remoto `pg` nem credenciais do Supabase. A concorrência do PGlite é serializada internamente; comportamento sob carga e conexões PostgreSQL independentes precisa ser validado em ambiente remoto de homologação.

Não foram realizados deploy no Render, execução do SQL no projeto do usuário ou revisão visual em navegador desta versão. O relatório do ZIP original não foi adotado como prova de testes desta entrega.
