# Mud Mules TV automatic completed-race website publisher (PowerShell 5.1).
# Reads canonical records and checksum-verified native completed captures. Writes an isolated Git clone.
# Never changes the Bridge, canonical archive, live.json, or website archive.
[CmdletBinding()]
param(
    [switch]$Publish,
    [string]$RepositoryUrl='https://github.com/bobbeth/khr-live-timing.git',
    [string]$AdapterSourcePath='',
    [string]$NodePath='',
    [switch]$Status,
    [switch]$CheckBroadcasts,
    [switch]$SkipBroadcasts,
    [switch]$CheckDriverProfiles,
    [switch]$SkipDriverProfiles,
    [string]$DriverSettingsPath='F:\Backup\KHR Bot\Driver Profiles\settings.json',
    [string]$DriverStateRoot='',
    [string]$WorkRoot = (Join-Path $env:USERPROFILE 'Documents\KHR Broadcast'),
    [string]$StagePath = (Join-Path $env:USERPROFILE 'Documents\KHR Broadcast\Race Archives\Unified\live-staging'),
    [string]$CanonicalPath = (Join-Path $env:USERPROFILE 'Documents\KHR Broadcast\Race Archives\Unified\canonical'),
    [int]$MinStableSeconds = 90,
    [string]$Competition = 'Fall Fest 2026',
    [int]$SeasonYear = 2026
)
. (Join-Path $PSScriptRoot 'BroadcastLinks.ps1')
. (Join-Path $PSScriptRoot 'DriverProfiles.ps1')
. (Join-Path $PSScriptRoot 'Export-Intelligence.ps1')
$lookupProfiles = -not $SkipDriverProfiles -and ($CheckDriverProfiles -or $CheckBroadcasts -or ([Environment]::CommandLine -notmatch '(?i)-NonInteractive'))
$lookupBroadcasts = -not $SkipBroadcasts -and ($CheckBroadcasts -or ([Environment]::CommandLine -notmatch '(?i)-NonInteractive'))
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$repoUrl = $RepositoryUrl
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
    if($series -eq 'Bomber Stocks' -and $n -match '^B-MAIN$|^B MAIN$|^CONSOLATION$|^TWIN\s*FEATURE\s*1$|^FEATURE\s*1$'){return 'twin_feature_1'}
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
            incidents=$null;champ_points=$null;reason_out=(PathValue $d 'reason')
        }
        if($isFeature){$row=[ordered]@{
            session='FEATURE';session_number=$num;subsession_id=$id;finish_position=$pos;start_position=$start;
            driver=$name;car_number=$car;positions_gained=$gain;laps_completed=$lap;laps_led=$led;
            best_lap_seconds=$best;incidents=$null;champ_points=$null;reason_out=(PathValue $d 'reason')
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
    $win=$rows[0];$second=$rows[1]
    $track=$meta.track;$series=$meta.series;$round=$meta.round
    $start=$win.start_position
    $gain=$win.positions_gained
    $headline="$($win.driver) takes $series Round $round at $track"
    $lead="$($win.driver) took $series Round $round at $track in the #$($win.car_number)."
    if($null -ne $start -and $start -gt 0){
        if($null -ne $gain -and $gain -ge 5){
            $headline="$($win.driver) comes from P$start to win at $track"
            $lead="P$start to the win. $($win.driver) gained $gain places to take $series Round $round at $track in the #$($win.car_number)."
        } elseif($start -eq 1){
            $lead="$($win.driver) took $series Round $round at $track, starting on pole and bringing the #$($win.car_number) home first."
        } else {
            $lead="$($win.driver) won $series Round $round at $track, bringing the #$($win.car_number) from P$start to first."
        }
    }
    $third=if($rows.Count -gt 2){$rows[2]}else{$null}
    $deck="$($second.driver) takes second"
    if($null -ne $third){$deck+=", with $($third.driver) third"}
    $deck+='.'
    $paragraphs=New-Object System.Collections.Generic.List[string]
    $paragraphs.Add($lead)
    $podium="$($second.driver) finished second"
    if($null -ne $second.start_position -and $second.start_position -gt 2){$podium+=" from P$($second.start_position)"}
    if($null -ne $third){
        $podium+=", with $($third.driver) third"
        if($null -ne $third.start_position -and $third.start_position -gt 3){$podium+=" from P$($third.start_position)"}
    }
    $podium+='.'
    if($rows.Count -gt 3){
        $podium+=" $($rows[3].driver) took fourth"
        if($rows.Count -gt 4){$podium+=" ahead of $($rows[4].driver)"}
        $podium+='.'
    }
    $paragraphs.Add($podium)
    $notes=New-Object System.Collections.Generic.List[string]
    $gained=@($rows | Where-Object {$null -ne $_.positions_gained -and $_.positions_gained -gt 0} | Sort-Object positions_gained -Descending | Select-Object -First 1)
    if($gained.Count -gt 0 -and $gained[0].driver -ne $win.driver){
        $m=$gained[0]
        $notes.Add("$($m.driver) made up $($m.positions_gained) places to finish P$($m.finish_position).")
    }
    $fast=@($rows | Where-Object {$null -ne $_.best_lap_seconds -and $_.best_lap_seconds -gt 0} | Sort-Object best_lap_seconds | Select-Object -First 1)
    if($fast.Count -gt 0){$notes.Add("$($fast[0].driver) set the fastest lap at $([math]::Round($fast[0].best_lap_seconds,4).ToString('0.0000',[Globalization.CultureInfo]::InvariantCulture)) seconds.")}
    if($notes.Count -gt 0){$paragraphs.Add(($notes.ToArray() -join ' '))}
    return [pscustomobject]@{headline=$headline;deck=$deck;kicker='MUD MULES TV RACE REPORT';paragraphs=$paragraphs.ToArray()}
}

function CanonicalSessions($file){
    if(((Get-Date).ToUniversalTime()-$file.LastWriteTimeUtc).TotalSeconds -lt $MinStableSeconds){return}
    $c=[IO.File]::ReadAllText($file.FullName) | ConvertFrom-Json
    $id=IntOrNull (PathValue $c 'subsession_id')
    Require ($id -eq (IntOrNull $file.BaseName)) "Canonical filename/identity mismatch: $($file.Name)"
    $features=@(PathValue $c 'sdk_completed_results' | Where-Object { (PathValue $_ 'role') -eq 'feature' -and @(PathValue $_ 'results').Count -ge 2 })
    if($features.Count -eq 0){return}
    # Canonical is the catalogue; resolve its latest immutable linked capture, never guess filenames.
    $feature=$features | Sort-Object capturedAt -Descending | Select-Object -First 1
    $refs=@(PathValue $c 'live.captures' | Where-Object { (IntOrNull (PathValue $_ 'sessionNum')) -eq (IntOrNull $feature.sessionNum) })
    if($refs.Count -eq 0){Note "[SKIP] ${id}: canonical Feature has no linked native capture.";return}
    $ref=$refs[$refs.Count-1]
    $unified=[IO.Path]::GetFullPath((Split-Path -Parent $CanonicalPath)).TrimEnd('\')+'\'
    $path=[IO.Path]::GetFullPath((Join-Path $unified ([string]$ref.file)))
    Require ($path.StartsWith($unified,[StringComparison]::OrdinalIgnoreCase) -and ([string]$ref.file -match '^live-staging[/\\]')) "Unsafe canonical capture path: $id"
    Require (Test-Path -LiteralPath $path -PathType Leaf) "Missing canonical-linked capture: $id"
    Require ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -eq $ref.sha256) "Canonical capture checksum mismatch: $id"
    $info=SourceInfo (Get-Item -LiteralPath $path)
    if($null -eq $info){Note "[SKIP] ${id}: latest linked Feature is not settled and finished.";return}
    Require ($info.id -eq $id -and $info.num -eq $feature.sessionNum) "Canonical/native identity mismatch: $id"
    $round=IntOrNull (PathValue $c 'round')
    Require ($null -ne $round -and $round -gt 0) "Canonical round unavailable: $id"
    foreach($native in @(PathValue $info.capture 'broadcast.nativeHistoricalResults.sessions')){
        if($null -eq $native -or (PathValue $native 'completedCandidate') -ne $true){continue}
        Require ((PathValue $native 'structureValid') -eq $true -and (IntOrNull $native.resultsOfficial) -eq 1) "Invalid native completion: $id/$($native.sessionNum)"
        $num=IntOrNull $native.sessionNum
        $kind=SessionKind $native.sessionName $info.series
        if(-not $kind){continue}
        $rows=@($native.results)
        Require ($rows.Count -ge 2 -and $rows.Count -eq (IntOrNull $native.classificationCount)) "Native row count mismatch: $id/$num"
        $stable=@(PathValue $info.capture 'broadcast.nativeClassificationStability.sessions' | Where-Object { $_.sessionNum -eq $num })
        Require ($stable.Count -eq 1 -and $stable[0].classificationUnchanged -eq $true -and $stable[0].eventIdentityValid -eq $true -and $stable[0].unchangedSeconds -ge $stable[0].minimumSeconds) "Native classification not stable: $id/$num"
        $distance=IntOrNull $native.resultsLapsComplete
        Require ($null -ne $distance -and $distance -gt 0) "Native distance missing: $id/$num"
        $cars=@{}
        foreach($row in $rows){
            $car=TextVal $row.number;$lap=IntOrNull $row.lapsCompleted
            Require ($car -and -not $cars.ContainsKey($car) -and (TextVal $row.name) -and $null -ne $lap -and $lap -ge 0 -and $lap -le $distance) "Invalid native driver identity/laps: $id/$num"
            $cars[$car]=$true
        }
        $winner=@($rows | Where-Object { $_.position -eq 1 })
        Require ($winner.Count -eq 1 -and $winner[0].lapsCompleted -eq $distance) "Native winner/distance mismatch: $id/$num"
        # Do not assume snapshot starts, best laps, points or led-lap counters are final.
        $drivers=@($rows | ForEach-Object { [pscustomobject]@{position=$_.position;number=$_.number;name=$_.name;lapsCompleted=$_.lapsCompleted;startPosition=$null;sdkStartPosition=$null;lapsLed=$null;bestLap=$null;reason=$_.reason} })
        $capture=[pscustomobject]@{drivers=$drivers}
        $infoCopy=[pscustomobject]@{id=$id;num=$num;name=$native.sessionName;series=$info.series;kind=$kind;date=$info.date;capture=$capture;file=$path;modified=$file.LastWriteTimeUtc;round=$round;nativeDistance=$distance;metadata=$info.capture}
        $null=DriverRows $capture $id $num ($kind -eq 'feature' -or $kind -eq 'twin_feature_2')
        $infoCopy
    }
}
function Publish-WebsiteCommit([string]$Git,[string]$Repository,[string]$Base,[string[]]$Allowed){
    $expected=@(& $Git -C $Repository diff --name-only $Base HEAD --)
    Require ($LASTEXITCODE -eq 0 -and $expected.Count -gt 0) 'No publication commit found.'
    foreach($p in $expected){Require ($Allowed -contains $p) "Commit contains unapproved file: $p"}
    for($attempt=1;$attempt -le 4;$attempt++){
        & $Git -C $Repository fetch --quiet origin main
        Require ($LASTEXITCODE -eq 0) 'Git fetch failed; prepared publication retained.'
        $remoteChanges=@(& $Git -C $Repository diff --name-only $Base origin/main --)
        Require ($LASTEXITCODE -eq 0) 'Cannot compare remote changes; prepared publication retained.'
        foreach($p in $remoteChanges){Require ($expected -notcontains $p) "Concurrent website change in $p; prepared publication retained. Review manually."}
        & $Git -C $Repository -c core.editor=true rebase origin/main
        if($LASTEXITCODE -ne 0){
            & $Git -C $Repository rebase --abort
            throw 'Rebase conflict; aborted safely. Prepared publication retained.'
        }
        $rebased=@(& $Git -C $Repository diff --name-only origin/main HEAD --)
        Require ($LASTEXITCODE -eq 0 -and (($rebased | Sort-Object) -join '|') -eq (($expected | Sort-Object) -join '|')) 'Publication paths changed during rebase; push stopped.'
        # Capture a rejected push as text, rather than a terminating PowerShell native stderr error.
        $oldPreference=$ErrorActionPreference
        $ErrorActionPreference='Continue'
        $output=@(& $Git -C $Repository push origin HEAD:main 2>&1)
        $exit=$LASTEXITCODE
        $ErrorActionPreference=$oldPreference
        foreach($line in $output){Note ([string]$line)}
        if($exit -eq 0){Note "[PUSH PASS] Published after attempt $attempt.";return}
        $message=$output -join [Environment]::NewLine
        Require ($message -match '\[rejected\].*(fetch first|non-fast-forward)') 'GitHub push failed for a reason other than concurrent updates; prepared publication retained.'
        if($attempt -lt 4){Note "[RETRY] Remote advanced during push; refreshing ($attempt/4).";Start-Sleep -Seconds $attempt}
    }
    throw 'Remote kept advancing after four bounded attempts; prepared publication retained. No force push attempted.'
}

$mutexName='Local\MMTVAutoWebsitePublisher'
if($RepositoryUrl -ne 'https://github.com/bobbeth/khr-live-timing.git'){$digest=[Security.Cryptography.SHA256]::Create();try{$mutexName='Local\MMTVPublisherTest-'+[BitConverter]::ToString($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($RepositoryUrl))).Replace('-','')}finally{$digest.Dispose()}}
$mutex=New-Object System.Threading.Mutex($false,$mutexName)
$locked=$false
try {
    $locked=$mutex.WaitOne(0)
    if(-not $locked){Note '[SKIP] Another publisher instance is running.';return}
    Require ($MinStableSeconds -ge 30) 'MinStableSeconds must be at least 30.'
    Require ($Competition -match '\S') 'Competition name is required.'
    $captures=New-Object System.Collections.Generic.List[object]
    Require (Test-Path -LiteralPath $CanonicalPath -PathType Container) 'Canonical archive directory is missing.'
    foreach($file in @(Get-ChildItem -LiteralPath $CanonicalPath -File -Filter '*.json')){
        if($file.BaseName -notmatch '^\d{7,12}$'){continue}
        foreach($info in @(CanonicalSessions $file)){if($null -ne $info){$captures.Add($info)}}
    }
    $features=@($captures | Where-Object { $_.kind -eq 'feature' -or $_.kind -eq 'twin_feature_2' } | Sort-Object date)
    Note "[CHECK] $($features.Count) canonical races with stable native completed Feature results found."
    if($Status){foreach($f in $features){Note "[READY] $($f.id) $($f.series) R$($f.round): $($f.nativeDistance) laps, $(@($f.capture.drivers).Count) native classified drivers"};return}
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
        $round=$f.round
        $maxRound=[int](($previous | Measure-Object -Property round -Maximum).Maximum)
        if($null -eq $round -or $round -le 0){$round=$maxRound+1}
        if($round -gt ($maxRound+1) -or $round -lt 1){Note "[SKIP] ${id}: unexpected round $round vs previous $maxRound.";continue}
        if(@($allEvents | Where-Object {$_.series -eq $series -and [int]$_.round -eq $round -and $_.subsession_id -ne $f.id}).Count -gt 0){Note "[SKIP] ${id}: $series round $round already published under another subsession ID.";continue}
        $track=FirstText $f.metadata @('track.displayName','track.name')
        if(-not $track){Note "[SKIP] ${id}: track identity unavailable.";continue}
        $sf=@($captures | Where-Object {$_.id -eq $f.id -and $_.series -eq $series -and $_.kind} | Group-Object num | ForEach-Object {$_.Group | Sort-Object modified -Descending | Select-Object -First 1} | Sort-Object num)
        $sessions=New-Object System.Collections.Generic.List[object]
        $featureRows=$null
        foreach($s in $sf){
            try{
                $isFeature=($s.num -eq $f.num -and ($s.kind -eq 'feature' -or $s.kind -eq 'twin_feature_2'))
                $rows=DriverRows $s.capture $f.id $s.num $isFeature
                if($isFeature){$featureRows=$rows}
                $rows=DriverRows $s.capture $f.id $s.num $false
                $sessions.Add([pscustomobject]@{
                    simsession_number=$s.num;name=$s.name.ToUpperInvariant();kind=$s.kind;available=$true;
                    classification=$rows;classification_source='sdk_native_completed_classification';sample_snapshots=$null;stable_tail_snapshots=$null
                })
            }catch{Note "[SKIP SESSION] $id $($s.name): $($_.Exception.Message)"}
        }
        if($null -eq $featureRows -or @($featureRows).Count -lt 2){Note "[SKIP] ${id}: no complete Feature classification.";continue}
        $winner=$featureRows[0]
        $date=$f.date.ToString('yyyy-MM-dd')
        $cautions=IntOrNull (PathValue $f.metadata 'session.cautions')
        $numDrivers=@($featureRows).Count
        $event=[ordered]@{
            schema_version='KHR-public-results-v1';verification='live_captured';
            provenance='canonical_linked_SDK_native_completed_classification';subsession_id=$f.id;
            series=$series;round=$round;track=$track;event_date=$date;
            event_summary=[ordered]@{event_laps_complete=$winner.laps_completed;num_drivers=$numDrivers;num_cautions=$cautions;num_caution_laps=$null};
            feature_results=$featureRows
        }
        $meeting=[ordered]@{
            schema_version='MMTV-live-meeting-v1';verification='live_captured';
            provenance='canonical_linked_SDK_native_completed_classification';subsession_id=$f.id;
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
    $profileChanged=$false
    $autoDriverDiscovery=$false
    if(-not $SkipDriverProfiles -and (Test-Path -LiteralPath $DriverSettingsPath)){
        try{$autoDriverDiscovery=(Get-Content -LiteralPath $DriverSettingsPath -Raw|ConvertFrom-Json).enabled -eq $true}catch{Note '[DRIVER DISCOVERY] Invalid settings; disabled.'}
    }
    if($lookupProfiles -or $autoDriverDiscovery){
        try{
            if(-not $DriverStateRoot){
                if($Publish){$DriverStateRoot='F:\Backup\KHR Bot\Driver Profiles\state'}
                else{$DriverStateRoot=Join-Path $WorkRoot 'Website Publisher\driver-state-dry-run'}
            }
            $profileUpdate=Invoke-MMTVDriverWorkflow -RepositoryPath $repo -NodePath $NodePath -StateRoot $DriverStateRoot -SettingsPath $DriverSettingsPath -Manual:$lookupProfiles
            $profileChanged=$profileUpdate.changed
            foreach($driverPath in @($profileUpdate.changed_paths)){
                Require ($driverPath -in @('news/data/driver-identities.json','news/data/driver-profiles.json')) 'Unexpected driver output path.'
                $allowed.Add($driverPath)
            }
            Note "[DRIVER DISCOVERY] $($profileUpdate.discovery_status); profile refresh $($profileUpdate.profile_status)."
            Note "[DRIVER PROFILES] $($profileUpdate.available) supplied profiles / $($profileUpdate.identified) verified driver IDs."
        }catch{Note ('[PROFILE SKIP] '+$_.Exception.Message)}
    }

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
    $intelligence=Write-MMTVIntelligence -RepositoryPath $repo -CanonicalPath $CanonicalPath -AdapterSourcePath $AdapterSourcePath -NodePath $NodePath -MinStableSeconds $MinStableSeconds -DriverSettingsPath $DriverSettingsPath
    foreach($path in @($intelligence.changed_paths)){Require ($path -match '^news/data/intelligence/((index|drivers|races|venues|championships|catalogue)\.json|events/[0-9]{6,12}\.json)$') "Unapproved intelligence output: $path";if($path -match '/events/(\d+)\.json$'){Require (@($intelligence.subsession_ids) -contains [long]$Matches[1]) "Unknown intelligence event output: $path"};$allowed.Add($path)}
    Note "[INTELLIGENCE] $($intelligence.event_count) canonical race events; $(@($intelligence.changed_paths).Count) changed derived files."
    if($allowed.Count -eq 0){Note '[PASS] No new races, broadcasts, driver profiles or intelligence changes to publish.';return}
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
    $base=(& $gitExe -C $repo rev-parse HEAD).Trim()
    Require ($LASTEXITCODE -eq 0) 'Cannot establish publication base.'
    & $gitExe -C $repo -c user.name='Mud Mules TV Auto Publisher' -c user.email='mmtv-auto-publisher@users.noreply.github.com' commit --quiet -m ("MMTV: publish $($new.Count) race(s), $broadcastCount broadcast link(s), profiles=$profileChanged")
    Require ($LASTEXITCODE -eq 0) 'Git commit failed; no push performed.'
    Publish-WebsiteCommit $gitExe $repo $base $allowed.ToArray()
    foreach($e in $new){Note "[PUBLISHED] https://bobbeth.github.io/khr-live-timing/news/#race/$($e.subsession_id)"}
}
catch {Note ('[ERROR] '+$_.Exception.Message);throw}
finally {if($locked){$mutex.ReleaseMutex()};$mutex.Dispose()}


# SIG # Begin signature block
# MIIHMAYJKoZIhvcNAQcCoIIHITCCBx0CAQExDzANBglghkgBZQMEAgEFADB5Bgor
# BgEEAYI3AgEEoGswaTA0BgorBgEEAYI3AgEeMCYCAwEAAAQQH8w7YFlLCE63JNLG
# KX7zUQIBAAIBAAIBAAIBAAIBADAxMA0GCWCGSAFlAwQCAQUABCBuUXvc+mimG/JT
# zGWn519PLaOc7PmPSQL38zyW94DuDKCCBBwwggQYMIICgKADAgECAhBjgsjexbsj
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
# MC8GCSqGSIb3DQEJBDEiBCDFNOOfrh/L20flvBwLq+Ibbf5FkPZQhrPdUA40CWet
# DzANBgkqhkiG9w0BAQEFAASCAYANZu7pXj2uPqzRW9/n1Xli9SbSUm4sINn/CyEP
# vAEZwJVFtd/m6aC/9DQxdLYiuAaG3UvozAPZehW7l+lVuqtcgSNM6YRUYhEBXX/2
# q8U/mV+sc0DbbEl/uU+FfcS++cpytgQyTW47XOtAU514prZaDZfUeRsxWOEFM0Q0
# 63oigjawW59V5aTCCzKnzIqgwM15gw46ByuePIMVCnAVjgH07BFi29+gHtA99xP2
# WhR07Di2BoxTUwpfhfUwHLKFqLi9mcHUS95wC+3nxE+v4XSSXIumxExLzbuFXv9P
# JnpNI9pWUIFOinH+A9mr+usDPv76cxYABJ/+USbhH+80YLdPo5BlQhmuo7yzsxUA
# sROiaoiMyLr5/taG/kGNUDhHIXx9YNxOAiZVGPTYp3VK6gMZ2XLOZmhn7nBZ/avl
# rauRihTIX2ytltB+Ns6T4a/LXcnIuN8xNWdC1qm08iM2XGhpBBclh+xSA06XMTl5
# skQ7A9UDz2I0eg9tmpUnJERCJ9A=
# SIG # End signature block
