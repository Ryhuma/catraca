---
name: iniciar
description: Ativa a catraca na pasta do projeto atual (cria .claude/catraca com livro de dividas, catalogo e pastas de receitas). Use quando o usuario digitar /catraca:iniciar ou aceitar a oferta de ativar a catraca.
---

# Iniciar a catraca neste projeto

1. Rode `node "<caminho do CLI informado no contexto da sessao>" init` na pasta do projeto.
2. Rode o mesmo CLI com `status` e confirme "catraca: ativa". O `init` cria tambem o executor `.claude/catraca/executor/executar-no-windows.ps1` (o centro: primitivas + motor das receitas).
3. Diga ao usuario, em 3 linhas: a pasta `.claude/catraca/` foi criada; a partir de agora tudo que voce executar a mao vira divida e voce a resolve criando receitas; para ver o ciclo funcionando, peca uma tarefa qualquer (ou siga `docs/EXERCICIO-WINDOWS.md` do plugin).
4. Sugira, sem fazer sozinho, adicionar `.claude/catraca/receitas/` e `.claude/catraca/scripts/` ao git para compartilhar as receitas (o `estado/` ja e ignorado).
5. Se o contexto da sessao nao trouxer o caminho do CLI, avise que o hook de inicio nao rodou (reiniciar a sessao) e nao tente adivinhar o caminho.
