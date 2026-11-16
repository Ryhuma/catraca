#!/usr/bin/env node
// Prova que a receita de exemplo do exercicio roda de verdade no PowerShell do Windows (so Windows) e que o filtro funciona.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") { console.log("PROVA PULADA: so faz sentido no Windows."); process.exit(0); }
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proj = fs.mkdtempSync(path.join(os.tmpdir(), "catraca-ps-"));
const env = { ...process.env, CATRACA_PROJETO: proj };
const cli = (...a) => spawnSync(process.execPath, [path.join(RAIZ, "scripts", "catraca.mjs"), ...a], { encoding: "utf8", env, cwd: proj });
cli("init");
fs.copyFileSync(path.join(RAIZ, "exemplos", "espaco-livre-discos.json"), path.join(proj, ".claude/catraca/receitas/espaco-livre-discos.json"));
const todos = cli("rodar", "espaco-livre-discos");
const nenhum = cli("rodar", "espaco-livre-discos", "limitePct=-1");
console.log(todos.stdout + todos.stderr);
const passou = todos.status === 0 && /[A-Z]:/.test(todos.stdout) && /LivreGB/.test(todos.stdout) && nenhum.status === 0 && !/[A-Z]:\s/.test(nenhum.stdout.split("RECEITA")[0]);
console.log(passou ? "PROVA OK: PowerShell listou os discos e o filtro limitePct=-1 removeu todos (controle negativo)." : "PROVA FALHOU\n" + nenhum.stdout + nenhum.stderr);
fs.rmSync(proj, { recursive: true, force: true });
process.exit(passou ? 0 : 1);
