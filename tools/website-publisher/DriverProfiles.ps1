# Driver-owned SDK Gaming profiles, joined only by verified iRacing customer ID.
function Update-MMTVDriverProfiles([string]$RepositoryPath,$SourceProfiles=$null){
 $identityPath=Join-Path $RepositoryPath 'news\data\driver-identities.json'
 $destination=Join-Path $RepositoryPath 'news\data\driver-profiles.json'
 $identity=Get-Content -LiteralPath $identityPath -Raw | ConvertFrom-Json
 if($identity.schema_version -ne 'MMTV-driver-identities-v1'){throw 'Unsupported driver identity schema.'}
 if($null -eq $SourceProfiles){$SourceProfiles=Invoke-RestMethod -Uri 'https://profiles.sdk-gaming.co.uk/profiles' -TimeoutSec 45}
 if(@($SourceProfiles).Count -eq 0 -or @($SourceProfiles | Where-Object {$null -eq $_.PSObject.Properties['id']}).Count -gt 0){throw 'Invalid SDK profile response; retaining existing profiles.'}
 $records=[ordered]@{}
 $allowed=@('id','firstName','lastName','suffix','country','hometown','team','header','info','bio','latestNews','website','youtube','twitter','twitch','facebook','pictureUrl','createdAt','updatedAt')
 $ids=@($identity.names.PSObject.Properties.Value | ForEach-Object {[long]$_} | Sort-Object -Unique)
 $available=0
 foreach($id in $ids){
  $matches=@($SourceProfiles | Where-Object {[long]$_.id -eq $id})
  if($matches.Count -gt 1){throw "Ambiguous SDK profile ID $id"}
  $profile=$null
  if($matches.Count -eq 1){
   $profile=[ordered]@{}
   foreach($field in $allowed){$p=$matches[0].PSObject.Properties[$field];if($null -ne $p){$profile[$field]=$p.Value}}
   $available++
  }
  $records[[string]$id]=[ordered]@{iracing_id=$id;profile=$profile}
 }
 $out=[ordered]@{schema_version='MMTV-driver-profiles-v1';source_url='https://profiles.sdk-gaming.co.uk/profiles';names=$identity.names;drivers=$records}
 $json=(ConvertTo-Json -InputObject $out -Depth 30).Replace("`r`n","`n")+"`n"
 $changed=(-not (Test-Path -LiteralPath $destination)) -or ([IO.File]::ReadAllText($destination) -cne $json)
 if($changed){[IO.File]::WriteAllText($destination,$json,(New-Object Text.UTF8Encoding($false)))}
 return [pscustomobject]@{changed=$changed;available=$available;identified=$ids.Count;path=$destination}
}
