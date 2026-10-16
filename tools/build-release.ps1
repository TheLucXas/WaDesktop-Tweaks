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
# Entries are written by hand with "/" separators: Windows PowerShell 5.1 (Compress-Archive and ZipFile alike)
# writes "\" in entry names, which the zip format does not allow; other platforms would extract files with a
# literal backslash in their name.
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$fs = [IO.File]::Open($zip, [IO.FileMode]::Create)
$za = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
Get-ChildItem $stage -Recurse -File | ForEach-Object {
    $entryName = $_.FullName.Substring($dist.Length + 1).Replace('\', '/')
    $entry = $za.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
    $entry.LastWriteTime = $_.LastWriteTime
    $out = $entry.Open(); $in = [IO.File]::OpenRead($_.FullName)
    try { $in.CopyTo($out) } finally { $in.Close(); $out.Close() }
}
$za.Dispose(); $fs.Close()
$hash = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower()
"$hash  $name.zip" | Set-Content -Encoding ASCII (Join-Path $dist 'checksums.txt')
Remove-Item -Recurse -Force $stage
Write-Host "Built $zip"
Write-Host "SHA-256 $hash"
