# Public profiles and read-only roster discovery. No result rows or Bridge writes.
function Invoke-MMTVDriverWorkflow {
 param([string]$RepositoryPath,[string]$NodePath,[string]$StateRoot,
 [string]$SettingsPath='F:\Backup\KHR Bot\Driver Profiles\settings.json',
 [switch]$Manual,$SourceProfiles=$null,$SnapshotPair=$null)
 if(-not $NodePath){$command=Get-Command node.exe -ErrorAction SilentlyContinue;if($command){$NodePath=$command.Source}else{$NodePath=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}}
 if(-not $StateRoot){throw 'An explicit F: private driver state directory is required.'}
 $settings=@{enabled=$false}
 if(Test-Path -LiteralPath $SettingsPath){$settings=Get-Content -LiteralPath $SettingsPath -Raw|ConvertFrom-Json}
 $request=@{repository=$RepositoryPath;stateRoot=$StateRoot;settings=$settings;manual=[bool]$Manual;now=[DateTime]::UtcNow.ToString('o');apply=$false}
 if($null -ne $SnapshotPair){$request.snapshots=@($SnapshotPair|ForEach-Object {$_})}
 elseif($settings.enabled){
  $bridge='F:\Backup\KHR Bot\Production\KHR Broadcast\Bridge Releases\131DC\retry-20261103-201556-303\DC.ps1'
  if((Get-FileHash -LiteralPath $bridge -Algorithm SHA256).Hash -ne 'CB54C4E8FA10E12EEFB0A52680EAAEF9AAA14ED3AAB047AFEA8A9429BC412EA6'){throw 'Unreviewed Bridge version; discovery safely skipped.'}
  try{
   $first=(Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8765/live' -TimeoutSec 3).Content
   Start-Sleep -Seconds 2
   $second=(Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8765/live' -TimeoutSec 3).Content
   $request.snapshots=@($first,$second);$request.now=[DateTime]::UtcNow.ToString('o')
  }catch{$request.snapshots=@()}
 }
 function Invoke-DriverNode($payload){
  $json=ConvertTo-Json -InputObject $payload -Depth 100 -Compress
  $oldOutput=$OutputEncoding
  try{$OutputEncoding=New-Object Text.UTF8Encoding($false);$reply=$json|& $NodePath (Join-Path $PSScriptRoot 'driver-discovery.mjs');if($LASTEXITCODE -ne 0){throw 'Driver adapter failed; public data retained.'};return ($reply|ConvertFrom-Json)}
  finally{$OutputEncoding=$oldOutput}
 }
 $plan=Invoke-DriverNode $request
 if($plan.needProfileFetch){
  if($null -ne $SourceProfiles){$request.profileResponse=@{status=200;body=(ConvertTo-Json -InputObject @($SourceProfiles|ForEach-Object {$_}) -Depth 40 -Compress)}}
  else{
   try{
    $reply=Invoke-WebRequest -UseBasicParsing -Uri 'https://profiles.sdk-gaming.co.uk/profiles' -TimeoutSec 12
    if([Text.Encoding]::UTF8.GetByteCount($reply.Content) -gt 16777216){throw 'Profile response too large.'}
    $request.profileResponse=@{status=[int]$reply.StatusCode;body=$reply.Content}
   }catch{$request.profileResponse=@{status=503;body=''}}
  }
 }
 $request.apply=$true
 return Invoke-DriverNode $request
}
function Update-MMTVDriverProfiles {
 param([string]$RepositoryPath,$SourceProfiles=$null,[string]$NodePath,[string]$StateRoot)
 if(-not $StateRoot){$StateRoot='F:\Backup\KHR Bot\Driver Profiles\state'}
 Invoke-MMTVDriverWorkflow -RepositoryPath $RepositoryPath -NodePath $NodePath -StateRoot $StateRoot -Manual -SourceProfiles $SourceProfiles
}


# SIG # Begin signature block
# MIIHMAYJKoZIhvcNAQcCoIIHITCCBx0CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCA381FG0jc9s6uI
# ZS0PJu/tjwQcUczdbHFVr+pfntPq7qCCBBwwggQYMIICgKADAgECAhBjgsjexbsj
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
# MC8GCSqGSIb3DQEJBDEiBCBzf7AxCLOgcR+dNemFo792nYH6II7nEWBacnFV1xTn
# YDANBgkqhkiG9w0BAQEFAASCAYAVx13TnwZu/5XufIbGtBw+UDlMgf/jrdyrq5Ip
# 4EpEMh9ZGseagVmWqZ3oe59n0sUb4/85ZF0ChmNwHU6e6Zho9IDZv7UBkwW+ZG6j
# MfHCOByQoJ9CBKvZP1wEkrqlnQmNq+u8Q45rmo1AXGqvSwGJiF6A/yzsGReMC1JR
# nhs334FZPbPLf8Iu2W4B0thSPzyOrI8LHWzv3G2YYedwytJDg4V8AZnIsWej9JEe
# Snp8nD6qBiIgdjUNWoXEhMgQjydMwv0Q8HpFJqfS2jorv0yAFkC19mKIzlSD8/ZW
# zOlfBSLuykp2wHmJ1TfDeopKsgzYBcJFmArJY4yEYffJS4X4yjgYscHwDRoGsYCw
# 1Jsvma8Oyz/WX4tFVqnZ8tOgJ/fUgqHdVXEc0LAJpNBlfbiAu4frtH4aejmk7Sfe
# DgBT6LMDuPUkra9ya2GBXrWm20hjrWrAHiGV6Np7pssmp1B6uyLylaaMrdPPdR+E
# El94naZsMIRr39T3teqRKJbok94=
# SIG # End signature block
