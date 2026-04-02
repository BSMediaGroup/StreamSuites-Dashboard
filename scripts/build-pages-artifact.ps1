param(
  [string]$OutputDir = "dist"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$docsRoot = Join-Path $repoRoot "docs"
$functionsRoot = Join-Path $repoRoot "functions"
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
  "/auth                  /auth/login.html         302"
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

if (Test-Path -LiteralPath $functionsRoot) {
  $publishFunctionsRoot = Join-Path $publishRoot "functions"
  Mirror-Directory -Source $functionsRoot -Destination $publishFunctionsRoot
}

Copy-Item -LiteralPath (Join-Path $repoRoot "index.html") -Destination (Join-Path $publishRoot "index.html") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "404.html") -Destination (Join-Path $publishRoot "404.html") -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "favicon.ico") -Destination (Join-Path $publishRoot "favicon.ico") -Force

$redirectsPath = Join-Path $publishRoot "_redirects"
Set-Content -LiteralPath $redirectsPath -Value ($directRouteRedirects -join [Environment]::NewLine) -NoNewline

Write-Host "Built root-style publish artifact at $publishRoot"
