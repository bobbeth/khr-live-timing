import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse(await fs.readFile(new URL(p,import.meta.url),'utf8'));
const index=await read('../data/broadcasts.json');
const audit=await read('../data/broadcast-audit.json');
const original=await read('../../tools/website-publisher/fixtures/broadcasts-before.json');
const schedule=await read('../data/schedule.json');
const races=new Map([...(await read('../../archive/index.json')).events,...(await read('../data/live/index.json')).events].map(e=>[String(e.subsession_id),e]));
const normalize=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');
const day=seconds=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Hobart',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(seconds*1000));
const patterns={'Bomber Stocks':/bomm?ber\s+stocks/i,'Cushion Kings':/cushion\s+kings?\b/i,'Mini Menaces':/mini\s+menaces/i,'Yota Outlawz':/yota\s+outlawz/i,'Wide Open Revival':/wide\s+open\s+revival/i};
assert.equal(Object.keys(audit.events).length,25);
assert.equal(Object.keys(audit.videos).length,15);
let viewed=0;
for(const [id,previous] of Object.entries(original.events)){
 const link=index.events[id],evidence=audit.events[id],video=audit.videos[link.video_id],race=races.get(id);
 assert.equal(link.video_id,previous.video_id,'Do not replace an existing video');
 assert.equal(link.start_seconds,previous.start_seconds,'Do not replace or invent a bookmark');
 assert.equal(link.round,previous.round);assert.equal(link.series,previous.series);
 assert.equal(evidence.video_id,link.video_id);
 assert.equal(evidence.previous_mapping.match_status,previous.match_status);
 assert.equal(evidence.previous_mapping.match_method,previous.match_method);
 assert.equal(video.channel_id,'UCdp4gP29AQWrMdoubvgekyA');
 assert.ok(['was_live','post_live'].includes(video.live_status));
 assert.ok(/Knuckleheadz.*Fall Fest 2026/i.test(video.title));
 assert.equal(day(video.release_timestamp),link.broadcast_date);
 assert.equal(schedule.events.filter(e=>e.series===race.series&&Number(e.round)===Number(race.round)&&e.date===link.broadcast_date).length,1);
 assert.ok(patterns[race.series].test(evidence.series_description_excerpt));
 assert.ok(video.description_excerpt.includes(evidence.series_description_excerpt));
 const plausibleDates=[new Date(video.release_timestamp*1000).toISOString().slice(0,10),new Date((video.release_timestamp+video.duration)*1000).toISOString().slice(0,10),link.broadcast_date];
 assert.ok(plausibleDates.includes(race.event_date),'Retain but explain archived UTC/local dates');
 if(evidence.footage_observation){
  viewed++;const observation=evidence.footage_observation;
  assert.equal(link.match_status,'content_verified');assert.equal(observation.track,race.track);assert.equal(observation.series,race.series);
  assert.ok(observation.observed_at_seconds>0&&observation.observed_at_seconds<video.duration);
  const record=await read('../../archive/'+race.path).catch(()=>read('../data/live/events/'+id+'.json'));
  assert.deepEqual(observation.podium.map(normalize),record.feature_results.slice(0,3).map(r=>normalize(r.driver)));
 }else{
  assert.equal(link.match_status,'metadata_matched');
  const registry=await read('../data/tracks.json');
  const track=registry.tracks.find(t=>t.aliases.some(a=>normalize(a)===normalize(race.track)));
  assert.ok(track.aliases.some(a=>normalize(evidence.series_description_excerpt).includes(normalize(a)))||(id==='89155471'&&evidence.source_spelling_note&&evidence.series_description_excerpt.includes('Lanier National Speeday - Dirt')));
 }
}
assert.equal(viewed,2);
assert.equal(index.events['88962942'].start_seconds,4560);
for(const id of ['89810317','89812470']){assert.equal(index.events[id].video_id,'IyXQ4OjSR3Y');assert.equal(index.events[id].match_status,'metadata_matched');assert.equal(index.events[id].start_seconds,undefined);}
assert.ok(!Object.values(index.events).some(e=>e.match_status==='schedule_inferred'));
console.log('PASS: 25 older mappings, 15 source recordings, dates/series/venues, two footage-checked podiums, all original IDs/offsets and Round 6 preserved.');
