# PowerShell 5.1. Metadata only: no video download, no inferred race offsets.
function Get-CompletedBroadcasts {
    $cmd=Get-Command yt-dlp -ErrorAction SilentlyContinue
    if(-not $cmd){throw 'yt-dlp is required for YouTube lookup.'}
    $raw=& $cmd.Source --ignore-config --flat-playlist --playlist-end 12 --dump-single-json --skip-download --socket-timeout 20 --retries 1 'https://www.youtube.com/@bobbethTV/streams'
    if($LASTEXITCODE -ne 0){throw 'YouTube stream inventory failed.'}
    $list=($raw -join "`n") | ConvertFrom-Json
    if($list.channel_id -ne 'UCdp4gP29AQWrMdoubvgekyA'){throw 'Unexpected YouTube channel.'}
    # Fetch full metadata for recent completed entries; never use list order as race evidence.
    foreach($item in @($list.entries | Where-Object {$_.live_status -in @('was_live','post_live')} | Select-Object -First 3)){
        if($item.id -notmatch '^[A-Za-z0-9_-]{11}$'){continue}
        $raw=& $cmd.Source --ignore-config --skip-download --dump-single-json --no-playlist --socket-timeout 20 --retries 1 ('https://www.youtube.com/watch?v='+$item.id)
        if($LASTEXITCODE -ne 0){throw "YouTube metadata failed for $($item.id)."}
        ($raw -join "`n") | ConvertFrom-Json
    }
}
function Add-BroadcastLinks($index,$events,$videos,[string]$competition,[int]$year){
    if($index.schema_version -ne 'MMTV-broadcast-links-v1'){throw 'Unexpected broadcast schema.'}
    $zone=[TimeZoneInfo]::FindSystemTimeZoneById('Tasmania Standard Time')
    $groups=@{
        Monday=@('Bomber Stocks','Cushion Kings')
        Tuesday=@('Mini Menaces','Yota Outlawz')
        Wednesday=@('Wide Open Revival')
    }
    $candidates=@()
    foreach($v in $videos){
        if($v.channel_id -ne 'UCdp4gP29AQWrMdoubvgekyA' -or $v.id -notmatch '^[A-Za-z0-9_-]{11}$' -or $v.live_status -notin @('was_live','post_live')){continue}
        if(-not $v.release_timestamp){continue}
        $utc=[DateTimeOffset]::FromUnixTimeSeconds([long]$v.release_timestamp)
        if($utc -gt [DateTimeOffset]::UtcNow){continue}
        $local=[TimeZoneInfo]::ConvertTime($utc,$zone)
        $day=[string]$local.DayOfWeek
        if($local.Year -ne $year -or -not $groups.ContainsKey($day)){continue}
        $text=[string]$v.title+"`n"+[string]$v.description
        if($text -notmatch [regex]::Escape($competition) -or $text -notmatch 'Knuckleheadz|Knuckle-Headz|KHR'){continue}
        # Require description/title evidence for every series in the scheduled coverage.
        $patterns=@{'Bomber Stocks'='Bomm?ber\s+Stocks';'Cushion Kings'='Cushion\s+Kings';'Mini Menaces'='Mini\s+Menaces';'Yota Outlawz'='Yota\s+Outlawz';'Wide Open Revival'='Wide\s+Open\s+Revival'}
        $supported=$true
        foreach($series in $groups[$day]){if($text -notmatch $patterns[$series]){$supported=$false}}
        if(-not $supported){continue}
        $candidates+= [pscustomobject]@{video=$v;date=$local.ToString('yyyy-MM-dd');series=$groups[$day]}
    }
    $count=0
    foreach($e in @($events | Group-Object subsession_id | ForEach-Object {$_.Group | Select-Object -Last 1})){
        $id=[string]$e.subsession_id
        if($index.events.PSObject.Properties[$id]){continue}
        if(-not $e.PSObject.Properties['competition'] -or $e.competition -ne $competition){continue}
        $matches=@($candidates | Where-Object {$_.date -eq $e.event_date -and $_.series -contains $e.series})
        if($matches.Count -ne 1){continue}
        $m=$matches[0];$v=$m.video
        # Multiple subsessions for one series/date are ambiguous; do not choose one.
        $same=@($events | Where-Object {$_.series -eq $e.series -and $_.event_date -eq $e.event_date} | Select-Object -ExpandProperty subsession_id -Unique)
        if($same.Count -ne 1){continue}
        $entry=[pscustomobject][ordered]@{
            video_id=$v.id;title=$v.title;round=$e.round;series=$e.series
            broadcast_group=($m.series -join ' / ')
            match_status='metadata_matched'
            match_method='channel_completed_stream_release_date_hobart_weekly_schedule_and_series_description'
            source_url=('https://www.youtube.com/watch?v='+$v.id)
            source_release_timestamp=$v.release_timestamp
            source_live_status=$v.live_status
            broadcast_date=$m.date;broadcast_timezone='Australia/Hobart'
            timestamp_note='Race start offset unknown; link opens the full broadcast.'
        }
        $index.events | Add-Member -NotePropertyName $id -NotePropertyValue $entry
        $count++
    }
    return $count
}


# Shared by the existing scheduled publisher and manual checks.
function Invoke-MMTVBroadcastWorkflow {
    param($Index,$Events,[string]$Competition,[int]$Year,[string]$StatePath,
        [switch]$ForceCheck,[ValidateRange(15,1440)][int]$IntervalMinutes=30,
        [DateTimeOffset]$Now=[DateTimeOffset]::UtcNow,
        [scriptblock]$Lookup={Get-CompletedBroadcasts})
    $unique=@($Events | Group-Object subsession_id | ForEach-Object {$_.Group | Select-Object -Last 1})
    $pending=@($unique | Where-Object {-not $Index.events.PSObject.Properties[[string]$_.subsession_id]} | ForEach-Object {[string]$_.subsession_id})
    if($pending.Count -eq 0 -and -not $ForceCheck){
        return [pscustomobject]@{added=0;status='not_needed';pending=0;attempted=$false;message='All published championship races have a video.'}
    }
    $state=$null
    if(Test-Path -LiteralPath $StatePath){
        try{
            $state=Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
            if($state.schema -ne 'MMTV-broadcast-retry-v1'){throw 'Unknown state schema'}
        }catch{$state=$null}
    }
    $seen=@();$next=$null
    if($null -ne $state){
        if($state.PSObject.Properties['attempted_pending_ids']){$seen=@($state.attempted_pending_ids)}
        if($state.PSObject.Properties['next_check_utc']){
            $date=[DateTimeOffset]::MinValue
            if([DateTimeOffset]::TryParse([string]$state.next_check_utc,[ref]$date)){$next=$date}
        }
    }
    $newPending=@($pending | Where-Object {$seen -notcontains $_})
    if(-not $ForceCheck -and $newPending.Count -eq 0 -and $null -ne $next -and $Now -lt $next -and $next -le $Now.AddMinutes($IntervalMinutes)){
        return [pscustomobject]@{added=0;status='not_due';pending=$pending.Count;attempted=$false;message=('Next video check '+$next.ToString('o'))}
    }
    # Save before network access so processing delays/failures remain throttled.
    $record=[pscustomobject][ordered]@{
        schema='MMTV-broadcast-retry-v1';last_attempt_utc=$Now.ToString('o')
        next_check_utc=$Now.AddMinutes($IntervalMinutes).ToString('o')
        attempted_pending_ids=@($pending);status='attempting';last_error=$null
    }
    $parent=Split-Path -Parent $StatePath
    [IO.Directory]::CreateDirectory($parent)|Out-Null
    [IO.File]::WriteAllText($StatePath,($record|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
    $added=0;$message=''
    try{
        $videos=@(& $Lookup)
        $added=Add-BroadcastLinks $Index $unique $videos $Competition $Year
        $record.status=if($added -gt 0){'linked'}else{'no_match'}
        $message=('{0} recording(s) inspected; {1} new video link(s).' -f $videos.Count,$added)
    }catch{
        $record.status='lookup_failed';$record.last_error=$_.Exception.Message
        $message='Video lookup failed; race publication continues. '+$record.last_error
    }
    [IO.File]::WriteAllText($StatePath,($record|ConvertTo-Json -Depth 8),(New-Object Text.UTF8Encoding($false)))
    $remaining=@($pending | Where-Object {-not $Index.events.PSObject.Properties[$_]}).Count
    return [pscustomobject]@{added=$added;status=$record.status;pending=$remaining;attempted=$true;message=$message}
}


function Get-MMTVBroadcastEvents {
    param([string]$RepositoryPath,$Events)
    $manifestPath=Join-Path $RepositoryPath 'news\data\intelligence\index.json'
    $cataloguePath=Join-Path $RepositoryPath 'news\data\intelligence\catalogue.json'
    $entries=@{}
    if((Test-Path -LiteralPath $manifestPath) -and (Test-Path -LiteralPath $cataloguePath)){
        $manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
        $expected=$manifest.files.'catalogue.json'.sha256
        if((Get-FileHash -LiteralPath $cataloguePath -Algorithm SHA256).Hash -ne $expected){throw 'Broadcast metadata catalogue SHA256 mismatch'}
        $catalogue=Get-Content -LiteralPath $cataloguePath -Raw|ConvertFrom-Json
        foreach($race in $catalogue.races){$entries[[string]$race.entry.subsession_id]=$race.entry}
    }
    foreach($event in $Events){
        $copy=$event.PSObject.Copy()
        # Older index rows omit competition; use only the verified existing export,
        # matched by ID, series and date. Never infer championship from weekday.
        if(-not $copy.PSObject.Properties['competition']){
            $entry=$entries[[string]$event.subsession_id]
            if($entry -and $entry.series -eq $event.series -and $entry.event_date -eq $event.event_date){
                $copy|Add-Member -NotePropertyName competition -NotePropertyValue $entry.competition
            }
        }
        $copy
    }
}

# SIG # Begin signature block
# MIIHMAYJKoZIhvcNAQcCoIIHITCCBx0CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCBlQistR0qdi2Be
# xrwKPTHmP2lPRCv2/TBPR73WsM7uCaCCBBwwggQYMIICgKADAgECAhBjgsjexbsj
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
# MC8GCSqGSIb3DQEJBDEiBCA9U3clGBagss0ZmQM0zOy09l62YCMKr499B+4fYkOG
# ejANBgkqhkiG9w0BAQEFAASCAYB9tky9aM3eKxpn8jGoZhVmisXaYKuCfSMOayHx
# MJbrSWYArRz46I/N8ItyCX8P/m5MywfBhx8jFzUO7hQlMomC/BpeEEldRLuSDKGN
# WOKoTZvqSVo65ifdOi5/8dwIde89lUN4x5MOET8Vrx5QhtiWkzUWgOC0+cDG78QL
# 9LJZW4rL3DJ6yRYEU+4wKF21hur0DEtkh+8vv8vVmRCf+j8PjIzWU2n69U7QXD2Y
# sEgrOXtuzrXUD2WT5KZBCGqxxFUQedb42RA4OT7Nhc4WdmO56sVBiWd9WYuJTKKC
# soc7moghoF/YT26to29S+usrLX6nTIgKQWCatpLxae/MBTieZIBVT+lo/LxIl3T8
# oZDDH6LX7ATl9jZhrJKEDm4yJGcs6dlRix+eY5M/5NJDzKJFOVRJY7HJoeJKJB06
# syFddOh5es2zH5NAPMSdLY+pqCpsBVnO2Y0yChcgtXuU9GCW9qkBWTlkL05qzvfh
# HVD36vX8Mj8kMCKmYchbe7bTy2w=
# SIG # End signature block
