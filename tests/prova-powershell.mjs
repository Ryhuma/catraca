#!/usr/bin/env node
// Prova ponta a ponta no PowerShell REAL (so Windows): o executor ganha a primitiva do exercicio (-EspacoLivre), a receita de exemplo
// roda por ele, e o filtro -LimitePct funciona (controle negativo: -1 nao devolve disco nenhum).
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
const exe = path.join(proj, ".claude/catraca/executor/executar-no-windows.ps1");
let s = fs.readFileSync(exe, "utf8");
s = s.replace("[switch]$Aplicar\n  #@PARAMS-FIM", "[switch]$Aplicar,\n  [switch]$EspacoLivre,\n  [int]$LimitePct = 100\n  #@PARAMS-FIM");
s = s.replace("#@PRIMITIVAS-FIM", `#@primitiva EspacoLivre - lista o espaco livre de cada disco local; -LimitePct N mostra so os com ate N% livre
if ($EspacoLivre) {
  Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' |
    Select-Object DeviceID,
      @{n='LivreGB';e={[math]::Round($_.FreeSpace/1GB,1)}},
      @{n='TotalGB';e={[math]::Round($_.Size/1GB,1)}},
      @{n='LivrePct';e={[math]::Round(100*$_.FreeSpace/$_.Size,0)}} |
    Where-Object { $_.LivrePct -le $LimitePct } |
    Format-Table -AutoSize | Out-String -Width 200 | Write-Host
  exit 0
}

#@PRIMITIVAS-FIM`);
fs.writeFileSync(exe, s);
fs.copyFileSync(path.join(RAIZ, "exemplos", "espaco-livre-discos.json"), path.join(proj, ".claude/catraca/receitas/espaco-livre-discos.json"));
const todos = cli("rodar", "espaco-livre-discos");
const nenhum = cli("rodar", "espaco-livre-discos", "limitePct=-1");
console.log(todos.stdout + todos.stderr);
const passou = todos.status === 0 && /[A-Z]:/.test(todos.stdout) && /LivreGB/.test(todos.stdout) && nenhum.status === 0 && !/[A-Z]:\s/.test(nenhum.stdout.split("RESULTADO")[0]);
console.log(passou ? "PROVA OK: o executor .ps1 rodou a receita, listou os discos e o filtro limitePct=-1 removeu todos (controle negativo)." : "PROVA FALHOU\n" + nenhum.stdout + nenhum.stderr);
fs.rmSync(proj, { recursive: true, force: true });
process.exit(passou ? 0 : 1);
