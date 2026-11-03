/* Session-specific result semantics. Raw champ_points is never a league-points verdict. */
window.MMTVResults=(()=>{
 const valid=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
 const racing=['heat','consolation','twin_feature_1','twin_feature_2','feature','race'];
 const series=['Bomber Stocks','Cushion Kings','Mini Menaces','Yota Outlawz','Wide Open Revival'];
 const kind=s=>/^WARM/i.test(s?.name||'')?'warmup':s?.kind||'other';
 const applicable=s=>{const k=kind(s);return ['position','car_number','driver','laps_completed','best_lap_seconds','average_lap_seconds','incidents','reason_out',...(racing.includes(k)?['start_position','positions_gained','laps_led']:[]),...(k==='qualifying'?['qual_lap_seconds']:[]),...(racing.includes(k)||k==='qualifying'?['league_points','champ_points']:[])];};
 function score(row,entry,s,rule){
  if(!(racing.includes(kind(s))||kind(s)==='qualifying'))return {value:null,status:'not_applicable'};
  const proof=row.league_points_provenance||row.field_provenance?.league_points||row.field_provenance?.fields?.league_points;
  if(valid(row.league_points)&&row.league_points_status==='saved_league'&&proof?.league_id===10402&&/\.league_points$/.test(proof.field||'')&&proof.official===true)return {value:Number(row.league_points),status:'saved_league',proof};
  if(valid(row.league_points)&&row.league_points_status==='calculated_provisional'&&proof?.field==='existing_KHR_series_session_scoring_rules'&&proof.official===false)return {value:Number(row.league_points),status:'calculated_provisional',proof};
  if(series.includes(entry?.series)){const value=rule(entry.series,kind(s),Number(row.position??row.finish_position));if(valid(value))return {value:Number(value),status:'calculated_provisional',proof:{certainty:'calculated_provisional',field:'existing_KHR_series_session_scoring_rules',official:false}};}
  return {value:null,status:'not_recorded'};
 }
 function columns(s,entry){const k=kind(s),cols=[['position','POS'],['car_number','CAR'],['driver','DRIVER']];
  if(racing.includes(k))cols.push(['start_position','START'],['positions_gained','+/-'],['laps_completed','LAPS'],['laps_led','LED'],['best_lap_seconds','BEST LAP'],['incidents','INC']);
  else if(k==='qualifying'){if((s.classification||[]).some(r=>valid(r.qual_lap_seconds)&&r.qual_lap_seconds>0))cols.push(['qual_lap_seconds','QUAL TIME']);cols.push(['best_lap_seconds','BEST LAP'],['laps_completed','LAPS'],['incidents','INC']);}
  else cols.push(['laps_completed','LAPS'],['best_lap_seconds','BEST LAP'],['incidents','INC']);
  if(series.includes(entry?.series)&&(racing.includes(k)||k==='qualifying'))cols.push(['league_points','PTS']);return cols;
 }
 const gain=r=>valid(r.positions_gained)?Number(r.positions_gained):valid(r.start_position)&&valid(r.finish_position)?Number(r.start_position)-Number(r.finish_position):null;
 function sort(rows,by){const config={start:['start_position',1],gained:['gain',-1],fastest:['best_lap_seconds',1],led:['laps_led',-1]},[field,direction]=config[by]||['finish_position',1];return [...rows].sort((a,b)=>{const x=field==='gain'?gain(a):a[field],y=field==='gain'?gain(b):b[field],vx=valid(x)&&(field!=='best_lap_seconds'||x>0),vy=valid(y)&&(field!=='best_lap_seconds'||y>0);return vx!==vy?vx?-1:1:vx?(Number(x)-Number(y))*direction||Number(a.finish_position)-Number(b.finish_position):Number(a.finish_position)-Number(b.finish_position)});}
 const printable=v=>valid(v)?String(v):'—';
 const copy=(entry,rows,displayName,source)=>entry.series+' R'+entry.round+' | '+entry.track+'\n'+sort(rows,'finish').map(r=>r.finish_position+'. #'+r.car_number+' '+displayName(r.driver)+' (start '+printable(r.start_position)+', laps '+printable(r.laps_completed)+', led '+printable(r.laps_led)+')').join('\n')+'\nSource: '+source;
 return {valid,kind,racing,applicable,score,columns,gain,sort,copy};
})();
