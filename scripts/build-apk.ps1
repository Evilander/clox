[CmdletBinding()]
param(
    [string]$SdkRoot,
    [string]$GradleVersion = "8.10.2",
    [switch]$Clean,
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$androidDir = Join-Path $repoRoot "android"
$expectedJavaHome = "C:\Program Files\Microsoft\jdk-17.0.18.8-hotspot"

function Set-CloxPath {
    $entries = $env:Path -split ";" |
        ForEach-Object { $_.Trim('"') } |
        Where-Object { $_ -ne "" } |
        Select-Object -Unique
    $env:Path = $entries -join ";"
}

function Resolve-CloxSdkRoot {
    param([string]$RequestedRoot)

    $candidates = @()
    if ($RequestedRoot) { $candidates += $RequestedRoot }
    if ($env:ANDROID_HOME) { $candidates += $env:ANDROID_HOME }
    if ($env:ANDROID_SDK_ROOT) { $candidates += $env:ANDROID_SDK_ROOT }
    $candidates += "B:\Android\Sdk"
    $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk")

    foreach ($candidate in $candidates | Select-Object -Unique) {
        if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate "platforms\android-35\android.jar"))) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }

    throw "Android SDK with platform android-35 was not found. Pass -SdkRoot or install it with Android SDK Manager."
}

function Ensure-Gradle {
    param([string]$Version)

    $cacheDir = Join-Path $androidDir ".gradle\bootstrap"
    $distDir = Join-Path $cacheDir "gradle-$Version"
    $gradleBat = Join-Path $distDir "bin\gradle.bat"
    $zipPath = Join-Path $cacheDir "gradle-$Version-bin.zip"
    $shaPath = Join-Path $cacheDir "gradle-$Version-bin.zip.sha256"
    New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

    if (-not (Test-Path -LiteralPath $shaPath)) {
        Invoke-WebRequest -Uri "https://services.gradle.org/distributions/gradle-$Version-bin.zip.sha256" -OutFile $shaPath
    }
    $expectedHash = ((Get-Content -LiteralPath $shaPath -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
    if ($expectedHash -notmatch "^[0-9a-f]{64}$") {
        throw "Gradle SHA-256 file at $shaPath is not valid."
    }
    if (-not (Test-Path -LiteralPath $zipPath)) {
        Invoke-WebRequest -Uri "https://services.gradle.org/distributions/gradle-$Version-bin.zip" -OutFile $zipPath
    }
    $actualHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $expectedHash) {
        throw "Gradle distribution hash mismatch for $zipPath."
    }

    if (Test-Path -LiteralPath $gradleBat) {
        return $gradleBat
    }

    Expand-Archive -LiteralPath $zipPath -DestinationPath $cacheDir -Force
    if (-not (Test-Path -LiteralPath $gradleBat)) {
        throw "Gradle $Version did not unpack correctly."
    }
    return $gradleBat
}

function New-CloxSecret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $rng.GetBytes($bytes)
    } finally {
        $rng.Dispose()
    }
    return [Convert]::ToBase64String($bytes)
}

function Read-CloxProperties {
    param([string]$Path)

    $result = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $result
    }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line.Trim() -eq "" -or $line.TrimStart().StartsWith("#")) {
            continue
        }
        $parts = $line.Split("=", 2)
        if ($parts.Count -eq 2) {
            $result[$parts[0]] = $parts[1]
        }
    }
    return $result
}

function Ensure-CloxSigning {
    $signingDir = Join-Path $env:LOCALAPPDATA "Clox\android-signing"
    $propertiesPath = Join-Path $signingDir "release-signing.properties"
    New-Item -ItemType Directory -Force -Path $signingDir | Out-Null

    $hasPropertiesFile = Test-Path -LiteralPath $propertiesPath
    $properties = Read-CloxProperties $propertiesPath
    $hasCompleteProperties = $properties.storeFile -and
        $properties.storePassword -and
        $properties.keyAlias -and
        $properties.keyPassword
    if ($hasCompleteProperties) {
        if (Test-Path -LiteralPath $properties.storeFile) {
            return $properties
        }
        throw "Signing properties reference a missing keystore: $($properties.storeFile). Restore that file or move $propertiesPath aside and choose a new signing identity deliberately."
    }
    if ($hasPropertiesFile) {
        throw "Signing properties are incomplete at $propertiesPath. Restore the missing fields or move both that file and the intended keystore aside deliberately."
    }

    $keytool = Join-Path $env:JAVA_HOME "bin\keytool.exe"
    if (-not (Test-Path -LiteralPath $keytool)) {
        throw "keytool.exe was not found under JAVA_HOME."
    }

    $keystorePath = Join-Path $signingDir "clox-release.jks"
    if (Test-Path -LiteralPath $keystorePath) {
        throw "A Clox release keystore already exists at $keystorePath, but $propertiesPath is missing or incomplete. Refusing to rekey; restore the properties file or move the keystore aside deliberately."
    }

    $password = New-CloxSecret
    $alias = "clox-release"

    & $keytool -genkeypair `
        -keystore $keystorePath `
        -storepass $password `
        -keypass $password `
        -alias $alias `
        -keyalg RSA `
        -keysize 4096 `
        -validity 10000 `
        -dname "CN=Clox Local, OU=Clox, O=Evilander, L=Local, S=Illinois, C=US" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "keytool failed to create the Clox release keystore."
    }

    $content = @(
        "storeFile=$keystorePath",
        "storePassword=$password",
        "keyAlias=$alias",
        "keyPassword=$password"
    )
    Set-Content -LiteralPath $propertiesPath -Value $content -Encoding UTF8
    return Read-CloxProperties $propertiesPath
}

function Get-CloxBuildTools {
    param([string]$Root)

    $toolDir = Get-ChildItem -LiteralPath (Join-Path $Root "build-tools") -Directory |
        Sort-Object Name -Descending |
        Select-Object -First 1
    if (-not $toolDir) {
        throw "No Android build-tools directory was found under $Root."
    }
    return $toolDir.FullName
}

function Remove-CloxUnsignedMetadata {
    param([string]$ApkPath)

    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::Open($ApkPath, [System.IO.Compression.ZipArchiveMode]::Update)
    try {
        foreach ($entryName in @(
            "META-INF/com/android/build/gradle/app-metadata.properties",
            "META-INF/version-control-info.textproto"
        )) {
            $entry = $archive.GetEntry($entryName)
            if ($entry) {
                $entry.Delete()
            }
        }
    } finally {
        $archive.Dispose()
    }
}

Set-CloxPath
if (Test-Path -LiteralPath $expectedJavaHome) {
    $env:JAVA_HOME = $expectedJavaHome
}
if (-not $env:JAVA_HOME) {
    throw "JAVA_HOME is not set and the expected Java 17 install was not found."
}

$sdk = Resolve-CloxSdkRoot $SdkRoot
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
Set-Content -LiteralPath (Join-Path $androidDir "local.properties") -Value "sdk.dir=$($sdk.Replace('\', '/'))" -Encoding ASCII

$signing = Ensure-CloxSigning
$env:CLOX_ANDROID_KEYSTORE = $signing.storeFile
$env:CLOX_ANDROID_KEYSTORE_PASSWORD = $signing.storePassword
$env:CLOX_ANDROID_KEY_ALIAS = $signing.keyAlias
$env:CLOX_ANDROID_KEY_PASSWORD = $signing.keyPassword

$gradle = Ensure-Gradle $GradleVersion
$tasks = @()
if ($Clean) { $tasks += "clean" }
if (-not $SkipTests) { $tasks += "testDebugUnitTest" }
$tasks += "assembleRelease"

& $gradle -p $androidDir @tasks --no-daemon --max-workers=1
if ($LASTEXITCODE -ne 0) {
    throw "Gradle build failed."
}

$unsignedApk = Join-Path $androidDir "app\build\outputs\apk\release\app-release-unsigned.apk"
$legacySignedApk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
$finalApk = Join-Path $androidDir "app\build\outputs\apk\release\clox-fire-tv-release.apk"

$buildTools = Get-CloxBuildTools $sdk
$apksigner = Join-Path $buildTools "apksigner.bat"
$zipalign = Join-Path $buildTools "zipalign.exe"
$aapt = Join-Path $buildTools "aapt.exe"
if (-not (Test-Path -LiteralPath $apksigner)) {
    throw "apksigner.bat was not found in $buildTools."
}
if (-not (Test-Path -LiteralPath $zipalign)) {
    throw "zipalign.exe was not found in $buildTools."
}

if (-not (Test-Path -LiteralPath $unsignedApk)) {
    if (Test-Path -LiteralPath $legacySignedApk) {
        throw "Gradle produced a signed release APK at $legacySignedApk, but this script expects an unsigned APK so it can strip metadata before signing."
    }
    throw "Unsigned release APK was not found at $unsignedApk."
}

$cleanUnsignedApk = Join-Path $androidDir "app\build\outputs\apk\release\clox-fire-tv-release-unsigned-clean.apk"
$alignedUnsignedApk = Join-Path $androidDir "app\build\outputs\apk\release\clox-fire-tv-release-unsigned-aligned.apk"
Copy-Item -LiteralPath $unsignedApk -Destination $cleanUnsignedApk -Force
Remove-CloxUnsignedMetadata $cleanUnsignedApk

& $zipalign -p -f 4 $cleanUnsignedApk $alignedUnsignedApk
if ($LASTEXITCODE -ne 0) {
    throw "zipalign failed."
}

if (Test-Path -LiteralPath $finalApk) {
    Remove-Item -LiteralPath $finalApk -Force
}
& $apksigner sign `
    --ks $signing.storeFile `
    --ks-key-alias $signing.keyAlias `
    --ks-pass env:CLOX_ANDROID_KEYSTORE_PASSWORD `
    --key-pass env:CLOX_ANDROID_KEY_PASSWORD `
    --v1-signing-enabled true `
    --v2-signing-enabled true `
    --v3-signing-enabled true `
    --out $finalApk `
    $alignedUnsignedApk
if ($LASTEXITCODE -ne 0) {
    throw "APK signing failed."
}

& $apksigner verify --verbose --print-certs $finalApk
if ($LASTEXITCODE -ne 0) {
    throw "APK signature verification failed."
}

if (Test-Path -LiteralPath $aapt) {
    & $aapt dump badging $finalApk
    if ($LASTEXITCODE -ne 0) {
        throw "APK badging inspection failed."
    }
}

Write-Host "APK: $finalApk"
Write-Host "Signing key: $($signing.storeFile)"
