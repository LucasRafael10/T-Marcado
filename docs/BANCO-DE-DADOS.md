# Modelo de dados

| Tabela | Finalidade | Relacionamentos |
|---|---|---|
| users | Organizadores e cerimonialistas, e-mail único, hash de senha | Um usuário pode ser dono de eventos |
| sessions | Sessões de 24 horas | Pertence a um usuário |
| events | Título, tipo, data, local e prazo | Pertence ao organizador (`owner`) |
| access | Autorização de leitura do cerimonialista | Liga usuário e evento, sem duplicações |
| guests | Convites, telefone, limite e resposta | Pertence a um evento, token individual único |
| gifts | Presentes com valor de referência e reserva | Pertence a um evento; reserva aponta para convidado do mesmo evento |

Os nomes de tabelas e os campos legados foram mantidos para preservar o contrato com as telas. IDs e tokens usam 18 bytes aleatórios, representados por 36 caracteres hexadecimais. Datas são strings ISO `AAAA-MM-DD`, mantendo o formato consumido pelo frontend; a API valida a existência da data e o SQL restringe o formato e a ordem do prazo. Valores monetários usam `numeric(12,2)`, evitando armazenamento em ponto flutuante.

## Regras

- `noiva` é o nome interno legado do perfil de organizador. Ele pode criar/editar seu evento, convidados, presentes e conceder leitura.
- `cerimonialista` só consulta eventos autorizados; os tokens de convite não são retornados para esse perfil.
- O mesmo telefone não pode ser duplicado dentro de um evento, mas pode participar de eventos diferentes.
- Estados: `pendente`, `aprovacao`, `confirmado`, `recusado`.
- Autocadastro público inicia em `aprovacao`; o organizador precisa aprovar.
- Crianças estão incluídas em `lugares`, e não somadas separadamente.
- Convidado confirmado deve ter pelo menos um lugar, sem ultrapassar seu limite.
- Recusar presença zera pessoas/crianças e libera reservas.
- Prazo de confirmação usa o fuso `America/Cuiaba`.
- Presentes só podem ser reservados por convidados confirmados antes do prazo.
- Alterações no mesmo evento usam bloqueio `FOR UPDATE` dentro de transação. Uma reserva só é aceita quando `guest_id IS NULL`.

## Proteção do acesso

RLS está habilitada sem políticas de acesso público. As funções do navegador falam com o servidor Node, e não com as tabelas pelo SDK Supabase. O servidor usa uma conexão privilegiada ao PostgreSQL e aplica as permissões na API. Não crie políticas liberando todas as linhas para `anon` ou `authenticated`.

As sessões e senhas não são retornadas em `/api/me`. Links de convite devem ser compartilhados individualmente: o token concede acesso à resposta e às reservas desse convite.
