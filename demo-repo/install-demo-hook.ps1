# DEMO ONLY — installs a harmless post-checkout hook.
# Run this from the demo repository root:
#   pwsh ./install-demo-hook.ps1
$hookDir = Join-Path (Get-Location) ".git\hooks"
New-Item -ItemType Directory -Force -Path $hookDir | Out-Null
Copy-Item -Force ".git-hooks\post-checkout" (Join-Path $hookDir "post-checkout")
Write-Host "Installed demo hook at .git/hooks/post-checkout"
