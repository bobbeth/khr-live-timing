$ErrorActionPreference='Stop'
Set-StrictMode -Version 2
. "$PSScriptRoot\BroadcastLinks.ps1"
function Assert($ok,$message){if(-not $ok){throw $message}}
function Load-Index {Get-Content "$PSScriptRoot\fixtures\broadcasts-before.json" -Raw | ConvertFrom-Json}
$events=@((Get-Content "$PSScriptRoot\..\..\news\data\live\index.json" -Raw | ConvertFrom-Json).events)
$video=Get-Content "$PSScriptRoot\fixtures\round6-youtube.json" -Raw | ConvertFrom-Json
$index=Load-Index
$old=ConvertTo-Json $index.events -Depth 30 -Compress
$n=Add-BroadcastLinks $index $events @($video) 'Fall Fest 2026' 2026
Assert ($n -eq 2) 'Expected both Round 6 races'
foreach($id in @('89810317','89812470')){
    Assert ($index.events.$id.video_id -eq 'IyXQ4OjSR3Y') "Wrong video: $id"
    Assert ($null -eq $index.events.$id.PSObject.Properties['start_seconds']) 'Invented race offset'
}
Assert ((Add-BroadcastLinks $index $events @($video) 'Fall Fest 2026' 2026) -eq 0) 'Not idempotent'
$index.events.PSObject.Properties.Remove('89810317')
$index.events.PSObject.Properties.Remove('89812470')
Assert ((ConvertTo-Json $index.events -Depth 30 -Compress) -ceq $old) 'Existing mappings changed'
foreach($field in @('channel_id','live_status','release_timestamp','description')){
    $bad=$video | ConvertTo-Json -Depth 30 | ConvertFrom-Json
    switch($field){
        channel_id {$bad.channel_id='wrong'}
        live_status {$bad.live_status='is_live'}
        release_timestamp {$bad.release_timestamp=$null}
        description {$bad.description='Unrelated stream'}
    }
    Assert ((Add-BroadcastLinks (Load-Index) $events @($bad) 'Fall Fest 2026' 2026) -eq 0) "Accepted invalid $field"
}
$other=$video | ConvertTo-Json -Depth 30 | ConvertFrom-Json
$other.id='abcdefghijk'
Assert ((Add-BroadcastLinks (Load-Index) $events @($video,$other) 'Fall Fest 2026' 2026) -eq 0) 'Accepted ambiguous recordings'
foreach($case in @(
    @{date='2026-11-03T01:00:00Z';series=@('Mini Menaces','Yota Outlawz')},
    @{date='2026-11-04T01:00:00Z';series=@('Wide Open Revival')}
)){
    $sample=$video | ConvertTo-Json -Depth 30 | ConvertFrom-Json
    $sample.release_timestamp=([DateTimeOffset]::Parse($case.date)).ToUnixTimeSeconds()
    # Use earlier week so fixture date is never in the future.
    $sample.release_timestamp-=604800
    $sample.description=$case.series -join ' / '
    $date=[TimeZoneInfo]::ConvertTime([DateTimeOffset]::FromUnixTimeSeconds($sample.release_timestamp),[TimeZoneInfo]::FindSystemTimeZoneById('Tasmania Standard Time')).ToString('yyyy-MM-dd')
    $fixture=@();$i=0
    foreach($series in $case.series){$i++;$fixture+=[pscustomobject]@{subsession_id=(99900000+$i);series=$series;competition='Fall Fest 2026';event_date=$date;round=5}}
    Assert ((Add-BroadcastLinks (Load-Index) $fixture @($sample) 'Fall Fest 2026' 2026) -eq $case.series.Count) 'Weekly coverage mismatch'
}
'PASS: Round 6, preservation, idempotency, wrong channel, active stream, missing date, unrelated description, ambiguity, Tuesday and Wednesday.'
