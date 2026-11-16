#!/usr/bin/env node
// Catraca: CLI.  node catraca.mjs <init|status|listar|catalogo|decidir|rodar|fechar|descartar> [opcoes]
// Roda sempre na raiz do projeto do usuario (cwd, ou CATRACA_PROJETO / CLAUDE_PROJECT_DIR).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { projeto, caminhos, ativo, CONFIG_PADRAO, lerJson, gravarJson, lerLivro, abertas, atualizarLivro, listarReceitas, listarScripts, marcarCatalogo, relativo } from "./lib.mjs";

const [cmd, ...args] = process.argv.slice(2);
const P = caminhos(projeto());
const arg = (n) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : null; };
const falhar = (m) => { console.error(`FALHOU: ${m}`); process.exit(1); };
const exigirAtivo = () => { if (!ativo(P)) falhar("projeto nao iniciado. Rode: init"); };

function ids(texto, livro) {
  if (args.includes("--todos")) return livro.itens.filter((i) => i.estado === "aberta").map((i) => i.id);
  if (!texto) falhar("informe --ids 1,2,3-5 (ou --todos)");
  const out = new Set();
  for (const p of texto.split(",")) { const m = /^(\d+)(?:-(\d+))?$/.exec(p.trim()); if (!m) falhar(`ids invalidos: ${texto}`); for (let n = +m[1]; n <= +(m[2] || m[1]); n++) out.add(n); }
  return [...out];
}

function init() {
  fs.mkdirSync(P.receitas, { recursive: true }); fs.mkdirSync(P.scripts, { recursive: true }); fs.mkdirSync(P.estado, { recursive: true });
  if (!fs.existsSync(P.config)) gravarJson(P.config, CONFIG_PADRAO);
  fs.writeFileSync(path.join(P.estado, ".gitignore"), "*\n!.gitignore\n", "utf8");
  console.log(`Catraca iniciada em ${path.relative(P.proj, P.base) || P.base}. Receitas: .claude/catraca/receitas. Scripts de apoio: .claude/catraca/scripts. Estado local (nao vai ao git): .claude/catraca/estado.`);
}

function listar() {
  const itens = args.includes("--abertas") ? abertas(P) : lerLivro(P).itens;
  if (args.includes("--json")) return console.log(JSON.stringify(itens, null, 1));
  if (!itens.length) return console.log("livro de dividas: VAZIO (ok).");
  for (const i of itens) console.log(`#${i.id} [${i.estado}] ${i.tipo} x${i.n} | ${i.resumo}${i.fechamento ? ` -> ${i.fechamento.arquivo}` : ""}${i.descarte ? ` (descartada: ${i.descarte.motivo})` : ""}`);
}

const RUIDO = new Set(["echo", "write-host", "write-output", "cd", "set-location"]);
function sobrepostas(rec) {
  let falhas = 0;
  for (let a = 0; a < rec.length; a++) for (let b = a + 1; b < rec.length; b++) {
    const A = rec[a], B = rec[b];
    const comum = A.sigs.filter((s) => B.sigs.includes(s) && !RUIDO.has(s));
    if (comum.length < 2) continue;
    const decl = (A.naoDuplica && String(A.naoDuplica).includes(B.nome)) || (B.naoDuplica && String(B.naoDuplica).includes(A.nome));
    console.log(`${decl ? "ok    " : "ALERTA"} ${A.nome} x ${B.nome}: comandos em comum ${comum.join(", ")}${decl ? " (naoDuplica declarado)" : ""}`);
    if (!decl) falhas++;
  }
  return falhas;
}

function catalogo() {
  exigirAtivo();
  const rec = listarReceitas(P);
  const uso = lerJson(P.execucoes, []);
  for (const r of rec) console.log(`${r.nome}${r.descricao ? ` - ${r.descricao}` : ""}\n  params: ${r.params.join(", ") || "-"}\n  comandos: ${r.sigs.join(", ") || "-"}\n  usos ok: ${uso.filter((u) => u.receita === r.nome && u.ok).length}`);
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
  const livro = lerLivro(P);
  const ab = livro.itens.filter((i) => i.estado === "aberta");
  const alvo = ids(arg("--ids"), livro);
  if (!alvo.length || alvo.some((id) => !ab.some((i) => i.id === id))) falhar(`--ids precisa de dividas ABERTAS (abertas agora: ${ab.map((i) => i.id).join(", ") || "nenhuma"}).`);
  const up = arg("--upgrade"), nova = arg("--nova"), motivo = arg("--motivo");
  if (!!up === !!nova) falhar('informe exatamente um: --upgrade <receita>  ou  --nova <nome> --motivo "..."');
  const rec = listarReceitas(P);
  for (const r of rec) console.log(`${r.nome}${r.descricao ? ` - ${r.descricao}` : ""}\n  params: ${r.params.join(", ") || "-"} | comandos: ${r.sigs.join(", ") || "-"}`);
  const dec = { ts: new Date().toISOString(), ids: alvo, tipo: up ? "upgrade" : "nova" };
  if (up) {
    const r = rec.find((x) => x.nome === up || x.arquivo === up || x.arquivo === `${up}.json`);
    if (!r) falhar(`receita "${up}" nao existe (veja a lista acima).`);
    Object.assign(dec, { receita: r.nome, arquivo: `.claude/catraca/receitas/${r.arquivo}` });
  } else {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(nova)) falhar("--nova: nome em minusculas com hifens (ex.: listar-maiores-arquivos).");
    if (!motivo || motivo.trim().length < 20) falhar("--nova exige --motivo com pelo menos 20 caracteres (por que NENHUMA receita da lista serve como upgrade).");
    if (fs.existsSync(path.join(P.receitas, `${nova}.json`))) falhar(`"${nova}" ja existe: e UPGRADE (--upgrade ${nova}).`);
    const toks = (s) => s.split("-").filter((t) => t.length >= 4);
    const sigsDivida = new Set(ab.filter((i) => alvo.includes(i.id)).map((i) => i.assinatura));
    const distintas = (arg("--distinta-de") ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const cand = rec.filter((r) => !distintas.includes(r.nome) && (toks(r.nome).some((t) => toks(nova).includes(t)) || r.sigs.some((s) => sigsDivida.has(s))));
    if (cand.length) falhar(`candidata(s) a UPGRADE: ${cand.map((r) => r.nome).join(", ")}. Use --upgrade <receita>; se for realmente distinta, nomeie-a em --distinta-de "${cand.map((r) => r.nome).join(",")}" e explique no --motivo.`);
    Object.assign(dec, { receita: nova, arquivo: `.claude/catraca/receitas/${nova}.json`, motivo, distintasDe: distintas });
  }
  gravarJson(P.decisao, dec); marcarCatalogo(P);
  console.log(`DECISAO gravada: ${dec.tipo} -> ${dec.arquivo} (dividas ${alvo.join(", ")}). Agora crie/edite esse arquivo, rode a receita e feche.`);
}

// ---- execucao de receitas ----
const PERIGOSO = /[`$;&|\r\n"'<>]/;
const sub = (txt, params) => String(txt).replace(/\{\{(\w+)\}\}/g, (_, k) => params[k] ?? "");
function executarPasso(passo, params, n) {
  const win = process.platform === "win32";
  let exe, a;
  if (passo.tipo === "powershell") { exe = win ? "powershell" : "pwsh"; a = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", sub(passo.comando, params)]; }
  else if (passo.tipo === "shell") { exe = win ? "cmd.exe" : "sh"; a = win ? ["/d", "/s", "/c", sub(passo.comando, params)] : ["-c", sub(passo.comando, params)]; }
  else if (passo.tipo === "node") { exe = process.execPath; a = ["-e", sub(passo.comando, params)]; }
  else if (passo.tipo === "script") {
    const arq = path.resolve(P.scripts, sub(passo.arquivo, params));
    if (path.relative(P.scripts, arq).startsWith("..")) falhar(`passo ${n}: script fora de .claude/catraca/scripts`);
    if (!fs.existsSync(arq)) falhar(`passo ${n}: script inexistente (${path.basename(arq)})`);
    const extra = (passo.args ?? []).map((x) => sub(x, params));
    if (arq.endsWith(".ps1")) { exe = win ? "powershell" : "pwsh"; a = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", arq, ...extra]; }
    else if (/\.m?js$/.test(arq)) { exe = process.execPath; a = [arq, ...extra]; }
    else { exe = "sh"; a = [arq, ...extra]; }
  } else falhar(`passo ${n}: tipo "${passo.tipo}" invalido (powershell|shell|node|script)`);
  const r = spawnSync(exe, a, { cwd: P.proj, encoding: "utf8", windowsHide: true, maxBuffer: 1 << 26 });
  if (r.error) falhar(`passo ${n}: nao consegui executar "${exe}" (${r.error.message})`);
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  return r.status === 0;
}

function rodar() {
  exigirAtivo();
  const nome = args[0];
  if (!nome) falhar("uso: rodar <receita> [chave=valor ...]");
  const arq = path.join(P.receitas, `${nome}.json`);
  const rec = lerJson(arq, null);
  if (!rec || !Array.isArray(rec.passos) || !rec.passos.length) falhar(`receita "${nome}" inexistente ou sem passos.`);
  const dados = Object.fromEntries(args.slice(1).filter((x) => x.includes("=")).map((x) => [x.slice(0, x.indexOf("=")), x.slice(x.indexOf("=") + 1)]));
  const params = {};
  for (const [k, def] of Object.entries(rec.parametros ?? {})) {
    const v = dados[k] ?? def?.padrao;
    if (v === undefined) falhar(`parametro obrigatorio ausente: ${k}`);
    if (PERIGOSO.test(String(v))) falhar(`parametro "${k}" contem caractere nao permitido (\` $ ; & | < > aspas ou quebra de linha).`);
    params[k] = String(v);
  }
  let ok = true, feitos = 0;
  for (const [i, p] of rec.passos.entries()) { if (!executarPasso(p, params, i + 1)) { ok = false; break; } feitos++; }
  const uso = lerJson(P.execucoes, []);
  uso.push({ receita: nome, ts: new Date().toISOString(), ok, passos: feitos });
  gravarJson(P.execucoes, uso.slice(-500));
  console.log(ok ? `\nRECEITA ${nome}: OK (${feitos} passo(s)).` : `\nRECEITA ${nome}: FALHOU no passo ${feitos + 1}.`);
  process.exit(ok ? 0 : 1);
}

function fechar() {
  exigirAtivo();
  const rel = relativo(P, arg("--arquivo"));
  if (!rel || !/^\.claude\/catraca\/receitas\/[a-z0-9-]+\.json$/.test(rel)) falhar("--arquivo precisa ser uma receita: .claude/catraca/receitas/<nome>.json (so receita fecha divida).");
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
  const mtime = fs.statSync(abs).mtimeMs;
  const tsMin = Math.min(...itens.map((i) => Date.parse(i.ts)));
  if (mtime <= tsMin) falhar(`"${rel}" NAO mudou desde o registro da divida (${new Date(tsMin).toISOString()}): fechar exige receita criada ou atualizada de fato.`);
  const rec = lerJson(abs, null);
  if (!rec) falhar(`JSON invalido em ${rel}.`);
  const nome = path.basename(rel, ".json");
  if (rec.nome !== nome) falhar(`o campo "nome" da receita deve ser "${nome}".`);
  if (!Array.isArray(rec.passos) || !rec.passos.length || rec.passos.some((p) => !p.tipo || !(p.comando || p.arquivo))) falhar('"passos" precisa ser lista nao vazia, cada passo com "tipo" e ("comando" ou "arquivo").');
  const execs = lerJson(P.execucoes, []);
  if (!execs.some((u) => u.receita === nome && u.ok && Date.parse(u.ts) >= mtime)) falhar(`a receita nunca rodou com sucesso DEPOIS da ultima alteracao. Prove: rodar ${nome} [chave=valor ...]`);
  const falhas = sobrepostas(listarReceitas(P));
  if (falhas) falhar(`${falhas} par(es) de receitas sobrepostos sem "naoDuplica": faca upgrade ou declare por que sao distintas.`);
  atualizarLivro(P, (l) => { for (const i of l.itens) if (alvo.includes(i.id)) { i.estado = "fechada"; i.fechamento = { arquivo: rel, ts: new Date().toISOString() }; } });
  if (!dec.ids.some((id) => abertas(P).some((i) => i.id === id))) { try { fs.unlinkSync(P.decisao); } catch { /* ja removida */ } }
  console.log(`FECHADO: dividas ${alvo.join(", ")} -> ${rel}. Abertas agora: ${abertas(P).length}.`);
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
