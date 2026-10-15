#requires -Version 5.1
<#
 WaDesktop-Tweaks updater: downloads the latest GitHub release, verifies its SHA-256 against checksums.txt
 and replaces the installed extension files. No administrator rights needed (the policy path never changes).
#>
param([string]$Repo = 'TheLucXas/WaDesktop-Tweaks')
. (Join-Path $PSScriptRoot 'common.ps1')
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

try {
    Write-Host ''
    Write-Host "  === $($script:AppName) updater ===" -ForegroundColor White
    $installJson = Join-Path $script:InstallDir 'install.json'
    $current = if (Test-Path $installJson) { (Get-Content $installJson -Raw | ConvertFrom-Json).version } else { '0.0.0' }

    Write-Step 'Checking the latest release'
    $rel = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'WaDesktop-Tweaks-updater' }
    $latest = ($rel.tag_name -replace '^v', '')
    if ([version]$latest -le [version]$current) { Write-Ok "Already up to date (v$current)."; Read-Host '  Press Enter to close'; return }

    $zipAsset = $rel.assets | Where-Object { $_.name -like 'WaDesktop-Tweaks-*.zip' } | Select-Object -First 1
    $sumAsset = $rel.assets | Where-Object { $_.name -eq 'checksums.txt' } | Select-Object -First 1
    if (-not $zipAsset -or -not $sumAsset) { throw 'The release is missing the zip or checksums.txt asset.' }

    $tmp = Join-Path $env:TEMP ("wadt-update-" + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    $zip = Join-Path $tmp $zipAsset.name
    Write-Step "Downloading v$latest"
    Invoke-WebRequest -Uri $zipAsset.browser_download_url -OutFile $zip -UseBasicParsing
    $sumFile = Join-Path $tmp 'checksums.txt'
    Invoke-WebRequest -Uri $sumAsset.browser_download_url -OutFile $sumFile -UseBasicParsing

    Write-Step 'Verifying SHA-256'
    $want = (Get-Content $sumFile | Where-Object { $_ -match [regex]::Escape($zipAsset.name) } | Select-Object -First 1) -split '\s+' | Select-Object -First 1
    $got = (Get-FileHash -Algorithm SHA256 $zip).Hash.ToLower()
    if (-not $want -or $want.ToLower() -ne $got) { throw "Checksum mismatch. Expected $want but got $got. Update aborted." }
    Write-Ok 'Checksum OK'

    Write-Step 'Installing'
    $ex = Join-Path $tmp 'x'
    Expand-Archive -Path $zip -DestinationPath $ex -Force
    $root = Get-ChildItem $ex -Directory | Select-Object -First 1
    if (-not $root) { $root = Get-Item $ex }
    $srcExt = Join-Path $root.FullName 'extension'
    if (-not (Test-Path (Join-Path $srcExt 'manifest.json'))) { throw 'Unexpected release layout.' }
    $dstExt = Join-Path $script:InstallDir 'extension'
    $dstInst = Join-Path $script:InstallDir 'installer'
    foreach ($d in @($dstExt)) { if (Test-Path $d) { Remove-Item -Recurse -Force $d } }
    Copy-Item -Recurse -Force $srcExt $dstExt
    $srcInst = Join-Path $root.FullName 'installer'
    if (Test-Path $srcInst) { Copy-Item -Recurse -Force (Join-Path $srcInst '*') $dstInst }
    @{ version = $latest; installedAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -Encoding UTF8 $installJson
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
    Write-Host ''
    Write-Ok "Updated to v$latest. Close and reopen WhatsApp Desktop."
}
catch { Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red }
Write-Host ''
Read-Host '  Press Enter to close'
