// Browser regression: run with Playwright installed or MMTV_PLAYWRIGHT_MODULE set.
import http from 'node:http';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require(process.env.MMTV_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(import.meta.dirname,'../..'),out=process.env.MMTV_QA_OUTPUT||fs.mkdtempSync(path.join(os.tmpdir(),'mmtv-race-navigation-'));fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!p.startsWith(root+path.sep))return res.writeHead(403).end();if(fs.existsSync(p)&&fs.statSync(p).isDirectory())p=path.join(p,'index.html');try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p))}catch{res.writeHead(404).end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const local='http://127.0.0.1:'+server.address().port+'/news/',base=process.env.MMTV_AUDIT_URL||local;
const browser=await chromium.launch({headless:true,...(process.env.MMTV_CHROME_PATH?{executablePath:process.env.MMTV_CHROME_PATH}:{})}),evidence=[];
try{for(const [device,width,height]of [['desktop',1440,1000],['phone',390,844],['tablet',1024,600]]){
 const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),errors=[],denied=[];
 await context.addInitScript(()=>{try{localStorage.setItem('mmtv.analytics.exclude','1');localStorage.setItem('mmtv.privateAnalytics.optout.v1','1')}catch{}});
 await context.route('**/*',r=>{const request=r.request(),u=new URL(request.url());if(request.method()!=='GET'||u.origin!==new URL(base).origin){denied.push(u.origin);return r.abort()}return r.continue()});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 // Cold-load regression: practice-only names must not lead to nonexistent profiles.
 await page.goto(base+'#race/88961208');await page.locator('#result-body tr').first().waitFor({timeout:45000});
 const practice=page.locator('table[data-session-number="-7"]');
 const unknown=practice.locator('.driver-cell').filter({hasText:/^Big Bird$/});assert.equal(await unknown.count(),1);assert.equal(await unknown.locator('a').count(),0);
 const known=practice.locator('.driver-cell a').first();assert.ok(await known.count());const knownName=await known.innerText();await known.click();await page.getByText('RACE HISTORY',{exact:true}).first().waitFor({timeout:45000});assert.ok(!(await page.locator('#app').innerText()).includes('DRIVER NOT FOUND'));
 evidence.push({device,fixture:'practice-driver-links',unknownName:'Big Bird',unknownLinks:0,knownName,knownProfileResolved:true,pass:true});
 for(const id of ['90313573','90315023','90197399','89982168']){
  await page.goto(base+'#race/'+id);await page.locator('#result-body tr').first().waitFor({timeout:45000});
  const snapshot=await page.evaluate(()=>({hash:location.hash,body:document.querySelector('#result-body').innerText,links:[...document.querySelectorAll('#result-body a')].map(e=>e.getAttribute('href')),tables:[...document.querySelectorAll('#race-details table')].map(e=>({session:e.dataset.sessionNumber,kind:e.dataset.sessionKind,headers:[...e.querySelectorAll('th')].map(t=>t.innerText),rows:e.querySelectorAll('tbody tr').length})),viewport:innerWidth,pageWidth:document.documentElement.scrollWidth}));
  const fields=await page.evaluate(()=>{const rows=[...document.querySelectorAll('#result-body tr')].map(tr=>[...tr.cells].map(c=>c.textContent.replaceAll('†','').trim()));const known=(i,positive=false)=>rows.filter(r=>r[i]!=='—'&&r[i]!==''&&Number.isFinite(parseFloat(r[i]))&&(!positive||parseFloat(r[i])>0)).length;return {total:rows.length,start:known(3,true),gain:known(4),best:known(7,true),led:known(6)};});
  if(['90313573','90315023'].includes(id)){
   const expected=JSON.parse(fs.readFileSync(path.join(root,'news/data/intelligence/events/'+id+'.json'),'utf8')).race.rows;
   for(const r of expected){const row=page.locator('#result-body tr').filter({has:page.locator('td:nth-child(2)',{hasText:r.car_number})});
    const found=await page.locator('#result-body tr').evaluateAll((rows,car)=>rows.find(tr=>tr.cells[1].innerText.trim()===car)?.rowIndex,r.car_number);assert.ok(found>0);
    const actual=page.locator('#result-body tr').nth(found-1);assert.equal((await actual.locator('td').nth(7).innerText()).replaceAll('†',''),Number(r.best_lap_seconds).toFixed(4)+'s');assert.equal((await actual.locator('td').nth(8).innerText()).replaceAll('†',''),String(r.incidents));assert.ok((await actual.locator('td').nth(7).locator('[title]').getAttribute('title')).startsWith('Native completed-race result'));
   }
  }
  const coverageText=await page.locator('#race-data-coverage').innerText();
  for(const [label,key]of [['starting positions','start'],['places gained','gain'],['best laps','best'],['laps led','led']])assert.ok(coverageText.includes(label+' '+fields[key]+'/'+fields.total),'Exact displayed field coverage: '+key);
  assert.ok(coverageText.includes('missing values do not mean zero'));
  if(id!=='89982168'){assert.ok(!(await page.locator('#race-meeting').innerText()).includes('The complete race meeting'));}
  assert.ok(snapshot.pageWidth<=snapshot.viewport,device+' page overflow');assert.ok(!/\b(undefined|null|NaN)\b/.test(snapshot.body));
  if(id!=='89982168'){
   const jump=page.locator('[data-race-jump="race-meeting"]');assert.equal(await jump.count(),1);
   await jump.click();assert.equal(await page.evaluate(()=>location.hash),'#race/'+id);assert.equal(await page.evaluate(()=>document.activeElement.id),'race-meeting');
   const last=page.locator('[data-stage-jump]').last(),target=await last.getAttribute('data-race-jump'),href=await last.getAttribute('href');
   await last.focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>location.hash),'#race/'+id);assert.equal(await page.evaluate(()=>document.activeElement.id),target);
   assert.ok(await page.locator('#classification').count());
   await page.goto(base+href);await page.locator('#result-body tr').first().waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),target,'Deep link focuses session');
   await page.reload();await page.locator('#result-body tr').first().waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),target,'Reload retains session target');
  }else{
   assert.equal(snapshot.tables.at(-1).kind,'special_event');assert.ok(await page.locator('#classification').innerText().then(s=>s.includes('Championship points are not shown')));
  }
  const final=page.locator('#classification .table-wrap');await final.scrollIntoViewIfNeeded();await final.focus();
  assert.equal(await final.getAttribute('role'),'region');assert.ok((await final.getAttribute('aria-label')).includes('results'));
  if(width===390){const start=await final.evaluate(e=>({left:e.scrollLeft,width:e.clientWidth,full:e.scrollWidth}));assert.ok(start.full>start.width);await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.waitForTimeout(200);assert.ok(await final.evaluate(e=>e.scrollLeft)>start.left,'Keyboard reaches remaining result columns');}
  const end=await page.locator('#result-body').innerText();assert.equal(end,snapshot.body,'Navigation preserves every displayed result cell');
  await page.selectOption('#table-sort','start');await page.selectOption('#table-sort','finish');assert.equal(await page.locator('#result-body').innerText(),snapshot.body,'Sorting retains classification');
  const driver=page.locator('#result-body .driver-link').first();if(await driver.count()){await driver.click();await page.getByText('RACE HISTORY',{exact:true}).first().waitFor({timeout:45000});assert.ok((await page.locator('#app').innerText()).includes('RACE HISTORY'));assert.ok(!(await page.locator('#app').innerText()).includes('Drops follow Round 8.'));assert.ok((await page.locator('#app').innerText()).includes('No drops are applied here'));}
  await page.goto(base+'#race/'+id);await page.locator('#result-body tr').first().waitFor();await page.locator('#classification').scrollIntoViewIfNeeded();if(id==='90313573')await page.screenshot({path:path.join(out,device+'-results.png')});
  evidence.push({device,id,...snapshot,coverage:fields,coverageText,pass:true});
 }
 await page.goto(base+'#standings');await page.locator('#standings-series').waitFor();const notice=page.locator('.section-head + .stats-notice');assert.ok((await notice.innerText()).includes('no drops are applied'));assert.ok((await notice.innerText()).includes('until the league drop policy is confirmed'));assert.ok(!(await notice.innerText()).includes('Drops are applied after Round 8.'));
 for(const series of await page.locator('#standings-series option').evaluateAll(es=>es.map(e=>e.value))){
  await page.selectOption('#standings-series',series);await page.waitForTimeout(150);
  const expected=await page.evaluate(()=>{const m=window.MMTVIntelligence.model,season=document.getElementById('standings-season').value,series=document.getElementById('standings-series').value;return m.championships.championships.find(c=>c.competition===season&&c.series===series)?.missing_sessions.length||0});
  const message=await page.locator('[data-coverage-warning]').count().then(n=>n?page.locator('[data-coverage-warning]').innerText():null);
  if(expected)assert.ok(message?.includes(expected+' meeting(s) in this selection'),'Warning follows selected series');else assert.equal(message,null,'Unrelated gaps do not contaminate selected series');
  const context=page.locator('#canonical-intelligence');assert.equal(await context.locator('details').count(),1);assert.ok((await context.locator('summary').innerText()).includes(series));
 }
 await page.selectOption('#standings-series','Bomber Stocks');await page.waitForTimeout(150);
 const points=await page.locator('#app tbody').first().innerText();assert.ok(points);await page.screenshot({path:path.join(out,device+'-standings.png')});
 const standingsText=await notice.innerText();await page.goto(base+'#records');await page.locator('#insights-series').waitFor();
 for(const series of ['Bomber Stocks','Cushion Kings','Mini Menaces','Yota Outlawz','Wide Open Revival','All series']){
  await page.selectOption('#insights-series',series);await page.waitForTimeout(150);
  const count=await page.evaluate(()=>{const m=window.MMTVIntelligence.model,season=document.getElementById('insights-season').value,series=document.getElementById('insights-series').value;return m.races.races.filter(r=>r.entry.competition===season&&(series==='All series'||r.entry.series===series)).length});
  assert.ok((await page.locator('#canonical-intelligence').innerText()).includes(count+' source-traced race events in this selection'),'Intelligence count follows record-book filters');
 }
 const model=await page.evaluate(()=>({intelligence:!!window.MMTVIntelligence.model?.index,analytics:window.MMTVAnalytics.status()}));assert.ok(model.intelligence,'Verified intelligence loaded');assert.equal(model.analytics.attempts,0);assert.equal(model.analytics.active,false);assert.deepEqual(errors,[],'No browser exceptions');
 evidence.push({device,standings:standingsText,model,errors,pass:true});await context.close();
}}finally{await browser.close();await new Promise(r=>server.close(r));}
fs.writeFileSync(path.join(out,'regression.json'),JSON.stringify(evidence,null,2));console.log('PASS: four race types at desktop/phone/tablet, mouse and keyboard jumps, deep links and reloads, keyboard table scrolling, unchanged result cells and sorting, driver links, special-event separation, scoped coverage, exact recorded-stat counts, provisional copy, verified intelligence and zero analytics attempts. Evidence: '+out);
