<#
.SYNOPSIS
  Executor da catraca: e quem EXECUTA as receitas (.claude/catraca/receitas/*.json) e onde moram as PRIMITIVAS.

.DESCRIPTION
  O Claude cresce este arquivo a cada divida resolvida: uma nova primitiva = um novo parametro + um bloco abaixo.
  CONVENCOES (a catraca le estas marcas):
    1. Declare o parametro no param(...) ANTES da linha "#@PARAMS-FIM" (ponha virgula depois do parametro anterior).
    2. Acima do bloco da primitiva, escreva:   #@primitiva NomeDoParametro - o que faz, em uma frase
    3. Leitura pura: nomeie com prefixo Ler, Listar, Consultar ou Ver (nao gera divida se chamada fora de receita).
    4. Primitiva que ALTERA algo: PLANO por padrao; so executa com -Aplicar (sem -Aplicar, apenas mostre o que faria).
    5. Nunca digite senha, token ou codigo de 2FA; nunca imprima segredo.
  Uma primitiva chamada a mao, fora de -Receita, vira DIVIDA no livro (a catraca fecha com receita provada).

  Receita (-Receita arquivo.json -Param "Chave=Valor"): passos { "mostrar": "texto {$chave}" } ou
  { "executar": ["-Primitiva", "-Arg", "{$chave}"], "toleraFalha": true }. Cada execucao termina gravando
  .claude/catraca/estado/execucoes.jsonl (e a prova que o "fechar" exige).

.EXAMPLE
  powershell -File .claude/catraca/executor/executar-no-windows.ps1 -Status
  powershell -File .claude/catraca/executor/executar-no-windows.ps1 -Receita .claude/catraca/receitas/minha-receita.json
#>
param(
  [switch]$Status,
  [string]$Receita = "",
  [string[]]$Param = @(),
  [switch]$Aplicar
  #@PARAMS-FIM
)
$ErrorActionPreference = 'Stop'
$raiz = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$estado = Join-Path $raiz '.claude\catraca\estado'
function Falhar([string]$Msg) { Write-Host "ERRO: $Msg"; exit 1 }
function RegistrarExecucao([string]$Nome, [bool]$Ok, [int]$Passos) {
  New-Item -ItemType Directory -Force $estado | Out-Null
  $linha = @{ receita = $Nome; ts = (Get-Date).ToUniversalTime().ToString('o'); ok = $Ok; passos = $Passos } | ConvertTo-Json -Compress
  Add-Content -Path (Join-Path $estado 'execucoes.jsonl') -Value $linha -Encoding UTF8
}

# ---------------- receita ----------------
if ($Receita -ne "") {
  $arq = if ([IO.Path]::IsPathRooted($Receita)) { $Receita } else { Join-Path $raiz $Receita }
  if (-not (Test-Path $arq)) { Falhar "receita nao achada: $Receita" }
  $rec = Get-Content -Raw -Encoding UTF8 $arq | ConvertFrom-Json
  $Vars = @{}
  if ($rec.parametros) { foreach ($prop in $rec.parametros.PSObject.Properties) { $Vars[$prop.Name] = [string]$prop.Value } }
  # varios -Param chegam numa unica string separada por ~~ (o -File do PowerShell nao divide listas)
  foreach ($kv in @($Param | ForEach-Object { $_ -split '~~' })) {
    $pos = $kv.IndexOf('=')
    if ($pos -lt 1) { Falhar "-Param espera Chave=Valor (recebeu '$kv')." }
    $Vars[$kv.Substring(0, $pos)] = $kv.Substring($pos + 1)
  }
  function Interpolar([string]$Texto) {
    return [regex]::Replace($Texto, '\{\$([A-Za-z_]\w*)\}', [System.Text.RegularExpressions.MatchEvaluator]{ param($m) [string]$Vars[$m.Groups[1].Value] })
  }
  Write-Host "RECEITA $($rec.nome)"
  $feitos = 0; $ok = $true
  foreach ($passo in $rec.passos) {
    if ($passo.mostrar) { Write-Host (Interpolar ([string]$passo.mostrar)); $feitos++; continue }
    if ($passo.executar) {
      $argv = @($passo.executar | ForEach-Object { Interpolar ([string]$_) })
      if ($Aplicar) { $argv += '-Aplicar' }
      $ErrorActionPreference = 'Continue'   # stderr do filho nao pode virar excecao no pai (PowerShell 5.1)
      $saida = & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PSCommandPath @argv 2>&1
      $codigo = $LASTEXITCODE
      $ErrorActionPreference = 'Stop'
      $saida | ForEach-Object { Write-Host $_ }
      if ($codigo -ne 0 -and -not $passo.toleraFalha) { $ok = $false; break }
      $feitos++; continue
    }
    Falhar "passo $($feitos + 1) sem 'mostrar' nem 'executar'."
  }
  RegistrarExecucao $rec.nome $ok $feitos
  if ($ok) { Write-Host "RESULTADO: OK ($feitos passo(s))." } else { Write-Host "RESULTADO: FALHOU no passo $($feitos + 1)." }
  exit $(if ($ok) { 0 } else { 1 })
}

# ---------------- primitivas ----------------
#@primitiva Status - mostra a versao do PowerShell e do sistema (leitura)
if ($Status) {
  Write-Host ("PowerShell {0} | {1} | executor ok" -f $PSVersionTable.PSVersion, [Environment]::OSVersion.VersionString)
  exit 0
}

#@PRIMITIVAS-FIM
Write-Host "Nada a fazer. Use -Status ou -Receita <arquivo.json>."
