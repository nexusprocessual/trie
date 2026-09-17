/* Local-only adaptations. Original presentation and Bootstrap interactions are preserved. */
(() => {
  async function refreshWhatsApp(){
    try{
      const response=await fetch('/api/settings',{cache:'no-store'});
      if(!response.ok)return;
      const settings=await response.json();
      if(!/^55\d{10,11}$/.test(settings.whatsappPhone))return;
      document.querySelectorAll('a[href^="https://wa.me/"]').forEach(link=>{
        const url=new URL(link.href);url.pathname='/'+settings.whatsappPhone;link.href=url.href;
      });
    }catch{/* Keep the server-rendered destination if offline. */}
  }
  refreshWhatsApp();
  window.addEventListener('focus',refreshWhatsApp);
  window.addEventListener('storage',event=>{if(event.key==='trie-settings-updated')refreshWhatsApp();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshWhatsApp();});
  // Render local covers immediately: embedded browsers can block YouTube frames.
  const videoStyle = document.createElement('style');
  videoStyle.textContent = `
    .trie-video{position:relative;display:block;width:100%;aspect-ratio:16/9;background:#05283b;overflow:hidden;border-radius:20px;color:#fff}
    .ratio>.trie-video{position:absolute;inset:0;height:100%}
    .trie-video-cover{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
    .trie-video-title{position:absolute;top:0;left:0;right:0;padding:16px 20px 32px;background:linear-gradient(#0009,transparent);font:600 clamp(12px,2vw,18px)/1.3 Arial,sans-serif;text-shadow:0 1px 3px #000;pointer-events:none}
    .trie-video-play{position:absolute;inset:0;border:0;background:transparent;cursor:pointer;display:grid;place-items:center;width:100%;height:100%}
    .trie-video-play span{display:grid;place-items:center;width:68px;height:48px;border-radius:14px;background:#f03;box-shadow:0 1px 5px #0003}
    .trie-video-play span:after{content:'';margin-left:4px;border-left:20px solid white;border-top:12px solid transparent;border-bottom:12px solid transparent}
    .trie-video-play:hover span{background:#c00}.trie-video-play:focus-visible{outline:3px solid #05bec0;outline-offset:-4px}
    .trie-video-external{position:absolute;bottom:12px;right:12px;z-index:3;border-radius:22px;padding:8px 14px;background:#0009;color:white!important;text-decoration:none;font:14px Arial,sans-serif}
    .trie-video-frame,.trie-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0;visibility:hidden}
    .trie-video.is-playing iframe{visibility:visible}
    .trie-video-status{position:absolute;left:12px;right:12px;bottom:56px;text-align:center;font:14px Arial,sans-serif;background:#05283bea;border-radius:6px;padding:8px;pointer-events:none}
    .trie-video-status:empty{display:none}
    @media(max-width:480px){.trie-video-title{padding:10px 12px}.trie-video-external{font-size:12px;padding:6px 10px;bottom:8px;right:8px}.trie-video-status{font-size:12px;bottom:40px}}
  `;
  document.head.append(videoStyle);
  let apiPromise;
  const youtubeAPI = () => apiPromise ||= new Promise((resolve,reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); resolve(window.YT); };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => reject(new Error('Player unavailable'));
    document.head.append(script);
  });
  const videoTitles = {
    jv35NIf2hn0:'Triê Soluções Financeiras - Institucional',
    '8cSM1Hqzv4w':'Sede operacional da Triê Soluções Financeiras em Goiânia - GO'
  };
  function videoCard(id, title) {
    const card = document.createElement('div'); card.className = 'trie-video';
    const cover = document.createElement('img'); cover.className='trie-video-cover';
    cover.src=`/assets/video-posters/${id}.jpg`; cover.alt=title;
    const heading = document.createElement('div'); heading.className='trie-video-title'; heading.textContent=title;
    const play = document.createElement('button'); play.type='button'; play.className='trie-video-play';
    play.setAttribute('aria-label',`Reproduzir vídeo: ${title}`); play.innerHTML='<span aria-hidden="true"></span>';
    const link = document.createElement('a'); link.className='trie-video-external'; link.href=`https://www.youtube.com/watch?v=${id}`;
    link.target='_blank'; link.rel='noopener'; link.textContent='Assista no YouTube';
    const status=document.createElement('div'); status.className='trie-video-status'; status.setAttribute('role','status');
    card.append(cover,heading,play,status,link);
    let player, timer, disposed=false;
    const fallback = () => {
      if(disposed) return;
      card.classList.remove('is-playing'); play.disabled=false;
      status.textContent='O player não carregou. Você pode assistir no YouTube.';
    };
    play.addEventListener('click', async () => {
      play.disabled=true; status.textContent='Carregando vídeo…';
      clearTimeout(timer); timer=setTimeout(fallback,10000);
      try {
        const YT=await youtubeAPI(); if(disposed) return;
        player?.destroy();
        const mount=document.createElement('div'); mount.className='trie-video-frame';card.append(mount);
        player=new YT.Player(mount, {videoId:id, width:'100%',height:'100%',
          playerVars:{autoplay:1,rel:0,playsinline:1,origin:location.origin},
          events:{onReady:()=>{if(disposed)return;clearTimeout(timer);card.classList.add('is-playing');status.textContent='';player.playVideo();},onError:()=>{clearTimeout(timer);fallback();}}
        });
      } catch { clearTimeout(timer); fallback(); }
    });
    card.dispose = () => {disposed=true;clearTimeout(timer);player?.destroy();};
    return card;
  }
  document.querySelectorAll('iframe[src*="youtube.com/embed/"]').forEach(frame=>{
    const id=frame.src.match(/embed\/([\w-]{11})/)?.[1];
    if(id) frame.replaceWith(videoCard(id,videoTitles[id] || 'Triê Soluções Financeiras'));
  });
  const modal=document.getElementById('modalYoutube');
  if(modal){
    let modalCard;
    modal.addEventListener('show.bs.modal',event=>{
      const id=event.relatedTarget?.getAttribute('data-bs-id'); if(!id)return;
      const frame=modal.querySelector('#iframe');frame.src='';frame.hidden=true;
      modalCard?.dispose();modalCard?.remove();
      modalCard=videoCard(id,videoTitles[id] || event.relatedTarget.getAttribute('data-bs-title') || 'Triê Soluções Financeiras');
      frame.after(modalCard);
    });
    modal.addEventListener('hidden.bs.modal',()=>{modalCard?.dispose();modalCard?.remove();modalCard=null;});
  }

  const form = document.querySelector('form[action="/simulacao"]');
  const money = value => value.toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  const feedback = (input, message) => {
    input.classList.toggle('is-invalid', Boolean(message));
    input.setAttribute('aria-invalid', String(Boolean(message)));
    const element = input.parentElement.querySelector('.invalid-feedback');
    if (element) element.textContent = message;
  };

  if (form) {
    // Capture runs before the original AJAX listener, so no production lead is created.
    form.addEventListener('submit', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      const name = form.elements.nome, phone = form.elements.celular, uf = form.elements.uf;
      const invalid = [
        [name, name.value.trim().length < 2 ? 'Informe seu nome.' : ''],
        [phone, !/^\d{10,11}$/.test(phone.value.replace(/\D/g,'')) ? 'Informe um telefone com DDD.' : ''],
        [uf, !uf.value ? 'Selecione seu estado.' : '']
      ];
      invalid.forEach(([input, message]) => feedback(input,message));
      const error = invalid.find(([,message]) => message);
      if (error) { error[0].focus(); return; }
      // Personal details remain only in this form; no persistence or outbound request.
      form.hidden = true;
      const panel = document.createElement('section');
      panel.setAttribute('aria-label','Simulação demonstrativa');
      panel.innerHTML = `<h3>Simule sua economia</h3>
        <p class="small">Demonstração local: estimativa ilustrativa de redução de até 50%. Não representa proposta ou aprovação da Triê.</p>
        <form id="estimate-form"><div class="form-floating mb-3"><input id="debt" class="form-control" type="number" min="1" max="1000000000" step="0.01" placeholder="Saldo da dívida" required><label for="debt">Saldo da dívida (R$)</label></div>
        <button class="btn btn-lg btn-form w-100" type="submit">Calcular economia</button></form>
        <div id="estimate-result" class="mt-4" role="status" aria-live="polite"></div>
        <button type="button" id="estimate-back" class="btn btn-link mt-3">Voltar</button>`;
      form.after(panel);
      const input = panel.querySelector('#debt'); input.focus();
      panel.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        const amount = Number(input.value);
        if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) return;
        panel.querySelector('#estimate-result').innerHTML = `<p>Saldo informado: <strong>${money(amount)}</strong></p><p>Economia estimada de até <strong>${money(amount * .5)}</strong></p><p>Saldo após redução máxima: <strong>${money(amount * .5)}</strong></p><small>O desconto real depende da análise e negociação. Nenhum dado foi enviado.</small>`;
      });
      panel.querySelector('#estimate-back').addEventListener('click', () => { panel.remove(); form.hidden=false; name.focus(); });
    }, true);
  }

  document.querySelectorAll('form[action="/newsletters"]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      let message = form.querySelector('[role="status"]');
      if (!message) { message = document.createElement('p'); message.setAttribute('role','status'); form.append(message); }
      message.textContent = 'A consulta de contratos depende da integração com o sistema da Triê. Nenhum dado foi enviado nesta versão local.';
    }, true);
  });
})();
