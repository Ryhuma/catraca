#!/usr/bin/env node
// Testes da catraca v2 (executor .ps1 no centro). Cada controle precisa poder FALHAR: ha casos negativos e positivos.
// Exige PowerShell (Windows) para as provas de execucao.   node tests/teste.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOOK = path.join(RAIZ, "scripts", "hook.mjs");
const CLI = path.join(RAIZ, "scripts", "catraca.mjs");
const proj = fs.mkdtempSync(path.join(os.tmpdir(), "catraca-teste-"));
const home = fs.mkdtempSync(path.join(os.tmpdir(), "catraca-home-"));
const env = { ...process.env, CATRACA_PROJETO: proj, HOME: home, USERPROFILE: home };
let ok = 0, ruim = 0;
const t = (nome, cond, extra = "") => { if (cond) { ok++; console.log(`  ok   ${nome}`); } else { ruim++; console.log(`  FALHA ${nome} ${extra}`); } };
const hook = (ev, entrada) => spawnSync(process.execPath, [HOOK, ev], { input: JSON.stringify({ session_id: "s1", cwd: proj, ...entrada }), encoding: "utf8", env });
const cli = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: "utf8", env, cwd: proj });
const bash = (command) => hook("pretool", { tool_name: "Bash", tool_input: { command } });
const arqLivro = path.join(proj, ".claude/catraca/estado/livro.json");
const livro = () => JSON.parse(fs.readFileSync(arqLivro, "utf8"));
const semLivro = () => !fs.existsSync(arqLivro) || livro().itens.length === 0;
const zerar = () => fs.rmSync(arqLivro, { force: true });
const esperar = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const EXE = ".claude/catraca/executor/executar-no-windows.ps1";
const exeAbs = path.join(proj, EXE);
const REC = (n) => path.join(proj, `.claude/catraca/receitas/${n}.json`);
const escreverReceita = (nome, obj) => { fs.mkdirSync(path.dirname(REC(nome)), { recursive: true }); fs.writeFileSync(REC(nome), JSON.stringify(obj)); };
const receita = (nome, extra = {}) => ({ nome, descricao: "Receita de teste que mostra um texto e o status", sinonimos: ["mostrar status", "eco do executor"], parametros: { texto: "ola" }, passos: [{ mostrar: "texto={$texto}" }, { executar: ["-Status"] }], ...extra });
// Simula o Claude acrescentando uma primitiva ao executor (param + bloco), como manda a convencao do modelo.
const addPrimitiva = (nome, bloco) => {
  let s = fs.readFileSync(exeAbs, "utf8");
  s = s.replace("[switch]$Aplicar\n  #@PARAMS-FIM", `[switch]$Aplicar,\n  [switch]$${nome}\n  #@PARAMS-FIM`);
  s = s.replace("#@PRIMITIVAS-FIM", `#@primitiva ${nome} - ${bloco.doc}\nif ($${nome}) {\n  ${bloco.corpo}\n  exit 0\n}\n\n#@PRIMITIVAS-FIM`);
  fs.writeFileSync(exeAbs, s);
};

console.log("projeto nao iniciado");
let r = hook("sessionstart", {});
t("sessionstart oferece /catraca:iniciar", r.status === 0 && r.stdout.includes("/catraca:iniciar"), r.stdout);
t("estilo Silencioso instalado em ~/.claude/output-styles", fs.existsSync(path.join(home, ".claude/output-styles/silencioso.md")));
t("pretool nao faz nada sem init", bash("npm install").status === 0 && !fs.existsSync(path.join(proj, ".claude/catraca")));

console.log("init");
r = cli("init");
t("init cria config, receitas, scripts, estado e o EXECUTOR .ps1", r.status === 0 && ["config.json", "receitas", "scripts", "estado", "executor/executar-no-windows.ps1"].every((x) => fs.existsSync(path.join(proj, ".claude/catraca", x))), r.stderr);
const cfgArq = path.join(proj, ".claude/catraca/config.json");
const cfg = JSON.parse(fs.readFileSync(cfgArq, "utf8"));
t("config criado pelo init NAO congela a lista padrao de neutros", cfg.neutros === undefined && Array.isArray(cfg.neutrosExtra));
r = hook("sessionstart", {});
t("sessionstart ativo informa CLI e livro vazio", r.stdout.includes("CATRACA ATIVA") && r.stdout.includes("Livro vazio"), r.stdout);
r = spawnSync("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", exeAbs, "-Status"], { encoding: "utf8" });
t("executor roda no PowerShell real (-Status)", r.status === 0 && r.stdout.includes("executor ok"), r.stdout + r.stderr);

console.log("calibracao");
t("antes de calibrar, 'dotnet --info' gera divida", bash("dotnet --info").stdout.includes("divida #1"));
zerar();
cfg.neutrosExtra = ["^dotnet\\s+--info"]; fs.writeFileSync(cfgArq, JSON.stringify(cfg));
t("neutrosExtra torna o comando neutro", bash("dotnet --info").status === 0 && semLivro());
t("neutrosExtra SOMA: git continua neutro", bash("git status").status === 0 && semLivro());
cfg.neutrosExtra = []; fs.writeFileSync(cfgArq, JSON.stringify(cfg));

console.log("deteccao de trabalho manual");
t("pipeline de leitura nao gera divida", bash("Get-ChildItem . | Sort-Object Length | Select-Object -First 3").status === 0 && semLivro());
t("ls | grep e redirecionamento de erro nao geram divida", bash("ls -la 2>&1 | grep a").status === 0 && semLivro());
t("texto com ; dentro de aspas nao cria segmento falso", bash('git commit -m "a; npm install"').status === 0 && semLivro());
t("escrita por redirecionamento GERA divida", bash("echo oi > saida.txt").stdout.includes("divida #1"));
t("pipeline que age (Get-ChildItem | Remove-Item) GERA divida de remove-item", bash("Get-ChildItem x | Remove-Item").stdout.includes("remove-item"));
zerar();
r = bash("powershell -Command \"Get-CimInstance Win32_LogicalDisk\"");
t("comando manual gera divida e avisa o Claude", r.stdout.includes("divida #1") && livro().itens.length === 1, r.stdout);
bash("powershell -Command \"Get-Service\"");
t("mesma assinatura soma (x2), nao duplica", livro().itens.length === 1 && livro().itens[0].n === 2);
t("chamada ao CLI da catraca nao gera divida", (bash(`node "${CLI}" status`), livro().itens.length === 1));

console.log("executor: primitivas fora de receita");
zerar();
t("-Status (leitura) pelo executor nao gera divida", bash(`powershell -NoProfile -File ${EXE} -Status`).status === 0 && semLivro());
t("-Receita pelo executor nao gera divida", bash(`powershell -File ${EXE} -Receita .claude/catraca/receitas/x.json`).status === 0 && semLivro());
t("primitiva LerAlgo (prefixo Ler) e neutra", bash(`powershell -File ${EXE} -LerAlgo`).status === 0 && semLivro());
r = bash(`powershell -File ${EXE} -EspacoLivre -LimitePct 50`);
t("primitiva solta (-EspacoLivre) fora de -Receita GERA divida de calibracao", r.stdout.includes("divida #1") && livro().itens[0].tipo === "primitiva" && livro().itens[0].assinatura === "-EspacoLivre", r.stdout);
t("flags do host (-NoProfile -File) nao viram primitiva", livro().itens.length === 1);
zerar();

console.log("protecoes");
t("Claude nao pode descartar divida", bash(`node ${CLI} descartar --ids 1 --motivo "teste de bloqueio"`).status === 2);
t("shell nao pode mexer no estado", bash("rm .claude/catraca/estado/livro.json").status === 2);
t("shell nao pode escrever em receitas", bash("echo {} > .claude/catraca/receitas/x.json").status === 2);
t("shell nao pode editar o executor", bash(`Add-Content ${EXE} "x"`).status === 2);
t("Write no estado e bloqueado", hook("pretool", { tool_name: "Write", tool_input: { file_path: path.join(proj, ".claude/catraca/estado/livro.json") } }).status === 2);
const wr = (rel) => hook("pretool", { tool_name: "Edit", tool_input: { file_path: path.join(proj, rel) } });
const wrR = (nome) => wr(`.claude/catraca/receitas/${nome}.json`);
bash("powershell -Command \"Get-CimInstance Win32_LogicalDisk\"");
t("Edit em receita sem ler o catalogo e bloqueado", wrR("espaco-livre").status === 2);
t("Edit no executor sem ler o catalogo e bloqueado", wr(EXE).status === 2);
r = cli("catalogo");
t("catalogo mostra divida, PRIMITIVAS do executor e receitas", r.stdout.includes("DIVIDAS EM ABERTO") && r.stdout.includes("-Status - mostra a versao"), r.stdout);
t("com catalogo lido mas SEM decisao e divida aberta: bloqueado", wrR("espaco-livre").status === 2);

console.log("decisao");
r = cli("decidir", "--ids", "1", "--nova", "espaco-livre");
t("--nova sem --motivo e recusada", r.status === 1 && r.stderr.includes("motivo"));
r = cli("decidir", "--ids", "9", "--nova", "espaco-livre", "--motivo", "nenhuma receita mostra espaco de disco");
t("id inexistente e recusado", r.status === 1);
r = cli("decidir", "--ids", "1", "--nova", "espaco-livre", "--motivo", "nenhuma receita mostra espaco de disco");
t("decisao nova gravada", r.status === 0 && fs.existsSync(path.join(proj, ".claude/catraca/estado/decisao.json")), r.stderr);
t("o arquivo decidido e liberado", wrR("espaco-livre").status === 0);
t("o EXECUTOR e liberado durante a decisao", wr(EXE).status === 0);
t("outra receita continua bloqueada", wrR("outra-coisa").status === 2);

console.log("fechamento (a prova exige executar de verdade)");
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/espaco-livre.json", "--ids", "1");
t("fechar sem a receita existir falha", r.status === 1);
esperar(30);
escreverReceita("espaco-livre", receita("espaco-livre", { descricao: "curta" }));
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/espaco-livre.json", "--ids", "1");
t("fechar sem descricao de 20+ caracteres falha", r.status === 1 && r.stderr.includes("descricao"), r.stderr);
escreverReceita("espaco-livre", receita("espaco-livre", { passos: [{ executar: ["-PrimitivaQueNaoExiste"] }] }));
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/espaco-livre.json", "--ids", "1");
t("fechar com receita que usa primitiva INEXISTENTE falha", r.status === 1 && r.stderr.includes("NAO tem"), r.stderr);
escreverReceita("espaco-livre", receita("espaco-livre"));
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/espaco-livre.json", "--ids", "1");
t("fechar sem rodar a receita falha (prova exigida)", r.status === 1 && r.stderr.includes("rodou"), r.stderr);
r = cli("rodar", "espaco-livre", "texto=abc");
t("rodar executa a receita pelo executor .ps1 e imprime o parametro", r.status === 0 && r.stdout.includes("texto=abc") && r.stdout.includes("RESULTADO: OK"), r.stdout + r.stderr);
const execs = fs.readFileSync(path.join(proj, ".claude/catraca/estado/execucoes.jsonl"), "utf8");
t("o executor gravou a execucao em execucoes.jsonl", execs.includes('"receita":"espaco-livre"') && execs.includes('"ok":true'));
esperar(30);
addPrimitiva("EspacoLivre", { doc: "teste: escreve uma linha", corpo: "Write-Host 'disco-ok'" });
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/espaco-livre.json", "--ids", "1");
t("executor alterado DEPOIS da ultima execucao: fechar exige rodar de novo", r.status === 1 && r.stderr.includes("rodou"), r.stderr);
esperar(30);
fs.appendFileSync(exeAbs, "\nif ($true { quebrado\n");
cli("rodar", "espaco-livre");
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/espaco-livre.json", "--ids", "1");
t("executor com ERRO DE SINTAXE nao fecha", r.status === 1, r.stderr + r.stdout);
fs.writeFileSync(exeAbs, fs.readFileSync(exeAbs, "utf8").replace("\nif ($true { quebrado\n", "\n"));
escreverReceita("espaco-livre", receita("espaco-livre", { passos: [{ mostrar: "inicio" }, { executar: ["-EspacoLivre"] }] }));
esperar(30);
r = cli("rodar", "espaco-livre");
t("receita chama a primitiva nova do executor", r.status === 0 && r.stdout.includes("disco-ok"), r.stdout + r.stderr);
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/espaco-livre.json", "--ids", "2");
t("fechar id fora da decisao falha", r.status === 1);
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/espaco-livre.json", "--ids", "1");
t("fechar com receita + primitiva provadas passa e valida a sintaxe", r.status === 0 && livro().itens[0].estado === "fechada" && r.stdout.includes("sintaxe do executor: valida"), r.stdout + r.stderr);

console.log("upgrade e duplicata");
bash("npm install left-pad");
r = cli("catalogo");
t("catalogo mostra a divida ao lado da descricao e dos sinonimos", r.stdout.includes("DIVIDAS EM ABERTO") && r.stdout.includes("npm install") && r.stdout.includes("Receita de teste que mostra") && r.stdout.includes("mostrar status"), r.stdout);
r = cli("decidir", "--ids", "2", "--nova", "espaco-livre-v2", "--motivo", "tentativa de duplicar uma receita existente");
t("--nova parecida com receita existente e recusada", r.status === 1 && r.stderr.includes("UPGRADE"), r.stderr);
r = cli("decidir", "--ids", "2", "--upgrade", "espaco-livre");
t("upgrade aceito", r.status === 0);
esperar(30);
escreverReceita("espaco-livre", receita("espaco-livre", { descricao: "Receita de teste agora com mais um passo", passos: [{ mostrar: "v2" }, { executar: ["-EspacoLivre"] }] }));
cli("rodar", "espaco-livre");
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/espaco-livre.json", "--ids", "2");
t("upgrade fecha a segunda divida", r.status === 0 && cli("status").stdout.includes("abertas: 0"), r.stderr);

console.log("stop");
t("stop com livro vazio libera", hook("stop", {}).stdout.trim() === "");
bash("docker ps");
r = hook("stop", {});
t("stop com divida aberta bloqueia", r.stdout.includes('"decision":"block"') && r.stdout.includes("docker ps"), r.stdout);
for (let i = 0; i < 6; i++) r = hook("stop", {});
t("depois do teto de tentativas o usuario nao fica preso", r.stdout.trim() === "");
r = cli("descartar", "--ids", "3", "--motivo", "so para o teste do descarte");
t("usuario descarta com motivo", r.status === 0 && cli("status").stdout.includes("abertas: 0"));
bash("docker ps");
cfg.tentativasStop = 0; fs.writeFileSync(cfgArq, JSON.stringify(cfg));
t("tentativasStop=0 desliga o bloqueio do fim da sessao", hook("stop", { session_id: "s-zero" }).stdout.trim() === "");

console.log("falha aberta");
r = spawnSync(process.execPath, [HOOK, "pretool"], { input: "isto nao e json", encoding: "utf8", env });
t("entrada invalida nao bloqueia", r.status === 0);

console.log(`\n${ok} ok, ${ruim} falha(s).`);
fs.rmSync(proj, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true });
process.exit(ruim ? 1 : 0);
