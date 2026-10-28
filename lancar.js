// App da profissional, aberto pelo link do WhatsApp (lancar.html#<código>) e instalável no celular.
// Sem login: tudo passa pelas funções link_* do banco. O código fica guardado no aparelho para o app instalado abrir sozinho.
// Com login (entrar.html, desde 27/10/2026): TOK fica vazio e as mesmas funções resolvem a profissional pela conta logada.
const sb = supabase.createClient(CONFIG.url, CONFIG.chave);
const ZAP = '5527999712727'; // WhatsApp da Assessoria até o produto ir ao mercado (decisão de 17/10/2026)
const guarda={get(){try{return localStorage.getItem('rs_tok')||''}catch(e){return ''}},set(t){try{localStorage.setItem('rs_tok',t)}catch(e){}}};
let TOK = location.hash.slice(1).replace(/^t=/, '') || guarda.get();
const $=id=>document.getElementById(id);
const so=s=>String(s||'').replace(/\D/g,'');
const brl=n=>(+n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dBR=iso=>iso.split('-').reverse().join('/');
const iso=d=>{d=new Date(d);d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const hojeISO=()=>iso(new Date());
const num=v=>parseFloat(String(v).replace(/\./g,'').replace(',','.'));
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function cpfOk(c){c=so(c);if(c.length!==11||/^(\d)\1+$/.test(c))return false;
  for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=+c[i]*(t+1-i);if(((s*10)%11)%10!==+c[t])return false}return true}
const telLimpo=t=>so(t).replace(/^55(?=\d{10,11}$)/,'');
const telOk=t=>/^\d{10,11}$/.test(telLimpo(t));
const fmtTel=t=>{t=so(t);return t.length===11?t.replace(/(\d{2})(\d{5})(\d{4})/,'($1) $2-$3'):t.replace(/(\d{2})(\d{4})(\d{4})/,'($1) $2-$3')};
const mailOk=m=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m);
function avisa(t,err){const a=$('aviso');a.textContent=t;a.className='msg'+(err?' err':'');a.hidden=false;clearTimeout(avisa.t);avisa.t=setTimeout(()=>a.hidden=true,5000)}

// Regras fiscais (contas, locais, Carnê-Leão, sobra de despesa, reforma) ficam em regras.js, igual para o painel
const mesDe=(a,m)=>`${a}-${String(m+1).padStart(2,'0')}`;
const NOMES_MES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

let D=null;
const localDe=id=>D.locais.find(l=>l.id===id);
const opLocais=(soDedutiveis,vazio)=>(vazio?`<option value="">${vazio}</option>`:'')+D.locais.filter(l=>!soDedutiveis||TIPOS[l.tipo][1]>0)
  .map(l=>`<option value="${l.id}">${esc(l.nome)} (${TIPOS[l.tipo][0]})</option>`).join('');
const totMes=m=>D.atendimentos.filter(a=>a.pago!==false&&a.data.startsWith(m)).reduce((s,a)=>s+ +a.valor,0);
const pagos=()=>D.atendimentos.filter(a=>a.pago!==false); // regime de caixa: só o que já entrou
const despMes=m=>D.despesas.filter(d=>d.data.startsWith(m));

async function carrega(){
  const r=await sb.rpc('link_dados',{tok:TOK});
  if(r.error&&!TOK){location.replace('entrar.html');return} // logada sem cadastro: termina o cadastro
  if(r.error){$('ruim').hidden=false;['t-ini','t-lan','t-desp','t-ag','t-aj','nav'].forEach(i=>$(i).hidden=true);return}
  D=r.data;D.locais=D.locais||[];D.fixas=D.fixas||[];D.despesas=D.despesas||[];
  if(TOK)guarda.set(TOK);if(location.hash)history.replaceState(null,'',location.pathname);
  contaTela();
  $('nome').textContent=D.nome||'Lado a Lado Saúde';$('nav').hidden=false;
  if(!document.querySelector('section:not([hidden])'))mostra('t-ini');
  telaIni();telaLan();telaDesp();telaAg();
}
// Situação da conta (supabase/010): teste com prazo, só leitura quando vence; sem a função no banco, segue como antes
async function contaTela(){
  const r=await sb.rpc('minha_conta',{tok:TOK});if(r.error||!r.data)return;planoTela();
  const c=r.data, leitura=['leitura','cancelada'].includes(c.situacao), teste=c.situacao==='teste'&&c.teste_ate;
  const dias=teste?Math.round((new Date(c.teste_ate)-new Date(hojeISO()))/864e5):0;
  document.body.classList.toggle('leitura',leitura);
  $('conta').hidden=!(leitura||teste);$('conta').className='msg'+(leitura?' err':'');
  $('conta').textContent=leitura?'Sua conta está só para consulta: nada foi apagado e você pode ver tudo, mas não lançar. Para continuar, escolha seu plano em Ajuda > Seu plano.'
    :teste?`Teste grátis: ${dias>1?`faltam ${dias} dias`:dias===1?'termina amanhã':'termina hoje'} (até ${dBR(c.teste_ate)}).${c.conselho_ok?'':' Seu registro no conselho está em conferência pela Assessoria.'}`:'';
  $('b-sair').hidden=!c.logada&&!TOK;
}
// Plano e cobrança (supabase/013 + função cobranca). Sem a função no banco, o cartão fica escondido.
let PL=null;
async function planoTela(){const r=await sb.rpc('minha_cobranca',{tok:TOK});if(r.error||!r.data)return;PL=r.data;$('aj-plano').hidden=false;
  const c=PL.cobranca,nome=k=>(PL.planos.find(x=>x.codigo===k)||{}).nome||k;
  $('pl-sit').innerHTML=c&&c.status!=='paga'?`Cobrança ${c.status==='vencida'?'<b>vencida</b>':'em aberto'}: ${brl(c.valor)}, vencimento ${dBR(c.vencimento)}. <a href="${esc(c.link||'#')}" target="_blank" rel="noopener">Pagar agora</a>`
    :PL.plano&&PL.situacao==='ativa'?`Plano ${esc(nome(PL.plano))}${PL.ciclo?` (${PL.ciclo})`:''}, em dia.`
    :PL.situacao==='teste'?`Teste grátis até ${dBR(PL.teste_ate)}. Escolha o plano agora e a 1ª cobrança vence só no fim do teste.`
    :'Escolha um plano para voltar a lançar. Nada foi apagado.';
  if(PL.fundadora)$('pl-sit').innerHTML+=' <b>Fundadora: 30% de desconto.</b>';
  const ciclo=(document.querySelector('[name=pl-ciclo]:checked')||{}).value||'mensal';
  $('pl-lista').innerHTML=PL.planos.map(p=>{const atual=PL.situacao==='ativa'&&PL.plano===p.codigo,v=ciclo==='anual'?p.anual:p.mensal;
    return `<div class="item" style="grid-template-columns:1fr;gap:6px"><div style="display:flex;justify-content:space-between;gap:8px"><b>${esc(p.nome)}</b><b class="num">${brl(v)}<span class="sub">/${ciclo==='anual'?'ano':'mês'}</span></b></div>
      <div class="sub">${esc(p.resumo)}</div>${atual?'<div class="sub"><b>Seu plano atual</b></div>':`<button type="button" data-plano="${p.codigo}">${PL.plano_pedido===p.codigo&&c&&c.status!=='paga'?'Ver cobrança':'Quero este'}</button>`}</div>`}).join('')}
document.querySelectorAll('[name=pl-ciclo]').forEach(r=>r.onchange=planoTela);
document.addEventListener('click',async e=>{const k=e.target.dataset&&e.target.dataset.plano;if(!k)return;
  const ciclo=document.querySelector('[name=pl-ciclo]:checked').value,p=PL.planos.find(x=>x.codigo===k);
  if(!confirm(`Plano ${p.nome}, ${ciclo}: ${brl(ciclo==='anual'?p.anual:p.mensal)}. Abrir a página de pagamento?`))return;
  e.target.disabled=true;const w=window.open('about:blank','_blank');
  try{const {data}=await sb.auth.getSession(),h={'Content-Type':'application/json',apikey:CONFIG.chave};if(data.session)h.Authorization='Bearer '+data.session.access_token;
    const r=await fetch(CONFIG.url+'/functions/v1/cobranca',{method:'POST',headers:h,body:JSON.stringify({acao:'assinar',tok:TOK,plano:k,ciclo})});
    const j=await r.json();if(!r.ok||!j.link)throw new Error(j.erro||r.status);
    if(j.ensaio){if(w)w.close();avisa(`Modo de teste: nenhuma cobrança real foi criada (${brl(j.valor)}, vencimento ${dBR(j.vencimento)}).`)}
    else if(w)w.location=j.link;else location.href=j.link;
    await planoTela()}
  catch(err){if(w)w.close();avisa('Não consegui abrir o pagamento agora. Tente de novo ou fale com a Assessoria.',true)}
  e.target.disabled=false});

function mostra(t){document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!==t);
  document.querySelectorAll('nav button').forEach(b=>b.dataset.t===t?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));scrollTo(0,0)}
$('nav').onclick=e=>{const t=e.target.dataset.t;if(t)mostra(t)};

// ---------- Início ----------
function telaIni(){
  const m=$('i-mes').value, ap=apura(pagos(),D.despesas,m), tot=ap.rec, cl=ap.cl, desp=ap.usado+ap.inss;
  $('i-rec').textContent=brl(tot);$('i-desp').textContent=brl(desp);$('i-imp').textContent=brl(ap.darf.pagar);
  const me=$('i-meter');me.className='meter'+(tot>LIM2?' bad':tot>LIM*0.9?' warn':'');me.firstElementChild.style.width=Math.min(100,tot/LIM2*100)+'%';
  $('i-faixa').textContent=tot<=LIM?`Isenção de 2026: até ${brl(LIM)} no mês não paga Carnê-Leão. Faltam ${brl(LIM-tot)}.`
    :tot<=LIM2?`Passou de ${brl(LIM)}: o imposto tem desconto parcial em 2026.`:`Acima de ${brl(LIM2)}: imposto sem desconto.`;
  const [a,mm]=m.split('-').map(Number), venc=ultimoDiaUtil(a,mm);
  $('i-guardar').textContent=ap.darf.pagar>0?`Guarde ${brl(ap.darf.pagar)} para o Carnê-Leão deste mês. Vence em ${venc.toLocaleDateString('pt-BR')}; a Assessoria manda o DARF.`
    :ap.darf.adia?`Carnê-Leão de ${brl(ap.darf.total)}: abaixo de R$ 10 não tem DARF; o valor soma ao do mês seguinte.`
    :desp<SIMPL&&tot>LIM?`Suas despesas (${brl(desp)}) são menores que o desconto padrão de ${brl(SIMPL)}; o cálculo usa o desconto padrão.`
    :'Nada a guardar de imposto neste mês.';
  $('i-sobra').hidden=!(ap.sobra>0||ap.anterior>0);
  $('i-sobra').textContent=ap.sobra>0?`Suas despesas passaram do que entrou no mês: ${brl(ap.sobra)} ficam para abater nos próximos meses (até dezembro).`
    :`Este mês usou ${brl(Math.min(ap.anterior,ap.usado))} de despesas que sobraram de meses anteriores.`;
  const ano=m.slice(0,4), rf=reforma(pagos().filter(x=>x.data.startsWith(ano)).reduce((s,x)=>s+ +x.valor,0),ano);
  const mr=$('i-rmeter');mr.className='meter'+(rf.p>=1?' bad':rf.p>=0.8?' warn':'');mr.firstElementChild.style.width=Math.min(100,rf.p*100)+'%';$('i-reforma').textContent=rf.txt;
  const porLocal={};pagos().filter(x=>x.data.startsWith(m)).forEach(x=>{const k=x.local_id||'';porLocal[k]=(porLocal[k]||0)+ +x.valor});
  const ks=Object.keys(porLocal);
  $('i-locais').innerHTML=ks.length>1||(ks.length===1&&ks[0])?ks.map(k=>`<div class="item"><span>${k?esc(localDe(k)?.nome||'Local'):'Sem local'}</span><span class="num">${brl(porLocal[k])}</span></div>`).join(''):'';
  $('i-agenda').innerHTML=agenda().slice(0,3).map(itemAg).join('')||'<div class="sub">Nada nos próximos dias.</div>';
  const rec=D.atendimentos.filter(x=>x.pago===false);$('i-recebercard').hidden=!rec.length;
  $('receber').innerHTML=rec.map(x=>`<div class="item"><div><b>${esc(x.paciente)}</b><div class="meta">atendido em ${dBR(x.data)} · ${esc(x.forma)}</div></div>
    <div style="text-align:right"><div class="num">${brl(x.valor)}</div><button class="small" data-rec="${x.id}" type="button">Recebi</button> <button class="small" data-del="${x.id}" type="button">Apagar</button></div></div>`).join('')
    +(rec.length?`<div class="item"><b>Total a receber</b><b class="num">${brl(rec.reduce((s,x)=>s+ +x.valor,0))}</b></div>`:'');
  const pend=pagos().filter(x=>!x.emitido);
  $('pend').innerHTML=pend.length?pend.map(x=>`<div class="item"><div><b>${esc(x.paciente)}</b><div class="meta">pago em ${dBR(x.data)} · ${esc(x.forma)}</div></div>
    <div style="text-align:right"><div class="num">${brl(x.valor)}</div><button class="small" data-del="${x.id}" type="button">Apagar</button></div></div>`).join('')
    +`<div class="item"><b>Total</b><b class="num">${brl(pend.reduce((s,x)=>s+ +x.valor,0))}</b></div>`
    :'<div class="sub">Nada aguardando recibo. Lance os atendimentos na aba Lançar.</div>';
  $('b-zap').hidden=!pend.length;
}
$('i-mes').onchange=telaIni;

// ---------- Lançar ----------
function telaLan(){
  const sel=$('pac').value;
  $('pac').innerHTML='<option value="">Escolha o paciente</option>'+D.pacientes.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')+'<option value="novo">+ Paciente novo</option>';
  if(sel&&[...$('pac').options].some(o=>o.value===sel))$('pac').value=sel;
  contatoTela();
  const lsel=$('a-local').value;$('a-local').innerHTML=opLocais(false,D.locais.length?'':'Cadastre seus locais na aba Despesas');
  if(lsel)$('a-local').value=lsel;$('l-local').hidden=!D.locais.length;
  $('feitos').innerHTML=D.atendimentos.slice(0,30).map(x=>`<div class="item"><div><b>${esc(x.paciente)}</b><div class="meta">${dBR(x.data)} · ${brl(x.valor)}${x.local_id&&localDe(x.local_id)?' · '+esc(localDe(x.local_id).nome):''}</div></div>
    <span class="pill ${x.emitido?'':'pend'}">${x.emitido?'recibo emitido':x.pago===false?'a receber':'aguardando'}</span></div>`).join('')||'<div class="sub">Nenhum atendimento ainda.</div>';
}
// WhatsApp e e-mail do paciente, para a Assessoria mandar o recibo (ponto 3 do Daniel)
function contatoTela(){const v=$('pac').value,p=D.pacientes.find(x=>x.id===v);
  $('novo').hidden=v!=='novo';$('contato').hidden=!v;
  $('n-tel').value=p&&p.telefone?fmtTel(p.telefone):'';$('n-email').value=p&&p.email||'';}
$('pac').onchange=contatoTela;
function pagoTela(){const p=$('pago').checked;$('l-data').textContent=p?'Data do pagamento':'Data do atendimento';$('pago-dica').hidden=p}
$('pago').onchange=pagoTela;
$('f-at').onsubmit=async e=>{e.preventDefault();
  const v=num($('valor').value);
  if(!(v>0)){avisa('Valor inválido. Use, por exemplo, 150,00.',true);return}
  let pac=$('pac').value;
  if(!pac){avisa('Escolha o paciente.',true);return}
  if(pac==='novo'){
    const nome=$('n-nome').value.trim(), cpf=so($('n-cpf').value), pag=so($('n-pag').value);
    if(!nome){avisa('Escreva o nome do paciente.',true);return}
    if(!cpfOk(cpf)){avisa('CPF do paciente inválido. Confira os números.',true);return}
    if(pag&&!cpfOk(pag)){avisa('CPF de quem paga inválido.',true);return}
  }
  const tel=$('n-tel').value.trim(),em=$('n-email').value.trim();
  if(tel&&!telOk(tel)){avisa('WhatsApp do paciente inválido. Use o DDD e o número, ex.: 27 99999-9999.',true);return}
  if(em&&!mailOk(em)){avisa('E-mail do paciente inválido.',true);return}
  if(pac==='novo'){
    const r=await sb.rpc('link_paciente',{tok:TOK,p_nome:$('n-nome').value.trim(),p_cpf:so($('n-cpf').value),p_cpf_pagador:so($('n-pag').value),p_telefone:tel?telLimpo(tel):'',p_email:em});
    if(r.error){avisa('Não consegui salvar o paciente. Tente de novo.',true);return}
    pac=r.data;$('n-nome').value='';$('n-cpf').value='';$('n-pag').value='';
  }else{const p=D.pacientes.find(x=>x.id===pac);
    if(p&&((p.telefone||'')!==(tel?telLimpo(tel):'')||(p.email||'')!==em)){
      const r=await sb.rpc('link_paciente_contato',{tok:TOK,p_paciente:pac,p_telefone:tel?telLimpo(tel):'',p_email:em});
      if(r.error){avisa('Não consegui salvar o contato do paciente. Tente de novo.',true);return}}
  }
  const r=await sb.rpc('link_atendimento',{tok:TOK,p_paciente:pac,p_data:$('data').value,p_valor:v,p_forma:$('forma').value,p_local:$('a-local').value||null,p_pago:$('pago').checked});
  if(r.error){avisa('Não consegui salvar. Confira a data e tente de novo.',true);return}
  const pg=$('pago').checked;$('valor').value='';$('pago').checked=true;pagoTela();await carrega();$('pac').value=pac;contatoTela();avisa(pg?'Atendimento salvo.':'Salvo em "A receber". Marque quando o paciente pagar.');
};

// ---------- Despesas ----------
function telaDesp(){
  $('d-local').innerHTML=opLocais(true,'Não é conta de imóvel (anuidade, ISS, material...)');
  $('x-local').innerHTML=opLocais(true,'Não é conta de imóvel');
  prevDesp();
  const m=$('d-mes').value, ds=despMes(m);
  $('l-desp').innerHTML=ds.length?ds.map(d=>{const l=d.local_id&&localDe(d.local_id), parcial=d.valor_pago&&+d.valor_pago!==+d.valor;
    return `<div class="item"><div><b>${esc(nomeCod(d.codigo))}</b><div class="meta">${dBR(d.data)}${d.competencia?' · competência '+d.competencia:''}${l?' · '+esc(l.nome):''}${d.obs?' · '+esc(d.obs):''}${parcial?` · conta de ${brl(d.valor_pago)}`:''}</div></div>
    <div style="text-align:right"><div class="num">${brl(d.valor)}</div>${d.importada?'<span class="pill">importada</span>':`<button class="small" data-ddesp="${d.id}" type="button">Excluir</button>`}</div></div>`}).join('')
    +`<div class="item"><b>Total lançado que abate</b><b class="num">${brl(ds.reduce((s,d)=>s+ +d.valor,0))}</b></div>`
    :'<div class="sub">Nenhuma despesa neste mês.</div>';
  const mesAtual=hojeISO().slice(0,7);
  $('l-fixas').innerHTML=D.fixas.length?D.fixas.map(f=>{const l=f.local_id&&localDe(f.local_id), feita=D.despesas.some(d=>d.fixa_id===f.id&&d.data.startsWith(mesAtual));
    return `<div class="item"><div><b>${esc(nomeCod(f.codigo))}</b><div class="meta">dia ${f.dia} · ${brl(f.valor)}${l?' · '+esc(l.nome):''}</div></div>
    <div style="text-align:right">${feita?'<span class="pill">lançada este mês</span>':`<button class="small" data-lfixa="${f.id}" type="button">Lançar</button>`} <button class="small" data-dfixa="${f.id}" type="button" aria-label="Remover conta fixa">×</button></div></div>`}).join('')
    :'<div class="sub">Nenhuma conta fixa ainda. Ex.: aluguel, energia, internet, anuidade.</div>';
  $('l-locais').innerHTML=D.locais.length?D.locais.map(l=>`<div class="item"><div><b>${esc(l.nome)}</b><div class="meta">${TIPOS[l.tipo][2]}</div></div><span class="pill">${TIPOS[l.tipo][0]}</span></div>`).join('')
    :'<div class="sub">Cadastre onde você atende. Cada tipo de local tem uma regra diferente para abater as contas.</div>';
}
function prevDesp(){const ins=$('d-cod').value===INSS;$('l-dlocal').hidden=ins;$('l-dcomp').hidden=!ins;
  const v=num($('d-valor').value), l=!ins&&localDe($('d-local').value), f=l?TIPOS[l.tipo][1]:1;
  $('d-prev').textContent=!(v>0)?'':f<1?`Abate ${brl(Math.round(v*f*100)/100)} (20% da conta, porque é a sua casa).`:`Abate ${brl(v)} no Carnê-Leão.`}
['d-valor','d-local','d-cod'].forEach(i=>$(i).oninput=$(i).onchange=prevDesp);
$('d-mes').onchange=telaDesp;
$('o-tipo').onchange=()=>$('o-regra').textContent=TIPOS[$('o-tipo').value][2];
let fixaAtual=null;
$('f-desp').onsubmit=async e=>{e.preventDefault();
  const v=num($('d-valor').value), cod=$('d-cod').value, loc=cod===INSS?null:$('d-local').value||null, comp=$('d-comp').value;
  if(!(v>0)){avisa('Valor inválido. Use, por exemplo, 312,40.',true);return}
  if(IMOVEL.includes(cod)&&!loc){avisa('Escolha de qual local é essa conta: a regra muda se for a sua casa.',true);return}
  const r=await sb.rpc('link_despesa',{tok:TOK,p_codigo:cod,p_data:$('d-data').value,p_valor:v,p_local:loc,p_obs:$('d-obs').value.trim(),p_fixa:fixaAtual,p_competencia:cod===INSS&&comp?comp.split('-').reverse().join('/'):null});
  if(r.error){avisa('Não consegui salvar a despesa. Confira a data e tente de novo.',true);return}
  fixaAtual=null;$('d-valor').value='';$('d-obs').value='';$('d-mes').value=$('d-data').value.slice(0,7);await carrega();avisa('Despesa salva.');
};
$('f-fixa').onsubmit=async e=>{e.preventDefault();
  const v=num($('x-valor').value), dia=+$('x-dia').value, cod=$('x-cod').value, loc=$('x-local').value||null;
  if(!(v>0)||!(dia>=1&&dia<=31)){avisa('Confira o valor e o dia do vencimento.',true);return}
  if(IMOVEL.includes(cod)&&!loc){avisa('Escolha de qual local é essa conta.',true);return}
  const r=await sb.rpc('link_fixa',{tok:TOK,p_codigo:cod,p_valor:v,p_dia:dia,p_local:loc});
  if(r.error){avisa('Não consegui salvar a conta fixa.',true);return}
  $('x-valor').value='';$('x-dia').value='';$('f-fixa').closest('details').open=false;await carrega();avisa('Conta fixa salva. Ela aparece na agenda todo mês.');
};
$('f-local').onsubmit=async e=>{e.preventDefault();
  const nome=$('o-nome').value.trim();if(!nome){avisa('Dê um nome ao local.',true);return}
  const r=await sb.rpc('link_local',{tok:TOK,p_nome:nome,p_tipo:$('o-tipo').value});
  if(r.error){avisa('Não consegui salvar o local.',true);return}
  $('o-nome').value='';$('f-local').closest('details').open=false;await carrega();avisa('Local salvo.');
};

// ---------- Agenda: fixas do mês, fechamento no dia 1º, Carnê-Leão quando houver imposto e datas do ano ----------
function agenda(){
  const hoje=new Date();hoje.setHours(0,0,0,0);const fim=new Date(hoje);fim.setDate(fim.getDate()+90);const it=[];
  for(let k=0;k<4;k++){const a=hoje.getFullYear(),m=hoje.getMonth()+k,d1=new Date(a,m,1);
    it.push({d:d1,t:'Fechamento do mês',s:`A Assessoria emite os recibos de ${NOMES_MES[(m+11)%12]}. Confira se todos os atendimentos foram lançados.`});
    D.fixas.forEach(f=>{const ult=new Date(a,m+1,0).getDate();it.push({d:new Date(a,m,Math.min(f.dia,ult)),t:nomeCod(f.codigo),s:`Vencimento: cerca de ${brl(f.valor)}. Depois de pagar, lance em Despesas.`})});
    const ant=new Date(a,m-1,1), dv=apura(pagos(),D.despesas,mesDe(ant.getFullYear(),ant.getMonth())).darf;
    if(dv.pagar>0)it.push({d:ultimoDiaUtil(ant.getFullYear(),ant.getMonth()+1),t:'Carnê-Leão (DARF)',s:`${brl(dv.pagar)} de ${NOMES_MES[ant.getMonth()]}. A Assessoria manda o DARF.`});
    // Auditoria F8: o cadastro no Carnê-Leão Web vale um ano; sem ele o Receita Saúde não emite
    if(d1.getMonth()===0)it.push({d:new Date(d1.getFullYear(),0,2),t:'Cadastro do ano no Carnê-Leão',s:'A Assessoria atualiza o seu cadastro do ano no Carnê-Leão Web. Sem ele, o recibo do Receita Saúde não sai.'});
    if(d1.getMonth()===1)it.push({d:new Date(d1.getFullYear(),1,28),t:'Informe aos pacientes',s:'A Assessoria prepara o resumo do ano para cada paciente declarar no IR dele.'});
    if(d1.getMonth()===2)it.push({d:new Date(d1.getFullYear(),2,1),t:'Declaração do IR',s:'Começa o prazo da declaração. O livro-caixa do ano já está pronto aqui.'});
  }
  return it.filter(x=>x.d>=hoje&&x.d<=fim).sort((x,y)=>x.d-y.d);
}
const itemAg=x=>`<div class="item" style="grid-template-columns:auto 1fr"><span class="dia">${x.d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'})}</span><div><b>${esc(x.t)}</b><div class="meta">${esc(x.s)}</div></div></div>`;
function telaAg(){$('ag-lista').innerHTML=agenda().map(itemAg).join('')||'<div class="sub">Nada nos próximos 90 dias.</div>'}

// ---------- Ajuda ----------
const AJUDA=[
  ['Até quanto não pago Carnê-Leão?','Em 2026, quem recebe até R$ 5.000 no mês não paga. De R$ 5.000 a R$ 7.350 o imposto tem desconto parcial. A barra no Início mostra onde você está.'],
  ['Quais despesas abatem?','Aluguel, condomínio, energia, água, gás, telefone, internet e IPTU do local onde você atende, anuidade do CREFITO, ISS, material de limpeza e de escritório e salário de funcionário.'],
  ['Atendo na minha casa. Posso abater?','Sim, mas só 1/5 (20%) das contas da casa, porque ela também é moradia. Cadastre a casa como local "Minha casa, que também é consultório" e o app faz a conta.'],
  ['Atendo na casa dos pacientes. Combustível abate?','Não. Combustível, estacionamento e manutenção do carro não abatem no Carnê-Leão de quem é da saúde.'],
  ['Maca, aparelhos e computador abatem?','Não. Equipamento que dura anos não entra no livro-caixa. Material que se gasta no dia a dia entra se estiver no plano da Receita.'],
  ['Quanto tempo guardo os comprovantes?','5 anos, no seu nome e CPF. Foto legível também serve para você, mas guarde o papel ou o PDF original.'],
  ['O paciente é criança. Como lanço?','Lance no nome da criança e preencha o CPF de quem paga (mãe ou pai). O recibo sai certo para os dois.'],
  ['Quando vence o Carnê-Leão?','No último dia útil do mês seguinte. Se der imposto, a Assessoria manda o DARF com o valor.'],
  ['Pago ISS para a prefeitura?','Quem atende como autônoma com inscrição na prefeitura paga um ISS fixo por ano, que depende da cidade e da escolaridade da profissão, não de quanto você recebe. Em Vitória, em 2026, venceu em 22/04, com 5% de desconto na cota única. Em Vila Velha e na Serra, valor e data vêm no carnê da prefeitura. O ISS pago abate no Carnê-Leão: lance em Despesas, tipo ISS. A Assessoria confere a sua situação.'],
  ['Meu INSS abate?','Sim. O INSS que você paga como autônoma (carnê ou GPS) abate do Carnê-Leão no mês em que foi pago. Lance em Despesas, tipo "Seu INSS", com o mês a que se refere.'],
  ['Gastei mais do que recebi no mês. Perco a despesa?','Não. O que passar do recebido fica guardado e abate nos meses seguintes, até dezembro. O app faz essa conta sozinho e mostra no Início.'],
  ['Quando sai o recibo? E se o paciente parcelar?','O recibo vale pela data em que o dinheiro entrou, não pela data do atendimento. Se ainda não recebeu, desmarque "Já recebi" ao lançar: fica em A receber. Parcelado ou cartão: a cada parcela que cair, toque em Recebi e informe o valor; cada parcela vira um recibo.'],
  ['Como o paciente recebe o recibo?','A Assessoria emite no Receita Saúde e manda o PDF para você encaminhar. O paciente também vê todos os recibos dele no app Receita Saúde (gov.br), com o CPF.'],
  ['Vou ter que emitir nota fiscal?','Pela reforma tributária, a partir de 2027 quem recebe mais de cerca de R$ 55 mil no ano (R$ 70 mil em 2028, pela lei nova do MEI, a confirmar) passa a pagar os novos impostos (CBS e IBS, com 60% de desconto para fisioterapia) e a emitir nota fiscal. Atenção: a nota fiscal não dispensa o recibo do Receita Saúde; quem emite nota continua emitindo o recibo de cada pagamento. O Início mostra onde você está. Algumas regras ainda dependem de regulamentação; a Assessoria acompanha.'],
  ['Tenho mais de um local. Como faço?','Cadastre cada um em Despesas → Meus locais e escolha o local em cada atendimento e conta. O Início mostra quanto rende cada um.']];
$('aj-lista').innerHTML='<h2>Perguntas frequentes</h2>'+AJUDA.map(([p,r])=>`<details><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join('');
$('b-duvida').onclick=()=>location.href=`https://wa.me/${ZAP}?text=${encodeURIComponent(`Olá! Sou ${D?D.nome:''} e tenho uma dúvida:`)}`;

// ---------- Ações nas listas ----------
document.addEventListener('click',async e=>{const t=e.target.dataset||{};
  if(t.rec){const a=D.atendimentos.find(x=>x.id===t.rec);
    const v=num(prompt(`Quanto ${a.paciente} pagou hoje? (total ${brl(a.valor)}; se foi uma parcela, escreva só o valor dela)`,String(a.valor).replace('.',','))||'');
    if(!(v>0)||v>+a.valor){if(v)avisa('Valor inválido.',true);return}
    const r=await sb.rpc('link_receber',{tok:TOK,p_atendimento:t.rec,p_valor:v,p_data:hojeISO()});if(r.error){avisa('Não consegui registrar o pagamento.',true);return}
    await carrega();avisa(v<+a.valor?`Parcela de ${brl(v)} registrada. Faltam ${brl(a.valor-v)}.`:'Pagamento registrado. Já está em Aguardando recibo.');return}
  if(t.del&&!confirm('Apagar este lançamento? Use só se foi lançado errado.'))return;
  if(t.del){const r=await sb.rpc('link_excluir',{tok:TOK,p_atendimento:t.del});if(r.error){avisa('Não consegui excluir.',true);return}carrega()}
  if(t.ddesp){const r=await sb.rpc('link_excluir_despesa',{tok:TOK,p_despesa:t.ddesp});if(r.error){avisa('Não consegui excluir.',true);return}carrega()}
  if(t.dfixa){if(!confirm('Remover esta conta fixa? As despesas já lançadas continuam.'))return;
    const r=await sb.rpc('link_fixa_desligar',{tok:TOK,p_fixa:t.dfixa});if(r.error){avisa('Não consegui remover.',true);return}carrega()}
  if(t.lfixa){const f=D.fixas.find(x=>x.id===t.lfixa);fixaAtual=f.id;$('d-cod').value=f.codigo;$('d-local').value=f.local_id||'';
    $('d-valor').value=String(f.valor).replace('.',',');$('d-data').value=hojeISO();$('d-obs').value='';prevDesp();scrollTo(0,0);$('d-valor').focus();
    avisa('Confira o valor da conta deste mês e toque em Salvar.')}
});
$('b-zap').onclick=()=>{
  const pend=pagos().filter(a=>!a.emitido);
  const txt=`Lado a Lado Saúde - ${D.nome}\nPagamentos recebidos para emitir recibo:\n`+pend.slice().reverse().map(a=>`• ${a.paciente}: ${dBR(a.data)} - ${brl(a.valor)}`).join('\n')
    +`\nTotal: ${brl(pend.reduce((s,a)=>s+ +a.valor,0))}`;
  location.href=`https://wa.me/${ZAP}?text=${encodeURIComponent(txt)}`;
};

const opCod=CONTAS.map(([c,n])=>`<option value="${c}">${n}</option>`).join('');$('d-cod').innerHTML=opCod;$('x-cod').innerHTML=opCod;
$('data').value=$('d-data').value=hojeISO();{const d=new Date();d.setMonth(d.getMonth()-1);$('d-comp').value=iso(d).slice(0,7)}$('i-mes').value=$('d-mes').value=hojeISO().slice(0,7);$('o-regra').textContent=TIPOS.consultorio[2];
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
// Link válido primeiro; sem link, a conta logada; sem nenhum dos dois, o aviso com o caminho para entrar
// PIN (supabase/014): o código do link vira uma chave deste aparelho depois do PIN; sem a função no banco, segue como antes
let PIN='';
async function partida(){const r=await sb.rpc('link_pin_estado',{tok:TOK});
  if(r.error||!r.data||['aparelho','invalido'].includes(r.data.estado))return carrega();
  PIN=r.data.estado;$('pin').hidden=false;$('l-pin-2').hidden=PIN!=='criar';$('pin-2').required=PIN==='criar';
  $('pin-tit').textContent=PIN==='criar'?'Crie seu PIN':'Digite seu PIN';
  if(PIN==='pin')$('pin-sub').textContent='Primeira vez neste aparelho: digite o PIN de 4 números que você criou.';
  if(r.data.bloqueio_ate)avisa('Muitas tentativas. Tente de novo às '+new Date(r.data.bloqueio_ate).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'.',true);}
$('pin').onsubmit=async e=>{e.preventDefault();const p=$('pin-1').value;
  if(!/^\d{4}$/.test(p)){avisa('O PIN tem 4 números.',true);return}
  if(PIN==='criar'&&p!==$('pin-2').value){avisa('Os dois PIN não são iguais.',true);return}
  const r=await sb.rpc(PIN==='criar'?'link_pin_criar':'link_entrar',{tok:TOK,p_pin:p});$('pin-1').value=$('pin-2').value='';
  if(r.error){const m=r.error.message;avisa(/facil/.test(m)?'PIN fácil demais. Evite 1234 e números repetidos.':/bloqueado ate (\S+)/.test(m)?'Muitas tentativas. Tente de novo às '+m.match(/bloqueado ate (\S+)/)[1]+'.':/ja existe/.test(m)?'Este link já tem PIN. Digite o PIN que você criou.':'Este link não vale mais. Peça um novo à Assessoria.',true);if(/ja existe/.test(m))partida();return}
  if(!r.data){avisa('PIN errado.',true);return}
  TOK=r.data;guarda.set(TOK);$('pin').hidden=true;carrega();};
(async()=>{if(TOK.length>=20)return partida();
  const {data}=await sb.auth.getSession();if(data.session){TOK='';return carrega()}
  $('ruim').hidden=false})();
$('b-sair').onclick=async()=>{if(TOK){if(!confirm('Sair deste aparelho? Para voltar, abra o link e digite o PIN.'))return;await sb.rpc('link_sair',{tok:TOK});guarda.set('');location.replace('lancar.html');return}
  await sb.auth.signOut();location.replace('entrar.html')};
