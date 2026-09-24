'use strict';
(() => {
  const data = window.LATIN_FONT_DATA;
  if (!data?.fonts?.length) { document.querySelector('#count').textContent = 'データを読み込めません。ページを再読み込みしてください。'; return; }
  const $ = id => document.getElementById(id);
  const key = 'latin-font-library:favorites:v1';
  let favorites = new Set();
  try { const saved=JSON.parse(localStorage.getItem(key)||'[]'); if(Array.isArray(saved)) favorites=new Set(saved); } catch { $('storage-warning').hidden=false; }
  const states = new Map(), cache = new Map();
  const el = (tag, cls, text) => { const n=document.createElement(tag); if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n; };
  const link = (label,url) => { const a=el('a','',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a; };
  const normalized = text => text.normalize('NFKC').replace(/[\s_\-（）()]/g,'').toLowerCase();
  let sequence=0;
  const measureContext=document.createElement('canvas').getContext('2d');
  function rendersWithoutFallback(family,text) {
    if(!measureContext)return false;
    // Some legacy faces resolve via local() but still render a fallback. Changing
    // the fallback must not change any glyph's width or ink bounds.
    return [...new Set(text)].every(char=>{
      const metrics=['serif','sans-serif','monospace'].map(fallback=>{
        measureContext.font=`48px "${family}", ${fallback}`;
        const m=measureContext.measureText(char);
        return [m.width,m.actualBoundingBoxAscent,m.actualBoundingBoxDescent,m.actualBoundingBoxLeft,m.actualBoundingBoxRight];
      });
      return metrics.slice(1).every(m=>m.every((value,i)=>Math.abs(value-metrics[0][i])<0.01));
    });
  }
  async function loadLocal(names) {
    for(const name of names) {
      if(!cache.has(name)) cache.set(name,(async()=>{
        const family=`LatinPreview${++sequence}`;
        const face=new FontFace(family,`local(${JSON.stringify(name)})`);
        try { await face.load();document.fonts.add(face);
          if(!rendersWithoutFallback(family,'Hamburgefontsiv0123456789')){document.fonts.delete(face);return null;}
          return {family,name}; } catch {return null;}
      })());
      const result=await cache.get(name);if(result)return result;
    }
    return null;
  }
  const fallbackFonts = {
    serif: {family:'serif', name:'ブラウザ標準のセリフ体（フォント名取得不可）'},
    sans: {family:'sans-serif', name:'ブラウザ標準のサンセリフ体（フォント名取得不可）'}
  };
  const fallbackReady = Promise.all([
    ['serif', ['Times New Roman', 'TimesNewRomanPSMT', 'Georgia']],
    ['sans', ['Arial', 'ArialMT', 'Helvetica']]
  ].map(async ([kind, names]) => {
    const loaded = await loadLocal(names);
    if (loaded) fallbackFonts[kind] = loaded;
  }));
  const googleFamilies = new Set(['Amiri','Lato','Montserrat','Quicksand','Roboto']);
  const webCache = new Map();
  function loadGoogle(name) {
    if (!webCache.has(name)) webCache.set(name, new Promise(resolve => {
      const sheet = document.createElement('link');
      sheet.rel = 'stylesheet';
      sheet.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}&display=swap`;
      const timer = setTimeout(() => resolve(null), 15000);
      sheet.onerror = () => { clearTimeout(timer); resolve(null); };
      sheet.onload = async () => {
        try {
          const faces = await document.fonts.load(`48px "${name}"`, 'Hamburgefontsiv0123456789');
          clearTimeout(timer);
          resolve(faces.length && rendersWithoutFallback(name, 'Hamburgefontsiv0123456789') ? {family:name,name,source:'google'} : null);
        } catch { clearTimeout(timer); resolve(null); }
      };
      document.head.append(sheet);
    }));
    return webCache.get(name);
  }
  function makeChoices(font) {
    const web = googleFamilies.has(font.name) ? [{label:`${font.name} · Google Fonts Regular`,variant:font.name,google:font.name,face:null}] : [];
    return web.concat(font.variants.flatMap(v => v.faces.length ? v.faces.map(f=>({label:`${v.name} · ${f.style} [${f.postscript}]`,variant:v.name,names:[f.postscript,f.fullName],face:f})) : [{label:`${v.name} · ローカル確認`,variant:v.name,names:v.localNames,face:null}]));
  }
  function saveFavorites() { try{localStorage.setItem(key,JSON.stringify([...favorites]));}catch{$('storage-warning').hidden=false;} }
  function updateSample(s) {
    s.preview.replaceChildren();
    if(s.pending) { s.preview.append(el('div','unavailable','フォントを確認中…')); return; }
    if(!s.loaded) {
      const fallback = fallbackFonts[['Serif','Slab Serif'].includes(s.font.category) ? 'serif' : 'sans'];
      const specimen=el('div','specimen fallback-specimen');specimen.style.fontFamily=`"${fallback.family}"`;
      if (['serif','sans-serif'].includes(fallback.family)) specimen.style.fontFamily=fallback.family;
      specimen.append(el('p','note',`代替フォント：${fallback.name}（対象書体の字形ではありません）`));
      for(const [i,text] of [$('sample').value,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz','0123456789'].entries()) specimen.append(el('p',i ? 'characters' : 'main-sample',text));
      s.preview.append(specimen);return;
    }
    const sample=$('sample').value;
    if(/[^\x20-\x7e]/.test(sample)) { s.preview.append(el('div','unavailable','英数字・半角記号を入力してください'));return; }
    const missing=s.choices[s.index].face?.missingASCII||'';
    if([...sample].some(c=>missing.includes(c))||!rendersWithoutFallback(s.loaded.family,sample)){s.preview.append(el('div','unavailable','選択したスタイルに未収録の文字があります'));return;}
    const specimen=el('div','specimen');specimen.style.fontFamily=`"${s.loaded.family}"`;
    specimen.append(el('p','main-sample',sample));
    for(const text of ['ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz','0123456789']) {
      if([...text].some(c=>missing.includes(c))||!rendersWithoutFallback(s.loaded.family,text)) specimen.append(el('p','meta','文字一覧：一部の文字が未収録のため省略'));
      else specimen.append(el('p','characters',text));
    }
    s.preview.append(specimen);
  }
  async function selectChoice(s,index) {
    const ticket=++s.ticket;s.pending=true;s.loaded=null;s.index=index;s.select.value=String(index);updateSample(s);
    s.status.textContent='フォントを確認中…';s.status.classList.remove('available');
    let loaded=null;try{loaded=s.choices[index].google ? await loadGoogle(s.choices[index].google) : await loadLocal(s.choices[index].names);}catch{}
    if(ticket!==s.ticket)return;
    s.pending=false;s.loaded=loaded;
    s.status.textContent=loaded?`${loaded.source==='google'?'Google Fonts':'ローカル表示'}：${loaded.name}`:'代替表示（未インストール・通信失敗・ブラウザ制限など）';
    s.status.classList.toggle('available',!!loaded);updateSample(s);filter();
  }
  function render(font) {
    const card=el('article','font-card');card.dataset.id=font.id;
    const header=el('div','card-header');const h=el('h2','',font.name);header.append(h);
    const star=el('button','favorite',favorites.has(font.id)?'★':'☆');star.type='button';star.setAttribute('aria-label',`${font.name}をお気に入りにする`);star.setAttribute('aria-pressed',String(favorites.has(font.id)));
    star.onclick=()=>{favorites.has(font.id)?favorites.delete(font.id):favorites.add(font.id);star.textContent=favorites.has(font.id)?'★':'☆';star.setAttribute('aria-pressed',String(favorites.has(font.id)));saveFavorites();filter();};header.append(star);card.append(header);
    card.append(el('p','meta',`${font.category} / ${font.sourceCategories.join('・')}`));
    const choices=makeChoices(font),select=el('select');select.id=`face-${font.id}`;
    choices.forEach((c,i)=>{const o=el('option','',c.label);o.value=String(i);select.append(o);});
    const label=el('label','face-control','表示する版・スタイル');label.htmlFor=select.id;label.append(select);card.append(label);
    const status=el('p','status','確認中…'),preview=el('div','preview-area');card.append(status,preview);
    card.append(el('p','recommendation',font.recommendedBy.length?`おすすめ：${font.recommendedBy.join(' / ')}`:'おすすめした人：元データに記載なし'));
    if(font.alternatives.length) card.append(el('p','alternative',`代替情報（見本には使用しません）：${font.alternatives.map(a=>a.label).join(' / ')}`));
    const details=el('details');details.append(el('summary','','情報・入手先'));
    for(const entry of font.sourceEntries) {
      const section=el('div','source-entry');section.append(el('h3','',`掲載：${entry.category}`));
      for(const block of entry.blocks) { section.append(el('p','',block.text));if(block.links.length){const list=el('ul');for(const l of block.links){const li=el('li');li.append(link(l.label,l.url));list.append(li);}section.append(list);} }
      details.append(section);
    }
    card.append(details);$('library').append(card);
    const s={font,card,status,preview,select,choices,index:0,loaded:null,pending:true,ticket:0};states.set(font.id,s);
    select.onchange=()=>selectChoice(s,Number(select.value));
    return s;
  }
  function filter() {
    let count=0,available=0,pending=0;
    const query=normalized($('search').value);
    for(const s of states.values()) {
      if(s.loaded)available++;if(s.pending)pending++;
      const show=normalized(s.font.name).includes(query)&&(!$('category').value||s.font.category===$('category').value)&&(!$('source').value||s.font.sourceCategories.includes($('source').value))&&(!$('favorites-only').checked||favorites.has(s.font.id))&&(!$('available-only').checked||!!s.loaded);
      s.card.hidden=!show;if(show)count++;
    }
    $('count').textContent=`${count} / ${states.size}項目　実書体 ${available}　${pending?`確認中 ${pending}`:`代替表示 ${states.size-available}`}`;
    $('empty').hidden=count!==0;
  }
  $('sample').oninput=()=>{for(const s of states.values())updateSample(s);};
  $('size').oninput=()=>{document.documentElement.style.setProperty('--sample-size',`${$('size').value}px`);$('size-value').textContent=`${$('size').value}px`;};
  for(const id of ['search','category','source','favorites-only','available-only'])$(id).addEventListener('input',filter);
  $('reset').onclick=()=>{for(const id of ['search','category','source'])$(id).value='';$('favorites-only').checked=false;$('available-only').checked=false;filter();};
  const mode=compact=>{$('library').classList.toggle('compact',compact);$('cards-mode').setAttribute('aria-pressed',String(!compact));$('compact-mode').setAttribute('aria-pressed',String(compact));};
  $('cards-mode').onclick=()=>mode(false);$('compact-mode').onclick=()=>mode(true);
  function report(){return {checkedAt:new Date().toISOString(),sourceCardCount:data.sourceCardCount,count:states.size,googleFonts:[...states.values()].filter(s=>s.loaded?.source==='google').map(s=>s.loaded.name),fonts:[...states.values()].map(s=>({name:s.font.name,status:s.pending?'checking':s.loaded?(s.loaded.source||'local'):'fallback',displayedFace:s.loaded?.name||null,selectedVariant:s.choices[s.index].variant,alternatives:s.font.alternatives}))};}
  $('export-report').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='font-preview-report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('updated').textContent=`データ更新 ${data.generatedAt.slice(0,10)} · 元カード ${data.sourceCardCount}件`;
  const rendered=data.fonts.map(render);filter();
  // Try each explicitly listed variant; never use alternativeFont as a local alias.
  const ready=Promise.all(rendered.map(async s=>{
    await fallbackReady;
    if(s.choices[0].google){await selectChoice(s,0);if(s.loaded)return;}
    for(const v of s.font.variants){
      const index=s.choices.findIndex(c=>!c.google&&c.variant===v.name);await selectChoice(s,index);
      if(s.loaded)return;
    }
  })).then(()=>{document.body.dataset.ready='true';filter();return report();});
  window.LatinLibrary={ready,report};
})();
