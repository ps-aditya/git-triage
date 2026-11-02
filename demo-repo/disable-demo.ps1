# DEMO ONLY — removes the folder-open task.
# Run from the demo repository root:
#   pwsh ./disable-demo.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $root ".vscode\tasks.json"
if (Test-Path $target) {
  Remove-Item -Force $target
  Write-Host "Removed .vscode/tasks.json."
} else {
  Write-Host "No .vscode/tasks.json to remove."
}
