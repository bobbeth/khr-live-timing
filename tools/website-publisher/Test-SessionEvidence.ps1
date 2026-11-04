$ErrorActionPreference='Stop'
Set-StrictMode -Version 2
. "$PSScriptRoot\SessionEvidence.ps1"
function Assert($ok,$message){if(-not $ok){throw $message}}
$root=$env:MMTV_SESSION_QA_ROOT;$backup=$env:MMTV_R6_BACKUP_ROOT
if(-not $root -or -not $backup){throw 'Private QA and real-capture backup paths required'}
$evidence=Join-Path $root ('capture-'+[guid]::NewGuid().ToString('N'))
$c=Get-Content (Join-Path $backup 'canonical\89859608.json') -Raw|ConvertFrom-Json
$ref=@($c.live.captures|Where-Object {$_.sessionNum -eq 2})[-1]
$source=Get-Content (Join-Path $backup $ref.file) -Raw|ConvertFrom-Json
function Copy-State {return ($source|ConvertTo-Json -Depth 70|ConvertFrom-Json)}
$native=[pscustomobject]@{Connected=$false;Text='';Update=0}
$now=[DateTimeOffset]::UtcNow
$s=Copy-State;$s.session.isFinished=$false;$s.session.state=2;$s.session.phase='grid';$s.diagnostic.rawSession.state=2
$s|Add-Member -NotePropertyName preRaceGridView -NotePropertyValue ([pscustomobject]@{active=$true;grid=@($s.drivers|Select-Object number,sdkStartPosition)}) -Force
Save-KHRSessionEvidence $s $evidence $native $now
$indexPath=Join-Path $evidence '89859608\index.json'
$first=Get-Content $indexPath -Raw|ConvertFrom-Json
Assert ($first.captures.Count -eq 1) 'Grid not captured before finish'

# References are relative to the standard Unified root; test folder has its own root.
$file=Join-Path $evidence ('89859608\'+(Split-Path $first.captures[0].file -Leaf))
$f=Get-Content $file -Raw|ConvertFrom-Json
Assert ($f.preRaceGridView.grid.Count -eq $s.drivers.Count) 'Incomplete grid'
Assert ($f.diagnostic.drivers[0].fields.userId -gt 0) 'Native identity unavailable'
$p=Copy-State;$p.session.name='PRACTICE';$p.session.type='Practice';$p.session.phase='practice';$p.session.isFinished=$false;$p.session.state=4;$p.diagnostic.rawSession.sessionNum=0;$p.diagnostic.rawSession.sessionName='PRACTICE';$p.diagnostic.rawSession.state=4
Save-KHRSessionEvidence $p $evidence $native $now.AddSeconds(2)
$p.timestamp='2026-11-04T00:50:01Z';$p.drivers[0].bestLap=17.4321
Save-KHRSessionEvidence $p $evidence $native $now.AddSeconds(3)
$q=Copy-State;$q.session.name='QUALIFY';$q.session.type='Qualify';$q.session.phase='qualifying';$q.session.isFinished=$false;$q.session.state=4;$q.diagnostic.rawSession.sessionNum=1;$q.diagnostic.rawSession.sessionName='QUALIFY';$q.diagnostic.rawSession.state=4
Save-KHRSessionEvidence $q $evidence $native $now.AddSeconds(4)
$index=Get-Content $indexPath -Raw|ConvertFrom-Json
Assert (@($index.captures|Where-Object {$_.sessionNum -eq 0}).Count -ge 2) 'Practice transition did not preserve final observed frame'
Assert (@($index.captures|Where-Object {$_.sessionNum -eq 1}).Count -gt 0) 'Qualifying not preserved'
$before=$index.captures.Count
foreach($kind in @('ai','replay','other_league')){
 $bad=Copy-State
 switch($kind){ai {$bad.session|Add-Member isAI $true};replay {$bad.session|Add-Member isReplay $true};other_league {$bad.broadcast.nativeEventIdentity.leagueID=999}}
 Save-KHRSessionEvidence $bad $evidence $native $now.AddSeconds(30)
}
Assert ((Get-Content $indexPath -Raw|ConvertFrom-Json).captures.Count -eq $before) 'AI/replay/other league captured'
foreach($ref in $index.captures){$file=Join-Path $evidence ('89859608\'+(Split-Path $ref.file -Leaf));Assert ((Get-FileHash $file).Hash -eq $ref.sha256) 'Immutable evidence SHA mismatch'}
$tests=@('complete pre-finish grid with native IDs/car indices','practice and qualifying preserved','last observed frame flushed at session transition','AI/replay/wrong league excluded','immutable file hashes and private manifests')
[pscustomobject]@{pass=$true;tests=$tests;root=$evidence;captures=$index.captures.Count;admission=$index.admission}|ConvertTo-Json -Depth 5|Set-Content (Join-Path $root 'capture-tests.json')
'PASS per-session capture: '+$tests.Count+' groups'

# SIG # Begin signature block
# MIIHMAYJKoZIhvcNAQcCoIIHITCCBx0CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCCoERTscHzxczjY
# UbsWx9NlWn3PZhTPQOmr0Mx5Mvp1RKCCBBwwggQYMIICgKADAgECAhBjgsjexbsj
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
# MC8GCSqGSIb3DQEJBDEiBCA8Ha0A0948f3vveAkCPeTdCcUaPnghPtlUcQ8QwZT+
# xzANBgkqhkiG9w0BAQEFAASCAYBc0ho2jTQi/ckPKrEWVrGYy4dpEruWB8FWTIiW
# a6Hh6MuX0BiUcsTk+0PphdGXzYeCqyc/t0zejuqyWA0PwtiO6AHNj4T++wgN2zNe
# alH43fBAiLgBDwWHujOJs6bYElUcJh7g6qmocPJoL8Cwz13/ORz2Oe6JbSqBpYXe
# XOufAQUHNryjLCc2InBQ2nl5d2T0a7KYnNm/aWyMAR+6eevZ2j0xBCD+wY+TSJnz
# ZULgDoRmd+6q15QH76iaxjNFykq7RIzqQEP+lStLSDXe8/rsaPzLxNNgfT8sTsMs
# 9TOtotaunVFSHdX7bnrLUu4VNEyLeY7fC35R/AeQ5mlGcweoqQI2rTAIgR/zkuk6
# GXLVJ6kGyRgOgyrdWapILIAboK/B8aKH2zKI8e7difnXTCEZRBR3Z0k6sWn47Gg6
# bvag5NXX9jyrs6V2NRcylYdwH+m+8KkyiK1cRfi7vhVAqHLbt6tPlSjtEGoCBjjX
# LMbbOIDZoCHX7v5i6b5QKXyRS1A=
# SIG # End signature block
