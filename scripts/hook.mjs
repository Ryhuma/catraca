#!/usr/bin/env node
// Catraca: manipulador unico dos hooks do Claude Code.  Uso: node hook.mjs <sessionstart|pretool|stop>
// Entrada: JSON do hook em stdin.  Saida: exit 2 + stderr (bloqueia), ou JSON em stdout (contexto / decision block).
// Regra de ouro: erro interno NUNCA bloqueia o usuario (falha aberta), exceto o que esta marcado como protecao.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RAIZ_PLUGIN, projeto, caminhos, ativo, lerConfig, lerJson, gravarJson, segmentos, assinaturaDe, ehNeutro, ehCatraca, registrarDivida, abertas, relativo, catalogoFresco } from "./lib.mjs";

const evento = process.argv[2];
const CLI = `node "${path.join(RAIZ_PLUGIN, "scripts", "catraca.mjs")}"`;
const escrever = (fd, s) => fs.writeSync(fd, s + "\n");   // sincrono: console.log + exit pode truncar no Windows
const bloquear = (msg) => { escrever(2, `CATRACA: ${msg}`); process.exit(2); };
const contexto = (nome, txt) => { escrever(1, JSON.stringify({ hookSpecificOutput: { hookEventName: nome, additionalContext: txt } })); process.exit(0); };

let entrada = {};
try { entrada = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch { /* sem entrada valida: segue com {} */ }
const P = caminhos(projeto(entrada));

try {
  if (evento === "sessionstart") sessionStart();
  else if (!ativo(P)) process.exit(0);
  else if (evento === "pretool") preTool();
  else if (evento === "stop") parar();
} catch (e) { escrever(2, `CATRACA (erro interno ignorado): ${e.message}`); process.exit(0); }
process.exit(0);

function instalarEstilo() {
  try {
    const origem = path.join(RAIZ_PLUGIN, "output-styles", "silencioso.md");
    const destino = path.join(os.homedir(), ".claude", "output-styles", "silencioso.md");
    if (!fs.existsSync(origem) || fs.existsSync(destino)) return "";
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.copyFileSync(origem, destino);
    return " Estilo de saida Silencioso instalado em ~/.claude/output-styles (ative com /output-style).";
  } catch { return ""; }
}

function sessionStart() {
  const cfg = lerConfig(P);
  const estilo = cfg.instalarEstilo === false ? "" : instalarEstilo();
  if (!ativo(P)) {
    contexto("SessionStart", `Catraca instalada, mas este projeto ainda nao foi iniciado. Ofereca ao usuario, em UMA linha, rodar /catraca:iniciar (cria .claude/catraca/ com livro de dividas, catalogo e receitas). Nao rode sem o usuario aceitar. Se aceitar: ${CLI} init${estilo}`);
  }
  const ab = abertas(P);
  const lista = ab.slice(0, 5).map((i) => `#${i.id} ${i.resumo} (x${i.n})`).join("; ");
  contexto("SessionStart", `CATRACA ATIVA. CLI: ${CLI} <comando>. Ciclo: voce executa a mao -> o hook registra uma divida no livro -> voce resolve na mesma sessao com UPGRADE de receita existente ou receita NOVA (catalogo -> decidir -> criar -> rodar -> fechar). Detalhes: skill catraca. ${ab.length ? `DIVIDAS ABERTAS (${ab.length}): ${lista}. Resolva-as na sua primeira resposta.` : "Livro vazio."}${estilo}`);
}

function preTool() {
  const cfg = lerConfig(P);
  const nome = entrada.tool_name ?? "";
  const ti = entrada.tool_input ?? {};

  if (nome === "Bash" || nome === "PowerShell") {
    const cmd = String(ti.command ?? "");
    if (/catraca\.mjs["']?\s+descartar/i.test(cmd)) bloquear("descartar uma divida e decisao SO do usuario. Peca a ele para rodar o comando com '!' no inicio.");
    if (/\.claude[\\/]catraca[\\/]estado/i.test(cmd)) bloquear("o estado da catraca (livro, decisao, execucoes) so e alterado pelo CLI da catraca, nunca a mao.");
    const novas = [];
    for (const seg of segmentos(cmd)) {
      if (ehCatraca(seg)) continue;
      if (/\.claude[\\/]catraca[\\/](receitas|scripts)/i.test(seg) && (!ehNeutro(seg, cfg) || />/.test(seg))) bloquear("crie ou edite receitas e scripts da catraca com Write/Edit (que passam pelo catalogo e pela decisao), nao pelo shell.");
      if (ehNeutro(seg, cfg)) continue;
      novas.push(registrarDivida(P, { tipo: "manual", assinatura: assinaturaDe(seg, cfg), resumo: seg.slice(0, 160) }));
    }
    if (novas.length) contexto("PreToolUse", `CATRACA: ${novas.map((d) => `divida #${d.id} (${d.assinatura}) ${d.nova ? "registrada" : `x${d.n}`}`).join("; ")}. Resolva ANTES de encerrar: ${CLI} catalogo -> decidir -> criar/atualizar a receita -> rodar -> fechar.`);
    return;
  }

  if (/^mcp__/.test(nome) && (cfg.mcpEscrita ?? []).some((r) => { try { return new RegExp(r, "i").test(nome); } catch { return false; } })) {
    const d = registrarDivida(P, { tipo: "mcp", assinatura: nome, resumo: nome });
    contexto("PreToolUse", `CATRACA: divida #${d.id} (${nome}) ${d.nova ? "registrada" : `x${d.n}`}. Transforme em receita ou upgrade antes de encerrar.`);
  }

  if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(nome)) {
    const rel = relativo(P, ti.file_path ?? ti.notebook_path);
    if (!rel) return;
    if (rel.startsWith(".claude/catraca/estado/")) bloquear("o estado da catraca so e alterado pelo CLI.");
    if (!/^\.claude\/catraca\/(receitas|scripts)\//.test(rel)) return;
    if (!catalogoFresco(P)) bloquear(`antes de criar ou editar receita/script, leia o catalogo: ${CLI} catalogo (vale 90 min). Existe uma receita que ja faz isto? Entao e UPGRADE dela.`);
    if (abertas(P).length) {
      const dec = lerJson(P.decisao, null);
      if (!dec) bloquear(`ha dividas abertas e nenhuma decisao: rode ${CLI} decidir --ids <ids> (--upgrade <receita> | --nova <nome> --motivo "...").`);
      const ok = rel === dec.arquivo || rel.startsWith(".claude/catraca/scripts/");
      if (!ok) bloquear(`com divida aberta so e permitido editar o arquivo decidido (${dec.arquivo}) ou scripts de apoio em .claude/catraca/scripts/. Para outra receita, rode decidir de novo.`);
    }
  }
}

function parar() {
  const ab = abertas(P);
  if (!ab.length) return;
  const cfg = lerConfig(P);
  const st = lerJson(P.stop, {});
  const sid = entrada.session_id ?? "?";
  const k = st[sid] ?? 0;
  if (k >= (cfg.tentativasStop ?? 6)) return;   // teto: nunca prende o usuario para sempre
  st[sid] = k + 1; gravarJson(P.stop, st);
  const lista = ab.map((i) => `#${i.id} ${i.tipo} x${i.n}: ${i.resumo}`).join("\n");
  escrever(1, JSON.stringify({ decision: "block", reason: `CATRACA: ${ab.length} divida(s) aberta(s) (tentativa ${k + 1}/${cfg.tentativasStop ?? 6}).\n${lista}\nResolva cada uma: ${CLI} catalogo -> decidir -> criar/atualizar receita -> rodar -> fechar. Se uma divida nao se aplica, diga ao usuario para descartar com '!'.` }));
}
