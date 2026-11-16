# Exercício guiado: veja o ciclo funcionando (Windows, 10 minutos)

**Objetivo:** entender como o trabalho manual do Claude vira dívida e depois receita. Quem trabalha é o **Claude**; você só pede e confere. O exercício só **lê** informações do computador: não altera nem apaga nada.

Pré-requisito: plugin instalado e `/catraca:iniciar` feito em uma pasta de teste (crie uma pasta vazia, por exemplo `C:\teste-catraca`, e abra o Claude Code nela).

## Parte 1: a primeira vez (nasce a dívida e a receita)
Cole no Claude:

> Mostre o espaço livre de cada disco do meu computador, em GB.

O que deve acontecer, nesta ordem (sem você fazer mais nada):
1. O Claude executa um comando PowerShell à mão (por exemplo `Get-CimInstance Win32_LogicalDisk ...`).
2. O hook avisa: `divida #1 (get-ciminstance) registrada`.
3. O Claude roda `catalogo` (está vazio) e `decidir --nova espaco-livre-discos --motivo "..."`.
4. Ele cria `.claude/catraca/receitas/espaco-livre-discos.json`.
5. Ele roda `rodar espaco-livre-discos` até dar OK e fecha a dívida.
6. A mensagem final diz qual receita nasceu e como rodá-la.

**Confira você:** peça "mostre o status da catraca". Esperado: `dívidas abertas: 0 | receitas: 1`, e o arquivo da receita existe na pasta.

> Quer comparar com uma receita pronta? Veja `exemplos/espaco-livre-discos.json` no plugin. A sua pode ficar diferente: o importante é que rode e que o Claude a tenha provado.

## Parte 2: a segunda vez (sem dívida)
Cole:

> Mostre de novo o espaço livre dos discos.

Esperado: o Claude lê o catálogo, vê que `espaco-livre-discos` serve e roda `rodar espaco-livre-discos`. **Nenhuma dívida nova.** Esse é o ganho: a tarefa virou uma chamada.

## Parte 3: o upgrade
Cole:

> Agora mostre só os discos com menos de 50% de espaço livre.

Esperado: o Claude percebe que é a mesma tarefa com um filtro, faz `decidir --upgrade espaco-livre-discos`, acrescenta um parâmetro (por exemplo `limitePct`) à receita, roda e fecha. **Não nasce uma segunda receita parecida**: se o Claude tentar uma `--nova` com nome ou comandos parecidos, o CLI recusa e manda fazer upgrade.

## Parte 4: veja as barreiras (opcional)
- Peça: "descarte a dívida 1 por conta própria". O hook recusa: descartar é só do usuário.
- Peça uma tarefa nova que o Claude execute à mão (por exemplo "liste os 5 processos que mais usam memória") e depois "pode encerrar": o hook de parada o devolve ao trabalho até a dívida fechar.

## O que você aprendeu
| Etapa | Papel |
|---|---|
| Executar à mão | gera dívida automática |
| `catalogo` + `decidir` | impede receita duplicada |
| `rodar` | prova que a receita funciona |
| `fechar` | só aceita com prova |
| Próxima vez | `rodar` direto, sem dívida |

## Se algo não aconteceu
- **Nenhuma dívida apareceu:** o Claude pode ter usado um comando considerado leitura simples (neutro). Peça algo que use um comando fora da lista, como o do exercício, ou ajuste `neutros` em `.claude/catraca/config.json`.
- Reinicie a sessão após instalar e confira `/plugin`. Mais na tabela de [TUTORIAL.md](TUTORIAL.md#8-problemas-comuns).
