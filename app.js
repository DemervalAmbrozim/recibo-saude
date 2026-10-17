// Recibo Saúde Fácil, fase 2: os dados ficam no Supabase, protegidos por RLS (ver supabase/001_esquema.sql).
const sb = supabase.createClient(CONFIG.url, CONFIG.chave);
const $=id=>document.getElementById(id);
const so=s=>String(s||'').replace(/\D/g,'');
const brl=n=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const vcsv=n=>n.toFixed(2).replace('.',',');
const dBR=iso=>iso.split('-').reverse().join('/');
const ascii=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[;\r\n]/g,' ');
const hojeISO=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const num=v=>parseFloat(String(v).replace(/\./g,'').replace(',','.'));
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function cpfOk(c){c=so(c);if(c.length!==11||/^(\d)\1+$/.test(c))return false;
  for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=+c[i]*(t+1-i);if(((s*10)%11)%10!==+c[t])return false}return true}
const fmtCpf=c=>{c=so(c);return c.length===11?c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'):c};

function avisa(t,err){const a=$('aviso');a.textContent=t;a.className='msg'+(err?' err':'');a.hidden=false;clearTimeout(avisa.t);avisa.t=setTimeout(()=>a.hidden=true,5000)}
async function copia(txt,el){try{await navigator.clipboard.writeText(txt);avisa('Copiado.')}catch(e){if(el){el.focus();el.select()}avisa('Selecionei o texto: use Copiar do próprio celular.')}}
function baixa(nome,txt){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt+'\r\n'],{type:'text/csv'}));
  a.download=nome;document.body.appendChild(a);a.click();a.remove();}
// Erro do banco vira mensagem clara; devolve true se deu erro
function falhou(r,oque){if(!r.error)return false;console.error(r.error);avisa(`Não consegui ${oque}. Confira a internet e tente de novo.`,true);return true}

// Estado em memória do profissional aberto
let S={prof:null,pac:[],at:[],desp:[],lotes:[]}, PROFS=[];
const pacDe=id=>S.pac.find(p=>p.id===id)||{nome:'(removido)',cpf:''};

// ---------- Login ----------
$('f-login').onsubmit=async e=>{e.preventDefault();
  try{localStorage.setItem('rs-nome',$('l-nome').value.trim())}catch(_){}
  const r=await sb.auth.signInWithOtp({email:$('l-email').value.trim(),options:{emailRedirectTo:location.origin+location.pathname}});
  $('l-msg').textContent=r.error?'Não foi possível enviar: '+r.error.message:'Link enviado. Abra seu e-mail neste aparelho e toque no link.';};
$('b-sair').onclick=async()=>{await sb.auth.signOut();location.reload();};

let entrando=false;
async function entrar(again){
  if(entrando&&!again)return; entrando=true;
  const ac=await sb.from('acessos').select('papel, profissionais(*)');
  if(falhou(ac,'abrir seus dados'))return;
  PROFS=ac.data.map(x=>({...x.profissionais,papel:x.papel}));
  if(!PROFS.length){ // primeiro acesso: cria o cadastro da profissional
    let nome='';try{nome=localStorage.getItem('rs-nome')||''}catch(_){}
    const r=await sb.rpc('criar_profissional',{p_nome:nome});
    if(falhou(r,'criar seu cadastro'))return;
    return entrar(true);
  }
  PROFS.sort((a,b)=>(a.papel==='dono'?0:1)-(b.papel==='dono'?0:1)||a.nome.localeCompare(b.nome));
  $('prof-sel').innerHTML=PROFS.map(p=>`<option value="${p.id}">${esc(p.nome||'(sem nome)')}${p.papel==='assessor'?' (cliente)':''}</option>`).join('');
  $('prof-sel').hidden=PROFS.length<2;
  $('t-login').hidden=true;document.querySelector('nav').hidden=false;
  document.querySelector('nav button').click();
  await abrir(PROFS[0].id);
}
$('prof-sel').onchange=()=>abrir($('prof-sel').value);

async function abrir(id){
  S.prof=PROFS.find(p=>p.id===id);
  const [p,a,d,l]=await Promise.all([
    sb.from('pacientes').select('*').eq('profissional_id',id).eq('ativo',true),
    sb.from('atendimentos').select('*').eq('profissional_id',id),
    sb.from('despesas').select('*').eq('profissional_id',id),
    sb.from('lotes').select('*').eq('profissional_id',id).order('criado_em',{ascending:false})]);
  if([p,a,d,l].some(r=>falhou(r,'carregar os dados')))return;
  S.pac=p.data; S.at=a.data.map(x=>({...x,valor:+x.valor})); S.desp=d.data.map(x=>({...x,valor:+x.valor})); S.lotes=l.data;
  cfgTela();render();despTela();acessosTela();if(!$('t-fech').hidden)fech();
}

// ---------- Abas ----------
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(s=>s.hidden=s.id!==b.dataset.t);
  document.querySelectorAll('nav button').forEach(x=>x===b?x.setAttribute('aria-current','page'):x.removeAttribute('aria-current'));
  if(b.dataset.t==='t-fech')fech();});

// ---------- Atendimentos e pacientes ----------
function render(){
  $('quem').textContent=S.prof.nome||'Preencha seus dados em Ajustes';
  const pacs=[...S.pac].sort((a,b)=>a.nome.localeCompare(b.nome));
  $('a-pac').innerHTML=pacs.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('');
  const mes=$('a-mes').value;
  const at=S.at.filter(a=>a.data.startsWith(mes)).sort((a,b)=>b.data.localeCompare(a.data));
  $('l-atend').innerHTML=at.length?at.map(a=>`<div class="item"><div><b>${esc(pacDe(a.paciente_id).nome)}</b><div class="meta">${dBR(a.data)} · ${esc(a.forma)}</div></div>
    <div style="text-align:right"><div class="num">${brl(a.valor)}</div><span class="pill ${a.lote_id?'':'pend'}">${a.lote_id?'recibo emitido':'falta recibo'}</span></div>
    <div style="grid-column:1/-1" class="btns">${a.lote_id?`<button class="small" data-reab="${a.id}" type="button">Desmarcar emitido</button>`:`<button class="small" data-del="${a.id}" type="button">Excluir</button>`}</div></div>`).join('')
    :'<div class="sub">Nenhum atendimento neste mês. Registre o primeiro acima.</div>';
  $('l-pac').innerHTML=pacs.length?pacs.map(p=>`<div class="item"><div><b>${esc(p.nome)}</b>
    <div class="meta mono">${fmtCpf(p.cpf)}${p.cpf_pagador?' · paga: '+fmtCpf(p.cpf_pagador):''}</div></div><button class="small" data-dpac="${p.id}" type="button">Excluir</button></div>`).join('')
    :'<div class="sub">Cadastre o primeiro paciente acima.</div>';
}
document.addEventListener('click',async e=>{
  const t=e.target.dataset; if(!t)return;
  if(t.del){if(falhou(await sb.from('atendimentos').delete().eq('id',t.del),'excluir'))return;
    S.at=S.at.filter(a=>a.id!==t.del);render();}
  if(t.reab){if(falhou(await sb.from('atendimentos').update({lote_id:null}).eq('id',t.reab),'desmarcar'))return;
    S.at.find(a=>a.id===t.reab).lote_id=null;render();}
  if(t.dpac){if(S.at.some(a=>a.paciente_id===t.dpac&&!a.lote_id)){avisa('Esse paciente tem atendimento sem recibo. Emita ou exclua antes.',true);return}
    // guarda o histórico: o paciente sai da lista, os recibos antigos continuam
    if(falhou(await sb.from('pacientes').update({ativo:false}).eq('id',t.dpac),'excluir o paciente'))return;
    S.pac=S.pac.filter(p=>p.id!==t.dpac);render();}
  if(t.ddesp){if(falhou(await sb.from('despesas').delete().eq('id',t.ddesp),'excluir a despesa'))return;
    S.desp=S.desp.filter(d=>d.id!==t.ddesp);despTela();}
  if(t.tirar){if(falhou(await sb.from('acessos').delete().eq('profissional_id',S.prof.id).eq('user_id',t.tirar),'tirar o acesso'))return;acessosTela();}
});
$('f-atend').onsubmit=async e=>{e.preventDefault();
  const v=num($('a-valor').value);
  if(!(v>0)){avisa('Valor inválido. Use, por exemplo, 150,00.',true);return}
  if(!$('a-pac').value){avisa('Cadastre o paciente primeiro, na aba Pacientes.',true);return}
  const r=await sb.from('atendimentos').insert({profissional_id:S.prof.id,paciente_id:$('a-pac').value,data:$('a-data').value,valor:v,forma:$('a-forma').value}).select().single();
  if(falhou(r,'salvar o atendimento'))return;
  S.at.push({...r.data,valor:+r.data.valor});$('a-valor').value='';$('a-mes').value=$('a-data').value.slice(0,7);render();avisa('Atendimento salvo.');};
$('f-pac').onsubmit=async e=>{e.preventDefault();
  const cpf=so($('p-cpf').value),pag=so($('p-pag').value);
  if(!cpfOk(cpf)){avisa('CPF do paciente inválido. Confira os números.',true);return}
  if(pag&&!cpfOk(pag)){avisa('CPF de quem paga inválido.',true);return}
  const r=await sb.from('pacientes').insert({profissional_id:S.prof.id,nome:$('p-nome').value.trim(),cpf,cpf_pagador:pag&&pag!==cpf?pag:null}).select().single();
  if(falhou(r,'salvar o paciente'))return;
  S.pac.push(r.data);e.target.reset();render();avisa('Paciente salvo.');};
$('a-mes').onchange=render;

// ---------- Livro-caixa: plano de contas da Receita, só despesas dedutíveis (P10) ----------
const P10=[['00002','Aluguel do consultório'],['00003','Condomínio do consultório'],['00001','Água do consultório'],['00007','Energia do consultório'],
  ['00014','Telefone e internet do consultório'],['00008','Gás do consultório'],['00009','IPTU do consultório'],['00004','Anuidade do conselho (CREFITO etc.)'],
  ['00011','Material de limpeza do consultório'],['00012','Material de escritório'],['00013','Funcionário: salário, INSS e FGTS'],['00010','ISS'],
  ['00005','Cópias e autenticações'],['00006','Emolumentos pagos a terceiros']].map(([c,n])=>['P10.01.'+c,n]);
const nomeCod=c=>(P10.find(x=>x[0]===c)||[c,c])[1];
$('d-cod').innerHTML=P10.map(([c,n])=>`<option value="${c}">${n}</option>`).join('');
const despMes=()=>S.desp.filter(d=>d.data.startsWith($('d-mes').value)).sort((a,b)=>a.data.localeCompare(b.data));
function despTela(){
  const ds=despMes();
  $('l-desp').innerHTML=ds.length?ds.map(d=>`<div class="item"><div><b>${esc(nomeCod(d.codigo))}</b><div class="meta">${dBR(d.data)}${d.obs?' · '+esc(d.obs):''}</div></div>
    <div style="text-align:right"><div class="num">${brl(d.valor)}</div>${d.lote_id?'<span class="pill">importada</span>':`<button class="small" data-ddesp="${d.id}" type="button">Excluir</button>`}</div></div>`).join('')
    +`<div class="item"><b>Total</b><b class="num">${brl(ds.reduce((s,d)=>s+d.valor,0))}</b></div>`
    :'<div class="sub">Nenhuma despesa neste mês.</div>';
  $('d-csv').value=ds.filter(d=>!d.lote_id).map(d=>[dBR(d.data),d.codigo,vcsv(d.valor),ascii(nomeCod(d.codigo)+(d.obs?' - '+d.obs:'')).slice(0,255)].join(';')).join('\r\n');
}
$('f-desp').onsubmit=async e=>{e.preventDefault();
  const v=num($('d-valor').value);
  if(!(v>0)){avisa('Valor inválido. Use, por exemplo, 800,00.',true);return}
  const r=await sb.from('despesas').insert({profissional_id:S.prof.id,codigo:$('d-cod').value,data:$('d-data').value,valor:v,obs:$('d-obs').value.trim()}).select().single();
  if(falhou(r,'salvar a despesa'))return;
  S.desp.push({...r.data,valor:+r.data.valor});$('d-valor').value='';$('d-obs').value='';$('d-mes').value=$('d-data').value.slice(0,7);despTela();avisa('Despesa salva.');};
$('d-mes').onchange=despTela;
$('d-copiar').onclick=()=>copia($('d-csv').value,$('d-csv'));
$('d-baixar').onclick=()=>$('d-csv').value&&baixa('despesas-'+$('d-mes').value+'.csv',$('d-csv').value);
$('d-importadas').onclick=()=>fechaLote('despesas',$('d-mes').value,despMes().filter(d=>!d.lote_id).map(d=>d.id));

// Grava o lote (trava contra importar duas vezes) e liga os itens a ele
async function fechaLote(tipo,mes,ids){
  if(!ids.length){avisa('Nada novo para marcar.');return}
  const l=await sb.from('lotes').insert({profissional_id:S.prof.id,tipo,mes,linhas:ids.length}).select().single();
  if(falhou(l,'registrar a importação'))return;
  const tab=tipo==='recibos'?'atendimentos':'despesas';
  if(falhou(await sb.from(tab).update({lote_id:l.data.id}).in('id',ids),'marcar os itens'))return;
  S.lotes.unshift(l.data);(tipo==='recibos'?S.at:S.desp).forEach(x=>{if(ids.includes(x.id))x.lote_id=l.data.id});
  render();despTela();if(!$('t-fech').hidden)fech();avisa(`${ids.length} ${tipo==='recibos'?'atendimento(s)':'despesa(s)'} marcados como importados.`);
}

// ---------- Carnê-Leão 2026: tabela mensal + desconto simplificado + redução da Lei 15.270/2025 ----------
const LIM=5000, LIM2=7350;
const TAB=[[2428.80,0,0],[2826.65,.075,182.16],[3751.05,.15,394.16],[4664.68,.225,675.49],[Infinity,.275,908.73]];
const SIMPL=607.20;
function carneLeao(rend,desp){
  const deducao=Math.max(desp,SIMPL), base=Math.max(0,rend-deducao);
  const [,al,pd]=TAB.find(f=>base<=f[0]); const bruto=Math.max(0,base*al-pd);
  const red=rend<=LIM?Math.min(bruto,312.89):rend<=LIM2?Math.max(0,978.62-0.133145*rend):0;
  return {deducao,usaSimpl:desp<SIMPL,base,bruto,red,devido:Math.max(0,Math.round((bruto-red)*100)/100)};
}

// ---------- Fechamento ----------
function recibos(mes){
  const pend=S.at.filter(a=>a.data.startsWith(mes)&&!a.lote_id).sort((a,b)=>a.data.localeCompare(b.data));
  if(!$('f-agrupa').checked)return pend.map(a=>({pac:a.paciente_id,data:a.data,valor:a.valor,datas:[a.data],ids:[a.id]}));
  const g={};pend.forEach(a=>{const r=g[a.paciente_id]||(g[a.paciente_id]={pac:a.paciente_id,data:a.data,valor:0,datas:[],ids:[]});
    r.valor+=a.valor;r.datas.push(a.data);r.ids.push(a.id);if(a.data>r.data)r.data=a.data});
  return Object.values(g);
}
function fech(){
  const mes=$('f-mes').value, ano=mes.slice(0,4);
  const tot=S.at.filter(a=>a.data.startsWith(mes)).reduce((s,a)=>s+a.valor,0);
  const tano=S.at.filter(a=>a.data.startsWith(ano)).reduce((s,a)=>s+a.valor,0);
  $('f-total').textContent=brl(tot);
  const desp=S.desp.filter(d=>d.data.startsWith(mes)).reduce((s,d)=>s+d.valor,0), cl=carneLeao(tot,desp);
  const [aa,mm]=mes.split('-').map(Number), venc=new Date(aa,mm+1,0); while([0,6].includes(venc.getDay()))venc.setDate(venc.getDate()-1);
  $('f-calc').innerHTML=[['Recebido no mês',brl(tot)],[cl.usaSimpl?'Desconto simplificado (maior que as despesas)':'Despesas do livro-caixa',brl(cl.deducao)],
    ['Base de cálculo',brl(cl.base)],['Imposto pela tabela',brl(cl.bruto)],['Redução de 2026',brl(cl.red)],
    ['<b>Carnê-Leão a pagar</b>',`<b>${brl(cl.devido)}</b>`],['Vencimento',cl.devido>0?venc.toLocaleDateString('pt-BR'):'nada a pagar']]
    .map(([a,b])=>`<div class="item"><span>${a}</span><span class="num">${b}</span></div>`).join('')+'<div class="sub">Estimativa. O valor oficial é o do Carnê-Leão Web.</div>';
  const m=$('f-meter');m.className='meter'+(tot>LIM2?' bad':tot>LIM*0.9?' warn':'');
  m.firstElementChild.style.width=Math.min(100,tot/LIM2*100)+'%';
  $('f-faixa').textContent=tot<=LIM?`Dentro da isenção de 2026: faltam ${brl(LIM-tot)} para ${brl(LIM)}.`
    :tot<=LIM2?`Passou de ${brl(LIM)}: imposto com redução parcial.`:`Acima de ${brl(LIM2)}: imposto sem redução.`;
  $('f-ano').textContent=`No ano ${ano}: ${brl(tano)} recebidos.`;
  const c=S.prof, rs=recibos(mes), erros=[];
  if(!cpfOk(c.cpf))erros.push('Preencha o CPF da profissional em Ajustes.');
  const antes=S.lotes.filter(l=>l.tipo==='recibos'&&l.mes===mes);
  if(antes.length&&rs.length)erros.push(`Este mês já teve importação em ${new Date(antes[0].criado_em).toLocaleDateString('pt-BR')}. A lista abaixo traz só os atendimentos novos.`);
  const linhas=rs.map(r=>{const p=pacDe(r.pac);
    const desc=ascii(`${c.descricao} - atendimento${r.datas.length>1?'s':''} em ${r.datas.map(d=>dBR(d).slice(0,5)).join(', ')}`).slice(0,255);
    return [dBR(r.data),'R01.001.001',c.ocupacao,vcsv(r.valor),'',desc,'PF',p.cpf_pagador||p.cpf,p.cpf,'','','','','S',so(c.cpf),ascii(c.registro)].join(';');});
  $('f-lista').innerHTML=rs.length?rs.map(r=>`<div class="item"><div><b>${esc(pacDe(r.pac).nome)}</b><div class="meta">${r.datas.map(dBR).join(', ')}</div></div><div class="num">${brl(r.valor)}</div></div>`).join('')
    :'<div class="sub">Todos os recibos deste mês já foram emitidos.</div>';
  $('f-erros').innerHTML=[...new Set(erros)].map(t=>`<div class="msg err">${esc(t)}</div>`).join('');
  $('f-csv').value=linhas.join('\r\n');
}
$('f-mes').onchange=fech;$('f-agrupa').onchange=fech;
$('b-copiar').onclick=()=>copia($('f-csv').value,$('f-csv'));
$('b-baixar').onclick=()=>$('f-csv').value&&baixa('recibos-'+$('f-mes').value+'.csv',$('f-csv').value);
$('b-zap').onclick=()=>{const rs=recibos($('f-mes').value);
  copia(`Recibos de ${$('f-mes').value.split('-').reverse().join('/')}:\n`+rs.map(r=>`${pacDe(r.pac).nome}: ${brl(r.valor)} (${r.datas.map(d=>dBR(d).slice(0,5)).join(', ')})`).join('\n')+`\nTotal: ${brl(rs.reduce((s,r)=>s+r.valor,0))}`);};
$('b-emitidos').onclick=()=>fechaLote('recibos',$('f-mes').value,recibos($('f-mes').value).flatMap(r=>r.ids));

// ---------- Ajustes ----------
function cfgTela(){const c=S.prof;$('c-nome').value=c.nome;$('c-cpf').value=fmtCpf(c.cpf);$('c-ocup').value=c.ocupacao;$('c-reg').value=c.registro;$('c-desc').value=c.descricao;}
$('f-cfg').onsubmit=async e=>{e.preventDefault();const cpf=so($('c-cpf').value);
  if(cpf&&!cpfOk(cpf)){avisa('CPF da profissional inválido.',true);return}
  const novo={nome:$('c-nome').value.trim(),cpf,ocupacao:$('c-ocup').value,registro:$('c-reg').value.trim(),descricao:$('c-desc').value.trim()||'Sessao de fisioterapia'};
  if(falhou(await sb.from('profissionais').update(novo).eq('id',S.prof.id),'salvar os dados'))return;
  Object.assign(S.prof,novo);render();avisa('Dados salvos.');};
async function acessosTela(){
  const souDono=S.prof.papel==='dono';
  $('b-assessor').disabled=!souDono;
  const r=await sb.from('acessos').select('user_id,papel').eq('profissional_id',S.prof.id);
  if(r.error)return;
  const assessores=r.data.filter(x=>x.papel==='assessor');
  $('l-acessos').innerHTML=assessores.length?assessores.map(x=>`<div class="item"><span class="sub">Assessor com acesso</span>${souDono?`<button class="small" data-tirar="${x.user_id}" type="button">Tirar acesso</button>`:''}</div>`).join('')
    :'<div class="sub">Nenhum assessor com acesso.</div>';
}
$('b-assessor').onclick=async()=>{const em=$('as-email').value.trim();if(!em)return;
  const r=await sb.rpc('dar_acesso_assessor',{prof:S.prof.id,email_assessor:em});
  if(r.error){avisa(/conta/.test(r.error.message)?'Essa pessoa ainda não entrou no app. Peça para ela entrar uma vez.':'Não consegui dar o acesso.',true);return}
  $('as-email').value='';acessosTela();avisa('Acesso dado.');};
$('b-bkp').onclick=()=>copia(JSON.stringify({profissional:S.prof,pacientes:S.pac,atendimentos:S.at,despesas:S.desp,lotes:S.lotes}));

// ---------- Início ----------
const h=hojeISO();$('a-data').value=h;$('a-mes').value=h.slice(0,7);$('f-mes').value=h.slice(0,7);$('d-data').value=h;$('d-mes').value=h.slice(0,7);
sb.auth.getSession().then(({data})=>{if(data.session)entrar();else $('t-login').hidden=false;});
sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_IN'&&!S.prof)entrar();});
