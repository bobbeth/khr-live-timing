(()=>{
 const header=document.querySelector('.site-header'),button=header.querySelector('.menu-toggle'),nav=header.querySelector('#main-navigation'),racing=nav.querySelector('.racing-dropdown'),summary=racing.querySelector('summary');
 function close(){button.setAttribute('aria-expanded','false');nav.classList.remove('is-open');racing.open=false;}
 button.hidden=false;header.classList.add('navigation-ready');
 button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));nav.classList.toggle('is-open',open);if(!open)racing.open=false;});
 nav.addEventListener('click',event=>{if(event.target.closest('a[href]'))close();});
 document.addEventListener('click',event=>{if(!header.contains(event.target))close();});
 document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(racing.open){racing.open=false;summary.focus();}else if(button.getAttribute('aria-expanded')==='true'){close();button.focus();}});
 window.addEventListener('hashchange',close);
})();
