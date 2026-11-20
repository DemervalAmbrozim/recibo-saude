/* Plano do ano (20/11/2026, ideia do Demerval): orçado × realizado, com projeção dos meses seguintes.
   Usa as regras que o app já tem (regras.js: apura, nano, soma), então o imposto estimado bate com o "Seu mês".
   Carregar DEPOIS de regras.js. Funciona no navegador e no teste (vm), sem acesso ao banco.
   Projeção = média dos 3 últimos meses fechados com recebimento (pode cruzar o ano). Sem 3 meses, não projeta: mostra só realizado e orçado.
   É ESTIMATIVA, nunca promessa: a tela e o WhatsApp dizem isso. */
const MES3=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESN=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const r2p=x=>Math.round(x*100)/100;
const BRLp=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).replace(/\u00a0/g,' ');   // espaço comum depois do R$ (no WhatsApp e nos testes)
const kMes=(ano,n)=>`${ano}-${String(n).padStart(2,'0')}`;

// ats: atendimentos PAGOS ({data,valor}); ds: despesas ({data,valor,codigo}); ano: '2026'; hoje: 'AAAA-MM-DD';
// orc: {rec:{1..12:valor}, desp:{1..12:valor}} (opcional; mês sem valor = sem orçado)
function planoAno(ats,ds,ano,hoje,orc){
  ano=String(ano); hoje=hoje||new Date().toISOString().slice(0,10);
  const limpa=l=>(l||[]).filter(x=>x&&typeof x.data==='string'&&/^\d{4}-\d{2}/.test(x.data)&&Number.isFinite(+x.valor)).map(x=>({...x,valor:+x.valor}));  // dado ruim (sem data, valor 'abc') é ignorado, não derruba a tela
  ats=limpa(ats);ds=limpa(ds);
  const anoH=hoje.slice(0,4), mAtual=anoH===ano?+hoje.slice(5,7):(anoH>ano?13:0);   // 13: ano já fechado; 0: ano que ainda não começou
  const recMes=k=>soma(ats.filter(a=>String(a.data).startsWith(k))), despMes=k=>soma(ds.filter(d=>String(d.data).startsWith(k)));
  // base: os 3 últimos meses fechados (antes do mês atual) que tiveram recebimento, olhando até 12 meses para trás
  const base={meses:[],rec:0,desp:0};
  if(mAtual>=1&&mAtual<=13){
    let a=+ano,n=Math.min(mAtual,13)-1; if(mAtual===13){n=12}
    for(let i=0;i<12&&base.meses.length<3;i++){ if(n<1){n=12;a--}
      const k=kMes(a,n),r=recMes(k); if(r>0)base.meses.push({mes:k,rec:r,desp:despMes(k)}); n--}
  }
  const suficiente=base.meses.length===3&&mAtual>=1&&mAtual<=12;
  if(suficiente){base.rec=r2p(base.meses.reduce((s,x)=>s+x.rec,0)/3);base.desp=r2p(base.meses.reduce((s,x)=>s+x.desp,0)/3)}
  const o=orc||{rec:{},desp:{}},orcDe=(t,n)=>{const v=(o[t]||{})[n];return v===undefined||v===null||v===''||isNaN(+v)?null:+v};
  const meses=[];
  for(let n=1;n<=12;n++){
    const k=kMes(ano,n),temReal=n<=mAtual||mAtual===13, real=temReal?{rec:recMes(k),desp:despMes(k)}:null;
    let proj=null;
    if(suficiente&&n>=mAtual) proj=n===mAtual?{rec:Math.max(real.rec,base.rec),desp:Math.max(real.desp,base.desp)}:{rec:base.rec,desp:base.desp};
    meses.push({n,mes:k,nome:MES3[n-1],real,fechado:n<mAtual||mAtual===13,atual:n===mAtual,proj,orc:{rec:orcDe('rec',n),desp:orcDe('desp',n)}});
  }
  // imposto (Carnê-Leão) mês a mês: o real onde já fechou, o projetado onde falta (mesma apura() do "Seu mês")
  const atsX=ats.slice(),dsX=ds.slice();
  meses.forEach(m=>{ if(!m.proj)return; const fa=m.proj.rec-(m.real?m.real.rec:0), fd=m.proj.desp-(m.real?m.real.desp:0);
    if(fa>0)atsX.push({data:`${m.mes}-15`,valor:fa,pago:true}); if(fd>0)dsX.push({data:`${m.mes}-15`,valor:fd,codigo:'P10.01.00002'})});
  let impReal=0,impProj=0;
  meses.forEach(m=>{ const tem=m.fechado||(m.real&&m.real.rec>0)||m.proj; if(!tem){m.imposto=null;return}
    m.imposto=apura(atsX,dsX,m.mes).cl.devido; if(m.fechado)impReal+=m.imposto; else impProj+=m.imposto});
  // acumulado e linha da reforma (R$ 55 mil em 2027, LC 238/2026, a confirmar com o contador)
  const lim=nano(ano); let acum=0,cruza=null,recAno=0,despAno=0,recAte=0,recFech=0,orcFech=0,orcAno=0,temOrc=false;
  meses.forEach(m=>{ const v=m.fechado?m.real.rec:(m.proj?m.proj.rec:(m.real?m.real.rec:0)); acum+=v; recAno+=v; m.acum=r2p(acum);
    despAno+=m.fechado?m.real.desp:(m.proj?m.proj.desp:(m.real?m.real.desp:0));
    if(cruza===null&&acum>=lim&&(m.fechado||m.proj||(m.real&&m.real.rec>0)))cruza={n:m.n,mes:m.mes,nome:MESN[m.n-1],jaPassou:m.fechado||m.atual&&m.real.rec>=lim};
    if(m.real&&(m.fechado||m.atual))recAte+=m.real.rec;
    if(m.fechado)recFech+=m.real.rec;
    if(m.orc.rec!==null){temOrc=true;orcAno+=m.orc.rec;if(m.fechado)orcFech+=m.orc.rec}});   // comparação justa: só meses FECHADOS (mês parcial × orçado inteiro engana)
  const projCompleta=suficiente||mAtual===13;
  return {ano,mAtual,suficiente,base,lim,meses,recAte:r2p(recAte),recFech:r2p(recFech),orcFech:r2p(orcFech),orcAno:r2p(orcAno),temOrc,
    projAno:projCompleta?{rec:r2p(recAno),desp:r2p(despAno)}:null,imposto:{real:r2p(impReal),proj:r2p(impProj),ano:r2p(impReal+impProj)},cruza:projCompleta?cruza:null,pctLimite:projCompleta?recAno/lim:null};
}

// Frases curtas para a tela e para o WhatsApp (sem promessa; "estimativa")
function planoTexto(P){
  const L=[];
  if(P.mAtual===0){L.push(`O ano de ${P.ano} ainda não começou.`);return L}
  if(!P.suficiente&&P.mAtual<=12){
    const n=P.base.meses.length;
    L.push(`Para projetar o resto do ano eu preciso de 3 meses fechados com recebimentos lançados (tenho ${n}). Enquanto isso, o plano mostra o que você já recebeu e o orçado que você definir.`);return L}
  const pj=P.projAno;
  let f=`No ritmo dos seus últimos 3 meses (média de ${BRLp(P.base.rec)} por mês), você deve fechar ${P.ano} com cerca de ${BRLp(pj.rec)} recebidos.`;
  if(P.temOrc&&P.orcAno>0){const d=pj.rec-P.orcAno,p=Math.abs(d)/P.orcAno*100;f+=` O orçado do ano é ${BRLp(P.orcAno)}: a projeção está ${Math.abs(d)<1?'igual ao orçado':`${Math.round(p)}% ${d>0?'acima':'abaixo'}`}.`}
  L.push(f);
  L.push(`Carnê-Leão estimado do ano: cerca de ${BRLp(P.imposto.ano)} (${BRLp(P.imposto.real)} dos meses fechados e ${BRLp(P.imposto.proj)} dos próximos).`);
  const a1=Math.max(+P.ano+1,2027);
  if(P.cruza)L.push(P.cruza.jaPassou?`Você já passou da linha de ${BRLp(P.lim)} por ano da reforma tributária. Em ${a1} será preciso emitir nota fiscal e pagar CBS/IBS (a saúde tem desconto de 60% em algumas profissões).`
    :`Pelo ritmo, você passa de ${BRLp(P.lim)} no ano em ${P.cruza.nome}. Acima dessa linha, em ${a1} será preciso emitir nota fiscal e pagar CBS/IBS. Vale ver a conta PF × CNPJ.`);
  else L.push(`Pelo ritmo, você fica abaixo da linha de ${BRLp(P.lim)} por ano da reforma tributária (${Math.round(P.pctLimite*100)}% dela).`);
  L.push('É uma estimativa pelo seu ritmo recente, não uma promessa. Limite novo (LC 238/2026), a confirmar com o contador.');
  return L;
}
if(typeof module!=='undefined')module.exports={...(typeof module.exports==='object'?module.exports:{}),planoAno,planoTexto};
