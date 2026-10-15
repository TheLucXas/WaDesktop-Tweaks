<#
 Builds dist\WaDesktop-Tweaks-vX.Y.Z.zip and dist\checksums.txt from the working tree.
 The version is read from extension\manifest.json. Run from the repository root:
   powershell -ExecutionPolicy Bypass -File tools\build-release.ps1
#>
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$ver = (Get-Content (Join-Path $root 'extension\manifest.json') -Raw | ConvertFrom-Json).version
$name = "WaDesktop-Tweaks-v$ver"
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist $name
if (Test-Path $dist) { Remove-Item -Recurse -Force $dist }
New-Item -ItemType Directory -Force -Path $stage | Out-Null
foreach ($item in 'extension', 'installer', 'docs', 'Install.cmd', 'Uninstall.cmd', 'README.md', 'README.es.md', 'LICENSE', 'CHANGELOG.md', 'SECURITY.md') {
    Copy-Item -Recurse -Force (Join-Path $root $item) $stage
}
$zip = Join-Path $dist "$name.zip"
Compress-Archive -Path $stage -DestinationPath $zip -CompressionLevel Optimal
$hash = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower()
"$hash  $name.zip" | Set-Content -Encoding ASCII (Join-Path $dist 'checksums.txt')
Remove-Item -Recurse -Force $stage
Write-Host "Built $zip"
Write-Host "SHA-256 $hash"
