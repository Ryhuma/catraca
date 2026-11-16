---
name: catraca
description: Protocolo da catraca. Use SEMPRE que um hook da catraca registrar uma divida, quando o contexto da sessao disser "CATRACA ATIVA", ou quando o usuario pedir uma tarefa que voce executaria a mao (shell, PowerShell, ferramenta de escrita). Explica como transformar trabalho manual em primitiva do executor .ps1 e receita .json (nova ou upgrade).
---

# Catraca: trabalho manual vira executor + receita

O usuario trabalha e voce executa. Tres pecas:

- **Executor** (`.claude/catraca/executor/executar-no-windows.ps1`): o centro. E quem executa as receitas e onde moram as **primitivas** (capacidades: cada uma e um parametro do script).
- **Receita** (`.claude/catraca/receitas/<nome>.json`): sequencia primitivas e textos. Nao tem codigo proprio.
- **Livro de dividas** (`.claude/catraca/estado/`): todo trabalho **manual** vira uma divida. Divida so fecha com receita provada.

O caminho do CLI vem no contexto da sessao ("CLI: node ..."). Abaixo, `CLI` significa esse comando.

## Antes de executar uma tarefa
1. `CLI catalogo` lista as PRIMITIVAS do executor e as RECEITAS. Se uma receita ja faz o trabalho (mesmo com outro comando ou parametro), **rode-a**: `CLI rodar <receita> chave=valor`. Nao gera divida.
2. So execute a mao o que nenhuma receita cobre. Comando solto (shell/PowerShell fora do executor) e primitiva chamada fora de `-Receita` viram divida.

## Quando houver divida (o hook avisa; o fim da sessao fica barrado ate zerar)
1. `CLI catalogo` (obrigatorio antes de editar receita ou executor). Ele mostra DIVIDAS, PRIMITIVAS e RECEITAS lado a lado. **Voce faz o julgamento semantico**: a mesma tarefa pode vir com outro comando (`wmic`, `Get-PSDrive` e `df` para espaco em disco). Medido: comparar so palavras acerta 0 de 6.
2. Decida e declare:
   - **Upgrade**: `CLI decidir --ids 1,2 --upgrade <receita>` (nova etapa ou parametro numa receita existente).
   - **Nova**: `CLI decidir --ids 1 --nova <nome-com-hifens> --motivo "por que nenhuma receita serve (20+ caracteres)"`. Recusa se achar candidata parecida pelo nome; se for realmente distinta, nomeie-a em `--distinta-de`.
3. Se falta a **capacidade**, acrescente uma **primitiva ao executor** (Edit no `.ps1`; so isso e o arquivo decidido e o executor ficam liberados):
   - parametro no `param(...)` ANTES de `#@PARAMS-FIM` (virgula depois do anterior);
   - acima do bloco: `#@primitiva Nome - o que faz, em uma frase`;
   - leitura pura: nome com prefixo `Ler`, `Listar`, `Consultar` ou `Ver` (nao gera divida fora de receita);
   - o que ALTERA algo: PLANO por padrao, so executa com `-Aplicar`;
   - nunca digite senha, token ou 2FA; nunca imprima segredo; termine o bloco com `exit 0`.
4. Crie ou edite a receita (Write/Edit) so no arquivo decidido.
5. Prove: `CLI rodar <nome> [chave=valor]` precisa terminar OK **depois** da ultima alteracao da receita **e** do executor.
6. Feche: `CLI fechar --arquivo .claude/catraca/receitas/<nome>.json --ids 1,2`. O `fechar` confere: descricao, primitivas existentes no executor, sintaxe do `.ps1` alterado e a execucao provada.

## Formato da receita
```json
{
  "nome": "<igual ao nome do arquivo>",
  "descricao": "o que faz, em linguagem comum (OBRIGATORIA, 20+ caracteres: e o que voce le no catalogo para reconhecer a receita)",
  "sinonimos": ["outras formas de pedir a mesma coisa", "opcional"],
  "parametros": { "limitePct": "100" },
  "passos": [
    { "mostrar": "Discos com ate {$limitePct}% livre:" },
    { "executar": ["-EspacoLivre", "-LimitePct", "{$limitePct}"], "toleraFalha": false }
  ],
  "naoDuplica": "so se outra receita parecer igual: diga por que esta e distinta"
}
```
`{$nome}` e substituido pelo parametro (padrao do JSON, ou `chave=valor` no `rodar`). Cada passo e `mostrar` (texto) ou `executar` (lista: primitiva e argumentos do executor).

## Regras que o hook impoe (nao tente contornar)
- Nao edite `.claude/catraca/estado/` nem receita/executor pelo shell: so por Write/Edit, depois do catalogo e da decisao.
- Descartar divida e **so do usuario** (`! node ... catraca.mjs descartar --ids N --motivo "..."`). Se uma divida nao fizer sentido virar receita, explique ao usuario e peca isso.
- Receita ou executor que nao rodou com sucesso depois da ultima alteracao nao fecha divida.

## Ao terminar
Diga ao usuario, em poucas linhas: que primitiva e receita nasceram ou mudaram, o que fazem e como rodar (`rodar <nome> chave=valor`). Se algo ficou "nao provado", diga.
