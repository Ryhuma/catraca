# Tutorial de instalação e uso

## 1. Pré-requisitos
- Claude Code instalado e logado.
- Node 18 ou superior: abra um terminal e rode `node --version`. Se não existir, instale em nodejs.org.
- Windows, macOS ou Linux (o exercício guiado é para Windows).

## 2. Instalar o plugin
Dentro do Claude Code:

```
/plugin marketplace add Ryhuma/catraca
/plugin install catraca@catraca
```

Depois **feche e abra a sessão**. Confira com `/plugin`: `catraca` deve aparecer como instalado e habilitado.

## 3. Ativar em um projeto
Abra o Claude Code na pasta do seu projeto. No início da sessão o Claude oferece, em uma linha, rodar `/catraca:iniciar`. Aceite (ou digite o comando).

Isso cria:

```
.claude/catraca/
  config.json     ajustes (lista de comandos neutros, tentativas do Stop, estilo)
  receitas/       as receitas (JSON). Vale a pena versionar no git.
  scripts/        scripts de apoio das receitas
  estado/         livro de dívidas e provas (local, ignorado pelo git)
```

Confira com `status` pedindo ao Claude: "mostre o status da catraca".

## 4. Usar (você só pede; o resto é automático)
1. Peça tarefas normalmente.
2. Se o Claude precisar executar algo à mão, o livro ganha uma dívida e ele a resolve na mesma sessão (catálogo, decisão, receita, execução, fechamento).
3. No fim ele diz qual receita nasceu ou foi atualizada e como rodá-la.
4. Na próxima vez que a tarefa aparecer, ele usa a receita.

Se o Claude tentar encerrar com dívida aberta, o hook `Stop` o devolve ao trabalho (até 6 vezes).

## 5. Estilo Silencioso
Na primeira sessão o plugin copia `silencioso.md` para `~/.claude/output-styles/`. Ative com `/output-style` e escolha **Silencioso**. Ele elimina a narração entre ferramentas: o Claude trabalha em silêncio e entrega uma mensagem final com resultado, pendências e prova.

## 6. Calibrar para o seu trabalho (`.claude/catraca/config.json`)
A catraca vem ajustada para o caso geral. O seu trabalho tem comandos próprios, então calibre. O arquivo é seu, vale por projeto e você pode versioná-lo no git.

| Campo | Para que serve | Exemplo |
|---|---|---|
| `neutrosExtra` | **Soma** à lista padrão: comandos que nunca geram dívida (leituras e consultas do seu dia a dia). É o jeito recomendado. | `["^dotnet\\s+--info", "^docker\\s+ps\\b"]` |
| `neutros` | **Substitui** a lista padrão inteira. Só use se quiser controle total (você perde os padrões, como `git` e `ls`, e as melhorias futuras do plugin). | |
| `mcpEscrita` | Ferramentas MCP que alteram coisas: cada uso vira dívida. | `["^mcp__meuservidor__(criar|apagar).*"]` |
| `tentativasStop` | Quantas vezes o fim da sessão é barrado com dívida aberta. `0` desliga o bloqueio. | `3` |
| `instalarEstilo` | `false` para não copiar o estilo Silencioso. | `false` |

**Como saber o que calibrar** (faça nos primeiros dias):
1. Trabalhe normalmente e, de vez em quando, peça ao Claude "liste as dívidas da catraca" (`listar`).
2. **Dívida de algo que é só consulta** (ex.: `docker ps`): adicione uma expressão em `neutrosExtra`. O comando passa a ser ignorado.
3. **Dívida de algo que você nunca vai repetir:** descarte (item 7), sem mexer na configuração.
4. **Tarefa que se repete e nenhuma dívida aparece:** o comando está sendo tratado como neutro. Remova-o de `neutrosExtra` ou, se vier da lista padrão, use `neutros` para montar a sua.
5. **Muitas dívidas pequenas parecidas:** sinal de que uma receita com parâmetros resolve todas; peça ao Claude para fazer o upgrade.

**O que mais é seu para mudar:**
- **As receitas** (`.claude/catraca/receitas/*.json`) e os scripts de apoio: edite à vontade. Toda receita precisa de `descricao` (20+ caracteres, em linguagem comum): é ela que o Claude lê no catálogo para reconhecer que uma tarefa nova já está coberta. O campo opcional `sinonimos` ajuda quando você pede a mesma coisa de formas diferentes. Para mudar uma receita, peça ao Claude: ele registra o upgrade e prova que ainda roda.
- **O estilo Silencioso** (`~/.claude/output-styles/silencioso.md`): é um arquivo de texto seu depois de copiado. Edite as regras, ou escolha outro estilo em `/output-style`.
- **O protocolo que o Claude segue** está em `skills/catraca/SKILL.md` dentro do plugin. Mudanças ali se perdem na atualização do plugin. Para ajustes duradouros, faça um fork do repositório e instale o seu.
- **Regras do hook** (o que bloqueia): estão em `scripts/hook.mjs`, também só por fork.

## 7. Descartar uma dívida (só você)
Se uma dívida não deve virar receita (comando único, sem repetição):

```
! node "<caminho do plugin>/scripts/catraca.mjs" descartar --ids 3 --motivo "comando único, não se repete"
```

O caminho exato do CLI aparece no contexto que o Claude recebe a cada sessão; peça "qual o comando para descartar a dívida 3?".

## 8. Problemas comuns
| Sintoma | Causa provável | Solução |
|---|---|---|
| Claude não oferece iniciar | plugin não carregou | reinicie a sessão; confira `/plugin` |
| "projeto nao iniciado" | falta `/catraca:iniciar` | rode-o na pasta do projeto |
| Dívida aparece para comando que é só leitura | comando fora da lista `neutros` | adicione uma regex em `config.json` |
| `fechar` recusa: "nunca rodou com sucesso" | receita não foi executada depois da última edição | rode `rodar <receita>` e feche de novo |
| Sessão não termina | dívida aberta | peça ao Claude para resolver ou descarte você mesmo (item 7) |
| Erro com `node` | Node ausente ou fora do PATH | instale Node 18+ e reabra o terminal |

## 9. Desinstalar
`/plugin uninstall catraca@catraca`. Seus arquivos em `.claude/catraca/receitas` continuam seus.
