// Painel da Lado a Lado Saúde (equipe e contadores): os dados ficam no Supabase, protegidos por RLS (ver supabase/001_esquema.sql).
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
const telOk=t=>/^\d{10,11}$/.test(so(t).replace(/^55(?=\d{10,11}$)/,''));
const telLimpo=t=>so(t).replace(/^55(?=\d{10,11}$)/,'');
const fmtTel=t=>{t=so(t);return t.length===11?t.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'):t.replace(/(\d{2})(\d{4})(\d{4})/,'($1) $2-$3')};
const mailOk=m=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m);
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
  const r=await sb.auth.signInWithOtp({email:$('l-email').value.trim(),options:{emailRedirectTo:location.origin+location.pathname}});
  $('l-msg').textContent=r.error?'Não foi possível enviar: '+r.error.message:'Link enviado. Abra seu e-mail neste aparelho e toque no link.';};
$('b-sair').onclick=$('mfa-sair').onclick=async()=>{await sb.auth.signOut();location.reload();};

let entrando=false, EQUIPE=false, ADMIN=false;
async function entrar(again){
  if(entrando&&!again)return; entrando=true;
  // 2º fator ligado: a sessão só abre os dados depois do código (o banco também cobra, supabase/011)
  const aal=await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  if(aal.data&&aal.data.nextLevel==='aal2'&&aal.data.currentLevel!=='aal2'){$('t-login').hidden=true;$('t-mfa').hidden=false;$('mfa-cod').focus();entrando=false;return}
  $('t-mfa').hidden=true;
  const [ac,eq,ad]=await Promise.all([sb.from('acessos').select('papel, profissionais(*)'),sb.rpc('e_equipe'),sb.rpc('e_admin')]);
  if(falhou(ac,'abrir seus dados'))return;
  EQUIPE=eq.data===true;ADMIN=ad.data===true;
  PROFS=ac.data.map(x=>({...x.profissionais,papel:x.papel}));
  // O painel é da equipe e dos contadores. A profissional usa o app dela; cadastro novo só por entrar.html (auditoria S2)
  if(!EQUIPE&&!PROFS.some(p=>p.papel==='assessor')){location.replace(PROFS.length?'lancar.html':'entrar.html');return}
  $('nav-adm').hidden=!EQUIPE;document.querySelectorAll('.adm-so').forEach(c=>c.hidden=!ADMIN);mfaTela();
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
  if(b.dataset.t==='t-fech')S.prof?abrir(S.prof.id):fech();
  if(b.dataset.t==='t-adm'){cobsCarrega().then(admTela);pedTela()}}); // recarrega: a profissional pode ter lançado pelo link
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
    <div style="text-align:right"><div class="num">${brl(a.valor)}</div><span class="pill ${a.lote_id?'':'pend'}">${a.lote_id?(loteDe(a)?.confirmado_em?'recibo confirmado':'arquivo gerado'):a.pago===false?'a receber':'falta recibo'}</span></div>
    <div style="grid-column:1/-1" class="btns">${a.lote_id?`<button class="small" data-reab="${a.id}" type="button">Desmarcar emitido</button>`:`<button class="small" data-del="${a.id}" type="button">Excluir</button>`}</div></div>`).join('')
    :'<div class="sub">Nenhum atendimento neste mês. Registre o primeiro acima.</div>';
  $('l-pac').innerHTML=pacs.length?pacs.map(p=>`<div class="item"><div><b>${esc(p.nome)}</b>
    <div class="meta mono">${fmtCpf(p.cpf)}${p.cpf_pagador?' · paga: '+fmtCpf(p.cpf_pagador):''}</div>
    <div class="meta">${[p.telefone&&fmtTel(p.telefone),p.email&&esc(p.email)].filter(Boolean).join(' · ')||'sem WhatsApp nem e-mail'}</div></div>
    <div class="btns"><button class="small" data-cpac="${p.id}" type="button">Contato</button><button class="small" data-dpac="${p.id}" type="button">Excluir</button></div></div>`).join('')
    :'<div class="sub">Cadastre o primeiro paciente acima.</div>';
}
document.addEventListener('click',async e=>{
  const t=e.target.dataset; if(!t)return;
  if(t.del){if(falhou(await sb.from('atendimentos').delete().eq('id',t.del),'excluir'))return;
    S.at=S.at.filter(a=>a.id!==t.del);render();}
  if(t.reab){const l=S.lotes.find(x=>x.id===S.at.find(a=>a.id===t.reab).lote_id), dias=l?Math.floor((Date.now()-new Date(l.criado_em))/864e5):0;
    // Auditoria F4: a Receita só cancela recibo em até 10 dias; reabrir e gerar o arquivo de novo emite em dobro
    if(!confirm(`Antes de desmarcar, cancele o recibo no Carnê-Leão Web ("Desfazer escrituração"). A Receita só cancela em até 10 dias da emissão`
      +(l?`; este foi emitido há ${dias} dia(s)${dias>10?' e já passou do prazo: se gerar o arquivo de novo, o recibo sai em dobro':''}`:'')+`.\n\nJá cancelou na Receita e quer desmarcar?`))return;
    if(falhou(await sb.from('atendimentos').update({lote_id:null}).eq('id',t.reab),'desmarcar'))return;
    S.at.find(a=>a.id===t.reab).lote_id=null;render();}
  if(t.dpac){if(S.at.some(a=>a.paciente_id===t.dpac&&!a.lote_id)){avisa('Esse paciente tem atendimento sem recibo. Emita ou exclua antes.',true);return}
    // guarda o histórico: o paciente sai da lista, os recibos antigos continuam
    if(falhou(await sb.from('pacientes').update({ativo:false}).eq('id',t.dpac),'excluir o paciente'))return;
    S.pac=S.pac.filter(p=>p.id!==t.dpac);render();}
  if(t.cpac){const p=S.pac.find(x=>x.id===t.cpac);
    const tel=prompt(`WhatsApp de ${p.nome} com DDD (deixe vazio para apagar):`,p.telefone?fmtTel(p.telefone):'');if(tel===null)return;
    if(tel.trim()&&!telOk(tel)){avisa('WhatsApp inválido. Use o DDD e o número, ex.: 27 99999-9999.',true);return}
    const em=prompt(`E-mail de ${p.nome} (deixe vazio para apagar):`,p.email||'');if(em===null)return;
    if(em.trim()&&!mailOk(em.trim())){avisa('E-mail inválido.',true);return}
    const novo={telefone:tel.trim()?telLimpo(tel):null,email:em.trim()||null};
    if(falhou(await sb.from('pacientes').update(novo).eq('id',p.id),'salvar o contato'))return;
    Object.assign(p,novo);render();fech();avisa('Contato salvo.');}
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
  const cpf=so($('p-cpf').value),pag=so($('p-pag').value),tel=$('p-tel').value.trim(),em=$('p-email').value.trim();
  if(!cpfOk(cpf)){avisa('CPF do paciente inválido. Confira os números.',true);return}
  if(pag&&!cpfOk(pag)){avisa('CPF de quem paga inválido.',true);return}
  if(tel&&!telOk(tel)){avisa('WhatsApp inválido. Use o DDD e o número, ex.: 27 99999-9999.',true);return}
  if(em&&!mailOk(em)){avisa('E-mail do paciente inválido.',true);return}
  const r=await sb.from('pacientes').insert({profissional_id:S.prof.id,nome:$('p-nome').value.trim(),cpf,cpf_pagador:pag&&pag!==cpf?pag:null,
    telefone:tel?telLimpo(tel):null,email:em||null}).select().single();
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
// Regime de caixa (pontos do Daniel, 23/10): só o que já foi pago entra no recibo e no Carnê-Leão
const pagos=()=>S.at.filter(a=>a.pago!==false);
function recibos(mes){
  const pend=pagos().filter(a=>a.data.startsWith(mes)&&!a.lote_id).sort((a,b)=>a.data.localeCompare(b.data));
  // Auditoria F1 (IN 2.240, art. 3º): cada pagamento tem o seu recibo. Juntar só quando o paciente pagou as sessões de uma vez.
  if(!$('f-agrupa').checked)return pend.map(a=>({pac:a.paciente_id,data:a.data,valor:a.valor,datas:[a.data],ids:[a.id]}));
  const g={};pend.forEach(a=>{const r=g[a.paciente_id]||(g[a.paciente_id]={pac:a.paciente_id,data:a.data,valor:0,datas:[],ids:[]});
    r.valor+=a.valor;r.datas.push(a.data);r.ids.push(a.id);if(a.data>r.data)r.data=a.data});
  return Object.values(g);
}
const MESES=['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function descRecibo(base,datas){
  const dias=[...new Set(datas.map(d=>d.slice(8)))].sort();
  const lista=dias.length>1?dias.slice(0,-1).join(', ')+' e '+dias.at(-1):dias[0];
  const [a,m]=datas[0].split('-'), nm=MESES[+m-1];
  return `${base||'Servicos de Fisioterapia'} ${dias.length>1?'nos dias':'no dia'} ${lista} de ${nm[0].toUpperCase()+nm.slice(1)} de ${a}.`;
}
function fech(){
  const mes=$('f-mes').value, ano=mes.slice(0,4);
  const tot=pagos().filter(a=>a.data.startsWith(mes)).reduce((s,a)=>s+a.valor,0);
  const tano=pagos().filter(a=>a.data.startsWith(ano)).reduce((s,a)=>s+a.valor,0);
  $('f-total').textContent=brl(tot);
  const ap=apura(pagos(),S.desp,mes), cl=ap.cl;
  const [aa,mm]=mes.split('-').map(Number), venc=ultimoDiaUtil(aa,mm), dv=ap.darf;
  $('f-calc').innerHTML=[['Recebido no mês',brl(tot)],['Livro-caixa lançado no mês',brl(ap.lc)],...(ap.anterior>0?[['Sobra de meses anteriores',brl(ap.anterior)]]:[]),['Livro-caixa usado (até o recebido)',brl(ap.usado)],
    ...(ap.inss>0?[['INSS pago no mês',brl(ap.inss)]]:[]),[cl.usaSimpl?'Desconto simplificado (maior que as deduções)':'Total de deduções',brl(cl.deducao)],
    ...(ap.sobra>0?[['Sobra que passa para o mês seguinte',brl(ap.sobra)]]:[]),
    ['Base de cálculo',brl(cl.base)],['Imposto pela tabela',brl(cl.bruto)],['Redução de 2026',brl(cl.red)],
    ['Carnê-Leão do mês',brl(cl.devido)],...(dv.vem>0?[['Somado de meses anteriores (DARF abaixo de R$ 10)',brl(dv.vem)]]:[]),
    ['<b>Carnê-Leão a pagar</b>',`<b>${brl(dv.pagar)}</b>`],['Vencimento',dv.pagar>0?venc.toLocaleDateString('pt-BR'):dv.adia?`abaixo de R$ 10: ${brl(dv.total)} passam para o mês seguinte`:'nada a pagar']]
    .map(([a,b])=>`<div class="item"><span>${a}</span><span class="num">${b}</span></div>`).join('')+'<div class="sub">Tabela de 2026 conferida na Receita em 18/10/2026. O valor que vale é o do Carnê-Leão Web.</div>';
  const m=$('f-meter');m.className='meter'+(tot>LIM2?' bad':tot>LIM*0.9?' warn':'');
  m.firstElementChild.style.width=Math.min(100,tot/LIM2*100)+'%';
  $('f-faixa').textContent=tot<=LIM?`Dentro da isenção de 2026: faltam ${brl(LIM-tot)} para ${brl(LIM)}.`
    :tot<=LIM2?`Passou de ${brl(LIM)}: imposto com redução parcial.`:`Acima de ${brl(LIM2)}: imposto sem redução.`;
  $('f-ano').textContent=`No ano ${ano}: ${brl(tano)} recebidos. `+reforma(tano,ano).txt;
  const cj=cnpjAviso(pagos(),S.desp,mes);$('f-cnpj').hidden=!cj;if(cj)$('f-cnpj').textContent=(cj.mostra?'Vale conversar sobre CNPJ. ':`CNPJ ainda não compensa (diferença de ${brl(cj.eco)} por mês). `)+cj.txt;
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
  envioTela(mes);loteTela(mes);
}
// Envio do recibo ao paciente (ponto 3 do Daniel): por enquanto abre o WhatsApp ou o e-mail com o texto pronto
function msgPaciente(p,mes,valor){const [aa,mm]=mes.split('-').map(Number);
  return `Olá, ${p.nome.split(' ')[0]}! Segue o recibo de ${MESES[mm-1].replace('marco','março')}/${aa}, no valor de ${brl(valor)}, emitido no Receita Saúde. `
    +`Ele também aparece no app Receita Saúde (gov.br) e já vai para a sua declaração de IR. ${S.prof.nome}`}
function envioTela(mes){const g={};
  S.at.filter(a=>a.data.startsWith(mes)&&a.lote_id).forEach(a=>{g[a.paciente_id]=(g[a.paciente_id]||0)+a.valor});
  const ids=Object.keys(g);
  $('f-envio').innerHTML=ids.length?ids.map(id=>{const p=pacDe(id),t=msgPaciente(p,mes,g[id]);
    const zap=p.telefone?`<a class="small btn" target="_blank" rel="noopener" href="https://wa.me/55${p.telefone}?text=${encodeURIComponent(t)}">WhatsApp</a>`:'';
    const mail=p.email?`<a class="small btn" href="mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent('Recibo '+mes.split('-').reverse().join('/'))}&body=${encodeURIComponent(t)}">E-mail</a>`:'';
    return `<div class="item"><div><b>${esc(p.nome)}</b><div class="meta">${brl(g[id])}${zap||mail?'':' · sem contato: cadastre em Pacientes'}</div></div><div class="btns">${zap}${mail}</div></div>`}).join('')
    :'<div class="sub">Nenhum recibo emitido neste mês ainda.</div>';
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
  const tot=pagos().filter(a=>a.data.startsWith(mes)).reduce((s,a)=>s+a.valor,0);
  const dv=apura(pagos(),S.desp,mes).darf, venc=ultimoDiaUtil(aa,mm);
  copia(`Olá, ${S.prof.nome.split(' ')[0]}! Seus recibos de ${MESES[mm-1].replace('marco','março')}/${aa} já foram emitidos no Receita Saúde:\n`+linhas.join('\n')
    +`\n\nConfira e encaminhe cada PDF ao paciente.\nTotal do mês: ${brl(tot)}. `
    +(dv.pagar>0?`Carnê-Leão a pagar: ${brl(dv.pagar)}, vence em ${venc.toLocaleDateString('pt-BR')}. O DARF vai em seguida.`
      :dv.adia?`Carnê-Leão de ${brl(dv.total)}: abaixo de R$ 10 a Receita não gera DARF, o valor soma ao do mês seguinte.`
      :tot<=LIM?`Dentro da isenção: nada de Carnê-Leão este mês.`:`Carnê-Leão zerado pela redução de 2026.`));};
// F5 (supabase/015): o lote só vira "confirmado" com a lista de recibos gerados que a Receita mostra depois de importar
const loteDe=a=>a.lote_id&&S.lotes.find(l=>l.id===a.lote_id);
function loteTela(mes){const ls=S.lotes.filter(l=>l.tipo==='recibos'&&l.mes===mes);
  $('f-lotes').innerHTML=ls.length?ls.map(l=>`<div class="item"><span>${new Date(l.criado_em).toLocaleDateString('pt-BR')} · ${l.linhas} recibo(s)</span>
    <span class="pill ${l.confirmado_em?'':'pend'}">${l.confirmado_em?'confirmado pela Receita em '+new Date(l.confirmado_em).toLocaleDateString('pt-BR'):'arquivo gerado, falta confirmar'}</span></div>`).join('')
    :'<div class="sub">Nenhum arquivo gerado neste mês.</div>';}
const numerosRecibo=t=>[...new Set(String(t).match(/\b\d{3}\.\d{3}\.\d{2}\.\d{5}\b/g)||[])];
$('b-confirmar').onclick=async()=>{const mes=$('f-mes').value, ns=numerosRecibo($('f-receita').value);
  const l=S.lotes.filter(x=>x.tipo==='recibos'&&x.mes===mes&&!x.confirmado_em).sort((a,b)=>a.criado_em.localeCompare(b.criado_em))[0];
  if(!l){avisa('Não há arquivo deste mês esperando confirmação.',true);return}
  if(!ns.length){avisa('Não achei números de recibo no texto colado (formato 084.009.26.00033).',true);return}
  if(ns.length!==l.linhas&&!confirm(`A lista da Receita tem ${ns.length} recibo(s), mas o arquivo tinha ${l.linhas}. Confira no Carnê-Leão antes. Confirmar mesmo assim?`))return;
  const r=await sb.from('lotes').update({confirmado_em:new Date().toISOString(),recibos:ns}).eq('id',l.id).select().single();
  if(falhou(r,'confirmar os recibos'))return;
  Object.assign(l,r.data);$('f-receita').value='';render();loteTela(mes);avisa(`${ns.length} recibo(s) confirmado(s) pela Receita.`);};
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

// ---------- 2º fator (auditoria S5): aplicativo autenticador, TOTP do Supabase ----------
$('t-mfa').onsubmit=async e=>{e.preventDefault();
  const f=await sb.auth.mfa.listFactors(), x=f.data&&f.data.totp[0];
  if(!x){avisa('Nenhum 2º fator ligado nesta conta.',true);return}
  const r=await sb.auth.mfa.challengeAndVerify({factorId:x.id,code:so($('mfa-cod').value)});
  if(r.error){avisa('Código errado ou vencido. Confira a hora do celular e digite o código novo.',true);return}
  $('mfa-cod').value='';entrar(true);};
let novoFator=null;
async function mfaTela(){
  const f=await sb.auth.mfa.listFactors();if(f.error)return;
  const ligado=f.data.totp.length>0; // a lista totp só traz os confirmados
  $('mfa-sit').textContent=ligado?'Ligado: o painel pede o código do aplicativo autenticador a cada entrada.'
    :'Desligado. Com ele, quem descobrir a senha do seu e-mail não entra no painel. Obrigatório para a equipe.';
  $('mfa-ligar').hidden=ligado;$('mfa-desligar').hidden=!ligado;$('mfa-novo').hidden=true;$('adm-mfa').hidden=!(EQUIPE&&!ligado);
}
$('mfa-ligar').onclick=async()=>{
  const f=await sb.auth.mfa.listFactors(); // cadastro que ficou pela metade impede um novo
  for(const x of (f.data&&f.data.all||[]).filter(x=>x.status!=='verified'))await sb.auth.mfa.unenroll({factorId:x.id});
  const r=await sb.auth.mfa.enroll({factorType:'totp',friendlyName:'Lado a Lado Saúde'});
  if(falhou(r,'começar o 2º fator'))return;
  novoFator=r.data.id;$('mfa-qr').src=r.data.totp.qr_code;$('mfa-chave').value=r.data.totp.secret;$('mfa-novo').hidden=false;$('mfa-ligar').hidden=true;};
$('mfa-confirma').onclick=async()=>{
  const r=await sb.auth.mfa.challengeAndVerify({factorId:novoFator,code:so($('mfa-cod2').value)});
  if(r.error){avisa('Código errado. Confira a hora do celular e digite o código novo.',true);return}
  $('mfa-cod2').value='';novoFator=null;mfaTela();avisa('2º fator ligado. Sem o celular com o aplicativo, só o suporte técnico destrava a entrada.');};
$('mfa-desligar').onclick=async()=>{if(!confirm('Desligar o 2º fator? O painel volta a abrir só com o link do e-mail.'))return;
  const f=await sb.auth.mfa.listFactors(), x=f.data&&f.data.totp[0];if(!x)return;
  if(falhou(await sb.auth.mfa.unenroll({factorId:x.id}),'desligar o 2º fator'))return;await sb.auth.refreshSession();mfaTela();avisa('2º fator desligado.');};

// ---------- Administração (supabase/010): situação das contas, conselho, convites e carteira do contador ----------
const SIT={teste:'em teste',ativa:'ativa',leitura:'só leitura',cancelada:'cancelada'};
const OCUP={'231':'Fisioterapeuta','255':'Psicólogo(a)','230':'Fonoaudiólogo(a)','232':'Terapeuta ocupacional','226':'Dentista','225':'Médico(a)'};
// Cobranças (supabase/013): a última de cada profissional; teste vencido com cobrança aberta há até 10 dias segue em teste
let COBS={};
async function cobsCarrega(){const r=await sb.from('cobrancas').select('profissional_id,valor,vencimento,status,link').neq('status','cancelada').order('vencimento');
  if(!r.error){COBS={};r.data.forEach(c=>COBS[c.profissional_id]=c)}}
const cobAberta=p=>{const c=COBS[p.id],d=new Date(Date.now()-10*864e5).toISOString().slice(0,10);return c&&['pendente','vencida'].includes(c.status)&&c.vencimento>=d};
const sitEf=p=>p.situacao==='teste'&&p.teste_ate&&p.teste_ate<hojeISO()&&!cobAberta(p)?'leitura':p.situacao||'ativa'; // igual a situacao_efetiva do banco
const PLANO={'':'sem plano',essencial:'Essencial',completo:'Completo',contador:'Com contador',empresa:'Empresa'};
const profsUnicos=()=>[...new Map(PROFS.map(p=>[p.id,p])).values()];
function admTela(){
  const em7=new Date(Date.now()+7*864e5).toISOString().slice(0,10), todos=profsUnicos();
  const F={conferir:p=>!p.conselho_ok&&sitEf(p)!=='cancelada',procuracao:p=>p.procuracao!=='conferida'&&p.plano!=='essencial'&&sitEf(p)!=='cancelada',teste:p=>sitEf(p)==='teste',vence:p=>sitEf(p)==='teste'&&p.teste_ate<=em7,
    ativa:p=>sitEf(p)==='ativa',leitura:p=>sitEf(p)==='leitura',cancelada:p=>sitEf(p)==='cancelada'};
  $('adm-kpi').innerHTML=[['Em teste','teste'],['Ativas','ativa'],['Conselho a conferir','conferir']]
    .map(([n,k])=>`<div class="kpi"><span class="sub">${n}</span><b>${todos.filter(F[k]).length}</b></div>`).join('');
  const ps=todos.filter(F[$('adm-filtro').value]||(()=>true)).sort((a,b)=>(b.criado_em||'').localeCompare(a.criado_em||''));
  const op=(o,v)=>Object.entries(o).map(([k,n])=>`<option value="${k}"${k===v?' selected':''}>${n}</option>`).join('');
  $('adm-lista').innerHTML=ps.length?ps.map(p=>{const s=sitEf(p), zap=p.telefone?`https://wa.me/55${p.telefone}?text=${encodeURIComponent(`Olá, ${(p.nome||'').split(' ')[0]}! Aqui é da Assessoria Lado a Lado, da Lado a Lado Saúde.`)}`:'';
    return `<div class="item"><div><b>${esc(p.nome||'(sem nome)')}</b><div class="meta">${esc(OCUP[p.ocupacao]||'')}${p.registro?' · '+esc(p.registro):''}${p.cidade?' · '+esc(p.cidade):''}</div>
      <div class="meta">${[p.email&&esc(p.email),p.telefone&&fmtTel(p.telefone)].filter(Boolean).join(' · ')||'sem contato'}</div>
      ${p.plano_pedido||COBS[p.id]||p.fundadora?`<div class="meta">${[p.plano_pedido&&`pediu ${PLANO[p.plano_pedido]} (${p.ciclo||'mensal'})`,p.fundadora&&'fundadora −30%',
        COBS[p.id]&&`cobrança ${brl(+COBS[p.id].valor)} · vence ${dBR(COBS[p.id].vencimento).slice(0,5)} · ${COBS[p.id].status}`].filter(Boolean).join(' · ')}</div>`:''}</div>
      ${p.pretende_cnpj||p.aceita_novidades?`<div class="meta">${[p.pretende_cnpj&&`CNPJ em 2027: ${{sim:'pretende',talvez:'talvez',nao:'não pretende'}[p.pretende_cnpj]}`,p.aceita_novidades&&'aceita novidades no zap'].filter(Boolean).join(' · ')}</div>`:''}</div>
      <div style="text-align:right"><span class="pill ${s==='ativa'?'':'pend'}">${SIT[s]}${s==='teste'&&p.teste_ate?' até '+dBR(p.teste_ate).slice(0,5):''}</span><div class="meta">${p.conselho_ok?'conselho conferido':'conselho a conferir'}</div><div class="meta">${PROC[p.procuracao||'pendente']}</div></div>
      <div style="grid-column:1/-1" class="btns">${zap?`<a class="btn" target="_blank" rel="noopener" href="${zap}">WhatsApp</a>`
          :`<input data-fone-in="${p.id}" inputmode="tel" placeholder="WhatsApp com DDD" style="width:auto;max-width:170px;padding:6px 8px"><button class="small" data-fone="${p.id}" type="button">Salvar WhatsApp</button>`}
        <button class="small" data-conselho="${p.id}" type="button">${p.conselho_ok?'Desfazer conferência':'Conselho conferido'}</button>
        <select data-sit="${p.id}" style="width:auto;padding:6px 8px" aria-label="Situação">${op(SIT,p.situacao||'ativa')}</select>
        <select data-plano="${p.id}" style="width:auto;padding:6px 8px" aria-label="Plano">${op(PLANO,p.plano||'')}</select>
        <button class="small" data-proc="${p.id}" type="button">${p.procuracao==='conferida'?'Desfazer procuração':'Procuração conferida'}</button>
        <button class="small" data-pin="${p.id}" type="button">Zerar PIN</button>
        <button class="small" data-fundadora="${p.id}" type="button">${p.fundadora?'Tirar fundadora':'Fundadora −30%'}</button>
        ${s==='teste'||s==='leitura'?`<button class="small" data-mais30="${p.id}" type="button">+30 dias de teste</button>`:''}</div></div>`}).join('')
    :'<div class="sub">Nenhuma profissional neste filtro.</div>';
  $('ct-prof').innerHTML=todos.map(p=>`<option value="${p.id}">${esc(p.nome||'(sem nome)')}</option>`).join('');
}
$('adm-filtro').onchange=admTela;
// Pedidos (supabase/016): quero conversar sobre CNPJ e aviso de procuração feita
const PROC={pendente:'procuração pendente',enviada:'procuração a conferir',conferida:'procuração conferida'};
const PSIT={novo:'novo',conversando:'conversando',feito:'feito',desistiu:'desistiu'},PTIPO={cnpj:'Quero conversar: CNPJ',procuracao:'Fiz a procuração',suporte:'Suporte (responder em 1 dia útil)'};
async function pedTela(){const f=$('adm-ped-filtro').value;let q=sb.from('pedidos').select('*').order('criado_em',{ascending:false}).limit(100);
  if(f==='aberto')q=q.in('situacao',['novo','conversando']);const r=await q;if(r.error){$('adm-ped-card').hidden=true;return}
  const nome=id=>(PROFS.find(p=>p.id===id)||{}).nome||'(profissional)',op=v=>Object.entries(PSIT).map(([k,n])=>`<option value="${k}"${k===v?' selected':''}>${n}</option>`).join('');
  $('adm-ped').innerHTML=r.data.length?r.data.map(x=>`<div class="item"><div><b>${esc(nome(x.profissional_id))}</b><div class="meta">${PTIPO[x.tipo]} · pelo ${x.origem} · ${new Date(x.criado_em).toLocaleDateString('pt-BR')}</div>
      ${x.obs&&x.tipo==='suporte'?`<div class="meta" style="white-space:pre-wrap">${esc(x.obs)}</div>`:''}
      ${x.media?`<div class="meta">média ${brl(+x.media)}/mês · economia estimada ${brl(+x.economia||0)}/mês</div>`:''}</div>
      <div><select data-ped="${x.id}" style="width:auto;padding:6px 8px" aria-label="Situação do pedido">${op(x.situacao)}</select></div></div>`).join('')
    :'<div class="sub">Nenhum pedido aberto.</div>'}
$('adm-ped-filtro').onchange=pedTela;
async function admMuda(id,novo,msg){
  if(falhou(await sb.from('profissionais').update(novo).eq('id',id),'mudar a conta'))return;
  PROFS.filter(p=>p.id===id).forEach(p=>Object.assign(p,novo));admTela();avisa(msg);}
document.addEventListener('click',e=>{const t=e.target.dataset||{};
  if(t.fundadora){const p=PROFS.find(x=>x.id===t.fundadora);admMuda(p.id,{fundadora:!p.fundadora},p.fundadora?'Desconto de fundadora retirado.':'Fundadora: 30% de desconto na próxima assinatura.')}
  if(t.proc){const p=PROFS.find(x=>x.id===t.proc),conf=p.procuracao!=='conferida';
    admMuda(p.id,{procuracao:conf?'conferida':'pendente'},conf?'Procuração conferida: já dá para emitir por ela.':'Procuração voltou para pendente.');
    if(conf)sb.from('pedidos').update({situacao:'feito',atualizado:new Date().toISOString()}).eq('profissional_id',p.id).eq('tipo','procuracao').in('situacao',['novo','conversando']).then(pedTela)}
  if(t.conselho){const p=PROFS.find(x=>x.id===t.conselho);admMuda(p.id,{conselho_ok:!p.conselho_ok},p.conselho_ok?'Conferência desfeita.':'Conselho marcado como conferido.')}
  if(t.fone){const f=so(document.querySelector(`[data-fone-in="${t.fone}"]`).value).replace(/^55(?=\d{10,11}$)/,'');
    if(!/^\d{10,11}$/.test(f)){avisa('WhatsApp com DDD, ex.: 27 99999-9999.',true);return}
    sb.rpc('prof_whatsapp',{p_prof:t.fone,p_fone:f}).then(r=>{if(falhou(r,'salvar o WhatsApp'))return;
      PROFS.filter(p=>p.id===t.fone).forEach(p=>p.telefone=f);admTela();avisa('WhatsApp salvo: o zap já reconhece este número.')})}
  if(t.pin&&confirm('Zerar o PIN desta profissional? Os aparelhos dela saem e ela cria outro PIN pelo link.'))
    sb.rpc('pin_zerar',{p_prof:t.pin}).then(r=>{if(!falhou(r,'zerar o PIN'))avisa('PIN zerado: no próximo acesso pelo link ela cria outro.')});
  if(t.mais30){const d=new Date(Math.max(Date.now(),new Date(PROFS.find(x=>x.id===t.mais30).teste_ate+'T12:00')));d.setDate(d.getDate()+30);
    admMuda(t.mais30,{situacao:'teste',teste_ate:d.toISOString().slice(0,10)},`Teste até ${d.toLocaleDateString('pt-BR')}.`)}});
document.addEventListener('change',e=>{const t=e.target.dataset||{};
  if(t.sit)admMuda(t.sit,{situacao:e.target.value},`Situação: ${SIT[e.target.value]}.`);
  if(t.plano!==undefined)admMuda(t.plano,{plano:e.target.value||null},'Plano salvo.');
  if(t.ped)sb.from('pedidos').update({situacao:e.target.value,atualizado:new Date().toISOString()}).eq('id',t.ped).then(r=>{if(!falhou(r,'mudar o pedido')){avisa('Pedido: '+PSIT[e.target.value]+'.');pedTela()}});});
$('b-convidar').onclick=async()=>{const em=$('cv-email').value.trim();if(!mailOk(em)){avisa('E-mail inválido.',true);return}
  const r=await sb.rpc('convidar',{p_email:em,p_papel:$('cv-papel').value});if(falhou(r,'convidar'))return;
  $('cv-email').value='';avisa(r.data.replace(/^./,c=>c.toUpperCase())+'.');};
async function carteira(dar){const em=$('ct-email').value.trim();if(!mailOk(em)){avisa('E-mail do contador inválido.',true);return}
  const r=await sb.rpc('carteira',{p_prof:$('ct-prof').value,p_email:em,p_dar:dar});
  if(r.error){avisa(/nao entrou/.test(r.error.message)?'Esse contador ainda não entrou no painel. Convide e peça para ele entrar uma vez.':'Não consegui mudar a carteira.',true);return}
  avisa(dar?'Profissional posta na carteira do contador.':'Profissional tirada da carteira do contador.');}
$('b-ct-dar').onclick=()=>carteira(true);$('b-ct-tirar').onclick=()=>carteira(false);

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
  location.href='https://wa.me/?text='+encodeURIComponent(`Olá! Este é o seu link da Lado a Lado Saúde. Salve esta mensagem. Depois de cada atendimento, abra o link e lance paciente e valor. No fim, toque em "Enviar para a Assessoria pelo WhatsApp" que nós emitimos os recibos. No primeiro acesso você cria um PIN de 4 números. Não encaminhe este link:\n${$('lk-url').value}`);};

// ---------- Início ----------
const h=hojeISO();$('a-data').value=h;$('a-mes').value=h.slice(0,7);$('f-mes').value=h.slice(0,7);$('d-data').value=h;$('d-mes').value=h.slice(0,7);{const d=new Date(h+'T12:00');d.setMonth(d.getMonth()-1);$('d-comp').value=d.toISOString().slice(0,7)}
sb.auth.getSession().then(({data})=>{if(data.session)entrar();else $('t-login').hidden=false;});
sb.auth.onAuthStateChange((ev)=>{if(ev==='SIGNED_IN'&&!S.prof)entrar();});

// ---------- PDFs pelo WhatsApp (supabase/012 + função zap): sobe na pasta privada recibos/<profissional>/<mês>/ e pede o envio ----------
$('b-pdfs').onclick=async()=>{const fs=[...$('f-pdfs').files],mes=$('f-mes').value,st=$('f-pdfs-st');
  if(!fs.length){avisa('Escolha os PDFs primeiro.',true);return}
  st.textContent=`Guardando ${fs.length} PDF(s)...`;
  for(const f of fs){const nome=f.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w.\-]+/g,'_');
    const r=await sb.storage.from('recibos').upload(`${S.prof.id}/${mes}/${nome}`,f,{upsert:true,contentType:'application/pdf'});
    if(r.error){st.textContent='';falhou(r,'guardar '+f.name);return}}
  const r=await sb.functions.invoke('zap',{body:{acao:'pdfs',prof:S.prof.id,mes}});
  if(r.error||!r.data||r.data.erro){st.textContent='PDFs guardados, mas o envio falhou: '+((r.data&&r.data.erro)||'sem resposta');return}
  st.textContent=r.data.ensaio?`${fs.length} PDF(s) guardados. O WhatsApp oficial ainda não está ligado: quando o número entrar, clique de novo (eles ficam guardados).`
    :r.data.enviados?`Enviados ${r.data.enviados} PDF(s) pelo WhatsApp.`:'Nada enviado: '+r.data.motivo;
  $('f-pdfs').value='';};
