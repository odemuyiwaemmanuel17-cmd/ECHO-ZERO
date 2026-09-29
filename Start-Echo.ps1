$ErrorActionPreference = 'Stop'
$previewUrl = 'http://127.0.0.1:5173/'
$projectPath = $PSScriptRoot
try {
    $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2
    if ($response.Content -match '<title>ECHO//ZERO</title>') {
        Write-Host "ECHO//ZERO is already running: $previewUrl"
        exit 0
    }
    throw 'Port 5173 belongs to another application.'
} catch {
    if ($_.Exception.Message -eq 'Port 5173 belongs to another application.') { throw }
}
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$nodePath = if ($nodeCommand) { $nodeCommand.Source } else {
    Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}
if (!(Test-Path -LiteralPath $nodePath)) { throw 'Node.js is required to start ECHO//ZERO.' }
if (!(Test-Path -LiteralPath (Join-Path $projectPath 'node_modules\vite\bin\vite.js'))) {
    throw 'Dependencies are missing. Run npm install in the ECHO folder first.'
}
$previewProcess = Start-Process -FilePath $nodePath -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort' -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectPath 'preview.stdout.log') -RedirectStandardError (Join-Path $projectPath 'preview.stderr.log') -PassThru
for ($attempt=0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
        $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 2
        if ($response.Content -match '<title>ECHO//ZERO</title>') {
            Write-Host "ECHO//ZERO is ready: $previewUrl (process $($previewProcess.Id))"
            exit 0
        }
    } catch { }
    if ($previewProcess.HasExited) { break }
}
throw 'Preview failed to start. See preview.stderr.log in the ECHO folder.'
