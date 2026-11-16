// Catraca: biblioteca comum (estado, livro de dividas, configuracao, analise de comandos).
// Sem dependencias: so Node 18+.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const RAIZ_PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Raiz do projeto do usuario. CATRACA_PROJETO existe so para os testes.
export const projeto = (entrada) => path.resolve(process.env.CATRACA_PROJETO || process.env.CLAUDE_PROJECT_DIR || entrada?.cwd || process.cwd());
export const caminhos = (proj) => {
  const base = path.join(proj, ".claude", "catraca");
  return {
    proj, base,
    config: path.join(base, "config.json"),
    receitas: path.join(base, "receitas"),
    scripts: path.join(base, "scripts"),
    estado: path.join(base, "estado"),
    livro: path.join(base, "estado", "livro.json"),
    catalogo: path.join(base, "estado", "catalogo.json"),
    decisao: path.join(base, "estado", "decisao.json"),
    execucoes: path.join(base, "estado", "execucoes.json"),
    stop: path.join(base, "estado", "stop.json"),
  };
};

export const lerJson = (arq, padrao) => { try { return JSON.parse(fs.readFileSync(arq, "utf8").replace(/^﻿/, "")); } catch { return padrao; } };
export const gravarJson = (arq, obj) => { fs.mkdirSync(path.dirname(arq), { recursive: true }); fs.writeFileSync(arq, JSON.stringify(obj, null, 1), "utf8"); };
export const ativo = (P) => fs.existsSync(P.config);

// Comandos que nunca geram divida: leitura, navegacao e versionamento nao sao "trabalho manual repetivel".
export const NEUTROS_PADRAO = [
  "^(cd|ls|dir|pwd|echo|cat|type|head|tail|wc|which|where|whoami|date|true|false|sleep|clear|cls|mkdir|printf|test)\\b",
  "^(git|gh)\\b",
  "^(grep|rg|find)\\b",
  "^(Get-ChildItem|Get-Content|Get-Item|Get-Location|Test-Path|Select-String|Get-Date|Write-Output|Write-Host|Set-Location|Resolve-Path|Get-Command|Measure-Object|Split-Path|Join-Path)\\b",
  "^node\\s+--check\\b",
  "^\\S+\\s+(--version|-v|--help|-h)\\s*$",
];

export const CONFIG_PADRAO = {
  versao: 1,
  descricao: "Configuracao da catraca. 'neutros': regex (sem diferenciar maiusculas) de comandos que NUNCA geram divida. 'mcpEscrita': regex de nomes de ferramentas MCP que alteram coisas (cada uso vira divida). 'tentativasStop': quantas vezes o fim da sessao e barrado com divida aberta.",
  neutros: NEUTROS_PADRAO,
  mcpEscrita: [],
  tentativasStop: 6,
  instalarEstilo: true,
};
export const lerConfig = (P) => ({ ...CONFIG_PADRAO, ...lerJson(P.config, {}) });

// Divide um comando de shell em segmentos (separadores && || ; | e quebra de linha) SEM cortar dentro de aspas
// e ignorando o corpo de heredoc. Heuristica declarada: shell e uma linguagem grande.
function cortar(texto, seps) {
  const out = []; let atual = ""; let aspa = null;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (aspa) { atual += c; if (c === aspa) aspa = null; continue; }
    if (c === '"' || c === "'") { aspa = c; atual += c; continue; }
    if (seps.includes(texto.slice(i, i + 2))) { out.push(atual); atual = ""; i++; continue; }
    if (seps.includes(c)) { out.push(atual); atual = ""; continue; }
    atual += c;
  }
  out.push(atual);
  return out.map((s) => s.trim()).filter(Boolean);
}
// Comandos encadeados (&&, ||, ;, quebra de linha). O pipe NAO corta: um pipeline e uma unidade (ver estagios/ehNeutro).
export function segmentos(cmd) {
  const texto = String(cmd ?? "").replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2\b/g, " ");
  return cortar(texto, ["&&", "||", ";", "\n", "\r"]);
}
export const estagios = (seg) => cortar(seg, ["|"]);
// Filtros de pipeline: neutros SO quando o 1o estagio e neutro (ex.: Get-ChildItem | Sort-Object).
const FILTROS = "^(Sort-Object|Select-Object|Where-Object|Format-Table|Format-List|Out-String|Measure-Object|ForEach-Object|Group-Object|sort|uniq|head|tail|wc|grep|rg|cut|tr|more|less)\\b";

const COM_SUBCOMANDO = new Set(["npm", "npx", "pnpm", "yarn", "node", "python", "python3", "py", "docker", "dotnet", "winget", "choco", "powershell", "pwsh", "cmd", "pip", "cargo"]);
export function assinatura(seg) {
  const t = seg.replace(/^[&.]\s*/, "").split(/\s+/).filter(Boolean);
  const a = (t[0] ?? "").replace(/^["']|["']$/g, "").toLowerCase().replace(/^.*[\\/]/, "").replace(/\.(exe|cmd|bat)$/, "");
  return COM_SUBCOMANDO.has(a) && t[1] && !t[1].startsWith("-") ? `${a} ${t[1].toLowerCase()}` : a;
}

const casa = (r, s) => { try { return new RegExp(r, "i").test(s); } catch { return false; } };
const temEscrita = (s) => />/.test(s.replace(/\d?>&\d|\d?>\s*(\/dev\/null|\$null|nul)\b/gi, ""));   // redirecionamento para arquivo = escrita
// Neutro = 1o estagio neutro, demais estagios neutros ou filtros, e nenhuma escrita por redirecionamento.
export const ehNeutro = (seg, cfg) => {
  const est = estagios(seg);
  if (!est.length || temEscrita(seg)) return false;
  const neutros = cfg.neutros ?? [];
  return neutros.some((r) => casa(r, est[0])) && est.slice(1).every((e) => neutros.some((r) => casa(r, e)) || casa(FILTROS, e));
};
// Assinatura da divida = 1o estagio que NAO e neutro nem filtro (e o que de fato age).
export const assinaturaDe = (seg, cfg) => {
  const est = estagios(seg);
  const agente = est.find((e) => !(cfg.neutros ?? []).some((r) => casa(r, e)) && !casa(FILTROS, e)) ?? est[0] ?? seg;
  return assinatura(agente);
};
export const ehCatraca = (seg) => /catraca\.mjs/i.test(seg);

// ---- livro de dividas ----
export const lerLivro = (P) => lerJson(P.livro, { proximo: 1, itens: [] });
export const abertas = (P) => lerLivro(P).itens.filter((i) => i.estado === "aberta");
export function registrarDivida(P, { tipo, assinatura: sig, resumo }) {
  const livro = lerLivro(P);
  const ja = livro.itens.find((i) => i.estado === "aberta" && i.tipo === tipo && i.assinatura === sig);
  if (ja) { ja.n++; ja.ultimo = new Date().toISOString(); ja.exemplos = [...(ja.exemplos ?? []), resumo].slice(-3); gravarJson(P.livro, livro); return { ...ja, nova: false }; }
  const item = { id: livro.proximo++, ts: new Date().toISOString(), tipo, assinatura: sig, resumo, n: 1, exemplos: [resumo], estado: "aberta" };
  livro.itens.push(item); gravarJson(P.livro, livro); return { ...item, nova: true };
}
export function atualizarLivro(P, fn) { const livro = lerLivro(P); fn(livro); gravarJson(P.livro, livro); }

// ---- receitas e catalogo ----
export const listarReceitas = (P) => (fs.existsSync(P.receitas) ? fs.readdirSync(P.receitas) : []).filter((f) => f.endsWith(".json")).map((f) => {
  const j = lerJson(path.join(P.receitas, f), {});
  const passos = Array.isArray(j.passos) ? j.passos : [];
  const sigs = [...new Set(passos.map((p) => (p.comando ? assinatura(p.comando) : p.arquivo ? `script:${p.arquivo}` : "")).filter(Boolean))];
  return { arquivo: f, nome: j.nome ?? f.replace(/\.json$/, ""), descricao: j.descricao ?? "", params: Object.keys(j.parametros ?? {}), sigs, naoDuplica: j.naoDuplica ?? null };
});
export const listarScripts = (P) => (fs.existsSync(P.scripts) ? fs.readdirSync(P.scripts) : []);
export const marcarCatalogo = (P) => gravarJson(P.catalogo, { ts: new Date().toISOString() });
export const catalogoFresco = (P) => { const c = lerJson(P.catalogo, null); return !!c && Date.now() - Date.parse(c.ts) < 90 * 60 * 1000; };

export const relativo = (P, p) => {
  if (!p) return null;
  const abs = path.isAbsolute(p) ? path.normalize(p) : path.resolve(P.proj, p);
  const r = path.relative(P.proj, abs).split(path.sep).join("/");
  return r.startsWith("..") || path.isAbsolute(r) ? null : r;
};
