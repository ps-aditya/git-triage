# DEMO ONLY — enables the harmless folder-open task.
# Run from the demo repository root:
#   pwsh ./enable-demo.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $root ".vscode\tasks.json.example"
$target = Join-Path $root ".vscode\tasks.json"
if (-not (Test-Path $source)) {
  Write-Error "Missing $source"
  exit 1
}
Copy-Item -Force $source $target
Write-Host "Created .vscode/tasks.json."
Write-Host "The payload is harmless, but the task runs on folder open. Run disable-demo.ps1 when done."
