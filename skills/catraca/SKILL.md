---
name: catraca
description: Protocolo da catraca. Use SEMPRE que um hook da catraca registrar uma divida, quando o contexto da sessao disser "CATRACA ATIVA", ou quando o usuario pedir uma tarefa que voce executaria a mao (shell, PowerShell, ferramenta de escrita). Explica como transformar trabalho manual em receita nova ou upgrade de receita.
---

# Catraca: trabalho manual vira receita

O usuario trabalha e voce executa. Quando voce executa algo **a mao** (um comando de shell/PowerShell que nao seja leitura, navegacao ou git), o hook registra uma **divida** no livro (`.claude/catraca/estado/livro.json`). A divida so fecha com uma **receita nova** ou com o **upgrade** de uma receita existente, provada por execucao. O usuario nao precisa lembrar nem pedir nada.

O caminho do CLI vem no contexto da sessao ("CLI: node ..."). Abaixo, `CLI` significa esse comando.

## Antes de executar uma tarefa
1. `CLI catalogo` mostra as receitas existentes. Se alguma ja faz o trabalho (mesmo com outro parametro), **rode-a**: `CLI rodar <receita> chave=valor`. Isso nao gera divida.
2. So execute a mao o que nenhuma receita cobre.

## Quando houver divida (hook avisa; o fim da sessao fica barrado ate zerar)
1. `CLI catalogo` (obrigatorio antes de criar ou editar receita). Ele mostra as DIVIDAS abertas ao lado de cada receita (descricao, sinonimos, comandos). **Voce faz o julgamento semantico**: a mesma tarefa pode vir com outro comando (`wmic`, `Get-PSDrive` e `df` para espaco em disco). Medido: comparar so palavras acerta 0 de 6; entao leia a descricao e decida com criterio, nao pelo nome do comando.
2. Decida e declare, comparando com a lista:
   - **Upgrade**: `CLI decidir --ids 1,2 --upgrade <receita>` quando uma receita existente deveria cobrir o caso (novo parametro, passo extra).
   - **Nova**: `CLI decidir --ids 1 --nova <nome-com-hifens> --motivo "por que nenhuma receita serve (20+ caracteres)"`. Recusa se achar candidata parecida; se for realmente distinta, nomeie-a em `--distinta-de`.
3. Crie ou edite o arquivo decidido com Write/Edit (so ele, mais scripts de apoio em `.claude/catraca/scripts/`).
4. Prove: `CLI rodar <nome> [chave=valor]` precisa terminar OK **depois** da ultima alteracao.
5. Feche: `CLI fechar --arquivo .claude/catraca/receitas/<nome>.json --ids 1,2`.

## Formato da receita (`.claude/catraca/receitas/<nome>.json`)
```json
{
  "nome": "<igual ao nome do arquivo>",
  "descricao": "o que faz, em linguagem comum (OBRIGATORIA, 20+ caracteres: e o que voce le no catalogo para reconhecer a receita)",
  "sinonimos": ["outras formas de pedir a mesma coisa", "opcional"],
  "parametros": { "pasta": { "padrao": "." } },
  "passos": [
    { "tipo": "powershell", "comando": "Get-ChildItem -LiteralPath '{{pasta}}' | Sort-Object Length -Descending | Select-Object -First 5 Name,Length" }
  ],
  "naoDuplica": "so se outra receita parecer igual: diga por que esta e distinta"
}
```
Tipos de passo: `powershell`, `shell`, `node` (codigo JS em `comando`) e `script` (`arquivo` dentro de `.claude/catraca/scripts/`, com `args` opcional). `{{param}}` e substituido; coloque aspas simples em volta nos comandos PowerShell. Valores de parametro nao podem conter `` ` $ ; & | < > `` aspas ou quebra de linha. Um parametro sem `padrao` e obrigatorio.

## Regras que o hook impoe (nao tente contornar)
- Nao edite `.claude/catraca/estado/` nem crie receita/script pelo shell: so por Write/Edit, depois do catalogo e da decisao.
- Descartar divida e **so do usuario** (`! node ... catraca.mjs descartar --ids N --motivo "..."`). Se uma divida nao fizer sentido virar receita, explique ao usuario e peca isso.
- Receita que nunca rodou com sucesso depois da ultima alteracao nao fecha divida.

## Ao terminar
Diga ao usuario, em poucas linhas: que receita nasceu ou foi atualizada, o que ela faz e como rodar (`rodar <nome> chave=valor`). Se algo ficou "nao provado", diga.
