#requires -Version 5.1
<#
 WaDesktop-Tweaks installer.
 - Copies the extension to %LOCALAPPDATA%\WaDesktop-Tweaks\extension
 - Adds two WebView2 startup arguments for WhatsApp Desktop (needs administrator once: it writes under
   HKCU\Software\Policies, which Windows protects)
 - Creates Start Menu shortcuts for Update and Uninstall
 It does NOT modify WhatsApp's own files and needs no open debugging port.
#>
param([string]$UserSid = '', [switch]$Elevated)
. (Join-Path $PSScriptRoot 'common.ps1')

if (-not (Test-IsAdmin)) {
    Write-Host ''
    Write-Host '  WaDesktop-Tweaks needs administrator permission once, to set a protected Windows policy' -ForegroundColor Yellow
    Write-Host '  that tells WhatsApp Desktop to load the extension. Accept the Windows prompt.' -ForegroundColor Yellow
    Request-Elevation $MyInvocation.MyCommand.Path
    return
}
if (-not $UserSid) { $UserSid = Get-UserSid }

try {
    Write-Host ''
    Write-Host "  === $($script:AppName) installer ===" -ForegroundColor White
    $repoRoot = Split-Path $PSScriptRoot -Parent
    $srcExt = Join-Path $repoRoot 'extension'
    if (-not (Test-Path (Join-Path $srcExt 'manifest.json'))) { throw "Extension folder not found next to the installer ($srcExt)." }

    if (-not (Test-WhatsAppInstalled)) {
        Write-Warn2 'WhatsApp Desktop (Microsoft Store version) was not found for this user. Install it first.'
        Write-Warn2 'Continuing anyway: the settings will apply as soon as it is installed.'
    }

    Write-Step 'Closing WhatsApp (if open)'
    Stop-WhatsApp

    Write-Step "Copying files to $($script:InstallDir)"
    $dstExt = Join-Path $script:InstallDir 'extension'
    $dstInst = Join-Path $script:InstallDir 'installer'
    New-Item -ItemType Directory -Force -Path $script:InstallDir | Out-Null
    foreach ($d in @($dstExt, $dstInst)) { if (Test-Path $d) { Remove-Item -Recurse -Force $d } }
    Copy-Item -Recurse -Force $srcExt $dstExt
    Copy-Item -Recurse -Force $PSScriptRoot $dstInst
    foreach ($f in 'LICENSE', 'README.md', 'README.es.md') { $p = Join-Path $repoRoot $f; if (Test-Path $p) { Copy-Item -Force $p $script:InstallDir } }
    $ver = (Get-Content (Join-Path $dstExt 'manifest.json') -Raw | ConvertFrom-Json).version
    @{ version = $ver; installedAt = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $script:InstallDir 'install.json')

    Write-Step 'Setting the WebView2 startup arguments for WhatsApp Desktop'
    $existing = Get-PolicyValue $UserSid
    # @() matters: an empty result would otherwise collapse to $null and the two += below would glue
    # the new tokens together as one string with no space between them.
    $tokens = @(Remove-OwnTokens (Split-Args $existing))
    $tokens += '--disable-features=DisableLoadExtensionCommandLineSwitch'
    $tokens += ('--load-extension="' + $dstExt + '"')   # quoted: the path may contain spaces
    Set-PolicyValue $UserSid ($tokens -join ' ')
    $check = @(Split-Args (Get-PolicyValue $UserSid))
    if (-not ($check -contains '--disable-features=DisableLoadExtensionCommandLineSwitch') -or
        -not ($check | Where-Object { $_ -like '--load-extension=*' })) {
        throw "The startup arguments were not stored correctly: $(Get-PolicyValue $UserSid)"
    }

    Write-Step 'Creating Start Menu shortcuts (Update / Uninstall)'
    $menuDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\WaDesktop-Tweaks'
    # the elevated process may belong to another account: resolve the original user's Start Menu from the registry
    try {
        $shell = (Get-ItemProperty -Path (Join-Path (Get-HiveRoot $UserSid) 'Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders') -ErrorAction Stop).Programs
        if ($shell) { $menuDir = Join-Path ([Environment]::ExpandEnvironmentVariables($shell)) 'WaDesktop-Tweaks' }
    } catch { }
    New-Item -ItemType Directory -Force -Path $menuDir | Out-Null
    $ws = New-Object -ComObject WScript.Shell
    foreach ($item in @(@('WaDesktop-Tweaks Update', 'update.ps1'), @('WaDesktop-Tweaks Uninstall', 'uninstall.ps1'))) {
        $lnk = $ws.CreateShortcut((Join-Path $menuDir ($item[0] + '.lnk')))
        $lnk.TargetPath = 'powershell.exe'
        $lnk.Arguments = '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $dstInst $item[1]) + '"'
        $lnk.WorkingDirectory = $script:InstallDir
        $lnk.Save()
    }

    Write-Host ''
    Write-Ok "Installed v$ver."
    Write-Host '  Open WhatsApp Desktop. A gear (settings) button appears next to the chat-list menu.' -ForegroundColor White
    Write-Host '  To remove: Start Menu > "WaDesktop-Tweaks Uninstall" (or the Uninstall button in the settings panel).' -ForegroundColor White
}
catch {
    Write-Host ''
    Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ''
Read-Host '  Press Enter to close'
