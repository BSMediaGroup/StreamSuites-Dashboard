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

function Clear-DirectoryContents {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
    return
  }

  Get-ChildItem -LiteralPath $Path -Force | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force
  }
}

function Mirror-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [Parameter(Mandatory = $true)]
    [string]$Destination,
    [string[]]$ExcludeFilePatterns = @()
  )

  $robocopyCommand = Get-Command robocopy -ErrorAction SilentlyContinue
  if ($robocopyCommand) {
    $args = @($Source, $Destination, "/E", "/NFL", "/NDL", "/NJH", "/NJS", "/NP", "/R:2", "/W:1")
    if ($ExcludeFilePatterns.Count -gt 0) {
      $args += "/XF"
      $args += $ExcludeFilePatterns
    }
    & $robocopyCommand.Source @args | Out-Null
    $robocopyExitCode = $LASTEXITCODE
    if ($robocopyExitCode -gt 7) {
      throw "robocopy failed while staging $Source into $Destination (exit code $robocopyExitCode)."
    }
    return
  }

  Clear-DirectoryContents -Path $Destination

  Get-ChildItem -LiteralPath $Source -Force | ForEach-Object {
    foreach ($pattern in $ExcludeFilePatterns) {
      if (-not $_.PSIsContainer -and $_.Name -like $pattern) {
        return
      }
    }

    if ($_.PSIsContainer) {
      Copy-Item -LiteralPath $_.FullName -Destination $Destination -Recurse -Force
    } else {
      Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $Destination $_.Name) -Force
    }
  }
}

$directRouteRedirects = @(
  "/auth                  /auth/login.html         302",
  "/home                  /index.html              200",
  "/overview              /index.html              200",
  "/users                 /index.html              200",
  "/users/:user_code      /index.html              200",
  "/accounts              /index.html              200",
  "/profiles              /index.html              200",
  "/profiles/integrations /index.html              200",
  "/profiles/stats        /index.html              200",
  "/creators              /index.html              200",
  "/creator-integrations  /index.html              200",
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
  "/permissions           /index.html              200",
  "/updates               /index.html              200",
  "/design                /index.html              200",
  "/integrations/triggers /index.html              200",
  "/integrations/rumble   /index.html              200",
  "/integrations/youtube  /index.html              200",
  "/integrations/twitch   /index.html              200",
  "/integrations/kick     /index.html              200",
  "/integrations/pilled   /index.html              200",
  "/integrations/twitter  /index.html              200",
  "/integrations/discord  /index.html              200",
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
  Clear-DirectoryContents -Path $publishRoot
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
  Mirror-Directory -Source $sourceDir -Destination $destinationDir -ExcludeFilePatterns @("tmp*")
}

Copy-Item -LiteralPath (Join-Path $repoRoot "index.html") -Destination (Join-Path $publishRoot "index.html") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "404.html") -Destination (Join-Path $publishRoot "404.html") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "favicon.ico") -Destination (Join-Path $publishRoot "favicon.ico") -Force

$redirectsPath = Join-Path $publishRoot "_redirects"
Set-Content -LiteralPath $redirectsPath -Value ($directRouteRedirects -join [Environment]::NewLine) -NoNewline

Write-Host "Built root-style publish artifact at $publishRoot"
