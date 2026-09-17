const form=document.getElementById('settings-form');
const phone=document.getElementById('whatsapp-phone');
const save=document.getElementById('save-button');
const status=document.getElementById('save-status');
const error=document.getElementById('phone-error');
const preview=document.getElementById('preview-link');
let token, saved, busy=false;
function national(value){let d=value.replace(/\D/g,'');return d.startsWith('55')&&d.length>=12?d.slice(2):d;}
function format(value){const d=national(value);if(d.startsWith('0800'))return d.replace(/^(\d{4})(\d{3})(\d{4})$/,'$1 $2 $3');return d.replace(/^(\d{2})(\d{4,5})(\d{4})$/,'($1) $2-$3');}
function update(){
  const d=national(phone.value);
  const plausible=d.length===10||d.length===11;
  preview.hidden=!plausible;document.getElementById('preview-empty').hidden=plausible;
  if(plausible){preview.href='https://wa.me/55'+d;preview.textContent='wa.me/55'+d;}
  save.disabled=busy||!token||'55'+d===saved||!d;
}
phone.addEventListener('input',()=>{error.textContent='';phone.removeAttribute('aria-invalid');status.textContent='';update();});
phone.addEventListener('blur',()=>{phone.value=format(phone.value);update();});
async function load(){
  try{
    const response=await fetch('/api/admin/settings',{cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.message);
    token=data.token;saved=data.whatsappPhone;phone.value=format(saved);phone.disabled=false;
    document.getElementById('current-number').textContent='+55 '+format(saved);update();
  }catch(e){status.dataset.error='true';status.textContent=e.message||'Não foi possível carregar. Atualize a página.';document.getElementById('current-number').textContent='Indisponível';}
}
form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy||!token)return;
  busy=true;save.textContent='Salvando…';status.textContent='';update();
  try{
    const response=await fetch('/api/admin/settings',{method:'PUT',headers:{'Content-Type':'application/json','X-Admin-Token':token},body:JSON.stringify({whatsappPhone:phone.value})});
    const data=await response.json();if(!response.ok)throw new Error(data.message||'Não foi possível salvar.');
    saved=data.whatsappPhone;phone.value=format(saved);document.getElementById('current-number').textContent='+55 '+format(saved);
    status.dataset.error='false';status.textContent='WhatsApp atualizado! Todos os botões do site agora usam este número.';
    try{localStorage.setItem('trie-settings-updated',String(Date.now()));}catch{}
  }catch(e){error.textContent=e.message;phone.setAttribute('aria-invalid','true');phone.focus();}
  finally{busy=false;save.textContent='Salvar alterações';update();}
});
const tabs=[...document.querySelectorAll('[role=tab]')];
let visitsLoaded=false, visitRows=[];
function selectTab(tab){
  for(const t of tabs){const on=t===tab;t.setAttribute('aria-selected',on);document.getElementById(t.getAttribute('aria-controls')).hidden=!on;}
  try{localStorage.setItem('trie-admin-tab',tab.id);}catch{}
  if(tab.id==='tab-visits'&&!visitsLoaded)loadVisits();
}
tabs.forEach(t=>t.addEventListener('click',()=>selectTab(t)));
const cell=text=>{const td=document.createElement('td');td.textContent=text??'';return td;};
const dateTime=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'medium'});
function renderVisits(){
  const body=document.getElementById('visits-body');
  const q=document.getElementById('visit-filter').value.trim().toLowerCase();
  const rows=visitRows.filter(v=>!q||[v.ip,v.city,v.region,v.country,v.path].some(x=>x&&x.toLowerCase().includes(q)));
  body.replaceChildren();
  if(!rows.length){const tr=document.createElement('tr');const td=cell(visitRows.length?'Nenhum acesso corresponde ao filtro.':'Nenhum acesso registrado ainda.');td.colSpan=4;tr.append(td);body.append(tr);return;}
  for(const v of rows){
    const tr=document.createElement('tr');
    const place=cell(v.city||'Desconhecida');
    const extra=[v.region,v.country].filter(Boolean).join(', ');
    if(extra){const small=document.createElement('small');small.textContent=extra;place.append(small);}
    const page=cell(v.path);page.className='path';
    if(v.user_agent){const small=document.createElement('small');small.textContent=v.user_agent;page.append(small);}
    tr.append(cell(dateTime.format(new Date(v.created_at))),cell(v.ip),place,page);
    body.append(tr);
  }
}
async function loadVisits(){
  const note=document.getElementById('visits-note');
  if(!token){note.textContent='Aguardando o painel carregar…';return setTimeout(loadVisits,300);}
  visitsLoaded=true;note.textContent='Carregando…';
  try{
    const response=await fetch('/api/admin/visits?limit=500',{cache:'no-store',headers:{'X-Admin-Token':token}});
    const data=await response.json();if(!response.ok)throw new Error(data.message);
    visitRows=data.visits;
    const today=new Date().toDateString();
    document.getElementById('stat-total').textContent=visitRows.length;
    document.getElementById('stat-unique').textContent=new Set(visitRows.map(v=>v.ip)).size;
    document.getElementById('stat-today').textContent=visitRows.filter(v=>new Date(v.created_at).toDateString()===today).length;
    note.textContent=(data.persistent?'Últimos 500 acessos, salvos no Supabase.':'Supabase não configurado: os acessos ficam só na memória e somem ao reiniciar o servidor.')+' Atualizado às '+new Date().toLocaleTimeString('pt-BR')+'.';
    renderVisits();
  }catch(e){visitsLoaded=false;note.textContent=e.message||'Não foi possível carregar os acessos.';}
}
document.getElementById('refresh-visits').addEventListener('click',loadVisits);
document.getElementById('visit-filter').addEventListener('input',renderVisits);
load();
try{const saved=document.getElementById(localStorage.getItem('trie-admin-tab'));if(saved)selectTab(saved);}catch{}
