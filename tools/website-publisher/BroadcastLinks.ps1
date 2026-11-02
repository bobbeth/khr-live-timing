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
        if($e.competition -ne $competition){continue}
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
