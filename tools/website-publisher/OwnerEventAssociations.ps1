function Initialize-MMTVOwnerEventAssociations {
 param([string]$AssociationsPath,[string]$CanonicalPath,[string]$DriverSettingsPath,[string]$NodePath,[int]$MinStableSeconds=90,[string]$SnapshotsPath='')
 if(-not $AssociationsPath){$AssociationsPath=Join-Path $PSScriptRoot 'owner-event-associations.json'}
 if(-not $SnapshotsPath){$SnapshotsPath=Join-Path $PSScriptRoot 'owner-event-evidence'}
 if(-not (Test-Path -LiteralPath $AssociationsPath)){return @{}}
 if(-not $NodePath){$cmd=Get-Command node.exe -ErrorAction SilentlyContinue;if($cmd){$NodePath=$cmd.Source}else{$NodePath=Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'}}
 $req=@{associationsPath=$AssociationsPath;snapshotsPath=$SnapshotsPath;canonicalPath=$CanonicalPath;driverSettingsPath=$DriverSettingsPath;minStableSeconds=$MinStableSeconds}
 $old=$OutputEncoding
 try{$OutputEncoding=New-Object Text.UTF8Encoding($false);$reply=(ConvertTo-Json $req -Compress)|& $NodePath (Join-Path $PSScriptRoot 'owner-event-associations.mjs') validate;if($LASTEXITCODE){throw 'Owner event association validation failed; publication blocked.'};$doc=($reply -join [Environment]::NewLine)|ConvertFrom-Json;$map=@{};foreach($p in $doc.events.PSObject.Properties){$map[$p.Name]=$p.Value};return $map}finally{$OutputEncoding=$old}
}
function Get-MMTVOwnerEventAssociation($Capture) {
 $identity=PathValue $Capture 'broadcast.nativeEventIdentity'
 if($null -eq $identity -or $identity.identityValid -ne $true -or $identity.leagueID -ne 10402){return $null}
 $id=[string]$identity.subSessionID
 if($script:MMTVOwnerEventAssociations.ContainsKey($id)){return $script:MMTVOwnerEventAssociations[$id]}
 return $null
}


# SIG # Begin signature block
# MIIHMAYJKoZIhvcNAQcCoIIHITCCBx0CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCAzYY8go6L4ShHQ
# 8WRf2MbWdZp4RwiA5M4s0gRTV2SKBKCCBBwwggQYMIICgKADAgECAhBjgsjexbsj
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
# MC8GCSqGSIb3DQEJBDEiBCBmyTtuy+XPE17KdfaxjfhiUz3xrrdIBVkzJrb8z5Ox
# QDANBgkqhkiG9w0BAQEFAASCAYDArm/glJqP8ew5QV5In2ZzY2lJ0L4dxDmTGO3d
# Wyijjz8uHOP2M5XAroxSH2oBVa1GQ+SV1I7HpNvC+az94O2ye7Aa/izCtOsix6n/
# muObMoxNhUGQ2b2UMgE3vq4s3gOnTPvoue5wjE8h/L+R0h38bvWlJCEFbMD1rU0n
# 3XpM1LA1EzzvmPS3mbwPgI7PSe9w5WAxzfCo+pzn28Nm3tBa8ITJesQijF3ZMtlx
# MLtIYf8yUX3hVPTBn2kowKs+p8BpBunohJNVbJWuiK2fjDDg30TR0gnFw/uPLV1U
# J4erFkTL/b3YRbpfxxTGpSC2tEYHr07fHVb2m355+yc1AqNTH6oE1qlZjDCy113F
# 2vVS5xmiF936CAgHm/J+tSw2A6QMXb0NsYbfVumxEzpM7kNYTGPe/FkNC/aoVL+8
# O+Bo13WJ9OF+t7KT2RmrarDT/hYZri3Gm5TvRmnThUxSSeSfhKszAC0+xl6nae+f
# gMH26x2wmPUZZMbgvop358jSXgg=
# SIG # End signature block
