# O que mudou no cadastro simplificado

Versão de referência: `fa95b45`, preparada em 29/09/2026. O pacote anterior de código se chama `Ta-Marcado-cadastro-simplificado.zip`. Este pacote contém somente documentos e não instala essas funcionalidades por si só.

## Antes e depois

| Antes | Na versão simplificada |
| --- | --- |
| Não havia barra de senha | Mostra fraca, moderada ou forte enquanto digita |
| A divergência aparecia ao enviar | Mostra imediatamente se as senhas conferem |
| Após cadastrar, abria formulário de reenvio | Dispara envio e abre tela de espera |
| Organizador definia senha outra vez ao confirmar | Confirma sem trocar a senha original |
| Era preciso voltar manualmente ao site | A confirmação abre o painel; a aba de espera também acompanha |

O link do organizador deve ser aberto no mesmo navegador do cadastro. O cerimonialista convidado continua escolhendo sua senha na ativação, pois não preencheu o cadastro do organizador.

A barra usa comprimento, variedade e algumas sequências comuns. Ela orienta; não impõe uma nova regra obrigatória de senha forte. O servidor mantém o mínimo de 8 caracteres e valida a confirmação no cadastro.

## Instalação do código, se ainda não foi feita

Use o ZIP de código enviado anteriormente. Extraia e copie os arquivos para seus caminhos correspondentes, sem apagar pastas inteiras. Publique frontend e servidor juntos. Não há nova migração SQL ou variável obrigatória nessa atualização.

## Instalação desta documentação

Copie apenas a pasta `docs` deste ZIP para o projeto, substituindo os documentos correspondentes. Comece por [README.md](README.md). Isso atualiza as explicações e não muda o comportamento do site.
