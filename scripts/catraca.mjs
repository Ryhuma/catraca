#!/usr/bin/env node
// Catraca: CLI.  node catraca.mjs <init|status|listar|catalogo|decidir|rodar|fechar|descartar> [opcoes]
// Roda sempre na raiz do projeto do usuario (cwd, ou CATRACA_PROJETO / CLAUDE_PROJECT_DIR).
// v2: o executor .ps1 (primitivas) e o centro; a receita .json so sequencia primitivas.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { RAIZ_PLUGIN, projeto, caminhos, ativo, lerConfig, CONFIG_PADRAO, lerJson, gravarJson, lerLivro, abertas, atualizarLivro, listarReceitas, listarScripts, lerExecutor, lerExecucoes, marcarCatalogo, relativo } from "./lib.mjs";

const [cmd, ...args] = process.argv.slice(2);
const P = caminhos(projeto());
const arg = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null; };
const falhar = (m) => { console.error(`FALHOU: ${m}`); process.exit(1); };
const exigirAtivo = () => { if (!ativo(P)) falhar("projeto nao iniciado. Rode: init"); };
const PS = process.platform === "win32" ? "powershell" : "pwsh";

function ids(texto, livro) {
  if (args.includes("--todos")) return livro.itens.filter((i) => i.estado === "aberta").map((i) => i.id);
  if (!texto) falhar("informe --ids 1,2,3-5 (ou --todos)");
  const out = new Set();
  for (const p of texto.split(",")) { const m = /^(\d+)(?:-(\d+))?$/.exec(p.trim()); if (!m) falhar(`ids invalidos: ${texto}`); for (let n = +m[1]; n <= +(m[2] || m[1]); n++) out.add(n); }
  return [...out];
}

function init() {
  for (const d of [P.receitas, P.scripts, P.estado, P.executor]) fs.mkdirSync(d, { recursive: true });
  if (!fs.existsSync(P.config)) gravarJson(P.config, { ...CONFIG_PADRAO, neutros: undefined });   // sem 'neutros': a lista padrao vem do plugin e melhora com as atualizacoes
  fs.writeFileSync(path.join(P.estado, ".gitignore"), "*\n!.gitignore\n", "utf8");
  const cfg = lerConfig(P);
  const destino = path.join(P.proj, cfg.executor.script);
  if (!fs.existsSync(destino)) { fs.mkdirSync(path.dirname(destino), { recursive: true }); fs.copyFileSync(path.join(RAIZ_PLUGIN, "modelos", "executar-no-windows.ps1"), destino); }
  console.log(`Catraca iniciada. Executor (primitivas): ${cfg.executor.script}. Receitas: .claude/catraca/receitas. Estado local (nao vai ao git): .claude/catraca/estado.`);
}

function listar() {
  const itens = args.includes("--abertas") ? abertas(P) : lerLivro(P).itens;
  if (args.includes("--json")) return console.log(JSON.stringify(itens, null, 1));
  if (!itens.length) return console.log("livro de dividas: VAZIO (ok).");
  for (const i of itens) console.log(`#${i.id} [${i.estado}] ${i.tipo} x${i.n} | ${i.resumo}${i.fechamento ? ` -> ${i.fechamento.arquivo}` : ""}${i.descarte ? ` (descartada: ${i.descarte.motivo})` : ""}`);
}

function sobrepostas(rec) {
  let falhas = 0;
  for (let a = 0; a < rec.length; a++) for (let b = a + 1; b < rec.length; b++) {
    const A = rec[a], B = rec[b];
    const comum = A.sigs.filter((s) => B.sigs.includes(s));
    if (comum.length < 2) continue;
    const decl = (A.naoDuplica && String(A.naoDuplica).includes(B.nome)) || (B.naoDuplica && String(B.naoDuplica).includes(A.nome));
    console.log(`${decl ? "ok    " : "ALERTA"} ${A.nome} x ${B.nome}: primitivas em comum ${comum.join(", ")}${decl ? " (naoDuplica declarado)" : ""}`);
    if (!decl) falhas++;
  }
  return falhas;
}

// Quem julga "essa receita ja cobre esta divida?" e o Claude: ele recebe DIVIDAS, PRIMITIVAS e RECEITAS lado a lado.
// (Medido: comparar so palavras acerta 0/6; o julgamento semantico fica com o Claude.)
function comparacao(rec, dividas, ex) {
  if (dividas.length) {
    console.log("DIVIDAS EM ABERTO (o que foi executado a mao):");
    for (const d of dividas) console.log(`  #${d.id} ${d.tipo} x${d.n} | ${(d.exemplos ?? [d.resumo]).join("  ||  ")}`);
    console.log("");
  }
  console.log(`PRIMITIVAS DO EXECUTOR (${ex.existe ? "o que ele sabe fazer" : "EXECUTOR AUSENTE: rode init"}):`);
  const nomes = ex.params.filter((p) => !/^(Receita|Param|Aplicar)$/i.test(p));
  for (const n of nomes) console.log(`  -${n}${ex.docs[n] ? ` - ${ex.docs[n]}` : " - (sem #@primitiva: documente)"}`);
  console.log(`\nRECEITAS EXISTENTES${dividas.length ? " (alguma ja faz o mesmo trabalho, mesmo com outro comando? entao e UPGRADE)" : ""}:`);
  for (const r of rec) console.log(`${r.nome}${r.descricao ? ` - ${r.descricao}` : " - (SEM descricao: peca upgrade para descrever)"}\n  tambem conhecida como: ${r.sinonimos || "-"}\n  params: ${r.params.join(", ") || "-"} | primitivas: ${r.sigs.join(", ") || "-"}`);
}

function catalogo() {
  exigirAtivo();
  const cfg = lerConfig(P);
  const rec = listarReceitas(P);
  const uso = lerExecucoes(P);
  comparacao(rec, abertas(P), lerExecutor(P, cfg));
  for (const r of rec) console.log(`  usos ok de ${r.nome}: ${uso.filter((u) => u.receita === r.nome && u.ok).length}`);
  const sc = listarScripts(P);
  console.log(`\nreceitas: ${rec.length} | scripts de apoio: ${sc.length}${sc.length ? ` (${sc.join(", ")})` : ""}`);
  marcarCatalogo(P);
  if (args.includes("--sobrepostas")) {
    const f = sobrepostas(rec);
    if (f) { console.log(`\n${f} par(es) sobreposto(s) sem "naoDuplica": uma receita deve ser UPGRADE da outra, ou ambas declaram por que sao distintas.`); process.exit(1); }
    console.log("Nenhum par sobreposto sem declaracao.");
  }
}

function decidir() {
  exigirAtivo();
  const cfg = lerConfig(P);
  const livro = lerLivro(P);
  const ab = livro.itens.filter((i) => i.estado === "aberta");
  const alvo = ids(arg("--ids"), livro);
  if (!alvo.length || alvo.some((id) => !ab.some((i) => i.id === id))) falhar(`--ids precisa de dividas ABERTAS (abertas agora: ${ab.map((i) => i.id).join(", ") || "nenhuma"}).`);
  const up = arg("--upgrade"), nova = arg("--nova"), motivo = arg("--motivo");
  if (!!up === !!nova) falhar('informe exatamente um: --upgrade <receita>  ou  --nova <nome> --motivo "..."');
  const rec = listarReceitas(P);
  comparacao(rec, ab.filter((i) => alvo.includes(i.id)), lerExecutor(P, cfg));
  const dec = { ts: new Date().toISOString(), ids: alvo, tipo: up ? "upgrade" : "nova" };
  if (up) {
    const r = rec.find((x) => x.nome === up || x.arquivo === up || x.arquivo === `${up}.json`);
    if (!r) falhar(`receita "${up}" nao existe (veja a lista acima).`);
    Object.assign(dec, { receita: r.nome, arquivo: `.claude/catraca/receitas/${r.arquivo}` });
  } else {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(nova)) falhar("--nova: nome em minusculas com hifens (ex.: espaco-livre-discos).");
    if (!motivo || motivo.trim().length < 20) falhar("--nova exige --motivo com pelo menos 20 caracteres (por que NENHUMA receita da lista serve como upgrade).");
    if (fs.existsSync(path.join(P.receitas, `${nova}.json`))) falhar(`"${nova}" ja existe: e UPGRADE (--upgrade ${nova}).`);
    const toks = (s) => s.split("-").filter((t) => t.length >= 4);
    const distintas = (arg("--distinta-de") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const cand = rec.filter((r) => !distintas.includes(r.nome) && toks(r.nome).some((t) => toks(nova).includes(t)));
    if (cand.length) falhar(`candidata(s) a UPGRADE pelo nome: ${cand.map((r) => r.nome).join(", ")}. Use --upgrade <receita>; se for realmente distinta, nomeie-a em --distinta-de "${cand.map((r) => r.nome).join(",")}" e explique no --motivo.`);
    Object.assign(dec, { receita: nova, arquivo: `.claude/catraca/receitas/${nova}.json`, motivo, distintasDe: distintas });
  }
  gravarJson(P.decisao, dec); marcarCatalogo(P);
  console.log(`DECISAO gravada: ${dec.tipo} -> ${dec.arquivo} (dividas ${alvo.join(", ")}). Voce pode editar: essa receita, o executor (${cfg.executor.script}) e scripts de apoio. Depois rode a receita e feche.`);
}

function rodar() {
  exigirAtivo();
  const nome = args[0];
  if (!nome) falhar("uso: rodar <receita> [chave=valor ...]");
  const cfg = lerConfig(P);
  const arq = path.join(P.receitas, `${nome}.json`);
  if (!fs.existsSync(arq)) falhar(`receita "${nome}" inexistente.`);
  const exe = path.join(P.proj, cfg.executor.script);
  if (!fs.existsSync(exe)) falhar(`executor ausente (${cfg.executor.script}). Rode: init`);
  const params = args.slice(1).filter((x) => x.includes("="));
  const r = spawnSync(PS, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", exe, "-Receita", arq, ...(params.length ? ["-Param", params.join("~~")] : []), ...(args.includes("--aplicar") ? ["-Aplicar"] : [])], { cwd: P.proj, encoding: "utf8", windowsHide: true, maxBuffer: 1 << 26 });
  if (r.error) falhar(`nao consegui executar "${PS}" (${r.error.message}). O executor .ps1 exige PowerShell (Windows) ou pwsh.`);
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  process.exit(r.status ?? 1);
}

// Sintaxe do .ps1 pelo parser do proprio PowerShell. Sem PowerShell no PC: devolve null ("nao provado").
function sintaxePs1(arq) {
  const cmd = `$e=$null;$null=[System.Management.Automation.Language.Parser]::ParseFile('${arq.replace(/'/g, "''")}',[ref]$null,[ref]$e);if($e){$e|ForEach-Object{Write-Output $_.Message};exit 1}`;
  const r = spawnSync(PS, ["-NoProfile", "-NonInteractive", "-Command", cmd], { encoding: "utf8", windowsHide: true });
  if (r.error) return null;
  return r.status === 0 ? { ok: true } : { ok: false, erro: (r.stdout || r.stderr).trim().split("\n")[0] };
}

function fechar() {
  exigirAtivo();
  const cfg = lerConfig(P);
  const rel = relativo(P, arg("--arquivo"));
  if (!rel || !/^\.claude\/catraca\/receitas\/[a-z0-9-]+\.json$/.test(rel)) falhar("--arquivo precisa ser uma receita: .claude/catraca/receitas/<nome>.json (so receita fecha divida; se voce criou uma primitiva, a receita que a usa e a prova).");
  const abs = path.join(P.proj, rel);
  if (!fs.existsSync(abs)) falhar(`"${rel}" nao existe.`);
  const livro = lerLivro(P);
  const alvo = ids(arg("--ids"), livro);
  const itens = livro.itens.filter((i) => alvo.includes(i.id));
  if (!itens.length || itens.length !== alvo.length) falhar(`id(s) inexistente(s): ${alvo.join(",")}`);
  const nao = itens.filter((i) => i.estado !== "aberta");
  if (nao.length) falhar(`ja fechada(s)/descartada(s): ${nao.map((i) => "#" + i.id).join(", ")}`);
  const dec = lerJson(P.decisao, null);
  if (!dec || alvo.some((id) => !dec.ids.includes(id)) || dec.arquivo !== rel) falhar(`sem decisao valida para estes ids e este arquivo. Rode antes: decidir --ids ${alvo.join(",")} (--upgrade <receita> | --nova <nome> --motivo "...").`);
  const tsMin = Math.min(...itens.map((i) => Date.parse(i.ts)));
  const mtimeRec = fs.statSync(abs).mtimeMs;
  if (mtimeRec <= tsMin) falhar(`"${rel}" NAO mudou desde o registro da divida (${new Date(tsMin).toISOString()}): fechar exige receita criada ou atualizada de fato.`);
  const rec = lerJson(abs, null);
  if (!rec) falhar(`JSON invalido em ${rel}.`);
  const nome = path.basename(rel, ".json");
  if (rec.nome !== nome) falhar(`o campo "nome" da receita deve ser "${nome}".`);
  if (typeof rec.descricao !== "string" || rec.descricao.trim().length < 20) falhar('"descricao" obrigatoria (20+ caracteres): diga o que a receita faz em linguagem comum, para o catalogo mostrar ao Claude. Opcional: "sinonimos": ["outras formas de pedir"].');
  if (!Array.isArray(rec.passos) || !rec.passos.length || rec.passos.some((p) => !(typeof p.mostrar === "string" || (Array.isArray(p.executar) && p.executar.length)))) falhar('"passos" precisa ser lista nao vazia; cada passo tem "mostrar" (texto) ou "executar" (["-Primitiva", "-Arg", ...]).');
  const ex = lerExecutor(P, cfg);
  if (!ex.existe) falhar(`executor ausente (${cfg.executor.script}). Rode: init`);
  const exAbs = ex.arq;
  const mtimeEx = fs.statSync(exAbs).mtimeMs;
  const faltam = rec.passos.filter((p) => Array.isArray(p.executar)).map((p) => String(p.executar[0]).replace(/^-/, "")).filter((n) => !ex.params.some((q) => q.toLowerCase() === n.toLowerCase()));
  if (faltam.length) falhar(`a receita usa primitiva(s) que o executor NAO tem: ${[...new Set(faltam)].map((n) => "-" + n).join(", ")}. Crie-as em ${cfg.executor.script} (param + bloco + #@primitiva).`);
  let sintaxe = "nao provada (PowerShell indisponivel)";
  if (mtimeEx > tsMin) {
    const s = sintaxePs1(exAbs);
    if (s && !s.ok) falhar(`o executor tem erro de sintaxe: ${s.erro}`);
    if (s) sintaxe = "valida";
  }
  const execs = lerExecucoes(P);
  const desde = Math.max(mtimeRec, mtimeEx);
  if (!execs.some((u) => u.receita === nome && u.ok && Date.parse(u.ts) >= desde)) falhar(`a receita nunca rodou com sucesso DEPOIS da ultima alteracao da receita ou do executor. Prove: rodar ${nome} [chave=valor ...]`);
  const falhas = sobrepostas(listarReceitas(P));
  if (falhas) falhar(`${falhas} par(es) de receitas sobrepostos sem "naoDuplica": faca upgrade ou declare por que sao distintas.`);
  atualizarLivro(P, (l) => { for (const i of l.itens) if (alvo.includes(i.id)) { i.estado = "fechada"; i.fechamento = { arquivo: rel, ts: new Date().toISOString() }; } });
  if (!dec.ids.some((id) => abertas(P).some((i) => i.id === id))) { try { fs.unlinkSync(P.decisao); } catch { /* ja removida */ } }
  console.log(`FECHADO: dividas ${alvo.join(", ")} -> ${rel} (sintaxe do executor: ${sintaxe}). Abertas agora: ${abertas(P).length}.`);
}

function descartar() {
  exigirAtivo();
  const motivo = arg("--motivo");
  if (!motivo || motivo.trim().length < 10) falhar('--motivo obrigatorio (minimo 10 caracteres).');
  const livro = lerLivro(P);
  const alvo = ids(arg("--ids"), livro);
  atualizarLivro(P, (l) => { for (const i of l.itens) if (alvo.includes(i.id) && i.estado === "aberta") { i.estado = "descartada"; i.descarte = { motivo, ts: new Date().toISOString() }; } });
  console.log(`Descartadas: ${alvo.join(", ")}. Abertas agora: ${abertas(P).length}.`);
}

function status() {
  if (!ativo(P)) return console.log("catraca: projeto NAO iniciado.");
  const ab = abertas(P);
  console.log(`catraca: ativa | dividas abertas: ${ab.length} | receitas: ${listarReceitas(P).length}`);
  for (const i of ab) console.log(`  #${i.id} ${i.tipo} x${i.n}: ${i.resumo}`);
}

const MAPA = { init, status, listar, catalogo, decidir, rodar, fechar, descartar };
if (!MAPA[cmd]) { console.log("uso: catraca.mjs <init|status|listar|catalogo|decidir|rodar|fechar|descartar>"); process.exit(cmd ? 1 : 0); }
MAPA[cmd]();
