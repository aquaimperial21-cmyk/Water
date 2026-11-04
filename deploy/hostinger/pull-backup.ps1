# Copies the newest SmartRO database backup from the VPS to this PC.
# Task Scheduler runs it every day ("SmartRO backup download"); you can also
# run it by hand. It only reads from the server: it lists the backups folder
# and downloads one file. Each run adds one line to pull-backup.log.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File deploy\hostinger\pull-backup.ps1

param(
    # Default: the backups\ folder at the repo root (gitignored).
    [string]$BackupDir = (Join-Path $PSScriptRoot '..\..\backups'),
    [string]$Server = 'root@187.127.176.28',
    [int]$KeepDays = 30
)

$remoteDir = '/opt/smartro/backups'
$ssh = "$env:WINDIR\System32\OpenSSH\ssh.exe"
$scp = "$env:WINDIR\System32\OpenSSH\scp.exe"
$pgRestore = 'C:\Program Files\PostgreSQL\18\bin\pg_restore.exe'
$sshOpts = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=30')

$BackupDir = [IO.Path]::GetFullPath($BackupDir)
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
# The dumps hold customer data and the repo is public: this file makes git
# ignore the whole folder, whatever branch is checked out.
$selfIgnore = Join-Path $BackupDir '.gitignore'
if (-not (Test-Path $selfIgnore)) { Set-Content -Path $selfIgnore -Value '*' -Encoding Ascii }

$log = Join-Path $BackupDir 'pull-backup.log'
$name = '-'
$size = 0
$inv = [Globalization.CultureInfo]::InvariantCulture   # same date format on any PC

function Write-Log([string]$result) {
    $line = '{0}  {1}  {2} bytes  {3}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss', $inv), $name, $size, $result
    Add-Content -Path $log -Value $line -Encoding UTF8
    Write-Output $line
}

function Stop-Run([string]$reason) {
    Write-Log "FAILED: $reason"
    exit 1
}

# 1. Ask the server for its dumps as "size:path" lines; the newest name sorts last.
$out = & $ssh @sshOpts $Server "stat -c %s:%n $remoteDir/daily-*.dump" 2>&1 | ForEach-Object { "$_" }
if ($LASTEXITCODE -ne 0) { Stop-Run "could not list $remoteDir on $Server ($(($out | Select-Object -Last 1)))" }
$newest = $out | Where-Object { $_ -match '^\d+:/.*/daily-\d{8}\.dump$' } | Sort-Object | Select-Object -Last 1
if (-not $newest) { Stop-Run "no daily-*.dump files on the server" }
$remoteSize = [long]($newest.Split(':')[0])
$remotePath = $newest.Substring($newest.IndexOf(':') + 1)
$name = Split-Path $remotePath -Leaf
$size = $remoteSize

$target = Join-Path $BackupDir $name
$part = "$target.part"

# 2. Download it, unless we already have the same file.
if ((Test-Path $target) -and ((Get-Item $target).Length -eq $remoteSize)) {
    $result = 'OK (already here, skipped download)'
} else {
    Remove-Item $part -Force -ErrorAction SilentlyContinue
    $out = & $scp -q -B -o ConnectTimeout=30 "${Server}:$remotePath" $part 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) {
        Remove-Item $part -Force -ErrorAction SilentlyContinue
        Stop-Run "download failed ($(($out | Select-Object -Last 1)))"
    }

    # 3. Check the copy before keeping it: full size, and pg_restore can read it.
    $got = 0
    if (Test-Path $part) { $got = (Get-Item $part).Length }
    if ($got -eq 0 -or $got -ne $remoteSize) {
        Remove-Item $part -Force -ErrorAction SilentlyContinue
        Stop-Run "downloaded $got bytes, server has $remoteSize"
    }
    $check = 'pg_restore not found, list check skipped'
    if (Test-Path $pgRestore) {
        & $pgRestore --list $part *> $null
        if ($LASTEXITCODE -ne 0) {
            Remove-Item $part -Force -ErrorAction SilentlyContinue
            Stop-Run 'pg_restore --list could not read the file'
        }
        $check = 'pg_restore --list passed'
    }
    Move-Item -Path $part -Destination $target -Force
    $result = "OK (downloaded, $check)"
}

# 4. Delete local dumps older than $KeepDays days (by the date in the file name).
$cutoff = (Get-Date).Date.AddDays(-$KeepDays).ToString('yyyyMMdd', $inv)
$old = Get-ChildItem -Path $BackupDir -Filter 'daily-*.dump' |
    Where-Object { $_.Name -match '^daily-(\d{8})\.dump$' -and $Matches[1] -lt $cutoff }
foreach ($f in $old) { Remove-Item $f.FullName -Force }
if ($old) { $result += ", removed $(@($old).Count) old" }

Write-Log $result
exit 0
