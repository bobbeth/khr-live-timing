# Private immutable per-session evidence. No canonical writes, scoring or result promotion.
function Get-KHRSessionEvidenceValue($Object,[string]$Path){
 foreach($part in $Path.Split('.')){if($null -eq $Object){return $null};$p=$Object.PSObject.Properties[$part];if($null -eq $p){return $null};$Object=$p.Value};return $Object
}
function Write-KHRSessionEvidenceFrame($Frame,[string]$Root){
 $id=[string]$Frame.broadcast.nativeEventIdentity.subSessionID;$num=[int]$Frame.diagnostic.rawSession.sessionNum
 $folder=Join-Path $Root $id;$null=[IO.Directory]::CreateDirectory($folder)
 $text=ConvertTo-Json -InputObject $Frame -Depth 70 -Compress
 $bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($text)
 $hasher=[Security.Cryptography.SHA256]::Create()
 try{$sha=[BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace('-','')}finally{$hasher.Dispose()}
 $name='session-'+$num+'-'+$sha+'.json';$dest=Join-Path $folder $name
 if(Test-Path -LiteralPath $dest){if((Get-FileHash -LiteralPath $dest -Algorithm SHA256).Hash -ne $sha){throw 'Immutable session evidence checksum mismatch'}}
 else{[IO.File]::WriteAllBytes(($dest+'.new'),$bytes);Move-Item -LiteralPath ($dest+'.new') -Destination $dest}
 $indexPath=Join-Path $folder 'index.json'
 if(Test-Path -LiteralPath $indexPath){$index=Get-Content -LiteralPath $indexPath -Raw|ConvertFrom-Json;if($index.schema -ne 'KHR-session-evidence-v1' -or $index.subsession_id -ne [long]$id -or $index.league_id -ne 10402){throw 'Session evidence manifest identity mismatch'}}
 else{$index=[pscustomobject]@{schema='KHR-session-evidence-v1';league_id=10402;subsession_id=[long]$id;admission='private_observation_not_a_race_start';captures=@()}}
 if(@($index.captures|Where-Object {$_.sha256 -eq $sha}).Count -eq 0){
  $index.captures=@($index.captures)+@([pscustomobject]@{sessionNum=$num;sha256=$sha;file=('session-evidence/'+$id+'/'+$name);timestamp=$Frame.timestamp;phase=$Frame.session.phase})
  [IO.File]::WriteAllText(($indexPath+'.new'),(ConvertTo-Json -InputObject $index -Depth 10 -Compress),(New-Object Text.UTF8Encoding($false)))
  Move-Item -LiteralPath ($indexPath+'.new') -Destination $indexPath -Force
 }
}
function Save-KHRSessionEvidence {
 param($CurrentState,[string]$EvidenceRoot,$NativeInfo=$null,[DateTimeOffset]$Now=[DateTimeOffset]::UtcNow)
 $identity=Get-KHRSessionEvidenceValue $CurrentState 'broadcast.nativeEventIdentity'
 if(-not $identity -or -not $identity.identityValid -or [string]$identity.leagueID -ne '10402' -or (Get-KHRSessionEvidenceValue $identity 'leagueConsistent') -eq $false){return}
 if([string]$identity.subSessionID -notmatch '^[1-9][0-9]{6,11}$'){return}
 foreach($field in @('session.isReplay','diagnostic.calculated.isReplay','broadcast.nativeFinalSessionEvidence.isReplay','session.isAI','broadcast.nativeEventIdentity.isAI')){
  if((Get-KHRSessionEvidenceValue $CurrentState $field) -eq $true){return}
 }
 $raw=Get-KHRSessionEvidenceValue $CurrentState 'diagnostic.rawSession'
 if($null -eq $raw -or [string]$raw.sessionNum -notmatch '^[0-9]+$' -or -not $raw.sessionName){return}
 if(@($CurrentState.diagnostic.drivers|Where-Object {(Get-KHRSessionEvidenceValue $_ 'fields.isAI') -eq $true}).Count -gt 0){return}
 if(-not $NativeInfo){try{$NativeInfo=[KHR.IRacingSessionInfoM]::Read()}catch{}}
 if($NativeInfo -and [string]$NativeInfo.Text -match '(?im)^\s*(?:IsAI|AIEnabled):\s*(?:1|true)\s*$|^\s*EventType:\s*.*(?:AI|Test|Replay)'){return}
 if(-not (Get-Variable -Name KHRSessionEvidenceState -Scope Script -ErrorAction SilentlyContinue)){$script:KHRSessionEvidenceState=@{}}
 $key=$EvidenceRoot+'|'+$identity.subSessionID;$previous=$script:KHRSessionEvidenceState[$key]
 # Retain exact authored timing fields, including absence; never convert offTracks to incidents.
 $fields=@('carIdx','userId','number','name','startPosition','laps','lapsLed','bestLapTime','lastLapTime','qualifyingLapTime','incidents','champPoints','isAI','isSpectator','inSession')
 $diagnostics=@(foreach($d in $CurrentState.diagnostic.drivers){$o=[ordered]@{};foreach($f in $fields){$df=Get-KHRSessionEvidenceValue $d 'fields';if($df){$p=$df.PSObject.Properties[$f];if($p){$o[$f]=$p.Value}}};[pscustomobject]@{number=$d.number;fields=[pscustomobject]$o}})
 $broadcast=[ordered]@{};foreach($f in @('nativeEventIdentity','nativeHistoricalResults','nativeClassificationStability','nativeFinalSessionEvidence','eolGridPreview','eolBroadcastStats','yotaEOL')){$p=$CurrentState.broadcast.PSObject.Properties[$f];if($p){$broadcast[$f]=$p.Value}}
 $native=$null
 if($NativeInfo -and $NativeInfo.Connected -and $NativeInfo.Text){$h=[Security.Cryptography.SHA256]::Create();try{$native=[pscustomobject]@{connected=$true;update=$NativeInfo.Update;text=$NativeInfo.Text;sha256=[BitConverter]::ToString($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($NativeInfo.Text))).Replace('-','')}}finally{$h.Dispose()}}
 $observed=$null
 if((Get-Variable -Name KHRObservedFeatureStarts -Scope Script -ErrorAction SilentlyContinue) -and (Get-Command Get-KHRObservedFeatureKey -ErrorAction SilentlyContinue)){
  $observedKey=Get-KHRObservedFeatureKey $CurrentState
  if($script:KHRObservedFeatureStarts.ContainsKey($observedKey)){
   $candidate=$script:KHRObservedFeatureStarts[$observedKey]
   $date=[DateTimeOffset]::MinValue;$frameDate=[DateTimeOffset]::MinValue
   if([DateTimeOffset]::TryParse([string]$candidate.capturedAt,[ref]$date) -and [DateTimeOffset]::TryParse([string]$CurrentState.timestamp,[ref]$frameDate) -and ($frameDate-$date).TotalSeconds -ge 0 -and ($frameDate-$date).TotalSeconds -le 300){$observed=$candidate}
  }
 }
 $frame=[pscustomobject]@{timestamp=$CurrentState.timestamp;session=$CurrentState.session;snapshot=(Get-KHRSessionEvidenceValue $CurrentState 'snapshot');drivers=$CurrentState.drivers;diagnostic=[pscustomobject]@{rawSession=$raw;drivers=$diagnostics};lapsLedIntegrity=(Get-KHRSessionEvidenceValue $CurrentState 'lapsLedIntegrity');preRaceGridView=(Get-KHRSessionEvidenceValue $CurrentState 'preRaceGridView');broadcast=[pscustomobject]$broadcast;sessionEvidence=[pscustomobject]@{schema='KHR-session-frame-v1';nativeSessionInfo=$native;observedStart=$observed;context='private_observation_only';captured_utc=$Now.ToString('o')}}
 # Detach from the mutable live object before the next SDK update.
 $frame=ConvertTo-Json -InputObject $frame -Depth 70 -Compress|ConvertFrom-Json
 if($previous -and $previous.num -ne [int]$raw.sessionNum){Write-KHRSessionEvidenceFrame $previous.frame $EvidenceRoot}
 $boundary=ConvertTo-Json -InputObject @($raw.sessionNum,$raw.state,$frame.preRaceGridView,$frame.broadcast.eolGridPreview,$frame.broadcast.nativeHistoricalResults) -Depth 40 -Compress
 $terminal=[bool]$CurrentState.session.isFinished
 $delay=if($terminal -and $previous -and ($Now-$previous.first).TotalSeconds -gt 15){60}elseif($terminal -or [int]$raw.state -le 3){1}else{15}
 $due=-not $previous -or $previous.num -ne [int]$raw.sessionNum -or $previous.boundary -cne $boundary -or ($Now-$previous.saved).TotalSeconds -ge $delay
 $saved=if($previous){$previous.saved}else{$Now}
 $first=if($previous -and $previous.num -eq [int]$raw.sessionNum -and $previous.terminal -eq $terminal){$previous.first}else{$Now}
 if($due){Write-KHRSessionEvidenceFrame $frame $EvidenceRoot;$saved=$Now}
 $script:KHRSessionEvidenceState[$key]=[pscustomobject]@{num=[int]$raw.sessionNum;frame=$frame;boundary=$boundary;saved=$saved;first=$first;terminal=$terminal}
}

# SIG # Begin signature block
# MIIHMAYJKoZIhvcNAQcCoIIHITCCBx0CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCD1WcY4JGO7u2V+
# 7yqjdxl986t6teGKynkSU92uqFl2UqCCBBwwggQYMIICgKADAgECAhBjgsjexbsj
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
# MC8GCSqGSIb3DQEJBDEiBCCPGU5+RS/GvkFFCmu1gj2bEE95en7C9pGmOqmriFdl
# 3jANBgkqhkiG9w0BAQEFAASCAYAa6UF+NET+68bt/3syiC6XQL2538jYcT2qSaGY
# rPFF9tUX2T+4IO2FhwDNdLq0m+syDeYr/+wqytV1pmtzRhD/0CCKBJeU8iTUjuQ7
# TLaWVsh1FF/qdXMtRmABjBZ0xoy0nqq82CceUmkqakc3yVqTZZY5bVMAmzLZrUgg
# XML4KR62beWzadiYETLTvQqVv5fRDSA8c1Jrh0ptXQ5Ek7xagZLo0YgLERsm7y5F
# ZhxxIkdAyruSzmnAxMAwJfEtqveKVUH7T4gj7MstAu2YgSmB1reszNjCpS6OTbzs
# MkBG9cHQw2/fLtnX/f7+YO3xT6esNG9Yz1CKTeDLtUTxxN8htuwRlaZX7BQ0HVp/
# b5HfMfW92grQpaY9klScAUCtGWnugA3dNT3KJbGlYuErE3+ESo8p5fA+Td56vTkS
# RRqZYz1p7Uy7JbofTHiEypNzL1JxThe1m2BdK8QYsMSLo5yB3xkPcmFsihV3McJj
# tpuZMxp35jNo9mGv2jS99gGSjC0=
# SIG # End signature block
