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
let S={prof:null,pac:[],at:[],desp:[],lotes:[],locais:[]}, PROFS=[];
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
  const [p,a,d,l,lc]=await Promise.all([
    sb.from('pacientes').select('*').eq('profissional_id',id).eq('ativo',true),
    sb.from('atendimentos').select('*').eq('profissional_id',id),
    sb.from('despesas').select('*').eq('profissional_id',id),
    sb.from('lotes').select('*').eq('profissional_id',id).order('criado_em',{ascending:false}),
    sb.from('locais').select('*').eq('profissional_id',id).eq('ativo',true).order('criado_em')]);
  if([p,a,d,l,lc].some(r=>falhou(r,'carregar os dados')))return;
  S.locais=lc.data;
  S.pac=p.data; S.at=a.data.map(x=>({...x,valor:+x.valor})); S.desp=d.data.map(x=>({...x,valor:+x.valor,valor_pago:x.valor_pago==null?null:+x.valor_pago})); S.lotes=l.data;
  cfgTela();render();locaisTela();despTela();acessosTela();linkTela();if(!$('t-fech').hidden)fech();
}

// ---------- Abas ----------
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(s=>s.hidden=s.id!==b.dataset.t);
  document.querySelectorAll('nav button').forEach(x=>x===b?x.setAttribute('aria-current','page'):x.removeAttribute('aria-current'));
  if(b.dataset.t==='t-fech')S.prof?abrir(S.prof.id):fech();}); // recarrega: a profissional pode ter lançado pelo link
// Ao voltar para o app (celular), traz o que entrou pelo link enquanto ele estava aberto
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.prof)abrir(S.prof.id);});

// ---------- Atendimentos e pacientes ----------
function render(){
  $('quem').textContent=S.prof.nome||'Preencha seus dados em Ajustes';
  const pacs=[...S.pac].sort((a,b)=>a.nome.localeCompare(b.nome));
  $('a-pac').innerHTML=pacs.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('');
  const mes=$('a-mes').value;
  const at=S.at.filter(a=>a.data.startsWith(mes)).sort((a,b)=>b.data.localeCompare(a.data));
  $('l-atend').innerHTML=at.length?at.map(a=>`<div class="item"><div><b>${esc(pacDe(a.paciente_id).nome)}</b><div class="meta">${dBR(a.data)} · ${esc(a.forma)}${a.local_id&&localDe(a.local_id)?' · '+esc(localDe(a.local_id).nome):''}</div></div>
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

// ---------- Livro-caixa: contas, locais e INSS vêm de regras.js ----------
const localDe=id=>S.locais.find(l=>l.id===id);
$('d-cod').innerHTML=CONTAS.map(([c,n])=>`<option value="${c}">${n}</option>`).join('');
function locaisTela(){$('d-local').innerHTML='<option value="">Não é conta de imóvel</option>'+S.locais.filter(l=>TIPOS[l.tipo][1]>0)
  .map(l=>`<option value="${l.id}">${esc(l.nome)} (${TIPOS[l.tipo][0]})</option>`).join('');despForm()}
function despForm(){const ins=$('d-cod').value===INSS;$('l-dlocal').hidden=ins;$('l-dcomp').hidden=!ins}
$('d-cod').onchange=despForm;
const despMes=()=>S.desp.filter(d=>d.data.startsWith($('d-mes').value)).sort((a,b)=>a.data.localeCompare(b.data));
function despTela(){
  const ds=despMes();
  $('l-desp').innerHTML=ds.length?ds.map(d=>{const l=d.local_id&&localDe(d.local_id);return `<div class="item"><div><b>${esc(nomeCod(d.codigo))}</b><div class="meta">${dBR(d.data)}${d.competencia?' · competência '+d.competencia:''}${l?' · '+esc(l.nome):''}${d.valor_pago&&d.valor_pago!==d.valor?' · conta de '+brl(d.valor_pago):''}${d.obs?' · '+esc(d.obs):''}</div></div>
    <div style="text-align:right"><div class="num">${brl(d.valor)}</div>${d.lote_id?'<span class="pill">importada</span>':`<button class="small" data-ddesp="${d.id}" type="button">Excluir</button>`}</div></div>`}).join('')
    +`<div class="item"><b>Total</b><b class="num">${brl(ds.reduce((s,d)=>s+d.valor,0))}</b></div>`
    :'<div class="sub">Nenhuma despesa neste mês.</div>';
  // Dois arquivos, como nos modelos da Receita: livro-caixa (plano de contas padrão) e INSS (pagamentos gerais: multa, juros e competência)
  const nov=ds.filter(d=>!d.lote_id), hist=d=>ascii(nomeCod(d.codigo)+(d.obs?' - '+d.obs:'')).slice(0,255);
  $('d-csv').value=nov.filter(d=>d.codigo!==INSS).map(d=>[dBR(d.data),d.codigo,vcsv(d.valor),hist(d)].join(';')).join('\r\n');
  $('d-csv2').value=nov.filter(d=>d.codigo===INSS).map(d=>[dBR(d.data),d.codigo,vcsv(d.valor),hist(d),'','',d.competencia||''].join(';')).join('\r\n');
  $('l-csv2').hidden=!$('d-csv2').value;
}
$('f-desp').onsubmit=async e=>{e.preventDefault();
  const v=num($('d-valor').value), cod=$('d-cod').value, ins=cod===INSS, l=!ins&&localDe($('d-local').value), f=l?TIPOS[l.tipo][1]:1;
  if(!(v>0)){avisa('Valor inválido. Use, por exemplo, 800,00.',true);return}
  if(IMOVEL.includes(cod)&&!l){avisa('Escolha de qual local é essa conta: na casa só abate 20%.',true);return}
  const comp=ins?($('d-comp').value||'').split('-').reverse().join('/')||null:null;
  const r=await sb.from('despesas').insert({profissional_id:S.prof.id,codigo:cod,data:$('d-data').value,valor:Math.round(v*f*100)/100,valor_pago:v,
    local_id:l?l.id:null,competencia:comp,obs:$('d-obs').value.trim()}).select().single();
  if(falhou(r,'salvar a despesa'))return;
  S.desp.push({...r.data,valor:+r.data.valor,valor_pago:+r.data.valor_pago});$('d-valor').value='';$('d-obs').value='';$('d-mes').value=$('d-data').value.slice(0,7);despTela();avisa('Despesa salva.');};
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

// ---------- Fechamento: o cálculo do Carnê-Leão está em regras.js ----------
const MESES=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function descRecibo(base,datas){
  const dias=[...new Set(datas.map(d=>d.slice(8)))].sort();
  const lista=dias.length>1?dias.slice(0,-1).join(', ')+' e '+dias.at(-1):dias[0];
  const [a,m]=datas[0].split('-'), nm=MESES[+m-1];
  return `${base||'Servicos de Fisioterapia'} ${dias.length>1?'nos dias':'no dia'} ${lista} de ${nm[0].toUpperCase()+nm.slice(1)} de ${a}.`;
}
function fech(){
  const mes=$('f-mes').value, ano=mes.slice(0,4);
  const tot=S.at.filter(a=>a.data.startsWith(mes)).reduce((s,a)=>s+a.valor,0);
  const tano=S.at.filter(a=>a.data.startsWith(ano)).reduce((s,a)=>s+a.valor,0);
  $('f-total').textContent=brl(tot);
  const ap=apura(S.at,S.desp,mes), cl=ap.cl;
  const [aa,mm]=mes.split('-').map(Number), venc=new Date(aa,mm+1,0); while([0,6].includes(venc.getDay()))venc.setDate(venc.getDate()-1);
  $('f-calc').innerHTML=[['Recebido no mês',brl(tot)],['Livro-caixa lançado no mês',brl(ap.lc)],...(ap.anterior>0?[['Sobra de meses anteriores',brl(ap.anterior)]]:[]),['Livro-caixa usado (até o recebido)',brl(ap.usado)],
    ...(ap.inss>0?[['INSS pago no mês',brl(ap.inss)]]:[]),[cl.usaSimpl?'Desconto simplificado (maior que as deduções)':'Total de deduções',brl(cl.deducao)],
    ...(ap.sobra>0?[['Sobra que passa para o mês seguinte',brl(ap.sobra)]]:[]),
    ['Base de cálculo',brl(cl.base)],['Imposto pela tabela',brl(cl.bruto)],['Redução de 2026',brl(cl.red)],
    ['<b>Carnê-Leão a pagar</b>',`<b>${brl(cl.devido)}</b>`],['Vencimento',cl.devido>0?venc.toLocaleDateString('pt-BR'):'nada a pagar']]
    .map(([a,b])=>`<div class="item"><span>${a}</span><span class="num">${b}</span></div>`).join('')+'<div class="sub">Tabela de 2026 conferida na Receita em 18/10/2026. O valor que vale é o do Carnê-Leão Web.</div>';
  const m=$('f-meter');m.className='meter'+(tot>LIM2?' bad':tot>LIM*0.9?' warn':'');
  m.firstElementChild.style.width=Math.min(100,tot/LIM2*100)+'%';
  $('f-faixa').textContent=tot<=LIM?`Dentro da isenção de 2026: faltam ${brl(LIM-tot)} para ${brl(LIM)}.`
    :tot<=LIM2?`Passou de ${brl(LIM)}: imposto com redução parcial.`:`Acima de ${brl(LIM2)}: imposto sem redução.`;
  $('f-ano').textContent=`No ano ${ano}: ${brl(tano)} recebidos. `+reforma(tano).txt;
  const c=S.prof, rs=recibos(mes), erros=[];
  if(!cpfOk(c.cpf))erros.push('Preencha o CPF da profissional em Ajustes.');
  if(!(c.registro||'').trim())erros.push('Preencha o registro no conselho (CREFITO) em Ajustes.');
  const falta=erros.length; // sem CPF ou registro a Receita recusa o arquivo: não gera
  const antes=S.lotes.filter(l=>l.tipo==='recibos'&&l.mes===mes);
  if(antes.length&&rs.length)erros.push(`Este mês já teve importação em ${new Date(antes[0].criado_em).toLocaleDateString('pt-BR')}. A lista abaixo traz só os atendimentos novos.`);
  const linhas=rs.map(r=>{const p=pacDe(r.pac);
    const desc=ascii(descRecibo(c.descricao,r.datas)).slice(0,255);
    return [dBR(r.data),'R01.001.001',c.ocupacao,vcsv(r.valor),'',desc,'PF',p.cpf_pagador||p.cpf,p.cpf,'','','','','S',so(c.cpf),ascii(c.registro)].join(';');});
  $('f-lista').innerHTML=rs.length?rs.map(r=>`<div class="item"><div><b>${esc(pacDe(r.pac).nome)}</b><div class="meta">${r.datas.map(dBR).join(', ')}</div></div><div class="num">${brl(r.valor)}</div></div>`).join('')
    :'<div class="sub">Todos os recibos deste mês já foram emitidos.</div>';
  $('f-erros').innerHTML=[...new Set(erros)].map(t=>`<div class="msg err">${esc(t)}</div>`).join('');
  $('f-csv').value=falta?'':linhas.join('\r\n');
}
$('f-mes').onchange=fech;$('f-agrupa').onchange=fech;
$('b-copiar').onclick=()=>copia($('f-csv').value,$('f-csv'));
$('b-baixar').onclick=()=>$('f-csv').value&&baixa('recibos-'+$('f-mes').value+'.csv',$('f-csv').value);
$('b-zap').onclick=()=>{const rs=recibos($('f-mes').value);
  copia(`Recibos de ${$('f-mes').value.split('-').reverse().join('/')}:\n`+rs.map(r=>`${pacDe(r.pac).nome}: ${brl(r.valor)} (${r.datas.map(d=>dBR(d).slice(0,5)).join(', ')})`).join('\n')+`\nTotal: ${brl(rs.reduce((s,r)=>s+r.valor,0))}`);};
// Mensagem que vai para a profissional junto com os PDFs: recibos já emitidos no mês, faixa e Carnê-Leão
$('b-devol').onclick=()=>{const mes=$('f-mes').value,[aa,mm]=mes.split('-').map(Number),g={};
  S.at.filter(a=>a.data.startsWith(mes)&&a.lote_id).forEach(a=>{(g[a.paciente_id]=g[a.paciente_id]||[]).push(a)});
  const linhas=Object.entries(g).map(([id,as])=>`• ${pacDe(id).nome}: ${brl(as.reduce((s,a)=>s+a.valor,0))}`);
  if(!linhas.length){avisa('Nenhum recibo emitido neste mês ainda. Marque como emitidos primeiro.',true);return}
  const tot=S.at.filter(a=>a.data.startsWith(mes)).reduce((s,a)=>s+a.valor,0);
  const cl=apura(S.at,S.desp,mes).cl;
  const venc=new Date(aa,mm+1,0);while([0,6].includes(venc.getDay()))venc.setDate(venc.getDate()-1);
  copia(`Olá, ${S.prof.nome.split(' ')[0]}! Seus recibos de ${MESES[mm-1].replace('marco','março')}/${aa} já foram emitidos no Receita Saúde:\n`+linhas.join('\n')
    +`\n\nConfira e encaminhe cada PDF ao paciente.\nTotal do mês: ${brl(tot)}. `
    +(cl.devido>0?`Carnê-Leão a pagar: ${brl(cl.devido)}, vence em ${venc.toLocaleDateString('pt-BR')}. O DARF vai em seguida.`
      :tot<=LIM?`Dentro da isenção: nada de Carnê-Leão este mês.`:`Carnê-Leão zerado pela redução de 2026.`));};
$('b-emitidos').onclick=()=>fechaLote('recibos',$('f-mes').value,recibos($('f-mes').value).flatMap(r=>r.ids));

// ---------- Ajustes ----------
function cfgTela(){const c=S.prof;$('c-nome').value=c.nome;$('c-cpf').value=fmtCpf(c.cpf);$('c-ocup').value=c.ocupacao;$('c-reg').value=c.registro;$('c-desc').value=c.descricao;}
$('f-cfg').onsubmit=async e=>{e.preventDefault();const cpf=so($('c-cpf').value);
  if(cpf&&!cpfOk(cpf)){avisa('CPF da profissional inválido.',true);return}
  const novo={nome:$('c-nome').value.trim(),cpf,ocupacao:$('c-ocup').value,registro:$('c-reg').value.trim(),descricao:$('c-desc').value.trim()||'Servicos de Fisioterapia'};
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

// ---------- Link da profissional ----------
const urlLink=tok=>new URL('lancar.html#'+tok,location.href).href;
async function linkTela(){
  const r=await sb.from('links').select('token').eq('profissional_id',S.prof.id).eq('ativo',true).limit(1);
  $('lk-url').value=r.data&&r.data[0]?urlLink(r.data[0].token):'';
}
$('b-link').onclick=async()=>{const r=await sb.rpc('gerar_link',{prof:S.prof.id});
  if(falhou(r,'gerar o link'))return;$('lk-url').value=urlLink(r.data);avisa('Link novo gerado. O anterior parou de funcionar.');};
$('b-link-copiar').onclick=()=>$('lk-url').value&&copia($('lk-url').value,$('lk-url'));
$('b-link-zap').onclick=()=>{if(!$('lk-url').value)return;
  location.href='https://wa.me/?text='+encodeURIComponent(`Olá! Este é o seu link do Recibo Saúde. Salve esta mensagem. Depois de cada atendimento, abra o link e lance paciente e valor. No fim, toque em "Enviar para a Assessoria pelo WhatsApp" que nós emitimos os recibos:\n${$('lk-url').value}`);};

// ---------- Início ----------
const h=hojeISO();$('a-data').value=h;$('a-mes').value=h.slice(0,7);$('f-mes').value=h.slice(0,7);$('d-data').value=h;$('d-mes').value=h.slice(0,7);{const d=new Date(h+'T12:00');d.setMonth(d.getMonth()-1);$('d-comp').value=d.toISOString().slice(0,7)}
sb.auth.getSession().then(({data})=>{if(data.session)entrar();else $('t-login').hidden=false;});
sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_IN'&&!S.prof)entrar();});
