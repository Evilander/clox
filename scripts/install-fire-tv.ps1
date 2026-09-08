[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Device,
    [string]$ApkPath,
    [string]$SdkRoot,
    [switch]$Launch
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
if (-not $ApkPath) {
    $ApkPath = Join-Path $repoRoot "android\app\build\outputs\apk\release\clox-fire-tv-release.apk"
}
if (-not (Test-Path -LiteralPath $ApkPath)) {
    throw "APK was not found at $ApkPath. Run scripts\build-apk.ps1 first."
}

$candidates = @()
if ($SdkRoot) { $candidates += $SdkRoot }
if ($env:ANDROID_HOME) { $candidates += $env:ANDROID_HOME }
if ($env:ANDROID_SDK_ROOT) { $candidates += $env:ANDROID_SDK_ROOT }
$candidates += "B:\Android\Sdk"
$candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk")

$adb = $null
foreach ($candidate in $candidates | Select-Object -Unique) {
    $path = Join-Path $candidate "platform-tools\adb.exe"
    if (Test-Path -LiteralPath $path) {
        $adb = $path
        break
    }
}
if (-not $adb) {
    throw "adb.exe was not found. Pass -SdkRoot with an Android SDK path."
}

& $adb start-server | Out-Null
$devicesBefore = & $adb devices
if (-not ($devicesBefore -match [regex]::Escape($Device))) {
    & $adb connect $Device | Out-Null
}

$devicesAfter = & $adb devices
$deviceLine = $devicesAfter | Where-Object { $_ -match "^$([regex]::Escape($Device))\s+device$" }
if (-not $deviceLine) {
    throw "Device $Device is not connected and authorized."
}

& $adb -s $Device install -r $ApkPath
if ($LASTEXITCODE -ne 0) {
    throw "adb install failed for $Device."
}

if ($Launch) {
    $launchOutput = & $adb -s $Device shell am start -W -n io.github.evilander.clox/.MainActivity
    if ($LASTEXITCODE -ne 0 -or -not ($launchOutput -match 'Status: ok')) {
        throw "Installed APK, but launch failed."
    }
    $launchOutput
}
