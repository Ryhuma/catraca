# catraca

**Automação que nasce sozinha enquanto você trabalha.** Plugin do Claude Code.

Você pede tarefas; o Claude executa. Tudo que ele executa **à mão** (shell, PowerShell) vira uma **dívida** num livro. A dívida só fecha quando o Claude cria uma **receita nova** ou faz o **upgrade de uma receita existente**, e **prova** que ela roda. Na próxima vez que a tarefa aparecer, ele chama a receita, sem dívida. Você não precisa lembrar nem pedir nada: hooks cuidam do ciclo.

Nome do método: *programming by demonstration* com *toil ledger*. Apelido aqui: **catraca**, porque o trabalho manual só passa por ela uma vez.

## O ciclo

```
você pede uma tarefa
   └─ Claude executa à mão ──► hook registra DÍVIDA no livro
                                   └─ Claude lê o catálogo e decide: UPGRADE ou NOVA
                                        └─ cria/edita a receita ──► roda ──► prova OK ──► FECHA a dívida
próxima vez: Claude chama a receita (sem dívida)
```

## O que ela garante (imposto por hooks, não por memória)

| Barreira | Como |
|---|---|
| Trabalho manual vira dívida | hook `PreToolUse` em Bash/PowerShell (leitura, navegação e `git` são neutros) |
| Não duplicar receita | `catalogo` obrigatório antes de criar; `--nova` é recusada se existir candidata parecida |
| Só fecha com prova | receita precisa ter rodado com sucesso **depois** da última alteração |
| Não terminar com dívida | hook `Stop` barra o fim da sessão (teto de 6 tentativas: nunca prende você) |
| Claude não se auto-absolve | descartar dívida é só do usuário (`!` no terminal); estado do livro é protegido |
| Falha aberta | erro interno do hook nunca bloqueia o seu trabalho |

## Instalação rápida

Requisitos: Claude Code e **Node 18+** (`node --version`).

```
/plugin marketplace add Ryhuma/catraca
/plugin install catraca@catraca
```

Reinicie a sessão. Na primeira vez em cada pasta de projeto o Claude oferece rodar `/catraca:iniciar` (cria `.claude/catraca/`). Passo a passo completo: [docs/TUTORIAL.md](docs/TUTORIAL.md). Para ver o ciclo funcionando em 10 minutos no Windows: [docs/EXERCICIO-WINDOWS.md](docs/EXERCICIO-WINDOWS.md).

## O que vem junto

- Estilo de saída **Silencioso** (zero narração entre ferramentas, uma mensagem final com resultado e prova). É copiado para `~/.claude/output-styles/` na primeira sessão; ative com `/output-style`. Para não copiar: `"instalarEstilo": false` em `.claude/catraca/config.json`.
- Receita de exemplo em [exemplos/](exemplos/).

## Comandos do CLI (o Claude os usa; você também pode)

`init`, `status`, `listar`, `catalogo [--sobrepostas]`, `decidir`, `rodar <receita> chave=valor`, `fechar`, `descartar` (só você).

## Limites declarados

- A análise de comandos de shell é **por padrões** (heurística). Um comando incomum pode escapar do registro; um comando de leitura incomum pode virar dívida. Ajuste a lista `neutros` em `.claude/catraca/config.json`.
- Receitas rodam **comandos reais** na sua máquina. Leia as receitas antes de compartilhá-las ou rodá-las; parâmetros recusam caracteres perigosos, mas isso não substitui revisão.
- Testado no Windows 11 com PowerShell 5.1 e Node 24. Em macOS/Linux o tipo `powershell` exige `pwsh`; os tipos `shell` e `node` não.
- Não provado: se um plugin pode entregar *output style* nativamente; por isso o estilo é copiado por hook.

## Testes

`node tests/teste.mjs` (40 verificações, com casos que devem falhar) e `node tests/prova-powershell.mjs`.

## Licença

MIT. Veja [LICENSE](LICENSE).
