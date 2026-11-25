# Read the existing canonical adapter as functions only. Never start or modify the Bridge.
function Write-MMTVIntelligence {
 [CmdletBinding()]
 param([Parameter(Mandatory=$true)][string]$RepositoryPath,[Parameter(Mandatory=$true)][string]$CanonicalPath,[string]$AdapterSourcePath='',[string]$NodePath='',[int]$MinStableSeconds=90,[switch]$ExhaustiveRecovery,[long[]]$ExhaustiveSubsessionIds=@(),[string]$AuditOutputPath='',[string]$DriverSettingsPath='F:\Backup\KHR Bot\Driver Profiles\settings.json',[string]$EventAssociationsPath='',[string]$EventSnapshotsPath='')
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
 . (Join-Path $PSScriptRoot 'OwnerEventAssociations.ps1')
 $ownerEvents=Initialize-MMTVOwnerEventAssociations -AssociationsPath $EventAssociationsPath -CanonicalPath $CanonicalPath -DriverSettingsPath $DriverSettingsPath -NodePath $NodePath -MinStableSeconds $MinStableSeconds -SnapshotsPath $EventSnapshotsPath
 $ownerCanonicalReader=(Get-Command Read-KHRCanonicalEvent131DC).ScriptBlock
 function Read-KHRCanonicalEvent131DC($File){
  $target=$File;$id=[string]$File.BaseName
  if($ownerEvents.ContainsKey($id)){$original=[IO.File]::ReadAllText($File.FullName)|ConvertFrom-Json;if(-not $original.official){$target=Get-Item -LiteralPath $ownerEvents[$id].canonicalFile}}
  $event=& $ownerCanonicalReader $target
  if($ownerEvents.ContainsKey($id)){$event.provenance|Add-Member -NotePropertyName captureRoot -NotePropertyValue (Split-Path -Parent $CanonicalPath) -Force}
  $event
 }
 $history=Get-KHRCanonicalHistory131DC
 foreach($race in $history.races){$id=[string]$race.subSessionID;if($ownerEvents.ContainsKey($id)){$a=$ownerEvents[$id];$race.seriesKey=$a.series_key;$race.round=$a.round;$race.track=$a.track;$race.metadataUnknown=@($race.metadataUnknown|Where-Object {$_ -notin @('series','round','track')});$race.provenance|Add-Member -NotePropertyName ownerAssociation -NotePropertyValue $a.public_provenance -Force}}
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
 $payload=[ordered]@{driver_policy=$driverPolicy;driver_eligibility=$driverEligibility;history=$history;source_event_count=$availableCount;source_catalogue_count=$catalogueCount;statistics=(Get-KHRHistoricalInsights131R $history -Mode season).statistics;adapter_sha256=(Get-FileHash -LiteralPath $AdapterSourcePath).Hash;recovery=[ordered]@{exhaustive=[bool]$ExhaustiveRecovery;exhaustive_ids=@($ExhaustiveSubsessionIds);audit_output=$AuditOutputPath;catalogue_root=$CanonicalPath}}
 $previousEncoding=$OutputEncoding
 try{
  $OutputEncoding=New-Object Text.UTF8Encoding($false)
  $builder=Join-Path $PSScriptRoot 'build-intelligence.mjs'
  $inputJson=ConvertTo-Json -InputObject $payload -Depth 45 -Compress
  $priorPreference=$ErrorActionPreference
  try{
   $ErrorActionPreference='Continue'
   $output=@($inputJson | & $NodePath $builder $RepositoryPath 2>&1)
   $exitCode=$LASTEXITCODE
  }finally{$ErrorActionPreference=$priorPreference}
  $diagnostic=@($output | Where-Object {$_ -is [System.Management.Automation.ErrorRecord]} | ForEach-Object {[string]$_})
  $stdout=@($output | Where-Object {$_ -isnot [System.Management.Automation.ErrorRecord]}) -join [Environment]::NewLine
  if($exitCode -ne 0){
   $detail=($diagnostic | Where-Object {$_ -match '\b(?:Error|Exception|ENOENT|EACCES|EPERM|EBUSY)\b'} | Select-Object -First 3) -join ' | '
   if(-not $detail){$detail=if($diagnostic.Count){$diagnostic[0]}else{'No stderr captured'}}
   $detail=$detail -replace '[\r\n]+',' '
   if($detail.Length -gt 1000){$detail=$detail.Substring(0,1000)}
   throw "Static canonical intelligence export failed (Node exit $exitCode): $detail. Publication held; the next run rebuilds from the current remote."
  }
  try{$summary=ConvertFrom-Json -InputObject $stdout -ErrorAction Stop}catch{throw 'Intelligence exporter returned invalid summary JSON; publication held.'}
  if($null -eq $summary -or $summary.revision -notmatch '^[0-9a-f]{64}$' -or $null -eq $summary.changed_paths -or $null -eq $summary.subsession_ids -or $summary.event_count -ne @($summary.subsession_ids).Count){
   throw 'Intelligence exporter returned an incomplete summary; publication held.'
  }
  $ids=@($summary.subsession_ids)
  if(@($ids | Where-Object {$_ -notmatch '^[1-9][0-9]{6,11}$'}).Count -or @($ids | Sort-Object -Unique).Count -ne $ids.Count){
   throw 'Intelligence exporter returned invalid or duplicate subsession IDs; publication held.'
  }
  $indexPath=Join-Path $RepositoryPath 'news\data\intelligence\index.json'
  $manifest=[IO.File]::ReadAllText($indexPath) | ConvertFrom-Json
  if($manifest.schema_version -ne 'MMTV-canonical-intelligence-v1' -or $manifest.revision -ne $summary.revision -or $manifest.published_event_count -ne $summary.event_count -or (@($manifest.subsession_ids) -join ',') -ne (@($summary.subsession_ids) -join ',')){
   throw 'Intelligence manifest and exporter summary disagree; publication held.'
  }
  $manifestPaths=@('races.json','drivers.json','venues.json','championships.json','catalogue.json')+@($summary.subsession_ids | ForEach-Object {"events/$_.json"})
  foreach($name in $manifestPaths){
   $property=$manifest.files.PSObject.Properties[$name]
   $file=Join-Path (Split-Path -Parent $indexPath) $name
   if($null -eq $property -or $property.Value.sha256 -notmatch '^[a-f0-9]{64}$' -or -not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $property.Value.sha256){
    throw "Intelligence artifact missing or checksum mismatch: $name; publication held."
   }
  }
  return $summary
 }finally{$OutputEncoding=$previousEncoding}
}







# SIG # Begin signature block
# MIIHMAYJKoZIhvcNAQcCoIIHITCCBx0CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCCD8f79GXFsQQ6Y
# Cam+gvz3LfDCxzRkVDGNr/wI0nXPKqCCBBwwggQYMIICgKADAgECAhBjgsjexbsj
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
# MC8GCSqGSIb3DQEJBDEiBCAjIQQqb/M7JZnoIok+GE9RNZ5BTKIFm5magVtqcW5j
# LDANBgkqhkiG9w0BAQEFAASCAYDDQYu7L46WqiJwsJGH0/dKoNdftD6Y1SSzh2R7
# 3I51pkUCtYykZIoLgqxBdwTxO+nq6vgHJWvKEC6UmdrXuC8Vk32HaPsXU71s6y2l
# ayQRLCBrKa/LDvfFwdx7Z4G0vEZvsyz34VSM3ucmFhX4E3vioCc96lCzyvUaKqiz
# zEAKuNcj+s2aB+w8mF2GmaLafju8QPCWo3n51oxQYD/qSGWxVGEn7BT+xLv9LFby
# Y0DS/mfjV3ldPKUbH0MwRDkuvyosagKV/TdnxJOpKnAIlWHKRUdSI4OwuWt0L8Zf
# sVz0KwAcR04gXJULuJgxmEqDKA7jBDDQbLCmWMcDn6x0T4TvZYgScG+SIIabAQn4
# sXUjqSG19fzQ2WTSAZJv0JwR0ZPTk2aUgTLHhwppNzXlF9/gKoz9b924e5X8qbaL
# r/4oTu9UIt7I+iaPbhV5LGvKT7HFwnnE+NVHN4iTT/sKBoGnMkhHSv8Pq5UGcbdM
# WUOJ7yMkYFVlyShfGCSg1Pe7xqA=
# SIG # End signature block
