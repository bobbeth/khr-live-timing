# Mud Mules TV automatic completed-race website publisher (PowerShell 5.1).
# ONLY reads KHR Bridge finished-session staging. ONLY writes an isolated Git clone.
# Never changes the Bridge, canonical archive, live.json, or website archive.
[CmdletBinding()]
param(
    [switch]$Publish,
    [switch]$Status,
    [switch]$CheckBroadcasts,
    [switch]$SkipBroadcasts,
    [string]$WorkRoot = (Join-Path $env:USERPROFILE 'Documents\KHR Broadcast'),
    [string]$StagePath = (Join-Path $env:USERPROFILE 'Documents\KHR Broadcast\Race Archives\Unified\live-staging'),
    [int]$MinStableSeconds = 90,
    [string]$Competition = 'Fall Fest 2026',
    [int]$SeasonYear = 2026
)
. (Join-Path $PSScriptRoot 'BroadcastLinks.ps1')
$lookupBroadcasts = -not $SkipBroadcasts -and ($CheckBroadcasts -or ([Environment]::CommandLine -notmatch '(?i)-NonInteractive'))
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$repoUrl = 'https://github.com/bobbeth/khr-live-timing.git'
$stagingRoot = Join-Path $WorkRoot 'Race Archives\Unified\publish-staging\auto-website'
$logDir = Join-Path $WorkRoot 'Website Publisher\logs'
[IO.Directory]::CreateDirectory($logDir) | Out-Null
$log = Join-Path $logDir ('publisher-' + (Get-Date -Format 'yyyy-MM-dd') + '.log')
function Note([string]$s) { $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + ' ' + $s; Write-Host $line; [IO.File]::AppendAllText($log,$line+"`r`n",[Text.Encoding]::UTF8) }
function Require([bool]$pass,[string]$message) { if(-not $pass) { throw $message } }
function JsonSave([string]$path,$obj) {
    $s = ConvertTo-Json -InputObject $obj -Depth 80 -Compress
    [IO.Directory]::CreateDirectory((Split-Path -Parent $path)) | Out-Null
    [IO.File]::WriteAllText($path,$s+"`n",(New-Object Text.UTF8Encoding($false)))
}
function IntOrNull($v) {
    if($null -eq $v -or "${v}" -eq '') { return $null }
    $n=0; if([int]::TryParse("$v",[ref]$n)) { return $n }; return $null
}
function DoubleOrNull($v) {
    if($null -eq $v -or "${v}" -eq '') { return $null }
    $n=0.0
    if([double]::TryParse("$v",[Globalization.NumberStyles]::Float,[Globalization.CultureInfo]::InvariantCulture,[ref]$n)) { return $n }
    return $null
}
function TextVal($v) { if($null -eq $v){return ''};return ([string]$v).Trim() }
function PathValue($obj,[string]$path) {
    $v=$obj
    foreach($part in $path.Split('.')) {
        if($null -eq $v) { return $null }
        if($v -is [System.Collections.IDictionary]) { $v = $v[$part] }
        else { $p=$v.PSObject.Properties[$part]; if($null -eq $p){return $null};$v=$p.Value }
    }
    return $v
}
function FirstText($obj,[string[]]$paths) {
    foreach($p in $paths){$v=TextVal (PathValue $obj $p);if($v){return $v}};return ''
}
function SessionNumber($s){return (IntOrNull (PathValue $s 'diagnostic.rawSession.sessionNum'))}
function SessionName($s){
    $name=FirstText $s @('session.name','diagnostic.rawSession.sessionName','broadcast.championship.sessionCapture.currentSession.name','broadcast.championship.sessionCapture.currentSession.sessionName')
    $num=SessionNumber $s
    $n=@(PathValue $s 'broadcast.nativeHistoricalResults.sessions')
    foreach($ss in $n) {
        if($null -ne $ss -and $null -ne $num -and (IntOrNull $ss.sessionNum) -eq $num) {
            $native=FirstText $ss @('sessionName','name')
            if($native -and $native -notmatch '^(RACE|WARMUP)$') { return $native }
        }
    }
    $hist=@(PathValue $s 'broadcast.persistentRaceHistory.races')
    foreach($ss in $hist){
        if($null -ne $ss -and $null -ne $num -and (IntOrNull $ss.sessionNum) -eq $num){
            $native=FirstText $ss @('name','sessionName')
            if($native -and $native -notmatch '^(RACE|WARMUP)$'){return $native}
        }
    }
    return $name
}
function SessionKind([string]$name,[string]$series){
    $n=$name.Trim().ToUpperInvariant()
    if($n -match '^FEATURE$|^FEATURE\s*2$|^TWIN\s*FEATURE\s*2$'){if($series -eq 'Bomber Stocks'){return 'twin_feature_2'};return 'feature'}
    if($series -eq 'Bomber Stocks' -and $n -match '^B-MAIN$|^B MAIN$|^TWIN\s*FEATURE\s*1$|^FEATURE\s*1$'){return 'twin_feature_1'}
    if($n -match '^HEAT\s*\d+'){return 'heat'}
    if($n -match '^CONSI|^CONSOLATION'){return 'consolation'}
    if($n -match '^QUALIF'){return 'qualifying'}
    if($n -eq 'PRACTICE'){return 'practice'}
    if($n -eq 'WARMUP'){return 'warmup'}
    return $null
}
function SeriesName($s){
    $k=FirstText $s @('broadcast.championship.activeSeriesKey','broadcast.fallFestRegistry.verifiedSeriesKey','broadcast.championship.series.key','broadcast.championship.series.seriesKey','broadcast.championship.series.name')
    $names=@{
        'bomber_stocks'='Bomber Stocks'; 'bomber stocks'='Bomber Stocks';
        'cushion_kings'='Cushion Kings'; 'cushion kings'='Cushion Kings';
        'mini_menaces'='Mini Menaces'; 'mini menaces'='Mini Menaces';
        'dirt_cheap_asphalt_fast'='Yota Outlawz'; 'yota_outlawz'='Yota Outlawz'; 'yota outlawz'='Yota Outlawz';
        'wide_open_revival'='Wide Open Revival'; 'wide open revival'='Wide Open Revival'
    }
    $key=$k.Trim().ToLowerInvariant()
    if($names.ContainsKey($key)){return $names[$key]}
    return ''
}
function IdentityId($s){
    $ident=PathValue $s 'broadcast.nativeEventIdentity'
    if($null -eq $ident -or $ident.identityValid -ne $true){return $null}
    if((IntOrNull $ident.leagueID) -ne 10402){return $null}
    $id=IntOrNull $ident.subSessionID
    if($null -eq $id -or $id -lt 10000000 -or $id -gt 9999999999){return $null}
    return $id
}
function DriverRows($s,[int]$id,[int]$num,[bool]$isFeature){
    $raw=@(PathValue $s 'drivers')
    if($raw.Count -lt 2){throw "Session ${num}: fewer than two drivers"}
    $rows=New-Object System.Collections.Generic.List[object]
    foreach($d in $raw){
        $pos=IntOrNull $d.position
        if($null -eq $pos -or $pos -lt 1){continue}
        $name=TextVal $d.name; $car=TextVal $d.number
        if(-not $name -or -not $car){throw "Session ${num}: nameless or unnumbered classified driver"}
        $start=IntOrNull $d.startPosition
        if($null -eq $start -or $start -lt 1){$start=IntOrNull $d.sdkStartPosition}
        if($null -ne $start -and $start -lt 1){$start=$null}
        $gain=$null;if($null -ne $start){$gain=$start-$pos}
        $lap=IntOrNull $d.lapsCompleted
        $led=IntOrNull $d.lapsLed
        $best=DoubleOrNull $d.bestLap
        if($null -ne $best -and $best -le 0){$best=$null}
        $row=[ordered]@{
            position=$pos;car_number=$car;driver=$name;start_position=$start;positions_gained=$gain;
            laps_completed=$lap;laps_led=$led;best_lap_seconds=$best;qual_lap_seconds=$null;
            incidents=$null;champ_points=$null;reason_out=$null
        }
        if($isFeature){$row=[ordered]@{
            session='FEATURE';session_number=$num;subsession_id=$id;finish_position=$pos;start_position=$start;
            driver=$name;car_number=$car;positions_gained=$gain;laps_completed=$lap;laps_led=$led;
            best_lap_seconds=$best;incidents=$null;champ_points=$null;reason_out=$null
        }}
        $rows.Add([pscustomobject]$row)
    }
    if($isFeature){$ordered=@($rows | Sort-Object finish_position)} else {$ordered=@($rows | Sort-Object position)}
    Require ($ordered.Count -ge 2) "Session ${num}: insufficient classified finishers"
    for($i=0;$i -lt $ordered.Count;$i++){
        $p= if($isFeature){$ordered[$i].finish_position}else{$ordered[$i].position}
        Require ($p -eq ($i+1)) "Session ${num}: missing or duplicated finishing position P$($i+1)"
    }
    return ,$ordered
}
function SourceInfo($f){
    if(((Get-Date).ToUniversalTime()-$f.LastWriteTimeUtc).TotalSeconds -lt $MinStableSeconds){return $null}
    try{$s=([IO.File]::ReadAllText($f.FullName,[Text.Encoding]::UTF8) | ConvertFrom-Json -ErrorAction Stop)}catch{return $null}
    if($null -eq $s -or (PathValue $s 'session.isFinished') -ne $true){return $null}
    $id=IdentityId $s
    if($null -eq $id){return $null}
    $num=SessionNumber $s
    $name=SessionName $s
    $series=SeriesName $s
    if($null -eq $num -or -not $name -or -not $series){return $null}
    $date=TryDate $s
    if(-not $date -or $date.Year -ne $SeasonYear){return $null}
    # Do not resurrect obsolete test captures after first installation.
    $age=((Get-Date).ToUniversalTime() - $date.UtcDateTime).TotalDays
    if($age -lt -0.05 -or $age -gt 21){return $null}
    if($id -eq 99999995){return $null}
    return [pscustomobject]@{id=$id;num=$num;name=$name;series=$series;kind=(SessionKind $name $series);date=$date;capture=$s;file=$f.FullName;modified=$f.LastWriteTimeUtc}
}
function TryDate($s){
    $ts=FirstText $s @('timestamp')
    if(-not $ts){return $null}
    $out=[DateTimeOffset]::MinValue
    if([DateTimeOffset]::TryParse($ts,[ref]$out)){return $out.ToLocalTime()}
    return $null
}
function BuildArticle($feature,$meta,$rows){
    $win=$rows[0];$second=$rows[1];$third=if($rows.Count -gt 2){$rows[2]}else{$null}
    $track=$meta.track;$series=$meta.series;$round=$meta.round
    $fast=@($rows | Where-Object {$null -ne $_.best_lap_seconds -and $_.best_lap_seconds -gt 0} | Sort-Object best_lap_seconds | Select-Object -First 1)
    $gained=@($rows | Where-Object {$null -ne $_.positions_gained} | Sort-Object positions_gained -Descending | Select-Object -First 1)
    $headline="$($win.driver) wins $series Round $round at $track"
    $thirdText=if($null -ne $third){' and '+$third.driver}else{''}
    $deck="$($win.driver) takes the Feature ahead of $($second.driver)$thirdText."
    $paragraphs=New-Object System.Collections.Generic.List[string]
    $p1="$($win.driver) has won the $Competition $series Round $round Feature at $track. The completed KHR classification puts the #$($win.car_number) first out of $($rows.Count) classified drivers. $($second.driver) finished second"
    if($null -ne $third){$p1+=", with $($third.driver) third"};$paragraphs.Add($p1+'.')
    $p2=''
    if($null -ne $win.start_position){$p2+="The winner started P$($win.start_position) and finished P1";if($win.positions_gained -gt 0){$p2+=", a gain of $($win.positions_gained) places"};$p2+='. '}
    if($null -ne $second.start_position){$p2+="$($second.driver) started P$($second.start_position) and finished second. "}
    if($null -ne $third -and $null -ne $third.start_position){$p2+="$($third.driver) moved from P$($third.start_position) to P3. "}
    if(-not $p2){$p2='The Feature finishing order is taken from the completed race capture.'}
    $paragraphs.Add($p2.Trim())
    $p3=''
    if($fast.Count -gt 0){$p3+="The fastest available Feature lap was $([math]::Round($fast[0].best_lap_seconds,4).ToString('0.0000',[Globalization.CultureInfo]::InvariantCulture)) seconds, recorded by $($fast[0].driver). "}
    if($gained.Count -gt 0 -and $gained[0].positions_gained -gt 0){$p3+="The largest net gain was $($gained[0].positions_gained) places for $($gained[0].driver), from P$($gained[0].start_position) to P$($gained[0].finish_position). "}
    if($null -ne $win.laps_completed){$p3+="The winning classification records $($win.laps_completed) laps completed. "}
    if(-not $p3){$p3='The results and available meeting session classifications are listed below.'}
    $paragraphs.Add($p3.Trim())
    return [pscustomobject]@{headline=$headline;deck=$deck;kicker='MUD MULES TV RACE REPORT';paragraphs=$paragraphs.ToArray()}
}

$mutex=New-Object System.Threading.Mutex($false,'Local\MMTVAutoWebsitePublisher')
$locked=$false
try {
    $locked=$mutex.WaitOne(0)
    if(-not $locked){Note '[SKIP] Another publisher instance is running.';return}
    Require ($MinStableSeconds -ge 30) 'MinStableSeconds must be at least 30.'
    Require ($Competition -match '\S') 'Competition name is required.'
    if(-not (Test-Path -LiteralPath $StagePath -PathType Container) -and -not $lookupBroadcasts){Note '[WAIT] Finished-session staging directory not present yet.';return}
    $files=@(); if(Test-Path -LiteralPath $StagePath -PathType Container){$files=@(Get-ChildItem -LiteralPath $StagePath -Recurse -File -Filter 'session-*-finished-live.json' -ErrorAction Stop)}
    if($files.Count -eq 0 -and -not $lookupBroadcasts){Note '[WAIT] No completed-session snapshots staged yet.';return}
    $captures=New-Object System.Collections.Generic.List[object]
    foreach($f in $files){$info=SourceInfo $f;if($null -ne $info){$captures.Add($info)}}
    $features=@($captures | Where-Object {($_.kind -eq 'feature' -or $_.kind -eq 'twin_feature_2')} | Group-Object id | ForEach-Object {$_.Group | Sort-Object modified -Descending | Select-Object -First 1} | Sort-Object date)
    if($features.Count -eq 0 -and -not $lookupBroadcasts){Note "[WAIT] $($captures.Count) identified session captures; no settled, verified KHR Feature yet.";return}
    Note "[CHECK] $($features.Count) stable, identified KHR Feature capture(s) found."
    if($Status){foreach($f in $features){Note "[READY] $($f.id) $($f.series) $($f.name) at $($f.date)"};return}
    $gitCmd=Get-Command git.exe -CommandType Application -ErrorAction SilentlyContinue
    if(-not $gitCmd){$gitCmd=Get-Command git -CommandType Application -ErrorAction SilentlyContinue}
    Require ($null -ne $gitCmd) 'Git for Windows is required. No website files changed.'
    $gitExe=$gitCmd.Source
    $run=Join-Path $stagingRoot ('run-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    $repo=Join-Path $run 'repo'
    [IO.Directory]::CreateDirectory($run) | Out-Null
    & $gitExe -c core.autocrlf=false clone --quiet --depth 1 --branch main $repoUrl $repo
    Require ($LASTEXITCODE -eq 0) 'Git clone failed. The local archives were not touched.'
    & $gitExe -C $repo config core.autocrlf false
    Require ($LASTEXITCODE -eq 0) 'Could not enforce safe Git line endings.'
    $idxPath=Join-Path $repo 'news\data\live\index.json'
    $histPath=Join-Path $repo 'archive\index.json'
    $edPath=Join-Path $repo 'news\assets\editorial.js'
    $htmlPath=Join-Path $repo 'news\index.html'
    $idx=[IO.File]::ReadAllText($idxPath) | ConvertFrom-Json
    $hist=[IO.File]::ReadAllText($histPath) | ConvertFrom-Json
    $edText=[IO.File]::ReadAllText($edPath)
    Require ($edText -match '^\s*window\.MMTV_EDITORIAL\s*=\s*') 'Editorial file format changed; refusing changes.'
    $ed=($edText -replace '^\s*window\.MMTV_EDITORIAL\s*=\s*','' -replace ';\s*$','') | ConvertFrom-Json
    Require ($idx.schema_version -eq 'MMTV-live-index-v1' -and $hist.schema_version -eq 'KHR-public-index-v1' -and $ed.schema_version -eq 'MMTV-editorial-articles-v1') 'Website data schema changed; refusing to modify.'
    $known=@{};foreach($e in @($hist.events)+@($idx.events)){$known[[string]$e.subsession_id]=$true}
    $allEvents=@($hist.events)+@($idx.events)
    $new=New-Object System.Collections.Generic.List[object]
    $allowed=New-Object System.Collections.Generic.List[string]
    foreach($f in $features){
        $id=[string]$f.id
        if($known.ContainsKey($id)){continue}
        $series=$f.series
        $previous=@($allEvents | Where-Object {$_.series -eq $series -and (PathValue $_ 'competition') -eq $Competition})
        if($previous.Count -eq 0){$previous=@($allEvents | Where-Object {$_.series -eq $series -and ([string]$_.event_date).StartsWith([string]$SeasonYear)})}
        if($previous.Count -eq 0){Note "[SKIP] ${id}: no preceding race to establish round. Review season setup.";continue}
        $round=IntOrNull (PathValue $f.capture 'broadcast.championship.round')
        $maxRound=[int](($previous | Measure-Object -Property round -Maximum).Maximum)
        if($null -eq $round -or $round -le 0){$round=$maxRound+1}
        if($round -gt ($maxRound+1) -or $round -lt 1){Note "[SKIP] ${id}: unexpected round $round vs previous $maxRound.";continue}
        if(@($allEvents | Where-Object {$_.series -eq $series -and [int]$_.round -eq $round -and $_.subsession_id -ne $f.id}).Count -gt 0){Note "[SKIP] ${id}: $series round $round already published under another subsession ID.";continue}
        $track=FirstText $f.capture @('track.displayName','track.name')
        if(-not $track){Note "[SKIP] ${id}: track identity unavailable.";continue}
        $sf=@($captures | Where-Object {$_.id -eq $f.id -and $_.series -eq $series -and $_.kind} | Group-Object num | ForEach-Object {$_.Group | Sort-Object modified -Descending | Select-Object -First 1} | Sort-Object num)
        $sessions=New-Object System.Collections.Generic.List[object]
        $featureRows=$null
        foreach($s in $sf){
            try{
                $isFeature=($s.num -eq $f.num -and ($s.kind -eq 'feature' -or $s.kind -eq 'twin_feature_2'))
                $rows=DriverRows $s.capture $f.id $s.num $isFeature
                if($isFeature){$featureRows=$rows}
                else {$rows=DriverRows $s.capture $f.id $s.num $false}
                $sessions.Add([pscustomobject]@{
                    simsession_number=$s.num;name=$s.name.ToUpperInvariant();kind=$s.kind;available=$true;
                    classification=$rows;classification_source='completed_bridge_capture';sample_snapshots=$null;stable_tail_snapshots=$null
                })
            }catch{Note "[SKIP SESSION] $id $($s.name): $($_.Exception.Message)"}
        }
        if($null -eq $featureRows -or @($featureRows).Count -lt 2){Note "[SKIP] ${id}: no complete Feature classification.";continue}
        $winner=$featureRows[0]
        $date=$f.date.ToString('yyyy-MM-dd')
        $cautions=IntOrNull (PathValue $f.capture 'session.cautions')
        $numDrivers=IntOrNull (PathValue $f.capture 'driverCount')
        $event=[ordered]@{
            schema_version='KHR-public-results-v1';verification='live_captured';
            provenance='KHR_Bridge_saved_finished_session_capture';subsession_id=$f.id;
            series=$series;round=$round;track=$track;event_date=$date;
            event_summary=[ordered]@{event_laps_complete=$winner.laps_completed;num_drivers=$numDrivers;num_cautions=$cautions;num_caution_laps=$null};
            feature_results=$featureRows
        }
        $meeting=[ordered]@{
            schema_version='MMTV-live-meeting-v1';verification='live_captured';
            provenance='KHR_Bridge_saved_finished_session_capture';subsession_id=$f.id;
            series=$series;round=$round;track=$track;event_date=$date;sessions=$sessions.ToArray()
        }
        $indexEntry=[pscustomobject]@{
            subsession_id=$f.id;path="events/$id.json";verification='live_captured';competition=$Competition;
            series=$series;round=$round;track=$track;event_date=$date;feature_result_rows=@($featureRows).Count;
            winners=@([pscustomobject]@{session='FEATURE';session_number=$f.num;driver=$winner.driver;car_number=$winner.car_number})
        }
        $eventRel="news/data/live/events/$id.json";$meetingRel="news/data/live/meetings/$id.json"
        $eventDest=Join-Path $repo ($eventRel.Replace('/','\'))
        $meetingDest=Join-Path $repo ($meetingRel.Replace('/','\'))
        Require (-not (Test-Path -LiteralPath $eventDest) -and -not (Test-Path -LiteralPath $meetingDest)) "Destination race JSON already exists: $id"
        JsonSave $eventDest $event
        JsonSave $meetingDest $meeting
        $article=BuildArticle $f $indexEntry $featureRows
        $ed.events | Add-Member -NotePropertyName $id -NotePropertyValue $article -ErrorAction Stop
        $new.Add($indexEntry);$allEvents+=@($indexEntry);$known[$id]=$true
        $allowed.Add($eventRel);$allowed.Add($meetingRel)
        Note "[READY] $series R$round $track | #$($winner.car_number) $($winner.driver) | ID $id"
    }
    $broadcastCount=0
    if($lookupBroadcasts){
        try {
            $videos=@(Get-CompletedBroadcasts)
            $broadcastPath=Join-Path $repo 'news\data\broadcasts.json'
            $broadcasts=[IO.File]::ReadAllText($broadcastPath) | ConvertFrom-Json
            $broadcastCount=Add-BroadcastLinks $broadcasts $allEvents $videos $Competition $SeasonYear
            if($broadcastCount -gt 0){
                JsonSave $broadcastPath $broadcasts
                $allowed.Add('news/data/broadcasts.json')
            }
            Note "[BROADCASTS] $broadcastCount new subsession link(s); existing mappings retained."
        } catch { Note ('[YOUTUBE SKIP] '+$_.Exception.Message) }
    }
    if($new.Count -eq 0 -and $broadcastCount -eq 0){Note '[PASS] No new completed races or reliably matched broadcasts to publish.';return}
    if($new.Count -gt 0){
    $idx.events=@($idx.events)+$new.ToArray()
    $idx.event_count=@($idx.events).Count
    $ed.editorial_count=@($ed.events.PSObject.Properties).Count
    JsonSave $idxPath $idx
    [IO.File]::WriteAllText($edPath,'window.MMTV_EDITORIAL = '+(ConvertTo-Json -InputObject $ed -Depth 80 -Compress)+";`n",(New-Object Text.UTF8Encoding($false)))
    # Refresh the script URL after each new race so existing browsers get the new headlines.
    $html=[IO.File]::ReadAllText($htmlPath,[Text.Encoding]::UTF8)
    Require ($html -match 'assets/editorial\.js\?v=[A-Za-z0-9_-]+') 'HTML editorial cache marker missing.'
    $html=[regex]::Replace($html,'assets/editorial\.js\?v=[A-Za-z0-9_-]+',('assets/editorial.js?v=race-'+$new[$new.Count-1].subsession_id))
    [IO.File]::WriteAllText($htmlPath,$html.Replace("`r`n","`n"),(New-Object Text.UTF8Encoding($false)))
    $allowed.Add('news/data/live/index.json');$allowed.Add('news/assets/editorial.js');$allowed.Add('news/index.html')
    }
    $addArgs=@('-C',$repo,'add','--') + $allowed.ToArray()
    & $gitExe @addArgs
    Require ($LASTEXITCODE -eq 0) 'Git stage failed.'
    & $gitExe -C $repo diff --cached --check
    Require ($LASTEXITCODE -eq 0) 'Git staged whitespace check failed.'
    $changed=@(& $gitExe -C $repo diff --cached --name-only | Where-Object {$_})
    Require ($changed.Count -eq $allowed.Count) "Unexpected number of changed files: $($changed.Count) vs $($allowed.Count)"
    foreach($p in $changed){Require ($allowed.Contains($p)) "Unexpected staged file: $p"}
    Note "[PASS] $($new.Count) new completed races; $($changed.Count) allowlisted website files staged; no historical results altered."
    Note "[STAGING] $repo"
    if(-not $Publish){Note '[DRY RUN] No GitHub push. Add -Publish for automatic publication.';return}
    & $gitExe -C $repo -c user.name='Mud Mules TV Auto Publisher' -c user.email='mmtv-auto-publisher@users.noreply.github.com' commit --quiet -m ("MMTV: publish $($new.Count) race(s), $broadcastCount broadcast link(s)")
    Require ($LASTEXITCODE -eq 0) 'Git commit failed; no push performed.'
    & $gitExe -C $repo push origin HEAD:main
    Require ($LASTEXITCODE -eq 0) 'GitHub push failed; canonical archive remains unchanged. Run the publisher again to retry.'
    foreach($e in $new){Note "[PUBLISHED] https://bobbeth.github.io/khr-live-timing/news/#race/$($e.subsession_id)"}
}
catch {Note ('[ERROR] '+$_.Exception.Message);throw}
finally {if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}
