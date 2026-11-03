# Read the existing canonical adapter as functions only. Never start or modify the Bridge.
function Write-MMTVIntelligence {
 [CmdletBinding()]
 param([Parameter(Mandatory=$true)][string]$RepositoryPath,[Parameter(Mandatory=$true)][string]$CanonicalPath,[string]$AdapterSourcePath='',[string]$NodePath='',[int]$MinStableSeconds=90,[switch]$ExhaustiveRecovery,[string]$AuditOutputPath='')
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
 $payload=[ordered]@{history=$history;source_event_count=$availableCount;source_catalogue_count=$catalogueCount;statistics=(Get-KHRHistoricalInsights131R $history -Mode season).statistics;adapter_sha256=(Get-FileHash -LiteralPath $AdapterSourcePath).Hash;recovery=[ordered]@{exhaustive=[bool]$ExhaustiveRecovery;audit_output=$AuditOutputPath}}
 $previousEncoding=$OutputEncoding
 try{
  $OutputEncoding=New-Object Text.UTF8Encoding($false)
  $result=(ConvertTo-Json -InputObject $payload -Depth 45 -Compress) | & $NodePath (Join-Path $PSScriptRoot 'build-intelligence.mjs') $RepositoryPath
  if($LASTEXITCODE -ne 0){throw 'Static canonical intelligence export failed; no publication permitted.'}
  return (($result -join [Environment]::NewLine) | ConvertFrom-Json)
 }finally{$OutputEncoding=$previousEncoding}
}
