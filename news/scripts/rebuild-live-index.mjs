// Mud Mules TV: index complete race exports uploaded by the local archive publisher.
// Does not touch the live timing Bridge or the canonical PC archive.
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const root = process.cwd();
const archiveIndex = read(join(root, 'archive/index.json'));
const officialIds = new Set((archiveIndex.events || []).map(e => Number(e.subsession_id)));
const eventsDir = join(root, 'news/data/live/events');
const meetingsDir = join(root, 'news/data/live/meetings');
const indexPath = join(root, 'news/data/live/index.json');
const existing = read(indexPath);
const entries = [];
const log = (id, reason) => console.warn(`SKIP ${id}: ${reason}`);
const safeText = x => typeof x === 'string' && x.trim().length > 0;
const sameName = (a,b) => String(a||'').replace(/\s+/g,' ').trim().toLowerCase() === String(b||'').replace(/\s+/g,' ').trim().toLowerCase();

for (const filename of readdirSync(eventsDir).filter(x => /^\d{7,12}\.json$/.test(x)).sort()) {
  const id = Number(filename.slice(0,-5));
  if (officialIds.has(id)) continue; // An official archive record always takes precedence.
  const meetingPath = join(meetingsDir, filename);
  if (!existsSync(meetingPath)) { log(id, 'matching meeting export not uploaded yet'); continue; }
  try {
    const event = read(join(eventsDir, filename));
    const meeting = read(meetingPath);
    if (Number(event.subsession_id) !== id || Number(meeting.subsession_id) !== id)
      throw Error('subsession ID does not match file or paired meeting');
    if (event.schema_version !== 'KHR-public-results-v1' ||
        !['live_captured','official_backed'].includes(event.verification))
      throw Error('not a recognised completed race export');
    if (!['MMTV-live-meeting-v1','MMTV-official-meeting-v2'].includes(meeting.schema_version))
      throw Error('unrecognised full meeting export');
    if (event.series !== meeting.series || Number(event.round) !== Number(meeting.round) || event.track !== meeting.track)
      throw Error('event and meeting identity mismatch');
    if (!safeText(event.series) || !safeText(event.track) || !/^\d{4}-\d{2}-\d{2}$/.test(event.event_date || '') ||
        !Number.isInteger(Number(event.round)) || Number(event.round) < 1)
      throw Error('required race identity fields missing');
    if (!Array.isArray(event.feature_results) || !event.feature_results.length)
      throw Error('Feature classification missing');
    const wins = event.feature_results.filter(r => Number(r.finish_position) === 1);
    if (wins.length !== 1 || !safeText(wins[0].driver) || !safeText(String(wins[0].car_number ?? '')))
      throw Error('unambiguous Feature winner missing');
    const features = (meeting.sessions||[]).filter(s => s.available && (s.kind === 'feature' || (event.series === 'Bomber Stocks' && s.kind === 'twin_feature_2')) && Array.isArray(s.classification));
    if (!features.length) throw Error('completed Feature meeting session missing');
    const finalFeature = features.at(-1);
    const meetingWins = finalFeature.classification.filter(r => Number(r.position) === 1);
    if (meetingWins.length !== 1 || !sameName(wins[0].driver,meetingWins[0].driver) ||
        String(wins[0].car_number) !== String(meetingWins[0].car_number))
      throw Error('Feature winner differs between event and meeting exports');
    const entry = {
      subsession_id:id, path:`events/${filename}`, verification:event.verification,
      series:event.series, round:Number(event.round), track:event.track,
      event_date:event.event_date, feature_result_rows:event.feature_results.length,
      winners:[{session:wins[0].session||'FEATURE',
        session_number:Number(wins[0].session_number ?? finalFeature.simsession_number ?? 0),
        driver:wins[0].driver,car_number:String(wins[0].car_number)}]
    };
    const competition = event.competition || meeting.competition ||
      (event.event_date.startsWith('2026-') &&
       ['Bomber Stocks','Cushion Kings','Mini Menaces','Yota Outlawz','Wide Open Revival'].includes(event.series)
        ? 'Fall Fest 2026' : null);
    if (competition) entry.competition = competition;
    entries.push(entry);
  } catch (err) { log(id, err.message); }
}
entries.sort((a,b) => a.event_date.localeCompare(b.event_date) || a.series.localeCompare(b.series) || a.subsession_id-b.subsession_id);
const newIndex = {schema_version:'MMTV-live-index-v1', status:'completed_bridge_captures',
  event_count:entries.length, events:entries};
if (JSON.stringify(existing) === JSON.stringify(newIndex)) {
  console.log(`UNCHANGED: ${entries.length} paired live race reports already indexed`);
} else {
  writeFileSync(indexPath,JSON.stringify(newIndex)+'\n');
  console.log(`UPDATED: ${entries.length} completed live race reports indexed (was ${existing.events?.length||0})`);
}
