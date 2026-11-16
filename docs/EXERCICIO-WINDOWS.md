# Exercício guiado: veja o ciclo funcionando (Windows, 10 minutos)

**Objetivo:** entender como o trabalho manual do Claude vira **primitiva no executor `.ps1`** e **receita `.json`**. Quem trabalha é o **Claude**; você só pede e confere. O exercício só **lê** informações do computador: não altera nem apaga nada.

Pré-requisito: plugin instalado e `/catraca:iniciar` feito em uma pasta de teste (crie uma pasta vazia, por exemplo `C:\teste-catraca`, e abra o Claude Code nela). O `init` cria o executor em `.claude/catraca/executor/executar-no-windows.ps1`, ainda sem primitivas além de `-Status`.

## Parte 1: a primeira vez (nasce a dívida, a primitiva e a receita)
Cole no Claude:

> Mostre o espaço livre de cada disco do meu computador, em GB.

O que deve acontecer, nesta ordem (sem você fazer mais nada):
1. O Claude executa um comando PowerShell à mão (por exemplo `Get-CimInstance Win32_LogicalDisk ...`).
2. O hook avisa: `divida #1 (get-ciminstance) registrada`.
3. O Claude roda `catalogo` (só existe `-Status`) e `decidir --nova espaco-livre-discos --motivo "..."`.
4. Ele **acrescenta ao executor** uma primitiva `-EspacoLivre` (parâmetro + bloco com `#@primitiva`).
5. Ele cria `.claude/catraca/receitas/espaco-livre-discos.json`, que **chama** `-EspacoLivre`.
6. Ele roda `rodar espaco-livre-discos` até dar OK e fecha a dívida (o `fechar` confere a sintaxe do `.ps1` e a execução).
7. A mensagem final diz o que nasceu e como rodar.

**Confira você:** peça "mostre o status da catraca": `dívidas abertas: 0 | receitas: 1`. Abra o executor e procure `#@primitiva EspacoLivre`.

> Para comparar com uma versão pronta: `exemplos/primitiva-EspacoLivre.txt` e `exemplos/espaco-livre-discos.json` no plugin. A sua pode ficar diferente: o importante é que rode e que o Claude a tenha provado.

## Parte 2: a segunda vez (sem dívida)
Cole:

> Mostre de novo o espaço livre dos discos.

Esperado: o Claude lê o catálogo e roda `rodar espaco-livre-discos`. **Nenhuma dívida nova.** Esse é o ganho: a tarefa virou uma chamada.

## Parte 3: o upgrade
Cole:

> Agora mostre só os discos com menos de 50% de espaço livre.

Esperado: o Claude percebe que é a mesma tarefa com um filtro, faz `decidir --upgrade espaco-livre-discos`, acrescenta o parâmetro (a primitiva ganha `-LimitePct`, a receita ganha `limitePct`), roda e fecha. **Não nasce uma segunda receita parecida.**

## Parte 4: veja as barreiras (opcional)
- Peça: "descarte a dívida 1 por conta própria". O hook recusa: descartar é só do usuário.
- Peça: "rode a primitiva -EspacoLivre direto no executor". O hook registra uma dívida: primitiva fora de receita é calibração a mão.
- Peça uma tarefa nova executada à mão (por exemplo "liste os 5 processos que mais usam memória") e depois "pode encerrar": o hook de parada o devolve ao trabalho até a dívida fechar.

## O que você aprendeu
| Peça | Papel |
|---|---|
| Executor `.ps1` | o centro: executa receitas e guarda as primitivas (capacidades) |
| Receita `.json` | sequencia primitivas; é o que se chama no dia a dia |
| Dívida | nasce de trabalho manual; só fecha com receita provada |
| `catalogo` + `decidir` | impedem receita duplicada |
| `rodar` e `fechar` | prova de execução e conferência da sintaxe do `.ps1` |

## Se algo não aconteceu
- **Nenhuma dívida apareceu:** o Claude pode ter usado um comando considerado leitura simples (neutro). Peça algo que use um comando fora da lista, como o do exercício, ou ajuste `neutros` em `.claude/catraca/config.json`.
- Reinicie a sessão após instalar e confira `/plugin`. Mais na tabela de [TUTORIAL.md](TUTORIAL.md#8-problemas-comuns).
