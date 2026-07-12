$ErrorActionPreference = "Stop"

$javaCandidates = @(
  @(
    "$env:ProgramFiles\Android\Android Studio\jbr",
    "${env:ProgramFiles(x86)}\Android\Android Studio\jbr",
    "$env:LOCALAPPDATA\Programs\Android Studio\jbr",
    "$env:JAVA_HOME"
  ) | Where-Object {
    $_ -and $_.Length -gt 3 -and (Test-Path (Join-Path $_ "bin\java.exe"))
  }
)

if ($javaCandidates.Count -lt 1) {
  Write-Error "JDK not found. Install Android Studio or set JAVA_HOME to a JDK 17+ folder."
}

$env:JAVA_HOME = [string]$javaCandidates[0]
Write-Host "Using JAVA_HOME=$env:JAVA_HOME"
$rootDir = Join-Path $PSScriptRoot ".."
$androidDir = Join-Path $rootDir "android"
$releasesDir = Join-Path $rootDir "releases"
$publicDownloadsDir = Join-Path $rootDir "public\downloads"
$namedApk = Join-Path $releasesDir "ExamNexus Android App.apk"
$webApk = Join-Path $publicDownloadsDir "ExamNexus-Android.apk"

Push-Location $androidDir
try {
  & .\gradlew.bat assembleDebug
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $apk = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
  if (-not (Test-Path $apk)) {
    Write-Error "APK not found at $apk"
  }

  New-Item -ItemType Directory -Force -Path $releasesDir | Out-Null
  New-Item -ItemType Directory -Force -Path $publicDownloadsDir | Out-Null
  Copy-Item -Path $apk -Destination $namedApk -Force
  Copy-Item -Path $apk -Destination $webApk -Force

  Write-Host ""
  Write-Host "APK built:" -ForegroundColor Green
  Write-Host $apk
  Write-Host ""
  Write-Host "Named copy for install:" -ForegroundColor Green
  Write-Host $namedApk
  Write-Host ""
  Write-Host "Website download copy:" -ForegroundColor Green
  Write-Host $webApk
} finally {
  Pop-Location
}
