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

$compatibilityDate = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
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

  $routeAudit = @'
const fs = require('fs');
const vm = require('vm');

const listeners = new Map();
const sandbox = {
  console,
  URL,
  URLSearchParams,
  CustomEvent: function CustomEvent(type, init = {}) { this.type = type; this.detail = init.detail; },
  window: {
    ADMIN_BASE_PATH: '',
    location: new URL('http://127.0.0.1:__PORT__/overview'),
    addEventListener(type, handler) {
      listeners.set(type, handler);
    },
    dispatchEvent() {
      return true;
    }
  }
};
sandbox.window.window = sandbox.window;

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('docs/js/admin-routes.js', 'utf8'), sandbox);

const routes = sandbox.window.StreamSuitesAdminRoutes;
const userDetail = routes.resolveViewFromPath('/users/7lPBEiA', '');
if (userDetail.view !== 'user-detail' || userDetail.params.user_code !== '7lPBEiA') {
  throw new Error(`Admin user-detail route mismatch: ${JSON.stringify(userDetail)}`);
}

const integrations = routes.resolveViewFromPath('/profiles/integrations', '?user_code=UGHW8WQ');
if (integrations.view !== 'creator-integrations' || integrations.queryString !== 'user_code=UGHW8WQ') {
  throw new Error(`Admin creator-integrations route mismatch: ${JSON.stringify(integrations)}`);
}

const discord = routes.resolveViewFromPath('/integrations/discord', '');
if (discord.view !== 'discord') {
  throw new Error(`Admin discord route mismatch: ${JSON.stringify(discord)}`);
}

sandbox.window.location = new URL('http://127.0.0.1:__PORT__/definitely-invalid-route');
const unknown = routes.resolveLocation();
if (unknown.view !== '' || unknown.matched !== false) {
  throw new Error(`Admin unknown-route mismatch: ${JSON.stringify(unknown)}`);
}
'@
  $routeAudit = $routeAudit.Replace("__PORT__", [string]$Port)

  $routeAudit | node -
  if ($LASTEXITCODE -ne 0) {
    throw "Admin route resolver validation failed."
  }

  Write-Host "Dashboard Pages routing validation passed on port $Port."
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
