param(
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$docsRoot = Join-Path $repoRoot "docs"
$publishRoot = Join-Path $repoRoot $OutputDir
$publishDirectories = @(
  "about",
  "assets",
  "auth",
  "css",
  "data",
  "js",
  "livechat",
  "runtime",
  "shared",
  "support",
  "tools",
  "views"
)
$excludedSourceFiles = @("_redirects", "404.html", "index.html")

$directRouteRedirects = @(
  "/auth                  /auth/login.html         302",
  "/overview              /index.html              200",
  "/users                 /index.html              200",
  "/users/*               /index.html              200",
  "/accounts              /index.html              200",
  "/profiles              /index.html              200",
  "/profiles/*            /index.html              200",
  "/creators              /index.html              200",
  "/profiles/stats        /index.html              200",
  "/creator-stats         /index.html              200",
  "/telemetry             /index.html              200",
  "/bots                  /index.html              200",
  "/runtime-status        /index.html              200",
  "/approvals             /index.html              200",
  "/audit                 /index.html              200",
  "/analytics             /index.html              200",
  "/analytics-alerts      /index.html              200",
  "/alerts                /index.html              200",
  "/notifications         /index.html              200",
  "/inbox                 /index.html              200",
  "/ratelimits            /index.html              200",
  "/rate-limits           /index.html              200",
  "/api-usage             /index.html              200",
  "/data-signals          /index.html              200",
  "/signals               /index.html              200",
  "/jobs                  /index.html              200",
  "/chat-replay           /index.html              200",
  "/tiers                 /index.html              200",
  "/clips                 /index.html              200",
  "/polls                 /index.html              200",
  "/tallies               /index.html              200",
  "/scoreboards           /index.html              200",
  "/scoreboard-management /index.html              200",
  "/settings              /index.html              200",
  "/updates               /index.html              200",
  "/design                /index.html              200",
  "/integrations/*        /index.html              200",
  "/rumble                /index.html              200",
  "/youtube               /index.html              200",
  "/twitch                /index.html              200",
  "/kick                  /index.html              200",
  "/pilled                /index.html              200",
  "/twitter               /index.html              200",
  "/discord               /index.html              200",
  "/triggers              /index.html              200",
  "/chat-triggers         /index.html              200"
)

if (Test-Path -LiteralPath $publishRoot) {
  $emptyDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ss-empty-" + [System.Guid]::NewGuid().ToString("N"))
  New-Item -ItemType Directory -Path $emptyDir | Out-Null
  & robocopy $emptyDir $publishRoot /MIR /NFL /NDL /NJH /NJS /NP /R:2 /W:1 | Out-Null
  Remove-Item -LiteralPath $emptyDir -Recurse -Force
} else {
  New-Item -ItemType Directory -Path $publishRoot | Out-Null
}

Get-ChildItem -LiteralPath $docsRoot -File -Force | Where-Object {
  $excludedSourceFiles -notcontains $_.Name
} | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $publishRoot $_.Name) -Force
}

foreach ($directoryName in $publishDirectories) {
  $sourceDir = Join-Path $docsRoot $directoryName
  if (-not (Test-Path -LiteralPath $sourceDir)) {
    continue
  }

  $destinationDir = Join-Path $publishRoot $directoryName
  & robocopy $sourceDir $destinationDir /E /XF tmp* /NFL /NDL /NJH /NJS /NP /R:2 /W:1 /MT:16 | Out-Null
  $robocopyExitCode = $LASTEXITCODE
  if ($robocopyExitCode -gt 7) {
    throw "robocopy failed while staging docs/$directoryName into the publish artifact (exit code $robocopyExitCode)."
  }
}

Copy-Item -LiteralPath (Join-Path $repoRoot "index.html") -Destination (Join-Path $publishRoot "index.html") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "404.html") -Destination (Join-Path $publishRoot "404.html") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "favicon.ico") -Destination (Join-Path $publishRoot "favicon.ico") -Force

$redirectsPath = Join-Path $publishRoot "_redirects"
Set-Content -LiteralPath $redirectsPath -Value ($directRouteRedirects -join [Environment]::NewLine) -NoNewline

Write-Host "Built root-style publish artifact at $publishRoot"
