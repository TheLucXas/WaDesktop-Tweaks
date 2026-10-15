#requires -Version 5.1
<# WaDesktop-Tweaks uninstaller: removes the WebView2 arguments it added, the link handler and the installed files.
   Your WhatsApp chats/account are not touched. Settings stored inside WhatsApp's browser profile remain until cleared. #>
param([string]$UserSid = '', [switch]$Silent)
. (Join-Path $PSScriptRoot 'common.ps1')

if (-not (Test-IsAdmin)) {
    Request-Elevation $MyInvocation.MyCommand.Path ($(if ($Silent) { '-Silent' } else { '' }))
    return
}
if (-not $UserSid) { $UserSid = Get-UserSid }
Set-InstallDirForUser $UserSid

try {
    Write-Host ''
    Write-Host "  === $($script:AppName) uninstaller ===" -ForegroundColor White
    Write-Step 'Closing WhatsApp (if open)'
    Stop-WhatsApp

    Write-Step 'Removing the WebView2 startup arguments added by this tool'
    $existing = Get-PolicyValue $UserSid
    $left = @(Remove-OwnTokens (Split-Args $existing))
    Set-PolicyValue $UserSid ($left -join ' ')
    # remove the (now empty) policy key if nothing else lives there
    $k = Join-Path (Get-HiveRoot $UserSid) $script:PolicyPath
    if (Test-Path $k) { $props = (Get-Item $k).GetValueNames(); if (-not $props -or $props.Count -eq 0) { Remove-Item $k -Force -ErrorAction SilentlyContinue } }

    Write-Step 'Removing Start Menu shortcuts'
    $menuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\WaDesktop-Tweaks'
    try {
        $shell = (Get-ItemProperty -Path (Join-Path (Get-HiveRoot $UserSid) 'Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders') -ErrorAction Stop).Programs
        if ($shell) { $menuDir = Join-Path ([Environment]::ExpandEnvironmentVariables($shell)) 'WaDesktop-Tweaks' }
    } catch { }
    if (Test-Path $menuDir) { Remove-Item -Recurse -Force $menuDir -ErrorAction SilentlyContinue }
    # leftovers from pre-release builds that registered a link handler
    $cls = Join-Path (Get-HiveRoot $UserSid) "Software\Classes\$($script:ProtoName)"
    if (Test-Path $cls) { Remove-Item -Recurse -Force $cls -ErrorAction SilentlyContinue }

    Write-Step 'Deleting installed files'
    # this script may be running from inside the install dir: copy-free approach, delete via a detached cmd
    foreach ($dir in @($script:InstallDir, (Get-LegacyInstallDir $UserSid))) {
        if (Test-Path $dir) {
            Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList "/c timeout /t 3 /nobreak >nul & rmdir /s /q `"$dir`""
        }
    }
    Write-Host ''
    Write-Ok 'WaDesktop-Tweaks was removed. Reopen WhatsApp Desktop.'
}
catch { Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red }
if (-not $Silent) { Write-Host ''; Read-Host '  Press Enter to close' }
