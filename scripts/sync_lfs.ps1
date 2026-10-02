# ============================================================
# LFS (Labor Force Survey) heavy-data sync via ODBC
# Reads the raw .mdb files (Microsoft Access) through the installed
# "Microsoft Access Driver (*.mdb, *.accdb)" and aggregates each record
# into compact per-year JSON for the backend API.
#
# Mapped fields (validated against official LFS questionnaire + totals):
#   province  = MID(pkey,3,2)   (SCI classic codes 00..30; verified: 31 provinces,
#                                Tehran=23 weighted ~14M in 1399)
#   wave      = NobatAmargiri   (1..4 quarterly rounds)
#   sex       = F2_D04          (1=male, 2=female)
#   age       = F2_D07          (years)
#   activity  = ActivityStatus  (1=employed, 2=unemployed, 3=inactive, ''=n/a)
#   weight    = IW_Yearly (1396/97/99) or IW10_Yearly (1384)
# Output: server/data/lfs-<year>.json
# ============================================================
$ErrorActionPreference = 'Stop'
$root = (Get-Location).Path
$outDir = Join-Path $root 'server\data'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$BANDS = @('0-4','5-9','10-14','15-24','25-34','35-44','45-54','55-64','65+')

function Get-AgeBand([int]$a) {
  if ($a -lt 0 -or $a -gt 120) { return 'unknown' }
  if ($a -lt 5) { return '0-4' }
  if ($a -lt 10) { return '5-9' }
  if ($a -lt 15) { return '10-14' }
  if ($a -lt 25) { return '15-24' }
  if ($a -lt 35) { return '25-34' }
  if ($a -lt 45) { return '35-44' }
  if ($a -lt 55) { return '45-54' }
  if ($a -lt 65) { return '55-64' }
  return '65+'
}

function Invoke-LfsSync([string]$mdbPath, [string]$table, [string]$weightCol, [string]$sourceLabel) {
  $conn = New-Object System.Data.Odbc.OdbcConnection("Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq=$mdbPath;")
  $conn.Open()
  $cmd = $conn.CreateCommand()
  $cmd.CommandText = "SELECT pkey, NobatAmargiri, F2_D04, F2_D07, ActivityStatus, $weightCol FROM $table"
  $rdr = $cmd.ExecuteReader()

  $sums = @{}          # "year|prov|wave|sex|band|act" -> weighted sum
  $raws = @{}          # same key -> raw count
  $rowCount = 0
  $bad = 0
  while ($rdr.Read()) {
    $rowCount++
    $pkey = [string]$rdr.GetValue(0)
    if ($pkey.Length -lt 5) { $bad++; continue }
    $year = $pkey.Substring(0, 2)
    $prov = $pkey.Substring(2, 2)
    $wave = [string]$rdr.GetValue(1)
    $sex = [string]$rdr.GetValue(2)
    $ageS = [string]$rdr.GetValue(3)
    $act = [string]$rdr.GetValue(4)
    $w = [double]$rdr.GetValue(5)

    $sexK = if ($sex -eq '1' -or $sex -eq '2') { $sex } else { 'unknown' }
    $age = 0
    if (-not [int]::TryParse($ageS, [ref]$age)) { $age = -1 }
    $band = Get-AgeBand $age
    $actK = if ($act -eq '1' -or $act -eq '2' -or $act -eq '3') { $act } else { 'unknown' }

    $key = "$year|$prov|$wave|$sexK|$band|$actK"
    if ($sums.ContainsKey($key)) { $sums[$key] += $w; $raws[$key]++ }
    else { $sums[$key] = $w; $raws[$key] = 1 }
  }
  $rdr.Close()
  $conn.Close()

  $years = @{}
  foreach ($k in $sums.Keys) {
    $parts = $k -split '\|'
    $y = $parts[0]
    if (-not $years.ContainsKey($y)) { $years[$y] = @{} }
    $years[$y][($parts | Select-Object -Skip 1) -join '|'] = $k
  }

  foreach ($y in $years.Keys) {
    $cells = @()
    $totalW = 0.0
    foreach ($key in $years[$y].Values) {
      $p = $key -split '\|'
      # prov, wave, sex, band, act, weighted, raw
      $cells += ,@($p[1], [int]$p[2], [int]$p[3], $p[4], $p[5], [math]::Round($sums[$key], 1), $raws[$key])
      $totalW += $sums[$key]
    }
    $out = [ordered]@{
      year = [int]$y
      source = $sourceLabel
      table = $table
      weightColumn = $weightCol
      rows = $rowCount
      skipRows = $bad
      waves = @($years[$y].Keys | ForEach-Object { ($_ -split '\|')[1] } | Sort-Object -Unique)
      totalWeighted = [math]::Round($totalW, 0)
      cells = $cells
    }
    $fname = Join-Path $outDir "lfs-$y.json"
    $json = $out | ConvertTo-Json -Depth 6 -Compress
    # Write WITHOUT BOM (Windows PowerShell 5.1 Set-Content -Encoding UTF8 adds one)
    [System.IO.File]::WriteAllText($fname, $json, (New-Object System.Text.UTF8Encoding($false)))
    Write-Output ("  year=$y rows=$rowCount weighted=" + [math]::Round($totalW, 0) + " -> " + (Split-Path $fname -Leaf))
  }
}

Write-Output '== LFS sync =='

# 1399
$m99 = Join-Path $root 'Portals\0\dataniruyekar\LFS_RawData99_14000615\LFS_RawData99_14000615.mdb'
if (Test-Path $m99) {
  Write-Output '- 1399 ...'
  Invoke-LfsSync $m99 'LFS_RawData' 'IW_Yearly' 'Portals/0/dataniruyekar/LFS_RawData99_14000615'
} else { Write-Output '- 1399 MISSING' }

# 1384
$m84 = Join-Path $root 'Portals\0\Files\LFSRawData_84_990826\LFSRawData_84_990826.mdb'
if (Test-Path $m84) {
  Write-Output '- 1384 ...'
  Invoke-LfsSync $m84 'LFS_RawData' 'IW10_Yearly' 'Portals/0/Files/LFSRawData_84_990826'
} else { Write-Output '- 1384 MISSING' }

# 1396 / 1397 (zips)
$tmp = Join-Path $root '.freebuff\sync_tmp'
foreach ($pair in @(
  @{ zip = 'Portals\0\census\raw-data\cn_z\LFS96_RawData.zip'; label = 'Portals/0/census/raw-data/cn_z/LFS96_RawData.zip' },
  @{ zip = 'Portals\0\census\raw-data\cn_z\LFS97_RawData.zip'; label = 'Portals/0/census/raw-data/cn_z/LFS97_RawData.zip' }
)) {
  $zp = Join-Path $root $pair.zip
  if (-not (Test-Path $zp)) { Write-Output ("- " + $pair.zip + " MISSING"); continue }
  Write-Output ("- " + $pair.zip + " ...")
  Expand-Archive -Path $zp -DestinationPath $tmp -Force
  $inner = Get-ChildItem -Path $tmp -Filter *.mdb -Recurse | Select-Object -First 1
  if ($inner) {
    Invoke-LfsSync $inner.FullName 'LFS_RawData1396' 'IW_Yearly' $pair.label
  } else { Write-Output '- no mdb found in zip' }
}

Write-Output '== done =='
