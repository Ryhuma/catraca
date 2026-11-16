#!/usr/bin/env node
// Testes da catraca: cada controle precisa poder FALHAR (ha casos negativos e positivos).  node tests/teste.mjs
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
const livro = () => JSON.parse(fs.readFileSync(path.join(proj, ".claude/catraca/estado/livro.json"), "utf8"));
const receita = (nome, extra = {}) => ({ nome, descricao: "teste", parametros: { pasta: { padrao: "." } }, passos: [{ tipo: "node", comando: "console.log('{{pasta}}')" }], ...extra });
const escreverReceita = (nome, obj) => { fs.mkdirSync(path.join(proj, ".claude/catraca/receitas"), { recursive: true }); fs.writeFileSync(path.join(proj, `.claude/catraca/receitas/${nome}.json`), JSON.stringify(obj)); };
const require_reset = () => fs.rmSync(path.join(proj, ".claude/catraca/estado/livro.json"), { force: true });
const esperar = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

console.log("projeto nao iniciado");
let r = hook("sessionstart", {});
t("sessionstart oferece /catraca:iniciar", r.status === 0 && r.stdout.includes("/catraca:iniciar"), r.stdout);
t("estilo Silencioso instalado em ~/.claude/output-styles", fs.existsSync(path.join(home, ".claude/output-styles/silencioso.md")));
t("pretool nao faz nada sem init", bash("npm install").status === 0 && !fs.existsSync(path.join(proj, ".claude/catraca")));

console.log("init");
r = cli("init");
t("init cria config, receitas, scripts, estado", r.status === 0 && ["config.json", "receitas", "scripts", "estado"].every((x) => fs.existsSync(path.join(proj, ".claude/catraca", x))), r.stderr);
r = hook("sessionstart", {});
t("sessionstart ativo informa CLI e livro vazio", r.stdout.includes("CATRACA ATIVA") && r.stdout.includes("Livro vazio"), r.stdout);

console.log("deteccao");
t("pipeline de leitura (Get-ChildItem | Sort-Object) nao gera divida", bash("Get-ChildItem . | Sort-Object Length | Select-Object -First 3").status === 0 && !fs.existsSync(path.join(proj, ".claude/catraca/estado/livro.json")));
t("ls | grep e redirecionamento de erro nao geram divida", bash("ls -la 2>&1 | grep a").status === 0 && !fs.existsSync(path.join(proj, ".claude/catraca/estado/livro.json")));
t("leitura com redirecionamento para arquivo GERA divida", bash("echo oi > saida.txt").stdout.includes("divida #1"));
t("pipeline que age (Get-ChildItem | Remove-Item) GERA divida de remove-item", bash("Get-ChildItem x | Remove-Item").stdout.includes("remove-item"));
require_reset();
t("comando neutro (git status, ls) nao gera divida", bash("git status && ls -la").status === 0 && !fs.existsSync(path.join(proj, ".claude/catraca/estado/livro.json")));
t("texto com ; dentro de aspas nao cria segmento falso", bash('git commit -m "a; npm install"').status === 0 && !fs.existsSync(path.join(proj, ".claude/catraca/estado/livro.json")));
r = bash("powershell -Command \"Get-Process | Sort CPU\"");
t("comando manual gera divida e avisa o Claude", r.status === 0 && r.stdout.includes("divida #1") && livro().itens.length === 1, r.stdout);
bash("powershell -Command \"Get-Service\"");
t("mesma assinatura soma (x2), nao duplica", livro().itens.length === 1 && livro().itens[0].n === 2);
bash("npm install left-pad");
t("assinatura distinta vira divida nova", livro().itens.length === 2 && livro().itens[1].assinatura === "npm install");
t("chamada ao CLI da catraca nao gera divida", (bash(`node "${CLI}" status`), livro().itens.length === 2));

console.log("protecoes");
t("Claude nao pode descartar divida", bash(`node ${CLI} descartar --ids 1 --motivo "teste de bloqueio"`).status === 2);
t("shell nao pode mexer no estado", bash("rm .claude/catraca/estado/livro.json").status === 2);
t("shell nao pode escrever em receitas", bash("echo {} > .claude/catraca/receitas/x.json").status === 2);
t("Write no estado e bloqueado", hook("pretool", { tool_name: "Write", tool_input: { file_path: path.join(proj, ".claude/catraca/estado/livro.json") } }).status === 2);
const wr = (nome) => hook("pretool", { tool_name: "Write", tool_input: { file_path: path.join(proj, `.claude/catraca/receitas/${nome}.json`) } });
t("Write em receita sem ler o catalogo e bloqueado", wr("listar-processos").status === 2);
cli("catalogo");
t("com catalogo lido mas SEM decisao e divida aberta: bloqueado", wr("listar-processos").status === 2);

console.log("decisao");
r = cli("decidir", "--ids", "1", "--nova", "listar-processos");
t("--nova sem --motivo e recusada", r.status === 1 && r.stderr.includes("motivo"));
r = cli("decidir", "--ids", "9", "--nova", "listar-processos", "--motivo", "nenhuma receita lista processos do sistema");
t("id inexistente e recusado", r.status === 1);
r = cli("decidir", "--ids", "1", "--nova", "listar-processos", "--motivo", "nenhuma receita lista processos do sistema");
t("decisao nova gravada", r.status === 0 && fs.existsSync(path.join(proj, ".claude/catraca/estado/decisao.json")), r.stderr);
t("agora o arquivo decidido e liberado", wr("listar-processos").status === 0);
t("outro arquivo continua bloqueado", wr("outra-coisa").status === 2);

console.log("fechamento");
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/listar-processos.json", "--ids", "1");
t("fechar sem a receita existir falha", r.status === 1);
esperar(30);
escreverReceita("listar-processos", receita("listar-processos"));
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/listar-processos.json", "--ids", "1");
t("fechar sem rodar a receita falha (prova exigida)", r.status === 1 && r.stderr.includes("rodou"), r.stderr);
r = cli("rodar", "listar-processos", "pasta=abc");
t("rodar executa e imprime o parametro", r.status === 0 && r.stdout.includes("abc"), r.stdout + r.stderr);
r = cli("rodar", "listar-processos", "pasta=a;b");
t("parametro perigoso e recusado", r.status === 1 && r.stderr.includes("nao permitido"));
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/listar-processos.json", "--ids", "2");
t("fechar id fora da decisao falha", r.status === 1);
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/listar-processos.json", "--ids", "1");
t("fechar com receita rodada com sucesso passa", r.status === 0 && livro().itens[0].estado === "fechada", r.stderr);

console.log("upgrade e duplicata");
r = cli("decidir", "--ids", "2", "--nova", "listar-processos-v2", "--motivo", "tentativa de duplicar uma receita existente");
t("--nova parecida com receita existente e recusada", r.status === 1 && r.stderr.includes("UPGRADE"), r.stderr);
r = cli("decidir", "--ids", "2", "--upgrade", "listar-processos");
t("upgrade aceito", r.status === 0);
esperar(30);
escreverReceita("listar-processos", receita("listar-processos", { descricao: "agora com filtro" }));
cli("rodar", "listar-processos");
r = cli("fechar", "--arquivo", ".claude/catraca/receitas/listar-processos.json", "--ids", "2");
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

console.log("falha aberta");
r = spawnSync(process.execPath, [HOOK, "pretool"], { input: "isto nao e json", encoding: "utf8", env });
t("entrada invalida nao bloqueia", r.status === 0);

console.log(`\n${ok} ok, ${ruim} falha(s).`);
fs.rmSync(proj, { recursive: true, force: true }); fs.rmSync(home, { recursive: true, force: true });
process.exit(ruim ? 1 : 0);
