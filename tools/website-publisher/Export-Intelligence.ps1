# Read the existing canonical adapter as functions only. Never start or modify the Bridge.
function Write-MMTVIntelligence {
 [CmdletBinding()]
 param([Parameter(Mandatory=$true)][string]$RepositoryPath,[Parameter(Mandatory=$true)][string]$CanonicalPath,[string]$AdapterSourcePath='',[string]$NodePath='',[int]$MinStableSeconds=90,[switch]$ExhaustiveRecovery,[string]$AuditOutputPath='',[string]$DriverSettingsPath='F:\Backup\KHR Bot\Driver Profiles\settings.json')
 if(-not $AdapterSourcePath){
  $release=Join-Path $env:USERPROFILE 'Documents\KHR Broadcast\Bridge Releases\131DC'
  $records=@(Get-ChildItem -LiteralPath $release -Recurse -File -Filter active.json | Sort-Object LastWriteTimeUtc -Descending)
  if($records.Count -eq 0){throw 'No installed canonical adapter release record found.'}
  $record=[IO.File]::ReadAllText($records[0].FullName) | ConvertFrom-Json
  $AdapterSourcePath=[string]$record.path
  if((Get-FileHash -LiteralPath $AdapterSourcePath).Hash -ne $record.signedHash){throw 'Canonical adapter release checksum mismatch.'}
 }
 if(-not $NodePath){$command=Get-Command node.exe -ErrorAction SilentlyContinue;if($command){$NodePath=$command.Source}else{$NodePath=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}}
 if(-not (Test-Path -LiteralPath $NodePath -PathType Leaf)){throw 'Existing Node runtime not found; no installation attempted.'}
 $tokens=$null;$errors=$null
 $ast=[Management.Automation.Language.Parser]::ParseFile($AdapterSourcePath,[ref]$tokens,[ref]$errors)
 if($errors.Count){throw 'Canonical adapter source has syntax errors.'}
 foreach($name in @('Get-KHRHistoryValue131DC','Get-KHRHistoryName131DC','Get-KHRHistorySeries131DC','Read-KHRCanonicalEvent131DC','Get-KHRCanonicalHistory131DC','Get-KHRHistoricalInsights131R')){
  $definitions=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true))
  if($definitions.Count -ne 1){throw "Required canonical adapter function missing/duplicated: $name"}
  . ([scriptblock]::Create($definitions[0].Extent.Text))
 }
 $script:KHRUnifiedCanonicalDir=$CanonicalPath
 $script:KHRLeagueFallbackDir=Split-Path -Parent (Split-Path -Parent $CanonicalPath)
 $script:KHR131DCHistoryCache=$null;$script:KHR131DCLastScan=[datetime]::MinValue;$script:KHR131DCFingerprint='';$script:KHR131DCRecords=@{}
 $history=Get-KHRCanonicalHistory131DC
 $published=@{}
 foreach($index in @('archive\index.json','news\data\live\index.json')){foreach($entry in @(([IO.File]::ReadAllText((Join-Path $RepositoryPath $index)) | ConvertFrom-Json).events)){$published[[string]$entry.subsession_id]=$true}}
 foreach($failure in $history.errors){if($failure -match '^(\d+)\.json:' -and $published.ContainsKey($Matches[1])){throw ('Published canonical event invalid: '+$failure)}}
 $availableCount=$history.archiveCount;$catalogueCount=$history.catalogueCount
 $history=$history | Select-Object *
 $history.races=@($history.races | Where-Object {$published.ContainsKey([string]$_.subSessionID)})
 $history.archiveCount=$history.races.Count
 foreach($race in $history.races){
  $file=Get-Item -LiteralPath $race.provenance.canonicalFile
  if(((Get-Date).ToUniversalTime()-$file.LastWriteTimeUtc).TotalSeconds -lt $MinStableSeconds){return [pscustomobject]@{changed_paths=@();event_count=$history.archiveCount;status='waiting_for_stable_canonical_archive'}}
  if((Get-FileHash -LiteralPath $file.FullName).Hash -ne $race.provenance.canonicalSha256){throw 'Canonical archive changed during export; retry after settling.'}
 }
 $driverPolicy=@{};$driverEligibility=$null
 if(Test-Path -LiteralPath $DriverSettingsPath){$driverPolicy=Get-Content -LiteralPath $DriverSettingsPath -Raw|ConvertFrom-Json;if($driverPolicy.PSObject.Properties['eligibility_path']){if((Get-FileHash -LiteralPath $driverPolicy.eligibility_path).Hash -ne $driverPolicy.eligibility_sha256){throw 'Private driver eligibility checksum mismatch.'};$driverEligibility=Get-Content -LiteralPath $driverPolicy.eligibility_path -Raw|ConvertFrom-Json}}
 $payload=[ordered]@{driver_policy=$driverPolicy;driver_eligibility=$driverEligibility;history=$history;source_event_count=$availableCount;source_catalogue_count=$catalogueCount;statistics=(Get-KHRHistoricalInsights131R $history -Mode season).statistics;adapter_sha256=(Get-FileHash -LiteralPath $AdapterSourcePath).Hash;recovery=[ordered]@{exhaustive=[bool]$ExhaustiveRecovery;audit_output=$AuditOutputPath}}
 $previousEncoding=$OutputEncoding
 try{
  $OutputEncoding=New-Object Text.UTF8Encoding($false)
  $result=(ConvertTo-Json -InputObject $payload -Depth 45 -Compress) | & $NodePath (Join-Path $PSScriptRoot 'build-intelligence.mjs') $RepositoryPath
  if($LASTEXITCODE -ne 0){throw 'Static canonical intelligence export failed; no publication permitted.'}
  return (($result -join [Environment]::NewLine) | ConvertFrom-Json)
 }finally{$OutputEncoding=$previousEncoding}
}

# SIG # Begin signature block
# MIIHMAYJKoZIhvcNAQcCoIIHITCCBx0CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCCq5OLCat3SRuPG
# YDQlXSVN5YiM4gQeBNFKatW6mFlyaqCCBBwwggQYMIICgKADAgECAhBjgsjexbsj
# mENaXQ9gFq0HMA0GCSqGSIb3DQEBCwUAMCQxIjAgBgNVBAMMGUtIUiBCcm9hZGNh
# c3QgRGV2ZWxvcG1lbnQwHhcNMjYxMDI4MDIyNTEyWhcNMjkxMDI4MDIzNTEyWjAk
# MSIwIAYDVQQDDBlLSFIgQnJvYWRjYXN0IERldmVsb3BtZW50MIIBojANBgkqhkiG
# 9w0BAQEFAAOCAY8AMIIBigKCAYEA0KKkBodSOLNMxbrvEKCaBPzCWy+OCdhF8pV5
# W2Kg3T7mMw9FjbGdMXqamhA0edqSj8H463I6NK8bIYYc1i2HS2Jh+jbUe02+aLT+
# MYPakVjKgaqs8Hd5MYhsKv1JQxl92SVpGlL7NK3m2i4umT67Gl4ZzBzQCCL+03R1
# 3vD7SCymEU3uVTQHc8+hdPXnvUeyTYy9jvC8QlfEX4zEKlO9ESmU6Yjk4fXmsEEg
# 8cTrmqSw3EeDfn9xvZJ6z+tk9iDLLeJTnK03pXvPJJoCldVE377mPfdij3l7BEu1
# SC8h7IL8nRq7JkbArXC6L6Yfyk0xRtDMRnYWM9BAaoTQH9WC5NtsDHs0Ztg6cuxL
# TrUctaUgRHcDVW+pWndwEosK4QMeSMSSKJ+HNKQtfUCw0zYRHSICKD02F2s/qm2K
# H43uGrtUp+w1ryc8C9tzznX8gia0UGPTYMI/OBSbaVOJUTCtjQGsuneZ2r19yRF+
# /nxseWw3VpiclujlL0/Q/0L9zTd5AgMBAAGjRjBEMA4GA1UdDwEB/wQEAwIHgDAT
# BgNVHSUEDDAKBggrBgEFBQcDAzAdBgNVHQ4EFgQUlPv7zz5U5NgsxT/dh2xfMvWZ
# 9dswDQYJKoZIhvcNAQELBQADggGBAK3zXDI/sEffqGOv8+9vjmVrHcId8WR36D7G
# JNxxA3Y3KKmnq2QtV88Vnu/zgM4wFZHjru56h9XTNWLNfEtgA17V9UXlmgMEqUvh
# Rp0eIkaZeRpnuJwybSQFijx0Djt19T4N4/sm/22l0u2uRTl9AZ9wkq2Udu42vi8x
# QCmWOspU1srAcKOJZNIlvxZKFsfiN8LKMaKiKweSSRsnplFimiCoatfJFHzKmxhu
# zyHab1jVH08/Zi8zSvDtSh+d34PO9hX+HF8ZMAJLj6Bnn5nK+98GMAaDOa5/PARl
# sbXXlcAybeyODLw6pQjapZlotot5VAirWzKO5zkmiCX+ym+zCsPvWzU2/8YOZJto
# MslBns4Yz4rdiGTHsLO+GyV6VFLcGvZhA7llttIG9B5aSCvZMwnDcQsgb4YKIo7A
# HXMkadUbyjqL78Docj57LWog0/NAH1dO1simWtkH0z9GUuijebxzkk0VlQXGZBGR
# hRjYXqaUj8R62vAr5K2SI3HGmi3bYjGCAmowggJmAgEBMDgwJDEiMCAGA1UEAwwZ
# S0hSIEJyb2FkY2FzdCBEZXZlbG9wbWVudAIQY4LI3sW7I5hDWl0PYBatBzANBglg
# hkgBZQMEAgEFAKCBhDAYBgorBgEEAYI3AgEMMQowCKACgAChAoAAMBkGCSqGSIb3
# DQEJAzEMBgorBgEEAYI3AgEEMBwGCisGAQQBgjcCAQsxDjAMBgorBgEEAYI3AgEV
# MC8GCSqGSIb3DQEJBDEiBCB2inzygbTQZNNea2bBFJbt/ofwqHHqd7+8mk6QeeMk
# ijANBgkqhkiG9w0BAQEFAASCAYC/2aPK/duOtOPUhmhTiU6Cdi2OPdM3lUH4FHX6
# efqn/Asp8wue3E8Kli5RzpJ0IHDT5B1ueZL7M6PTyP9N4zA7WlAvPio/y+hVJQsR
# FYDY+/kUUPnt1HoN4MzuWA+c4vJgufSWcGqAis+QpWFvdbFFJ5yIXUKtxdHt0nd7
# 59gnKF6yOD+eXH7QXYtsOELz/0bQTGs6rjnLOG5JluLKYRoop33x7fY66tUhP0pS
# Mp9IciRA1QKngFcOr1uRM4acI6tm1Z4luJgV85oZXwNU36ezcW27n/KnvVTcZiYd
# QQCw4rblGnrpeOWfm9QW7eK34mr6tUZz6P7zEl0l/yl71E3WyYuVNZEfskYS1U2k
# 6UbfxJwD6NeHmYEPMqJee3RHtZaND/mwNVbDf30rn3Y2lEuwwYtwnDkw1smvjbS9
# SwXlg+s0MELtDJYO8y51DmRK/nNFxw30xb4VnvI1AHeRJGQL1ehFlLZVtECuyCWk
# aoAgdnvlhmiM2n9NvsxqVtQPTPQ=
# SIG # End signature block
