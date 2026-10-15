# Shared helpers for install / uninstall / update.  Windows PowerShell 5.1 compatible.
$ErrorActionPreference = 'Stop'

$script:AppName    = 'WaDesktop-Tweaks'
$script:ExeName    = 'WhatsApp.Root.exe'
$script:ProtoName  = 'wadesktop-tweaks'  # legacy: only used to clean up old pre-release builds
$script:PolicyPath = 'Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments'
$script:InstallDir = Join-Path $env:LOCALAPPDATA $script:AppName

function Test-IsAdmin {
    $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-UserSid { return [Security.Principal.WindowsIdentity]::GetCurrent().User.Value }

# Re-launches the calling script elevated (UAC prompt) and passes the ORIGINAL user's SID, so registry
# changes still land in that user's hive even if a different admin account approves the prompt.
function Request-Elevation([string]$ScriptPath, [string]$ExtraArgs = '') {
    $sid = Get-UserSid
    $argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" -UserSid $sid $ExtraArgs"
    Start-Process -FilePath 'powershell.exe' -ArgumentList $argLine -Verb RunAs
}

function Get-HiveRoot([string]$Sid) { return "Registry::HKEY_USERS\$Sid" }

# Tokens this tool owns inside the WhatsApp WebView2 arguments string.
function Split-Args([string]$s) {
    if ([string]::IsNullOrWhiteSpace($s)) { return @() }
    # split on spaces that are not inside double quotes
    return [regex]::Matches($s, '(?:[^\s"]+|"[^"]*")+') | ForEach-Object { $_.Value }
}
function Remove-OwnTokens($tokens) {
    # patterns are deliberately loose: they also catch a malformed value where two tokens got glued together
    return @($tokens | Where-Object { $_ -notmatch '--load-extension=' -and $_ -notmatch '^--disable-features=DisableLoadExtensionCommandLineSwitch' })
}

function Get-PolicyValue([string]$Sid) {
    $k = Join-Path (Get-HiveRoot $Sid) $script:PolicyPath
    if (-not (Test-Path $k)) { return $null }
    return (Get-ItemProperty -Path $k -ErrorAction SilentlyContinue).$($script:ExeName)
}

function Set-PolicyValue([string]$Sid, [string]$Value) {
    $k = Join-Path (Get-HiveRoot $Sid) $script:PolicyPath
    if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
    if ([string]::IsNullOrWhiteSpace($Value)) { Remove-ItemProperty -Path $k -Name $script:ExeName -ErrorAction SilentlyContinue }
    else { Set-ItemProperty -Path $k -Name $script:ExeName -Value $Value }
}

function Stop-WhatsApp {
    Get-Process -Name 'WhatsApp.Root', 'WhatsApp' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

function Test-WhatsAppInstalled {
    try { return [bool](Get-AppxPackage -Name '*WhatsAppDesktop*' -ErrorAction Stop) } catch { return $false }
}

function Write-Step([string]$m)  { Write-Host "  > $m" -ForegroundColor Cyan }
function Write-Ok([string]$m)    { Write-Host "  OK  $m" -ForegroundColor Green }
function Write-Warn2([string]$m) { Write-Host "  !   $m" -ForegroundColor Yellow }
