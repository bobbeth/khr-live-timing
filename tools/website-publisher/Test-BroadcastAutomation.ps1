$ErrorActionPreference='Stop'
Set-StrictMode -Version 2
. "$PSScriptRoot\BroadcastLinks.ps1"
function Assert($ok,$message){if(-not $ok){throw $message}}
$root=$env:MMTV_BROADCAST_QA_ROOT
if(-not $root){throw 'Set MMTV_BROADCAST_QA_ROOT to private F: QA folder'}
$null=New-Item -ItemType Directory -Path $root -Force
$repo=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$indexPath=Join-Path $repo 'news\data\broadcasts.json'
$rawEvents=@((Get-Content (Join-Path $repo 'archive\index.json') -Raw|ConvertFrom-Json).events)+@((Get-Content (Join-Path $repo 'news\data\live\index.json') -Raw|ConvertFrom-Json).events)
$events=@(Get-MMTVBroadcastEvents -RepositoryPath $repo -Events $rawEvents)
Assert ($events.Count -eq 30 -and @($events|Where-Object {$_.competition -ne 'Fall Fest 2026'}).Count -eq 0) 'Legacy competition normalization failed'
$video=Get-Content (Join-Path $PSScriptRoot 'fixtures\round6-wide-open-youtube.json') -Raw|ConvertFrom-Json
function Missing-Index {$i=Get-Content $indexPath -Raw|ConvertFrom-Json;$i.events.PSObject.Properties.Remove('89859608');return $i}
$tests=New-Object Collections.Generic.List[string]
$i=Missing-Index;$before=ConvertTo-Json $i.events -Depth 40 -Compress
Assert ((Add-BroadcastLinks $i $events @($video) 'Fall Fest 2026' 2026) -eq 1) 'Tonight not linked'
Assert ($i.events.'89859608'.video_id -eq 'ojLdErQ-5L8') 'Wrong recording'
Assert (-not $i.events.'89859608'.PSObject.Properties['start_seconds']) 'Invented offset'
Assert ((Add-BroadcastLinks $i $events @($video) 'Fall Fest 2026' 2026) -eq 0) 'Overwrite/idempotence'
$i.events.PSObject.Properties.Remove('89859608')
Assert ((ConvertTo-Json $i.events -Depth 40 -Compress) -ceq $before) 'Previous 29 mappings changed'
$tests.Add('Actual R6 metadata recovers missing mapping; all previous mappings byte-equivalent; no offset; idempotent')
foreach($field in @('channel_id','release_timestamp','description','title','live_status')){
 $bad=$video|ConvertTo-Json -Depth 10|ConvertFrom-Json
 switch($field){
 channel_id {$bad.channel_id='wrong'}
 release_timestamp {$bad.release_timestamp-=86400}
 description {$bad.description='Unrelated championship'}
 title {$bad.title='Unrelated'}
 live_status {$bad.live_status='is_live'}
 }
 Assert ((Add-BroadcastLinks (Missing-Index) $events @($bad) 'Fall Fest 2026' 2026) -eq 0) "Accepted wrong $field"
 $tests.Add('Rejected wrong '+$field)
}
$other=$video|ConvertTo-Json -Depth 10|ConvertFrom-Json;$other.id='abcdefghijk'
Assert ((Add-BroadcastLinks (Missing-Index) $events @($video,$other) 'Fall Fest 2026' 2026) -eq 0) 'Ambiguous recording accepted'
$tests.Add('Ambiguous recordings remain pending')
$now=[DateTimeOffset]::UtcNow
$state=Join-Path $root ('retry-'+[guid]::NewGuid().ToString('N')+'.json')
$i=Missing-Index
$u=Invoke-MMTVBroadcastWorkflow $i $events 'Fall Fest 2026' 2026 $state -Now $now -Lookup {throw 'simulated temporary failure'}
Assert ($u.status -eq 'lookup_failed' -and $u.pending -eq 1) 'Failure not safely pending'
$u=Invoke-MMTVBroadcastWorkflow $i $events 'Fall Fest 2026' 2026 $state -Now $now.AddMinutes(2) -Lookup {throw 'MUST NOT RUN'}
Assert ($u.status -eq 'not_due' -and -not $u.attempted) 'Failure not throttled'
$u=Invoke-MMTVBroadcastWorkflow $i $events 'Fall Fest 2026' 2026 $state -Now $now.AddMinutes(30) -Lookup {@()}
Assert ($u.status -eq 'no_match' -and $u.attempted) 'Due retry missing'
$u=Invoke-MMTVBroadcastWorkflow $i $events 'Fall Fest 2026' 2026 $state -Now $now.AddMinutes(32) -Lookup {throw 'MUST NOT RUN'}
Assert ($u.status -eq 'not_due') 'Processing delay not throttled'
$tests.Add('Temporary failure and processing delay never throw; checks throttled and retry at 30 minutes')
$newEvent=[pscustomobject]@{subsession_id=99988877;competition='Fall Fest 2026';series='Wide Open Revival';event_date='2026-11-11';round=7}
$u=Invoke-MMTVBroadcastWorkflow $i @($events+$newEvent) 'Fall Fest 2026' 2026 $state -Now $now.AddMinutes(33) -Lookup {@()}
Assert ($u.attempted -and $u.pending -eq 2) 'New race did not bypass interval'
$tests.Add('New completed race immediately checks even during retry interval')
$u=Invoke-MMTVBroadcastWorkflow $i $events 'Fall Fest 2026' 2026 $state -Now $now.AddMinutes(34) -ForceCheck -Lookup {$video}
Assert ($u.added -eq 1 -and $u.pending -eq 0) 'Manual force/recovery failed'
$u=Invoke-MMTVBroadcastWorkflow $i $events 'Fall Fest 2026' 2026 $state -Now $now.AddMinutes(35) -Lookup {throw 'MUST NOT RUN'}
Assert ($u.status -eq 'not_needed' -and -not $u.attempted) 'All-linked races queried YouTube'
$tests.Add('Forced check recovers video; no network lookup when all races linked')
# Production may already contain tonight's mapping; compare it with recovered facts.
$published=Get-Content $indexPath -Raw|ConvertFrom-Json
Assert ($published.events.'89859608'.video_id -eq $i.events.'89859608'.video_id) 'Published mapping differs'
$tests.Add('Current production video identity agrees with independently verified metadata')
[pscustomobject]@{pass=$true;tests=@($tests);video_id=$video.id;old_mapping_count=29;mapping_count=30;state_files_private=$true}|ConvertTo-Json -Depth 8|Set-Content (Join-Path $root 'broadcast-workflow-tests.json')
'PASS '+$tests.Count+' broadcast workflow groups'


# SIG # Begin signature block
# MIIHMAYJKoZIhvcNAQcCoIIHITCCBx0CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCCHPMTxo73T6iXd
# qkAIF3vqdbpjHRL7YtZs8+JTmMveVKCCBBwwggQYMIICgKADAgECAhBjgsjexbsj
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
# MC8GCSqGSIb3DQEJBDEiBCCuKFAoP3WDkfARLHgcV+9RSBV4iJa7aKjnK1bvbfxW
# mzANBgkqhkiG9w0BAQEFAASCAYCFuQLvirJQ/JZOm9C3MhZXYQCPRanYYBZpJyhV
# VPfrB/SZ935oTWRiOpm3MPXbIVNNmKtUFkjmXlS0SOpJ+W0GYTnSspnh4zjO8auK
# 0fyeMEcgQ6wteIKvJ11eeE5BbaiBeDORmMhDiqi/aB6JljqrsTfQsxx0b0EKNUlL
# wQI4AOtX2dnVZ6yKWMlLF6pHv9Sq00WlmL0z6TpHUzBN1Gc8B69xH9kyjIGDDVKI
# 1IOP7QOinwMnh+PWyq23JVytvjuXZHjKIa7j/QWmAdHx+X9W04FzYAvZ8j1zScTi
# coZpf0lT85Ik+o8TgR0trroi1yIblRExsoD+hERvyJqclEFVrJpRWWPCCZbi+CvI
# 4TZjV49iLecw1DQdvU9r4jJFgLsNrm7tt+Mzib/x2WbUhtz+Gtnt03qfNCt2xywz
# B1Gz7PzAWpZhbdxmeiRwrJqBRMyGVyIPq4hY/zLHhkaeWvRTJtBJTreQiEb8KzlT
# RwkF4ljnj4sVefpm1yukTm5c01k=
# SIG # End signature block
