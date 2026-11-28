import {createAPI, TTL, escapeHTML as esc, safeURL, list, normalize, currentProgram, eventTime, sortEvents} from './api.mjs';
const $ = s => document.querySelector(s), api = createAPI();
const channelId = new URLSearchParams(location.search).get('canal');
const channelURL = id => './index.html?canal=' + encodeURIComponent(id);
const preferred = ['Canais Abertos','Documentários','Entretenimento','Esportes','Filmes e Séries','Infantil','Notícias'];
const state = {channels:[], events:[], categories:[], sportCategories:[], query:'', category:'', favoritesOnly:false, sport:'', sportStatus:'', search:null, loading:true, sportsUnavailable:false};
let favorites = [], timer, searchController, searchVersion = 0, detailVersion = 0, slide = 0, highlights = [], lastRefresh = 0, loading = false;
try { const saved = JSON.parse(localStorage.getItem('dc-favorites') || '[]'); favorites = Array.isArray(saved) ? saved.filter(x => typeof x === 'string') : []; } catch {}
const isFavorite = c => favorites.includes(String(c.id)) || favorites.includes(c.name);
const statusText = status => ({live:'Ao vivo', upcoming:'Em breve', finished:'Encerrado'}[status] || 'Programação');
function image(url, cls, alt = '') { const src = safeURL(url); return src ? `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer">` : `<span class="${cls} image-fallback" aria-hidden="true">▶</span>`; }
document.addEventListener('error', e => { if (e.target.tagName === 'IMG') { const fallback = document.createElement('span'); fallback.className = e.target.className + ' image-fallback'; fallback.textContent = '▶'; fallback.setAttribute('aria-hidden','true'); e.target.replaceWith(fallback); } }, true);
function channelCard(c) { const p = currentProgram(c); return `<a class="channel-card" href="${esc(channelURL(c.id))}" target="_blank" rel="noopener" aria-label="Assistir ${esc(c.name)} (nova guia)">${image(c.logo_url,'logo-image')}<strong>${esc(c.name)}${isFavorite(c) ? ' ★' : ''}</strong><small>${p ? '<b>Agora:</b> ' + esc(p.title) : 'Ver canal e programação'}</small></a>`; }
function eventCard(e) { return `<button class="event-card" data-kind="sports" data-id="${esc(e.id)}"><span class="event-art">${image(e.poster,'event-image')}<span class="event-status ${e.status === 'live' ? 'is-live' : ''}">${statusText(e.status)} · ${esc(eventTime(e))}</span></span><span class="event-copy"><strong>${esc(e.title)}</strong><small>${esc(e.competition || e.category || 'Esportes')}</small></span></button>`; }
function section(title, id, cards, filters='') { return `<section class="catalog-section" id="${id}"><div class="section-head"><h2><span class="tv-icon" aria-hidden="true"></span>${esc(title)}</h2><div class="row-actions"><button class="arrow prev" aria-label="Anteriores em ${esc(title)}">‹</button><button class="arrow next" aria-label="Próximos em ${esc(title)}">›</button><button class="all" aria-expanded="false">Ver todos →</button></div></div>${filters}<div class="card-row">${cards}</div></section>`; }
function sportFilters() { return `<div class="sport-filters"><label>Esporte <select id="sport-category"><option value="">Todos</option>${state.sportCategories.map(c => `<option value="${esc(c)}" ${c===state.sport?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Status <select id="sport-status"><option value="">Todos</option>${['live','upcoming','finished'].map(s=>`<option value="${s}" ${s===state.sportStatus?'selected':''}>${statusText(s)}</option>`).join('')}</select></label><small>Horários no seu fuso local</small></div>`; }
function render() {
  const source = state.search || state;
  let channels = source.channels, events = source.events;
  if (state.query && !state.search) { const q = normalize(state.query); channels = channels.filter(c => normalize([c.name,c.description,c.category,c.epg?.current?.title].join(' ')).includes(q)); events = events.filter(e => normalize([e.title,e.competition,e.category,e.teams?.home?.name,e.teams?.away?.name].join(' ')).includes(q)); }
  if (state.favoritesOnly) channels = channels.filter(isFavorite);
  if (state.category) channels = channels.filter(c => c.category === state.category);
  let html = '';
  if (!state.category && !state.favoritesOnly && (!state.query || events.length || state.sport || state.sportStatus)) {
    events = sortEvents(events.filter(e => (!state.sport || e.category === state.sport) && (!state.sportStatus || e.status === state.sportStatus)));
    const notice = state.loading ? 'Carregando agenda…'
      : state.sportsUnavailable ? 'Agenda temporariamente indisponível. Use “Tentar novamente” para atualizar.'
      : !events.length && (state.sport || state.sportStatus) ? 'Nenhum evento corresponde aos filtros.'
      : !state.query && !state.sport && !state.sportStatus && !events.some(event => event.status === 'live' || event.status === 'upcoming')
        ? 'Nenhum jogo ao vivo ou agendado no momento.' : '';
    const message = notice ? '<p class="inline-empty" role="status">' + esc(notice) + '</p>' : '';
    html += section('Agenda esportiva','agenda',events.map(eventCard).join(''),sportFilters() + message);
  }
  const names = [...new Set([...state.categories,...channels.map(c=>c.category || 'Outros canais')])];
  names.sort((a,b) => (preferred.indexOf(a)<0?99:preferred.indexOf(a)) - (preferred.indexOf(b)<0?99:preferred.indexOf(b)));
  html += '<div id="canais"></div>';
  names.forEach((name,i) => { const items = channels.filter(c => (c.category || 'Outros canais') === name); if(items.length) html += section(name,'category-'+i,items.map(channelCard).join('')); });
  $('#catalog').innerHTML = html;
  $('#empty').hidden = state.loading || (!state.query && !state.category && !state.favoritesOnly) || channels.length > 0 || (!state.category && !state.favoritesOnly && events.length > 0);
  $('#empty').textContent = state.favoritesOnly ? 'Nenhum favorito encontrado. Abra um canal e toque na estrela para salvar.' : 'Nenhum resultado encontrado. Tente outro canal, time ou evento.';
  $('.result-bar').hidden = !(state.query || state.category || state.favoritesOnly);
  $('#result-label').textContent = state.favoritesOnly ? 'Seus canais favoritos' : state.category || 'Resultados da busca';
  $('#fav-count').textContent = state.channels.filter(isFavorite).length;
  $('#chips').innerHTML = names.map(n=>`<button data-category="${esc(n)}" class="${n===state.category?'selected':''}" aria-pressed="${n===state.category}"><span aria-hidden="true">▣</span>${esc(n)}</button>`).join('');
  document.querySelectorAll('.catalog-section').forEach(s => { const row=s.querySelector('.card-row'),prev=s.querySelector('.prev'),next=s.querySelector('.next'); const update=()=>{prev.disabled=row.scrollLeft<2;next.disabled=row.scrollLeft+row.clientWidth>=row.scrollWidth-2;}; prev.onclick=()=>row.scrollBy({left:-600,behavior:'smooth'});next.onclick=()=>row.scrollBy({left:600,behavior:'smooth'});row.onscroll=update;s.querySelector('.all').onclick=e=>{const expanded=row.classList.toggle('expanded');e.target.textContent=expanded?'Recolher ↑':'Ver todos →';e.target.setAttribute('aria-expanded',expanded);update();};requestAnimationFrame(update); });
  if ($('#sport-category')) $('#sport-category').onchange = e => {state.sport=e.target.value;render();};
  if ($('#sport-status')) $('#sport-status').onchange = e => {state.sportStatus=e.target.value;render();};
}
function announce(message, error=false) { $('#api-message').textContent=message;$('#api-status').classList.toggle('error',error);$('#retry').hidden=!error; }
async function refresh() {
  if (loading) return; loading=true;
  if (!lastRefresh) announce('Carregando canais e programação…');
  const results = await Promise.allSettled(['/channels','/sports','/channels/categories','/sports/categories','/health'].map(p=>api(p,{fresh:true})));
  if(results[0].status==='fulfilled') state.channels=list(results[0].value.data).filter(c=>c.id&&c.name);
  state.sportsUnavailable = results[1].status !== 'fulfilled';
  state.events = state.sportsUnavailable ? [] : list(results[1].value.data).filter(e=>e.id&&e.title);
  if(results[2].status==='fulfilled') state.categories=list(results[2].value.data).map(c=>c.name).filter(Boolean);
  if(results[3].status==='fulfilled') state.sportCategories=list(results[3].value.data).map(c=>c.name).filter(Boolean);
  state.loading=false;loading=false;lastRefresh=Date.now();
  const failed=results.slice(0,2).some(r=>r.status==='rejected');
  const healthy=results[4].status==='fulfilled'&&results[4].value.status==='healthy';
  announce(failed ? 'Não foi possível atualizar todos os dados. Tente novamente.' : `${state.channels.length} canais · ${state.events.length} eventos · Atualizado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}${healthy?'':' · Status da API indisponível'}`,failed);
  if(state.query) scheduleSearch(state.query); else render();
  const liveEvents = sortEvents(state.events.filter(event => event.status === 'live'));
  const featuredChannels = state.channels.filter(channel => currentProgram(channel));
  const channels = featuredChannels.length ? featuredChannels : state.channels;
  const firstChanged = liveEvents[0]?.id !== (highlights[0]?.status === 'live' ? highlights[0].id : undefined);
  highlights = [...liveEvents, ...channels.slice(0, Math.max(0, 7 - liveEvents.length))];
  setSlide(firstChanged || slide >= highlights.length ? 0 : slide);
}
function setSlide(index) {
  slide=highlights.length?(index+highlights.length)%highlights.length:0;
  const c=highlights[slide], p=currentProgram(c);
  const liveEvent = c?.status === 'live' ? c : null;
  $('.hero h1').textContent=liveEvent?.title||p?.title||c?.name||'Seu próximo programa está aqui';
  $('#hero-description').textContent=p?.description||c?.description||'Descubra canais, programação e eventos esportivos em um só lugar.';
  $('#hero-channel').textContent=liveEvent?.competition||c?.name||'DC CANAIS';$('.hero-meta span').textContent=c?.category||'Canais e esportes';
  $('.live').textContent=(liveEvent||p)?'● AO VIVO':'● EM DESTAQUE';
  const url=safeURL(liveEvent?.poster || p?.image);$('.hero-picture').style.backgroundImage=url?`url("${url.replace(/"/g,'%22')}")`:'';
  $('#hero-button').disabled=!c;$('#hero-prev').disabled=highlights.length<2;$('#hero-next').disabled=highlights.length<2;
  $('.dots').innerHTML=highlights.map((c,i)=>`<button class="${i===slide?'selected':''}" aria-label="Destaque ${i+1}: ${esc(c.title || c.name)}" aria-pressed="${i===slide}" data-slide="${i}"></button>`).join('');
}
function scheduleSearch(value) {
  state.query=value;state.search=null;$('#search').value=value;$('#top-search').value=value;$('#clear').hidden=!value;
  clearTimeout(timer);searchController?.abort();const version=++searchVersion;$('#search-message').textContent='';render();
  if(!value.trim())return;
  $('#search-message').textContent='Buscando na programação…';
  timer=setTimeout(async()=>{searchController=new AbortController();try{const result=await api('/search?q='+encodeURIComponent(value.trim()),{signal:searchController.signal});if(version!==searchVersion)return;state.search={channels:list(result.data?.channels),events:list(result.data?.events)};$('#search-message').textContent='';render();}catch(e){if(version!==searchVersion)return;$('#search-message').textContent='Busca online indisponível. Exibindo resultados do catálogo carregado.';}},350);
}
const detailsCache=new Map();
async function openDetail(kind,id) {
  const version=++detailVersion, key=kind+'/'+id;
  const item=(kind==='channels'?state.channels:state.events).find(x=>String(x.id)===id)||(kind==='channels'?state.search?.channels:state.search?.events)?.find(x=>String(x.id)===id);
  $('#detail-content').innerHTML='<p role="status">Carregando transmissão e programação…</p>';
  if(!$('#detail').open) { if(channelId) $('#detail').show(); else $('#detail').showModal(); }
  try {const hit=detailsCache.get(key);const result=hit&&Date.now()-hit.time<TTL?hit.item:(await api('/'+kind+'/'+encodeURIComponent(id))).data;if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('Detalhes inválidos');detailsCache.set(key,{item:result,time:Date.now()});if(version===detailVersion&&$('#detail').open)renderDetail(result,kind,false);}
  catch {if(version!==detailVersion||!$('#detail').open)return;if(item)renderDetail(item,kind,true);else $('#detail-content').innerHTML='<h2>Não foi possível carregar</h2><p>Tente abrir este canal ou evento novamente em alguns instantes.</p>';}
}
function renderDetail(item,kind,stale) {
  const isChannel=kind==='channels',name=item.name||item.title||'Transmissão',p=currentProgram(item),next=item.epg?.next;
  if (channelId) document.title = name + ' | DC CANAIS';
  const sources=list(item.embeds).filter(s=>safeURL(s.embed_url));
  $('#detail-content').innerHTML=`<div class="detail-heading">${isChannel?image(item.logo_url,'detail-logo'):''}<div><h2>${esc(name)}</h2><p class="detail-tag">${esc(item.category||'')}${!isChannel?' · '+statusText(item.status)+' · '+esc(eventTime(item)):''}</p></div></div>${stale?'<p class="notice">Não foi possível atualizar os detalhes. Exibindo a última informação carregada.</p>':''}<div id="player-area">${sources.length?'<div class="player-placeholder">Escolha um servidor abaixo para assistir.</div>':'<p class="notice">Nenhum servidor de transmissão disponível no momento.</p>'}</div>${sources.length?`<div class="sources" aria-label="Servidores de transmissão">${sources.map((s,i)=>`<button data-source="${i}" aria-pressed="false">▶ ${esc(s.provider||'Servidor '+(i+1))} <small>${esc(s.quality||'')}</small></button>`).join('')}</div><p class="player-help" id="player-help">Selecione um servidor acima para carregar o player.</p>`:''}<p>${esc(item.description||'')}</p>${isChannel?`<div class="epg"><div><span>AGORA</span><h3>${esc(p?.title||'Programação atual indisponível')}</h3><p>${esc(p?.formatted_time||'')}</p><p>${esc(p?.description||'')}</p></div>${next&&Number(next.end_time)*1000>Date.now()?`<div><span>A SEGUIR</span><h3>${esc(next.title)}</h3><p>${esc(next.formatted_time||'')}</p></div>`:''}</div><button class="primary" id="toggle-favorite">${isFavorite(item)?'★ Remover dos favoritos':'☆ Adicionar aos favoritos'}</button>`:''}`;
  if(isChannel)$('#toggle-favorite').onclick=()=>{if(isFavorite(item))favorites=favorites.filter(v=>v!==String(item.id)&&v!==item.name);else favorites.push(String(item.id));try{localStorage.setItem('dc-favorites',JSON.stringify(favorites));}catch{}$('#toggle-favorite').textContent=isFavorite(item)?'★ Remover dos favoritos':'☆ Adicionar aos favoritos';render();};
  document.querySelectorAll('[data-source]').forEach(button=>button.onclick=()=>{const src=sources[Number(button.dataset.source)];const iframe=document.createElement('iframe');iframe.src=safeURL(src.embed_url);iframe.title='Assistir '+name+' — '+(src.provider||'Servidor');iframe.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';iframe.allowFullscreen=true;iframe.referrerPolicy='no-referrer';$('#player-area').replaceChildren(iframe);document.querySelectorAll('[data-source]').forEach(b=>b.setAttribute('aria-pressed',b===button));$('#player-help').textContent='Player de '+(src.provider||'transmissão')+' selecionado. Se não iniciar, tente outro servidor. A disponibilidade depende do provedor.';});
}
$('#catalog').onclick=e=>{const card=e.target.closest('[data-kind]');if(card)openDetail(card.dataset.kind,card.dataset.id);};
$('#chips').onclick=e=>{const b=e.target.closest('[data-category]');if(!b)return;state.category=state.category===b.dataset.category?'':b.dataset.category;state.favoritesOnly=false;render();};
$('#search').oninput=e=>scheduleSearch(e.target.value);$('#top-search').oninput=e=>scheduleSearch(e.target.value);$('#top-search').onkeydown=e=>{if(e.key==='Enter')$('.discover').scrollIntoView();};$('#clear').onclick=()=>scheduleSearch('');
function reset(){state.category='';state.favoritesOnly=false;state.sport='';state.sportStatus='';scheduleSearch('');}
$('#reset').onclick=reset;
function showFavorites(){state.favoritesOnly=!state.favoritesOnly;state.category='';scheduleSearch('');$('.discover').scrollIntoView();}
$('#favorites').onclick=showFavorites;$('#footer-favorites').onclick=showFavorites;
$('.close').onclick=()=>$('#detail').close();$('#detail').addEventListener('close',()=>{detailVersion++;$('#detail-content').replaceChildren();});
$('#detail').onclick=e=>{if(e.target===$('#detail')){const r=$('#detail').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#detail').close();}};
$('#hero-prev').onclick=()=>setSlide(slide-1);$('#hero-next').onclick=()=>setSlide(slide+1);$('.dots').onclick=e=>{if(e.target.dataset.slide!==undefined)setSlide(+e.target.dataset.slide);};$('#hero-button').onclick=()=>{const item = highlights[slide]; if (!item) return; if (item.status === 'live') openDetail('sports', String(item.id)); else window.open(channelURL(item.id), '_blank', 'noopener');};
document.querySelectorAll('a[href="#canais"],a[href="#agenda"],a[href="#inicio"]').forEach(a=>a.addEventListener('click',reset));
$('#retry').onclick=refresh;$('#year').textContent=new Date().getFullYear();
if (channelId) {
  document.body.classList.add('channel-page');
  openDetail('channels', channelId);
} else {
setSlide(0);render();refresh();setInterval(()=>{if(!document.hidden)refresh();},TTL);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastRefresh>=TTL)refresh();});


}
