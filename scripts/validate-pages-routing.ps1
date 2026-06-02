param(
  [int]$Port = 8794
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$buildScript = Join-Path $PSScriptRoot "build-pages-artifact.ps1"
$runToken = Get-Date -Format "yyyyMMddHHmmssfff"
$stdoutLog = Join-Path $repoRoot "tmp\\wrangler-pages-validate-$runToken.out.log"
$stderrLog = Join-Path $repoRoot "tmp\\wrangler-pages-validate-$runToken.err.log"
$playwrightSession = "admin-pages-routing-validate"

if (-not (Test-Path -LiteralPath (Split-Path $stdoutLog -Parent))) {
  New-Item -ItemType Directory -Path (Split-Path $stdoutLog -Parent) | Out-Null
}

& $buildScript

$distFunctionPath = Join-Path $repoRoot "dist\\functions\\[[path]].js"
if (-not (Test-Path -LiteralPath $distFunctionPath)) {
  throw "Built artifact is missing dist/functions/[[path]].js. Pages SPA fallback would not ship."
}

$compatibilityDate = "2026-01-20"
$process = $null
$invokeWebRequestOptions = @{
  MaximumRedirection = 0
  ErrorAction = "Stop"
}

if ($PSVersionTable.PSVersion.Major -lt 6) {
  $invokeWebRequestOptions.UseBasicParsing = $true
}

function Invoke-RouteCheck {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [Parameter(Mandatory = $true)]
    [int]$ExpectedStatus,
    [switch]$RejectHtml
  )

  $response = $null
  $statusCode = $null

  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$Port$Path" @invokeWebRequestOptions
    $statusCode = $response.StatusCode
  } catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    if (-not $statusCode) {
      throw
    }
  }

  if ($statusCode -ne $ExpectedStatus) {
    throw "Route $Path returned $statusCode, expected $ExpectedStatus."
  }

  if ($RejectHtml -and $response -and $response.Content -match "<!DOCTYPE html>") {
    throw "Route $Path unexpectedly returned HTML."
  }
}

function Invoke-BrowserRouteValidation {
  $code = @'
async (page) => {
  const baseUrl = 'http://127.0.0.1:__PORT__';
  const emptyObject = {};
  const statusSummaryPayload = {
    page: { name: 'StreamSuites' },
    status: { indicator: 'none', description: 'All Systems Operational' }
  };
  const versionPayload = { version: '0.5.0-alpha', build: 'route-validation' };

  await page.context().route('**/api/admin/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyObject)
    });
  });
  await page.context().route('https://api.streamsuites.app/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(emptyObject)
    });
  });
  await page.context().route('**/runtime/exports/version.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(versionPayload)
    });
  });
  await page.context().route('https://v0hwlmly3pd2.statuspage.io/api/v2/summary.json', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statusSummaryPayload)
    });
  });

  const previewCheck = await page.goto(`${baseUrl}/overview`, { waitUntil: 'networkidle' });
  if (!previewCheck || previewCheck.status() !== 200) {
    throw new Error(`Preview boot returned ${previewCheck ? previewCheck.status() : 'no response'} for /overview.`);
  }
  await page.waitForTimeout(600);

  const previewState = await page.evaluate(() => ({
    pathname: window.location.pathname,
    currentView: window.App?.currentView || '',
    previewBanner: document.getElementById('admin-session-banner')?.textContent?.trim() || '',
    overlayTitle: document.querySelector('#admin-gate-screen .admin-gate-title')?.textContent?.trim() || '',
    bodyText: document.body?.textContent || ''
  }));

  if (previewState.pathname !== '/overview') {
    throw new Error(`Preview boot rewrote /overview to ${previewState.pathname}.`);
  }
  if (previewState.currentView !== 'overview') {
    throw new Error(`Preview boot resolved ${previewState.currentView} instead of overview.`);
  }
  if (/service unavailable/i.test(previewState.overlayTitle) || /service unavailable/i.test(previewState.bodyText)) {
    throw new Error('Preview boot fell into the generic Service Unavailable state.');
  }
  if (!/preview host booted in static preview mode/i.test(previewState.previewBanner)) {
    throw new Error(`Preview boot did not show the preview-host banner. Saw "${previewState.previewBanner}".`);
  }

  const cases = [
    {
      pathname: '/users/W3SGR3N',
      expectedView: 'user-detail',
      expectedPathname: '/users/W3SGR3N',
      expectedUserCode: 'W3SGR3N'
    },
    {
      pathname: '/profiles/integrations?user_code=UGHW8WQ',
      expectedView: 'creator-integrations',
      expectedPathname: '/profiles/integrations',
      expectedQuery: 'user_code=UGHW8WQ'
    },
    {
      pathname: '/permissions',
      expectedView: 'permissions',
      expectedPathname: '/permissions'
    },
    {
      pathname: '/integrations/discord',
      expectedView: 'discord',
      expectedPathname: '/integrations/discord'
    }
  ];

  for (const testCase of cases) {
    const response = await page.goto(`${baseUrl}${testCase.pathname}`, { waitUntil: 'networkidle' });
    if (!response || response.status() !== 200) {
      throw new Error(`Route ${testCase.pathname} returned ${response ? response.status() : 'no response'}, expected 200.`);
    }
    await page.waitForTimeout(600);

    const actual = await page.evaluate(() => ({
      pathname: window.location.pathname,
      currentView: window.App?.currentView || '',
      route: window.App?.currentRoute || null,
      title: document.title,
      bodyText: document.body?.textContent || ''
    }));

    if (actual.pathname !== testCase.expectedPathname) {
      throw new Error(`Requested ${testCase.pathname} ended on ${actual.pathname}, expected ${testCase.expectedPathname}.`);
    }
    if (actual.currentView !== testCase.expectedView) {
      throw new Error(`Requested ${testCase.pathname} resolved view ${actual.currentView}, expected ${testCase.expectedView}.`);
    }
    if (/service unavailable/i.test(actual.bodyText)) {
      throw new Error(`Requested ${testCase.pathname} fell into Service Unavailable.`);
    }
    if (testCase.expectedUserCode && actual.route?.params?.user_code !== testCase.expectedUserCode) {
      throw new Error(`Requested ${testCase.pathname} resolved user_code ${actual.route?.params?.user_code}, expected ${testCase.expectedUserCode}.`);
    }
    if (testCase.expectedQuery && actual.route?.queryString !== testCase.expectedQuery) {
      throw new Error(`Requested ${testCase.pathname} resolved query ${actual.route?.queryString}, expected ${testCase.expectedQuery}.`);
    }
  }

  const invalidResponse = await page.goto(`${baseUrl}/definitely-invalid-route`, {
    waitUntil: 'domcontentloaded'
  });
  await page.waitForTimeout(250);

  const invalidState = await page.evaluate(() => ({
    pathname: window.location.pathname,
    currentView: window.App?.currentView || '',
    title: document.title,
    heading:
      document.querySelector('main h1')?.textContent?.trim() ||
      document.querySelector('#view-container h2')?.textContent?.trim() ||
      '',
    bodyText: document.body?.textContent || ''
  }));

  if (!invalidResponse || invalidResponse.status() !== 404) {
    throw new Error(`Invalid route returned ${invalidResponse ? invalidResponse.status() : 'no response'}, expected 404.`);
  }
  if (invalidState.pathname !== '/definitely-invalid-route') {
    throw new Error(`Invalid route rewrote to ${invalidState.pathname} instead of preserving /definitely-invalid-route.`);
  }
  if (invalidState.currentView === 'overview' || /overview/i.test(invalidState.heading) || /overview/i.test(invalidState.title)) {
    throw new Error('Invalid route silently rendered the overview surface.');
  }

  return 'Admin browser route validation passed.';
}
'@

  $code = $code.Replace("__PORT__", [string]$Port)

  & npx.cmd --yes --package @playwright/cli playwright-cli --session $playwrightSession open about:blank | Out-Null
  & npx.cmd --yes --package @playwright/cli playwright-cli --session $playwrightSession run-code $code
  if ($LASTEXITCODE -ne 0) {
    throw "Admin browser route validation failed."
  }
}

function Invoke-RouteResolverValidation {
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
    location: new URL('http://streamsuites-dashboard.pages.dev/overview'),
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
const userDetail = routes.resolveViewFromPath('/users/W3SGR3N', '');
if (userDetail.view !== 'user-detail' || userDetail.params.user_code !== 'W3SGR3N') {
  throw new Error(`Admin user-detail route mismatch: ${JSON.stringify(userDetail)}`);
}

const integrations = routes.resolveViewFromPath('/profiles/integrations', '?user_code=UGHW8WQ');
if (integrations.view !== 'creator-integrations' || integrations.queryString !== 'user_code=UGHW8WQ') {
  throw new Error(`Admin creator-integrations route mismatch: ${JSON.stringify(integrations)}`);
}

const permissions = routes.resolveViewFromPath('/permissions', '');
if (permissions.view !== 'permissions') {
  throw new Error(`Admin permissions route mismatch: ${JSON.stringify(permissions)}`);
}

const discord = routes.resolveViewFromPath('/integrations/discord', '');
if (discord.view !== 'discord') {
  throw new Error(`Admin discord route mismatch: ${JSON.stringify(discord)}`);
}

sandbox.window.location = new URL('http://streamsuites-dashboard.pages.dev/definitely-invalid-route');
const unknown = routes.resolveLocation();
if (unknown.view !== '' || unknown.matched !== false) {
  throw new Error(`Admin unknown-route mismatch: ${JSON.stringify(unknown)}`);
}
'@

  $routeAudit | node -
  if ($LASTEXITCODE -ne 0) {
    throw "Admin route resolver validation failed."
  }
}

try {
  $process = Start-Process -FilePath "npx.cmd" -ArgumentList @(
    "wrangler",
    "pages",
    "dev",
    ".",
    "--port",
    $Port,
    "--compatibility-date",
    $compatibilityDate
  ) -WorkingDirectory (Join-Path $repoRoot "dist") -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog -PassThru

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
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

  Invoke-RouteCheck -Path "/overview" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/users/W3SGR3N" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/profiles/integrations?user_code=UGHW8WQ" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/integrations/discord" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/permissions" -ExpectedStatus 200
  Invoke-RouteCheck -Path "/definitely-invalid-route" -ExpectedStatus 404
  Invoke-RouteCheck -Path "/js/admin-routes.js" -ExpectedStatus 200 -RejectHtml

  Invoke-RouteResolverValidation
  Invoke-BrowserRouteValidation

  Write-Host "Dashboard Pages routing validation passed on port $Port."
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
  }
}
