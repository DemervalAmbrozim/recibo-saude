/* PLANO DO ANO DA EMPRESA (21/11/2026): acompanhamento do ano para quem tem CNPJ no Simples. Responde 3 perguntas em linguagem simples:
   1) "Quanto vou pagar de DAS este ano?"  2) "Estou no Anexo certo (Fator R)?"  3) "Posso passar do limite?"
   Reaproveita o que já existe: anexoSaude e fatorR (contab.js), proLaboreParaFatorR e limiteIsento (lucros.js). Carregar DEPOIS de contab.js e lucros.js.
   hist = [{mes:'AAAA-MM', receita, folha}] dos meses JÁ FECHADOS (folha = salários + pró-labore + encargos que contam no Fator R). Projeção = média dos 3 últimos meses fechados com receita
   (com sazonalidade opcional: mês do ano anterior ÷ média dos mesmos 3 meses do ano anterior, limitada a 0,5 a 2). É ESTIMATIVA, não promessa: o valor oficial do DAS é o do PGDAS-D.
   Regras: RBT12 = 12 meses ANTERIORES ao mês; Fator R até 2026 = mesma janela; desde 2027 a janela termina um mês antes (Res. CGSN 190/2026, art. 26) [conferir]. Mês anterior ao primeiro dado = estimado pela média. */
const pe2=x=>Math.round(x*100+(x<0?-1e-7:1e-7))/100;
const peBRL=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).replace(/ /g,' ');
const peMES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const peK=(a,n)=>`${a}-${String(n).padStart(2,'0')}`;
const peSoma=(a,n,d)=>{let y=a,m=n+d;while(m<1){m+=12;y--}while(m>12){m-=12;y++}return {a:y,n:m}};
const LIM_PORTE=360e3, LIM_SIMPLES=4.8e6;

function planoEmpresa({hist,ano,hoje,orcRec={},salarioMinimo=1621,sazonal=true}){
  ano=+ano;hoje=hoje||new Date().toISOString().slice(0,10);
  const H={};(hist||[]).filter(x=>x&&/^\d{4}-\d{2}$/.test(x.mes)&&Number.isFinite(+x.receita)&&+x.receita>=0&&Number.isFinite(+x.folha||0)).forEach(x=>{H[x.mes]={receita:+x.receita,folha:+x.folha||0}});
  const aH=+hoje.slice(0,4),mAtual=aH===ano?+hoje.slice(5,7):(aH>ano?13:0);
  if(mAtual===0)return {ok:false,motivo:`O ano de ${ano} ainda não começou.`};
  // meses fechados com receita, do mais recente para trás, até o mês anterior ao atual
  const fechadosAte=mAtual===13?peK(ano,12):(()=>{const p=peSoma(ano,mAtual,-1);return peK(p.a,p.n)})();
  const meses=Object.keys(H).filter(k=>k<=fechadosAte&&H[k].receita>0).sort();
  const ult3=meses.slice(-3),suficiente=ult3.length===3;
  if(!suficiente)return {ok:false,motivo:`Para planejar o ano eu preciso de 3 meses fechados com receita (tenho ${ult3.length}). Lance mais meses e volte.`,mesesTenho:ult3.length};
  const med=k=>ult3.reduce((s,m)=>s+H[m][k],0)/3,baseRec=pe2(med('receita')),baseFol=pe2(med('folha'));
  // sazonalidade: só se o ano anterior tem os mesmos 3 meses e a média deles é > 0
  const fatorSaz=n=>{if(!sazonal)return 1;let soma=0,c=0;for(const m of ult3){const a=+m.slice(0,4)-1,mm=m.slice(5,7),h=H[`${a}-${mm}`];if(h&&h.receita>0){soma+=h.receita;c++}}
    if(c<3)return 1;const mediaAnt=soma/3,ref=H[peK(ano-1,n)];if(!ref||!(ref.receita>0))return 1;return Math.min(2,Math.max(0.5,ref.receita/mediaAnt))};
  const usouSaz=sazonal&&[1,2,3,4,5,6,7,8,9,10,11,12].some(n=>fatorSaz(n)!==1);
  // linha do tempo: do 1º mês do ano anterior ao dezembro do ano (para as janelas de 12 meses)
  const T={};const val=(a,n)=>{const k=peK(a,n);if(T[k])return T[k];
    let v;if(H[k]&&k<=fechadosAte)v={receita:H[k].receita,folha:H[k].folha,tipo:'real'};
    else if(k===peK(ano,mAtual)&&H[k])v={receita:Math.max(H[k].receita,baseRec*(a===ano?fatorSaz(n):1)),folha:Math.max(H[k].folha,baseFol),tipo:'parcial'};
    else if(k>fechadosAte)v={receita:pe2(baseRec*(a===ano?fatorSaz(n):1)),folha:baseFol,tipo:'projetado'};
    else v={receita:baseRec,folha:baseFol,tipo:'estimado'};   // mês antigo sem dado: média (avisado)
    return T[k]=v};
  const atraso=ano>=2027?1:0;let temEstimado=false;
  const janela=(a,n)=>{let r=0,f=0;let p=peSoma(a,n,-1-atraso);for(let i=0;i<12;i++){const v=val(p.a,p.n);if(v.tipo==='estimado')temEstimado=true;r+=v.receita;f+=v.folha;p=peSoma(p.a,p.n,-1)}return {r,f}};
  const mensal=[];let anexoAnt=null,faixaAnt=null;const eventos=[];
  for(let n=1;n<=12;n++){
    const v=val(ano,n),j=janela(ano,n),as=anexoSaude(j.r,j.f,ano);
    const das=pe2(v.receita*as.efetiva);
    // quanto pagaria no outro anexo (mostra o valor do Fator R)
    const outroDas=pe2(v.receita*(as.anexo==='III'?anexoSaude(j.r,0,ano).efetiva:anexoSaude(j.r,j.r,ano).efetiva));
    const faixaIdx=[180e3,360e3,720e3,1.8e6,3.6e6,4.8e6].findIndex(x=>j.r<=x);
    mensal.push({n,mes:peK(ano,n),nome:peMES[n-1].slice(0,3),tipo:v.tipo,receita:pe2(v.receita),folha:pe2(v.folha),rbt12:pe2(j.r),fatorR:as.fatorR,anexo:as.anexo,efetiva:as.efetiva,das,dasNoOutro:outroDas,faixa:faixaIdx<0?7:faixaIdx+1,orc:orcRec[n]!=null&&orcRec[n]!==''&&!isNaN(+orcRec[n])?+orcRec[n]:null});
    if(anexoAnt&&as.anexo!==anexoAnt&&n>=Math.min(mAtual,13))eventos.push({n,tipo:'anexo',texto:`Em ${peMES[n-1]} o Anexo muda de ${anexoAnt} para ${as.anexo} (Fator R ${(as.fatorR*100).toFixed(1).replace('.',',')}%).`});
    if(faixaAnt&&mensal[n-1].faixa!==faixaAnt&&n>=Math.min(mAtual,13))eventos.push({n,tipo:'faixa',texto:`Em ${peMES[n-1]} a empresa passa para a ${mensal[n-1].faixa}ª faixa do Simples: a alíquota efetiva sobe.`});
    anexoAnt=as.anexo;faixaAnt=mensal[n-1].faixa}
  const recAno=pe2(mensal.reduce((s,m)=>s+m.receita,0)),folAno=pe2(mensal.reduce((s,m)=>s+m.folha,0)),dasAno=pe2(mensal.reduce((s,m)=>s+m.das,0));
  const dasReal=pe2(mensal.filter(m=>m.tipo==='real').reduce((s,m)=>s+m.das,0));
  // limites: maior RBT12 do ano e mês em que o acumulado do ano passa de R$ 360 mil (porte) e R$ 4,8 mi (saída do Simples)
  const maxRbt=Math.max(...mensal.map(m=>m.rbt12)),maxRbtMes=mensal.find(m=>m.rbt12===maxRbt);
  let acum=0,passaPorte=null,passaSimples=null;for(const m of mensal){acum+=m.receita;if(!passaPorte&&acum>LIM_PORTE)passaPorte=m;if(!passaSimples&&acum>LIM_SIMPLES)passaSimples=m}
  const rbtFim=pe2(Math.max(maxRbt,recAno));
  // pró-labore sugerido para o próximo mês aberto (mantém Fator R em 28%)
  const nProx=Math.min(mAtual===13?12:mAtual,12),jj=(()=>{let r=0,f=0,p=peSoma(ano,nProx,-1-atraso);for(let i=0;i<11;i++){const v=val(p.a,p.n);r+=v.receita;f+=v.folha;p=peSoma(p.a,p.n,-1)}return {r,f}})();
  const vProx=val(ano,nProx);
  const pl=typeof proLaboreParaFatorR==='function'?proLaboreParaFatorR({receita11:jj.r,folha11:jj.f,receitaMes:vProx.receita,folhaOutrasMes:0,salarioMinimo,alvo:0.28}):null;
  // lucro que pode retirar sem imposto no ano (estimativa; sem escrituração contábil completa vale a presunção)
  let lucro=null;if(typeof limiteIsento==='function'&&typeof irpjCsllEstimado==='function'){
    const ic=pe2(mensal.reduce((s,m)=>s+irpjCsllEstimado(m.das,m.anexo,m.rbt12),0));lucro=limiteIsento({receita:recAno,pct:PRESUNCAO.servicos,irpjCsll:ic});}
  const orcAno=pe2(mensal.reduce((s,m)=>s+(m.orc||0),0)),temOrc=mensal.some(m=>m.orc!==null);
  const anexoAgora=mensal[Math.min(mAtual,12)-1]||mensal[0],mesesV=mensal.filter(m=>m.anexo==='V'&&(m.tipo!=='real')).length;
  const economiaAnexo=mensal.filter(m=>m.tipo!=='real'&&m.anexo==='V').reduce((s,m)=>s+Math.max(0,m.das-m.dasNoOutro),0);
  return {ok:true,ano,mAtual,base:{receita:baseRec,folha:baseFol,meses:ult3},usouSaz,temEstimado,mensal,eventos,recAno,folAno,dasAno,dasReal,dasProj:pe2(dasAno-dasReal),
    limites:{maxRbt,maxRbtMes:maxRbtMes&&maxRbtMes.mes,rbtFim,porte:rbtFim>LIM_PORTE?'EPP':'ME',passaPorte:passaPorte&&passaPorte.mes,passaSimples:passaSimples&&passaSimples.mes,pctSimples:rbtFim/LIM_SIMPLES},
    proLabore:pl?{...pl,mes:peK(ano,nProx)}:null,lucro,orc:{temOrc,orcAno},anexoAgora:{mes:anexoAgora.mes,anexo:anexoAgora.anexo,fatorR:anexoAgora.fatorR},mesesAnexoV:mesesV,economiaAnexo:pe2(economiaAnexo)}}

// Histórico mês a mês lido do LIVRO CONTÁBIL (21/11/2026): receita bruta e despesas de pessoal (pró-labore, salários, FGTS e demais encargos de folha) pela DRE de cada mês.
// livro = criaLivro() (contabil.js). deMes/ateMes = 'AAAA-MM'. Meses sem nenhum lançamento ficam de fora (o plano os completa pela média e avisa).
// Atenção: as provisões de férias e 13º entram em despesas de pessoal (regime de competência); o Fator R oficial do PGDAS-D usa a folha paga: o contador confere [conferir].
function historicoPlanoDoLivro(livro,deMes,ateMes){
  const out=[];let [a,m]=deMes.split('-').map(Number);const [af,mf]=ateMes.split('-').map(Number);
  while(a<af||(a===af&&m<=mf)){const k=peK(a,m),ult=new Date(Date.UTC(a,m,0)).getUTCDate(),d=livro.dre(`${k}-01`,`${k}-${String(ult).padStart(2,'0')}`);
    if(d.receitaBruta>0||d.despesasPessoal>0)out.push({mes:k,receita:pe2(d.receitaBruta),folha:pe2(d.despesasPessoal)});
    m++;if(m>12){m=1;a++}}
  return out}
// As 3 perguntas e as frases curtas (linguagem simples, sem promessa)
function planoEmpresaTexto(P){
  if(!P.ok)return {perguntas:[],notas:[P.motivo]};
  const q=[],tx=v=>peBRL(v);
  // 1) DAS
  q.push({p:'Quanto vou pagar de DAS este ano?',r:`Cerca de ${tx(P.dasAno)} no ano (${tx(P.dasReal)} dos meses fechados e ${tx(P.dasProj)} dos próximos).`,detalhe:`Receita do ano estimada em ${tx(P.recAno)}, no ritmo dos últimos 3 meses (média de ${tx(P.base.receita)} por mês).`});
  // 2) Anexo
  const ev=P.eventos.find(e=>e.tipo==='anexo');
  const fr=(P.anexoAgora.fatorR*100).toFixed(1).replace('.',',');
  let r2=P.anexoAgora.anexo==='III'?`Sim, hoje você está no Anexo III (Fator R de ${fr}%, acima de 28%).`:`Ainda não: você está no Anexo V (Fator R de ${fr}%, abaixo de 28%).`;
  if(ev)r2+=' '+ev.texto;
  let det2='';if(P.proLabore){det2=`Para manter o Fator R em 28% em ${peMES[+P.proLabore.mes.slice(5)-1]}, a folha do mês (pró-labore mais salários) precisaria ser de cerca de ${tx(P.proLabore.proLabore)}${P.proLabore.noMinimo?' (já no mínimo)':''}.`;
    if(P.economiaAnexo>0)det2+=` Ficar no Anexo V nos próximos meses custa cerca de ${tx(P.economiaAnexo)} a mais de DAS.`}
  q.push({p:'Estou no Anexo certo (Fator R)?',r:r2,detalhe:det2});
  // 3) limite
  const L=P.limites;let r3,det3='';
  if(L.passaSimples)r3=`Atenção: pelo ritmo, a receita do ano passa de R$ 4,8 milhões em ${peMES[+L.passaSimples.slice(5)-1]}, o limite do Simples. Fale com o contador agora.`;
  else if(L.pctSimples>=0.8)r3=`Cuidado: você está em ${Math.round(L.pctSimples*100)}% do limite de R$ 4,8 milhões do Simples. Vale planejar com o contador.`;
  else r3=`Não: a receita estimada do ano é ${tx(L.rbtFim)}, ${Math.round(L.pctSimples*100)}% do limite de R$ 4,8 milhões do Simples.`;
  if(L.passaPorte)det3=`Passa de R$ 360 mil no ano em ${peMES[+L.passaPorte.slice(5)-1]}: a empresa deixa de ser ME e vira EPP (o imposto continua pelo mesmo cálculo).`;
  q.push({p:'Posso passar do limite?',r:r3,detalhe:det3});
  const notas=[];
  if(P.lucro)notas.push(`Lucro que costuma poder retirar sem imposto no ano (estimativa): até ${tx(P.lucro.limite)}. Acima de R$ 50 mil por mês para a mesma pessoa pode haver retenção de 10% (regra em disputa): confirme com o contador.`);
  if(P.usouSaz)notas.push('A projeção considerou como seus meses do ano passado se comportaram (sazonalidade).');
  if(P.temEstimado)notas.push('Faltam dados de meses antigos: usei a média para completar os 12 meses do cálculo.');
  notas.push('É uma estimativa pelo seu ritmo recente, não uma promessa. O valor oficial do DAS é o do PGDAS-D; o contador confere.');
  return {perguntas:q,notas}}
if(typeof module!=='undefined')module.exports={...(typeof module.exports==='object'?module.exports:{}),planoEmpresa,planoEmpresaTexto,historicoPlanoDoLivro};
