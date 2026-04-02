param(
  [int]$Port = 8794
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildScript = Join-Path $PSScriptRoot "build-pages-artifact.ps1"
$stdoutLog = Join-Path $repoRoot "tmp\\wrangler-pages-validate.out.log"
$stderrLog = Join-Path $repoRoot "tmp\\wrangler-pages-validate.err.log"

if (-not (Test-Path -LiteralPath (Split-Path $stdoutLog -Parent))) {
  New-Item -ItemType Directory -Path (Split-Path $stdoutLog -Parent) | Out-Null
}

if (Test-Path -LiteralPath $stdoutLog) {
  Remove-Item -LiteralPath $stdoutLog -Force
}

if (Test-Path -LiteralPath $stderrLog) {
  Remove-Item -LiteralPath $stderrLog -Force
}

& $buildScript

$compatibilityDate = Get-Date -Format "yyyy-MM-dd"
$process = $null

function Invoke-RouteCheck {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [int]$ExpectedStatus,
    [switch]$RejectHtml
  )

  $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port$Path" -SkipHttpErrorCheck
  if ($response.StatusCode -ne $ExpectedStatus) {
    throw "Route $Path returned $($response.StatusCode), expected $ExpectedStatus."
  }

  if ($RejectHtml -and $response.Content -match "<!DOCTYPE html>") {
    throw "Route $Path unexpectedly returned HTML."
  }
}

try {
  $process = Start-Process -FilePath "npx.cmd" -ArgumentList @(
    "wrangler",
    "pages",
    "dev",
    "dist",
    "--port",
    $Port,
    "--compatibility-date",
    $compatibilityDate
  ) -WorkingDirectory $repoRoot -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt += 1) {
    Start-Sleep -Seconds 1
    if ($process.HasExited) {
      throw "wrangler pages dev exited before validation completed."
    }

    try {
      Invoke-WebRequest -Uri "http://127.0.0.1:$Port/" -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch {
      continue
    }
  }

  if (-not $ready) {
    throw "Timed out waiting for wrangler pages dev on port $Port."
  }

  Invoke-RouteCheck -Path "/home" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/users/7lPBEiA" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/profiles/integrations?user_code=UGHW8WQ" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/integrations/discord" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/permissions" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/profiles/not-real" -ExpectedStatus 404
  Invoke-RouteCheck -Path "/js/admin-routes.js" -ExpectedStatus 200 -RejectHtml

  Write-Host "Dashboard Pages routing validation passed on port $Port."
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
