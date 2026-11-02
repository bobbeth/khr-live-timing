/* KHR GA4: basic consent (no Google script before opt-in), manual hash views. */
(()=>{
 'use strict';
 const ID='G-WLVRGFTMM1',KEY='mmtv.analytics.choice.v1',EXCLUDE='mmtv.analytics.exclude';
 const source=document.currentScript?.src||new URL('news/assets/analytics.js',location.href).href;
 const privacy=new URL('../privacy.html',source).href;
 const production=location.hostname==='bobbeth.github.io'&&/^\/khr-live-timing(?:\/|$)/.test(location.pathname);
 const denied={analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'};
 let started=false,lastKey=null,previous=null,choice=null,excluded=false,identityPromise;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const read=key=>{try{return localStorage.getItem(key);}catch{return null;}};
 const store=(key,value)=>{try{localStorage.setItem(key,value);}catch{}};
 try{const saved=JSON.parse(read(KEY));if(saved&&Date.now()-saved.at<180*86400000)choice=['allow','deny'].includes(saved.choice)?saved.choice:null;}catch{}
 excluded=read(EXCLUDE)==='1';
 const protectedBrowser=()=>navigator.globalPrivacyControl===true||navigator.doNotTrack==='1';
 const allowed=()=>production&&choice==='allow'&&!excluded&&!protectedBrowser();
 function routeInfo(url,identities={}){
  const parsed=new URL(url),path=parsed.pathname;
  if(path.endsWith('/privacy.html'))return {key:path,section:'Privacy',title:'Privacy and analytics choices',hash:''};
  if(!/\/news\/?$/.test(path))return {key:path,section:'Live timing',title:'Live timing',hash:''};
  let bits;try{bits=decodeURIComponent(parsed.hash.slice(1)||'home').split('/');}catch{bits=['unknown'];}
  const names={calendar:'Season calendar',tracks:'Track directory',track:'Track page','track-name':'Track page',home:'Newsroom',results:'Race results',championships:'Championships',standings:'Standings',drivers:'Driver roster',driver:'Driver profile',broadcasts:'Broadcast library',broadcast:'Broadcast recording',records:'Season records',compare:'Driver comparison'};
  const section=names[bits[0]]||'Other page';let hash=names[bits[0]]?'#'+bits[0]:'#other',title=section;
  if(bits[0]==='race'&&/^\d{7,12}$/.test(bits[1]||'')){hash='#race/'+bits[1];title='Race report '+bits[1];}
  if(bits[0]==='broadcast'&&/^[A-Za-z0-9_-]{11}$/.test(bits[1]||'')){hash='#broadcast/'+bits[1];title='Broadcast '+bits[1];}
  if(bits[0]==='track'||bits[0]==='track-name')hash='#tracks';
  if(bits[0]==='driver'){
   hash='#drivers';
   const numeric=/^\d{1,10}$/.test(bits[1]||'')?Number(bits[1]):null;
   const id=numeric&&Object.values(identities).includes(numeric)?numeric:identities[String(bits[1]||'').trim().toLowerCase().replace(/\s+/g,' ')];
   // Customer IDs identify public race content, never a visitor account.
   if(Number.isSafeInteger(id)&&id>0){hash='#driver/'+id;title='Driver profile '+id;}
  }
  return {key:path+'|'+bits[0]+'|'+String(bits[1]||'').slice(0,100),section:bits[0]==='race'?'Race report':section,title,hash};
 }
 function cleanUrl(url,info){const u=new URL(url);return u.origin+u.pathname+(info?.hash||'');}
 function referrer(url){try{const u=new URL(url);return /^https?:$/.test(u.protocol)?u.origin+'/':'';}catch{return '';}}
 function identities(){if(!identityPromise)identityPromise=fetch(new URL('../data/driver-identities.json',source).href,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(j=>j?.schema_version==='MMTV-driver-identities-v1'?j.names:{}).catch(()=>({}));return identityPromise;}
 function start(){
  if(started)return;
  started=true;window.dataLayer=window.dataLayer||[];window.gtag=function(){window.dataLayer.push(arguments);};
  window.gtag('consent','default',denied);
  window.gtag('consent','update',{...denied,analytics_storage:'granted'});
  window.gtag('js',new Date());
  window.gtag('set','page_location',cleanUrl(location.href,routeInfo(location.href)));
  window.gtag('config',ID,{send_page_view:false,allow_google_signals:false,allow_ad_personalization_signals:false,page_referrer:referrer(document.referrer),cookie_prefix:'mmtv',cookie_domain:location.hostname,cookie_path:'/khr-live-timing',cookie_expires:90*86400});
  const script=document.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+ID;script.id='mmtv-google-tag';document.head.appendChild(script);
 }
 async function pageView(){
  if(!allowed())return;
  const href=location.href,map=await identities();if(!allowed())return;
  const info=routeInfo(href,map);if(info.key===lastKey)return;lastKey=info.key;
  start();window['ga-disable-'+ID]=false;
  const url=cleanUrl(href,info);
  window.gtag('set',{page_location:url,page_title:info.title+' | Mud Mules TV',content_group:info.section,page_referrer:previous||referrer(document.referrer)});
  window.gtag('event','page_view',{send_to:ID,page_location:url,page_title:info.title+' | Mud Mules TV',content_group:info.section,page_referrer:previous||referrer(document.referrer)});
  previous=url;
 }
 function clearCookies(){for(const part of document.cookie.split(';')){const name=part.trim().split('=')[0];if(!name.startsWith('mmtv_'))continue;for(const domain of ['',location.hostname,'.'+location.hostname])for(const path of ['/','/khr-live-timing','/khr-live-timing/'])document.cookie=name+'=; Max-Age=0; Path='+path+(domain?'; Domain='+domain:'')+'; SameSite=Lax; Secure';}}
 function stop(){window['ga-disable-'+ID]=true;if(started)window.gtag('consent','update',denied);lastKey=null;previous=null;clearCookies();}
 function choose(value){choice=value;store(KEY,JSON.stringify({choice:value,at:Date.now()}));if(allowed()){if(started)window.gtag('consent','update',{...denied,analytics_storage:'granted'});window['ga-disable-'+ID]=false;pageView();}else stop();render();}
 function exclude(value){excluded=value;store(EXCLUDE,value?'1':'0');if(!allowed())stop();else pageView();render();}
 function render(){
  const existing=document.getElementById('mmtv-analytics-banner');if(existing)existing.remove();
  if(production&&!choice&&!excluded&&!protectedBrowser()){
   const banner=document.createElement('section');banner.id='mmtv-analytics-banner';banner.className='analytics-banner';banner.setAttribute('aria-label','Analytics choice');
   banner.innerHTML=`<div><strong>Help improve Mud Mules TV?</strong><p>Allow Google Analytics cookies to measure visits and popular sections. You can decline and use the whole site.</p><a href="${esc(privacy)}">Privacy & choices</a></div><div class="analytics-actions"><button type="button" data-analytics-action="allow">Allow analytics</button><button type="button" data-analytics-action="deny">Decline</button></div>`;
   document.body.appendChild(banner);
  }
  const panel=document.querySelector('[data-analytics-panel]');if(panel)panel.innerHTML=`<p role="status">Analytics: <strong>${!production?'inactive on this preview':excluded?'excluded for this browser':protectedBrowser()?'off — browser privacy preference':choice==='allow'?'allowed':choice==='deny'?'declined':'not yet chosen'}</strong>.</p><div class="analytics-actions"><button type="button" data-analytics-action="allow">Allow analytics</button><button type="button" data-analytics-action="deny">Decline analytics</button><button type="button" data-analytics-action="${excluded?'include':'exclude'}">${excluded?'Stop excluding this browser':'Exclude this browser from statistics'}</button></div><p class="result-note">The exclusion is saved in this browser only. Clearing browser storage removes your preferences. Enabling analytics after exclusion still requires an Allow choice.</p>`;
 }
 document.addEventListener('click',event=>{
  const action=event.target.closest?.('[data-analytics-action]')?.getAttribute('data-analytics-action');
  if(action){if(action==='allow'||action==='deny')choose(action);else if(action==='exclude'||action==='include')exclude(action==='exclude');return;}
  const link=event.target.closest?.('a[href]');if(!link||!allowed()||!started)return;
  let target;try{target=new URL(link.href,location.href);}catch{return;}
  if(!/^https?:$/.test(target.protocol)||target.origin===location.origin)return;
  const youtube=/(^|\.)(youtube\.com|youtu\.be)$/.test(target.hostname);
  // No free-form text, search input, target queries, account details or full referrer URLs.
  window.gtag('event',youtube?'youtube_click':'outbound_click',{send_to:ID,link_domain:target.hostname,content_group:routeInfo(location.href).section});
 });
 window.addEventListener('hashchange',()=>{pageView();});
 window.addEventListener('storage',event=>{if(event.key===KEY||event.key===EXCLUDE)location.reload();});
 window.MMTVAnalytics={measurementId:ID,routeInfo,cleanUrl,referrer,choose,exclude,pageView,status:()=>({choice,excluded,active:allowed()})};
 render();pageView();
})();
