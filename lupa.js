/* ЛУПА - общий кусочек для всех приложений (ЛУПА-ВЕЗДЕ-01, 2026-11-02).
   Источник один: Кабинет документов :8020 отдаёт этот файл по /lupa.js и отвечает на /api/ask.
   Подключение в приложении - одна строка:
     <script src="http://127.0.0.1:8020/lupa.js"></script>
   Если страница открывается с телефона или по публичному адресу, приложение ставит у себя
   прокладку (Кабинет_документов/loupe_proxy.py) и подключает так:
     <script src="/lupa.js" data-endpoint="/api/loupe"></script>
   Эталон поведения и меню - Лупа Галереи (_данные/loupe.js): меню у выделения, каждый ответ -
   новое перетаскиваемое окно, сворачивается в плашку, выделение ВНУТРИ ответа даёт новую Лупу
   (рекурсия), «Подробнее» и «Спросить точнее» прямо под ответом.
   В полях ввода (input, textarea, select, contenteditable) Лупа не срабатывает.
   Отключить на участке страницы: класс lp-skip или атрибут data-no-loupe. */
(function(){
  if(window.__sharedLoupe || window.__loupe) return;   // в Галерее своя полная Лупа - не дублируем
  window.__sharedLoupe=1;

  // ── адрес ответчика ──
  var me=document.currentScript;
  var ENDPOINT=(me&&me.getAttribute('data-endpoint'))||window.LOUPE_ENDPOINT||'';
  if(!ENDPOINT){
    try{ ENDPOINT=new URL('/api/ask', (me&&me.src)||'http://127.0.0.1:8020/').href; }
    catch(e){ ENDPOINT='http://127.0.0.1:8020/api/ask'; }
  }
  try{ ENDPOINT=new URL(ENDPOINT, location.href).href; }catch(e){}
  function isLocalHost(h){ return h==='127.0.0.1'||h==='localhost'||h==='[::1]'; }
  var endHost=''; try{ endHost=new URL(ENDPOINT).hostname; }catch(e){}
  // страница не с ПК, а ответчик - на 127.0.0.1: до него отсюда не дотянуться
  var PC_ONLY = isLocalHost(endHost) && !isLocalHost(location.hostname) && location.protocol!=='file:';
  // страница с ПК (file:// или 127.0.0.1) - доставка обычная; window.LOUPE_TRANSPORT задаёт свою (см. post)
  var APP=(me&&me.getAttribute('data-app'))||document.title||location.host;

  // ── вид (эталон Галереи: пергамент; тёмная тема - по системе) ──
  var C={bg:'#fdfaf2',head:'#f6efdd',line:'#ddd2b8',fg:'#3d3728',mut:'#8c7f63',hov:'#f1e9d2',acc:'#b8860b',btn:'#f3ead2',btnfg:'#7a5f1f',err:'#b5512f'};
  try{ if(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)
    C={bg:'#24211c',head:'#2e2a23',line:'#4a4335',fg:'#ece5d6',mut:'#a89c83',hov:'#3a3428',acc:'#d9a227',btn:'#3a3428',btnfg:'#e7c879',err:'#e08a6a'}; }catch(e){}
  var FONT='Manrope,system-ui,-apple-system,"Segoe UI",sans-serif';
  function esc(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function el(t,css,h,cls){var e=document.createElement(t); if(css)e.style.cssText=css; if(h!=null)e.innerHTML=h; if(cls)e.className=cls; return e;}

  var topZ=2147480000;   // общий счётчик слоя: меню и окна делят его, меню всегда выше окон
  var menu=null;
  function ensureMenu(){
    if(menu) return menu;
    menu=el('div','display:none;position:fixed;background:'+C.bg+';border:1px solid '+C.line+';border-radius:10px;'
      +'box-shadow:0 8px 24px rgba(0,0,0,.22);padding:4px;min-width:190px;',null,'lp-skip lp-menu');
    menu.setAttribute('data-loupe-menu','1');
    document.body.appendChild(menu);
    return menu;
  }
  function mbtn(label){
    var b=el('button','display:block;width:100%;text-align:left;border:none;background:none;padding:6px 13px;'
      +'font-size:12.5px;color:'+C.fg+';cursor:pointer;border-radius:7px;font-family:'+FONT+';white-space:nowrap;',null,'lp-skip');
    b.textContent=label;
    b.onmouseenter=function(){b.style.background=C.hov;}; b.onmouseleave=function(){b.style.background='';};
    return b;
  }
  function abtn(label){
    var b=el('button','border:1px solid '+C.line+';background:'+C.btn+';color:'+C.btnfg+';border-radius:9px;padding:5px 11px;'
      +'font-size:12px;cursor:pointer;font-family:'+FONT+';',null,'lp-skip');
    b.textContent=label; return b;
  }

  // ── плавающие окна: каждый запрос - новое окно; перетаскивать за шапку, свернуть, закрыть ──
  var floatN=0;
  function makeFloat(title){
    floatN++;
    var w=Math.min(430, innerWidth-24), off=((floatN-1)%6)*30;
    var win=el('div','position:fixed;z-index:'+(++topZ)+';left:'+Math.max(10,innerWidth-w-22-off)+'px;top:'+(66+off)+'px;width:'+w+'px;'
      +'max-height:min(72vh,calc(100vh - 110px));display:flex;flex-direction:column;background:'+C.bg+';color:'+C.fg+';'
      +'border:1px solid '+C.line+';border-radius:14px;box-shadow:0 20px 60px rgba(0,0,0,.33);overflow:hidden;font-family:'+FONT+';',null,'lp-float');
    var head=el('div','display:flex;align-items:center;gap:8px;padding:9px 12px;background:'+C.head+';border-bottom:1px solid '+C.line+';flex:none;cursor:move;user-select:none;',
      '<span title="Перетащи окно" style="color:'+C.mut+';flex:none;">⠿</span>'
      +'<b style="flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(title)+'</b>'
      +'<button class="lpf-min lp-skip" title="Свернуть в плашку" style="border:none;background:none;font-size:16px;line-height:1;color:'+C.mut+';cursor:pointer;padding:0 4px;">–</button>'
      +'<button class="lpf-x lp-skip" title="Закрыть" style="border:none;background:none;font-size:17px;line-height:1;color:'+C.mut+';cursor:pointer;padding:0 4px;">×</button>','lp-skip');
    var body=el('div','padding:12px 15px;font-size:13.5px;line-height:1.55;overflow:auto;',null,'lp-float-body');
    win.appendChild(head); win.appendChild(body); document.body.appendChild(win);
    drag(head,win);
    var min=false, mb=head.querySelector('.lpf-min');
    mb.onclick=function(e){ e.stopPropagation(); min=!min; body.style.display=min?'none':'';
      win.style.width=min?'auto':w+'px'; win.style.maxWidth=min?'70vw':''; mb.textContent=min?'▢':'–'; mb.title=min?'Развернуть':'Свернуть в плашку'; };
    head.querySelector('.lpf-x').onclick=function(e){ e.stopPropagation(); win.remove(); };
    win.addEventListener('pointerdown',function(){ win.style.zIndex=(++topZ); },true);
    return {win:win, body:body};
  }
  function drag(handle,box){
    var sx,sy,ox,oy,on=false;
    handle.addEventListener('pointerdown',function(e){ if(e.target.closest('button'))return; on=true; sx=e.clientX; sy=e.clientY;
      var r=box.getBoundingClientRect(); ox=r.left; oy=r.top; try{handle.setPointerCapture(e.pointerId);}catch(_){ } e.preventDefault(); });
    handle.addEventListener('pointermove',function(e){ if(!on)return;
      box.style.left=Math.max(-box.offsetWidth+60,Math.min(innerWidth-60,ox+e.clientX-sx))+'px';
      box.style.top=Math.max(0,Math.min(innerHeight-40,oy+e.clientY-sy))+'px'; });
    handle.addEventListener('pointerup',function(){ on=false; });
  }

  // ── запрос к ответчику ──
  var DOWN_MSG='Лупа не достучалась до ответчика: Кабинет документов (порт 8020) выключен. '
    +'Он поднимается сам при входе в Windows (задача PoldenDocs); если нет - запустить её или попросить Клода.';
  var PC_MSG='Лупа отвечает только на ПК: эта страница открыта не с компьютера, а ответчик живёт на нём. '
    +'Открой её на ПК - или приложению нужна прокладка Лупы.';
  function post(payload, onDone){
    payload.app=APP; payload.page=location.pathname;
    // своя доставка вопроса (Монтажка: через главный процесс Electron) - window.LOUPE_TRANSPORT(payload) -> Promise<{answer}>
    if(typeof window.LOUPE_TRANSPORT==='function'){
      Promise.resolve().then(function(){ return window.LOUPE_TRANSPORT(payload); })
        .then(function(d){ if(d&&d.error) onDone(null, d.error); else onDone((d&&d.answer)||'(пустой ответ)', null); })
        .catch(function(){ onDone(null, DOWN_MSG); });
      return;
    }
    if(PC_ONLY){ onDone(null, PC_MSG); return; }
    var ctrl=('AbortController' in window)?new AbortController():null;
    var tm=setTimeout(function(){ if(ctrl) ctrl.abort(); }, 240000);
    fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:ctrl?ctrl.signal:undefined,credentials:'same-origin'})
      .then(function(r){ if(r.status===401) throw {auth:1}; if(r.status===403) throw {forbid:1};
        return r.json().then(function(d){ if(!r.ok&&!(d&&d.error)) d={error:'Ответчик ответил ошибкой (код '+r.status+'). Попробуй ещё раз.'}; return d; },
          function(){ return {error:'Ответчик ответил ошибкой (код '+r.status+'). Попробуй ещё раз.'}; }); })
      .then(function(d){ clearTimeout(tm); if(d&&d.error) onDone(null, d.error); else onDone((d&&d.answer)||'(пустой ответ)', null); })
      .catch(function(e){ clearTimeout(tm);
        onDone(null, (e&&e.auth)?'Лупа доступна только после входа в приложение.'
          :(e&&e.forbid)?'Ответчик не принял вопрос с этой страницы: она открыта не по адресу ПК (например, файлом). Открой её через Кабинет документов.'
          :(e&&e.name==='AbortError')?'Ответчик думал дольше 4 минут - прервано. Попробуй ещё раз.':DOWN_MSG); });
  }
  function waitHtml(){ return '<span style="color:'+C.mut+'">…думаю (ответ модели, 10-60 сек)</span>'; }
  function render(f, term, ctx, answer, err, hist){
    var box=f.body; box.innerHTML='';
    if(err){ box.appendChild(el('div','color:'+C.err+';white-space:pre-line;',esc(err))); return; }
    box.appendChild(el('div','font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:'+C.mut+';margin-bottom:6px;','ответ модели',''));
    var a=el('div','white-space:pre-line;','', 'lp-answer'); a.textContent=answer; box.appendChild(a);
    var bar=el('div','display:flex;flex-wrap:wrap;gap:6px;margin-top:11px;',null,'lp-skip');
    var more=abtn('🔍 Подробнее'); more.onclick=function(){ more.disabled=true; more.style.opacity='.6';
      var g=makeFloat('🔍 Подробнее - '+term.slice(0,40)); g.body.innerHTML=waitHtml();
      post({term:term,mode:'more',context:ctx,prev:answer}, function(ans,er){ render(g,term,ctx,ans,er,(hist||[]).concat([answer])); }); };
    var follow=abtn('✍️ Спросить ещё'); follow.onclick=function(){ askInput(term, ctx, answer); };
    bar.appendChild(more); bar.appendChild(follow); box.appendChild(bar);
  }
  function run(term, mode, label, ctx){
    var f=makeFloat(label+' - '+term.slice(0,40)); f.body.innerHTML=waitHtml();
    post({term:term,mode:mode,context:ctx}, function(ans,err){ render(f,term,ctx,ans,err); });
  }
  function askInput(term, ctx, prev){
    var f=makeFloat('✍️ Спросить точнее');
    var hasSR=('webkitSpeechRecognition' in window)||('SpeechRecognition' in window);
    f.body.innerHTML='<div style="font-size:12px;color:'+C.mut+';margin-bottom:7px;">Выделено: «'+esc(term.slice(0,90))+'»</div>';
    var ta=el('textarea','width:100%;box-sizing:border-box;min-height:66px;padding:9px 11px;border:1px solid '+C.line+';border-radius:9px;'
      +'background:'+C.bg+';color:'+C.fg+';font:13.5px '+FONT+';resize:vertical;',null,'lp-skip');
    ta.placeholder='Что именно хочешь узнать про это…';
    var row=el('div','display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;',null,'lp-skip');
    var go=el('button','border:none;background:'+C.acc+';color:#fff;border-radius:9px;padding:7px 18px;font:13px '+FONT+';cursor:pointer;',null,'lp-skip');
    go.textContent='Спросить';
    if(hasSR){ var mic=abtn('🎤'); mic.title='Наговорить вопрос'; mic.onclick=function(){
      try{ var R=window.SpeechRecognition||window.webkitSpeechRecognition, r=new R(); r.lang='ru-RU'; r.interimResults=false;
        r.onresult=function(ev){ ta.value=(ta.value?ta.value+' ':'')+ev.results[0][0].transcript; ta.focus(); };
        mic.textContent='● слушаю'; r.onend=function(){ mic.textContent='🎤'; }; r.start(); }catch(e){} }; row.appendChild(mic); }
    row.appendChild(go); row.appendChild(el('span','font-size:11px;color:'+C.mut+';','Ctrl+Enter'));
    var out=el('div','margin-top:12px;');
    f.body.appendChild(ta); f.body.appendChild(row); f.body.appendChild(out);
    go.onclick=function(){ var q=ta.value.trim(); if(!q){ta.focus();return;}
      out.innerHTML=waitHtml(); go.disabled=true;
      post({term:term,mode:'custom',question:q,context:ctx,prev:prev||''}, function(ans,err){ go.disabled=false; render({body:out},term,ctx,ans,err); }); };
    ta.addEventListener('keydown',function(e){ if((e.ctrlKey||e.metaKey)&&e.key==='Enter') go.click(); });
    ta.focus();
  }

  // ── меню у выделения (как в Галерее) ──
  var MODES=[['explain','❓ Что это?'],['more','🔍 Подробнее об этом'],['custom','✍️ Спросить точнее…'],
             ['links','🧵 Связи'],['simpler','🔤 Проще'],['example','💡 Пример'],['translate','🌐 Перевести']];
  function showLoupe(s, ctx){
    var m=ensureMenu(); m.innerHTML=''; m.style.zIndex=(++topZ);
    MODES.forEach(function(md){ var b=mbtn(md[1]);
      b.onclick=function(ev){ ev.stopPropagation(); m.style.display='none';
        if(md[0]==='custom') askInput(s, ctx); else run(s, md[0], md[1], ctx); };
      m.appendChild(b); });
    m.style.display='block'; return m;
  }
  function placeMenu(m, r){
    var mw=m.offsetWidth||210, mh=m.offsetHeight||240, g=8, vw=innerWidth, vh=innerHeight, top, left;
    top=(r.bottom+8+mh<=vh-g)?r.bottom+8:((r.top-8-mh>=g)?r.top-8-mh:r.bottom+8);
    left=(r.left+mw<=vw-g)?r.left:((r.right-mw>=g)?r.right-mw:r.left);
    m.style.left=Math.max(g,Math.min(vw-mw-g,left))+'px'; m.style.top=Math.max(g,Math.min(vh-mh-g,top))+'px';
  }
  function blocked(n){
    var e=n&&(n.nodeType===1?n:n.parentElement); if(!e||!e.closest) return false;
    if(e.closest('input,textarea,select,[contenteditable=""],[contenteditable="true"],[data-no-loupe],.lp-skip')) return true;
    return !!e.isContentEditable;
  }
  function selInfo(tEl){
    var so=window.getSelection&&window.getSelection(); if(!so||!so.rangeCount) return null;
    var s=so.toString().trim(); if(s.length<2) return null; if(s.length>800) s=s.slice(0,800)+'…';
    if(blocked(tEl)) return null;
    var rg=so.getRangeAt(0); if(blocked(rg.startContainer)||blocked(rg.endContainer)) return null;
    var ae=document.activeElement; if(ae&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')) return null;
    var n=rg.commonAncestorContainer, b=(n.nodeType===1?n:n.parentElement);
    while(b&&(b.textContent||'').length<60&&b.parentElement&&b.parentElement!==document.body) b=b.parentElement;
    var ctx=b?(b.textContent||'').replace(/\s+/g,' ').trim().slice(0,500):'';
    var r=rg.getBoundingClientRect();
    return {s:s, ctx:ctx, r:(r&&(r.width||r.height))?r:null};
  }
  document.addEventListener('mouseup',function(e){
    if(menu&&menu.contains(e.target)) return;
    setTimeout(function(){
      var m=ensureMenu(), i=selInfo(e.target);
      if(!i){ m.style.display='none'; return; }
      showLoupe(i.s, i.ctx); placeMenu(m, i.r||{left:e.clientX,right:e.clientX,top:e.clientY,bottom:e.clientY});
    },10);
  });
  document.addEventListener('touchend',function(e){
    setTimeout(function(){
      var ct=e.changedTouches&&e.changedTouches[0], t=ct?document.elementFromPoint(ct.clientX,ct.clientY):null;
      var i=selInfo(t); if(!i||!i.r) return;
      showLoupe(i.s, i.ctx); placeMenu(ensureMenu(), i.r);
    },350);
  },{passive:true});
  document.addEventListener('mousedown',function(e){ if(menu&&!menu.contains(e.target)) menu.style.display='none'; });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'){ if(menu&&menu.style.display!=='none'){ menu.style.display='none'; return; }
    var fs=document.querySelectorAll('.lp-float'); if(fs.length) fs[fs.length-1].remove(); } });
  window.__loupeEndpoint=ENDPOINT;   // для проверки и отладки
})();
