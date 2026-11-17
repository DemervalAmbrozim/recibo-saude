// Relatório mensal de uma página para a profissional com CNPJ (módulo C10, 17/11/2026): quanto entrou, saiu e sobrou; imposto e vencimento; Fator R e limite do Simples;
// pró-labore e lucros; folha; pendências; próximos vencimentos; o que fazer. Saídas: objeto com seções, HTML de uma página (imprimir ou PDF) e texto curto para o zap.
// Depende de contabil.js (livro), contab.js (anexoSaude, calendario). Linguagem simples, estimativa sempre como estimativa, sem promessa de economia ou de prazo de órgão público.

const brlR=v=>(v==null||isNaN(v)?'-':v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}));
const pctR=v=>v==null?'-':(v*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
const escR=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fimMes=(ano,mes)=>{const d=new Date(ano,mes,0);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const mesAnt=(comp,k=1)=>{const [a,m]=comp.split('-').map(Number),t=new Date(a,m-1-k,1);return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`};
const periodo=comp=>{const [a,m]=comp.split('-').map(Number);return [`${comp}-01`,fimMes(a,m)]};
const NOME_MES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const nomeComp=comp=>{const [a,m]=comp.split('-').map(Number);return NOME_MES[m-1]+' de '+a};
const dBR=iso=>iso.split('-').reverse().join('/');

// Receita e folha dos últimos 12 meses (até a competência), tirados da escrituração. Folha = pró-labore + salários + FGTS (provisão de férias e 13º fica de fora: não é pago no mês).
function histDoLivro(livro,comp){const out=[];for(let k=11;k>=0;k--){const m=mesAnt(comp,k),[de,ate]=periodo(m),d=livro.dre(de,ate);
  const folha=livro.saldoConta('3.2.1.01.001',ate,de)+livro.saldoConta('3.2.1.01.002',ate,de)+livro.saldoConta('3.2.1.01.003',ate,de);
  out.push({mes:m,receita:d.receitaBruta,folha:Math.round(folha*100)/100})}return out}

// Fator R e porte. Se a empresa tem menos de 12 meses de movimento, usa a média dos meses com movimento × 12 (regra de início de atividade) e avisa.
function fatorRDoHist(hist){const ativos=hist.filter(x=>x.receita>0||x.folha>0),m=ativos.length;if(!m)return null;
  let rec=ativos.reduce((s,x)=>s+x.receita,0),fol=ativos.reduce((s,x)=>s+x.folha,0);if(m<12){rec=rec/m*12;fol=fol/m*12}
  return {...anexoSaude(rec,fol),rbt12:Math.round(rec*100)/100,folha12:Math.round(fol*100)/100,mesesComMovimento:m,primeiroAno:m<12}}

// opts: {livro, empresa:{nome,cnpj}, comp:'AAAA-MM', pendencias:{naoClassificados,notasSemBaixa,recebimentosSemNota,documentosFaltando}, hoje:'AAAA-MM-DD', folhaAtiva:bool}
function relatorioMes({livro,empresa={},comp,pendencias={},hoje=null,folhaAtiva=false}){
  const [de,ate]=periodo(comp),[deA,ateA]=periodo(mesAnt(comp)),d=livro.dre(de,ate),dA=livro.dre(deA,ateA);
  const entrou=d.receitaBruta,das=d.deducoes,despesas=Math.round((d.despesasPessoal+d.despesasAdministrativas+d.despesasTributarias+d.despesasFinanceiras+d.outrasDespesas)*100)/100,sobrou=d.resultado;
  const sa=livro.saldos(de,ate),recebido=(sa['1.1.2.01']?sa['1.1.2.01'].c:0)/100,aReceber=livro.saldoConta('1.1.2.01',ate),caixa=livro.saldoConta('1.1.1.02',ate);
  const proLabore=livro.saldoConta('3.2.1.01.001',ate,de),distrib=(sa['2.3.3.01']?sa['2.3.3.01'].d:0)/100,lucroDisp=livro.lucroDisponivel(ate);
  const hist=histDoLivro(livro,comp),fr=fatorRDoHist(hist);
  const [a,m]=comp.split('-').map(Number),venc=`${m===12?a+1:a}-${String(m===12?1:m+1).padStart(2,'0')}-20`;
  const hojeI=hoje||`${m===12?a+1:a}-${String(m===12?1:m+1).padStart(2,'0')}-01`;
  const var_=(x,y)=>y>0?Math.round((x-y)/y*1000)/10:null;
  const R={comp,nomeComp:nomeComp(comp),empresa,entrou,das,despesas,sobrou,margem:d.margem,efetiva:entrou>0?das/entrou:null,
    anterior:{entrou:dA.receitaBruta,sobrou:dA.resultado},variacao:{entrou:var_(entrou,dA.receitaBruta),sobrou:dA.resultado>0?var_(sobrou,dA.resultado):null},
    caixa,recebido:Math.round(recebido*100)/100,aReceber,imposto:{valor:das,vencimento:venc,efetiva:entrou>0?das/entrou:null},
    enquadramento:fr,proLabore,distribuicoes:distrib,lucroDisponivel:lucroDisp,folhaAtiva,pessoal:d.despesasPessoal,pendencias:{naoClassificados:0,notasSemBaixa:0,recebimentosSemNota:0,documentosFaltando:0,...pendencias}};
  // próximos vencimentos (30 dias a partir de "hoje")
  const lim=new Date(hojeI+'T12:00:00');lim.setDate(lim.getDate()+30);const limI=lim.toISOString().slice(0,10);
  R.vencimentos=calendario(comp,{folha:folhaActive(folhaAtiva)}).filter(e=>e.data>=hojeI&&e.data<=limI).slice(0,8);
  // alertas e ações em linguagem simples
  const A=[],P=[];
  if(das>0)P.push(`Pagar o imposto do Simples (DAS) de ${brlR(das)} até ${dBR(venc)}.`);
  if(fr&&fr.anexo==='V'&&!fr.primeiroAno)A.push(`A folha (incluindo seu pró-labore) está em ${pctR(fr.fatorR)} da receita dos últimos 12 meses, abaixo de 28%: o imposto passa a ser calculado pela tabela mais cara (Anexo V). Peça ao contador para revisar o pró-labore.`);
  else if(fr&&fr.fatorR<0.3&&fr.anexo==='III')A.push(`A folha está em ${pctR(fr.fatorR)} da receita, perto do mínimo de 28% para ficar na tabela mais barata (Anexo III). Vale conversar sobre o pró-labore.`);
  if(fr&&fr.primeiroAno)A.push(`Sua empresa tem ${fr.mesesComMovimento} mês(es) de movimento; o enquadramento do imposto usa a média desses meses até completar 12.`);
  if(fr&&fr.perto)A.push(`Sua receita acumulada está ${fr.perto}.`);
  if(fr&&fr.porte==='acima do Simples')A.push('A receita dos últimos 12 meses passou do limite do Simples: falar com o contador agora.');
  if(distrib>lucroDisp+0.005&&lucroDisp<0)A.push('Houve retirada de lucro maior que o lucro registrado: sem lucro escriturado, o excesso pode ser tributado. Falar com o contador.');
  if(entrou>0&&sobrou<0)A.push(`O mês fechou com resultado negativo de ${brlR(sobrou)}.`);
  const pe=R.pendencias;
  if(pe.naoClassificados>0){A.push(`${pe.naoClassificados} lançamento(s) do extrato ainda sem classificação.`);P.push('Responder as perguntas sobre os lançamentos sem classificação do extrato.')}
  if(pe.recebimentosSemNota>0){A.push(`${pe.recebimentosSemNota} recebimento(s) sem nota fiscal correspondente: emitir a nota ou explicar a origem.`);P.push('Emitir a nota fiscal dos recebimentos sem nota.')}
  if(pe.notasSemBaixa>0)A.push(`${pe.notasSemBaixa} nota(s) emitida(s) ainda sem recebimento no extrato.`);
  if(pe.documentosFaltando>0){A.push(`${pe.documentosFaltando} documento(s) faltando para fechar o mês.`);P.push('Enviar os documentos que faltam pelo app ou pelo WhatsApp.')}
  if(folhaAtiva)P.push('Conferir a folha: eSocial até o dia 15 e FGTS Digital até o dia 20.');
  R.alertas=A;R.acoes=P.slice(0,3);
  R.aviso='Estimativa gerada pelo sistema a partir da escrituração do mês. O contador responsável confere antes de qualquer pagamento ou envio à Receita. Não é promessa de resultado.';
  R.texto=textoZap(R);R.html=htmlRelatorio(R);return R}
const folhaActive=x=>!!x;

function textoZap(R){const L=[];L.push(`${R.empresa.nome||'Sua empresa'}: resumo de ${R.nomeComp}`);
  L.push(`Entrou ${brlR(R.entrou)}${R.variacao.entrou!=null?' ('+(R.variacao.entrou>=0?'+':'')+String(R.variacao.entrou).replace('.',',')+'% sobre o mês anterior)':''}.`);
  L.push(`Imposto do Simples: ${brlR(R.das)}, vence em ${dBR(R.imposto.vencimento)}.`);
  L.push(`Despesas: ${brlR(R.despesas)}. Sobrou no mês: ${brlR(R.sobrou)}${R.margem!=null?' ('+pctR(R.margem)+' da receita)':''}.`);
  L.push(`Saldo no banco: ${brlR(R.caixa)}.`);
  if(R.alertas.length)L.push('Atenção: '+R.alertas.slice(0,2).join(' '));
  if(R.acoes.length)L.push('O que fazer: '+R.acoes.map((x,i)=>(i+1)+') '+x).join(' '));
  L.push('Estimativa; o contador confere. Relatório completo no app.');return L.join('\n')}

function htmlRelatorio(R){const sin=v=>v>=0?'':'neg',linha=(t,v,cl)=>`<tr><td>${escR(t)}</td><td class="n ${cl||''}">${v}</td></tr>`;
  const fr=R.enquadramento;
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Resumo de ${escR(R.nomeComp)}</title>
<style>:root{--fg:#17231e;--m:#5d6e66;--ac:#0f6b55;--bd:#d9e2dd;--bad:#9b1c1c;--warn:#8a5a00}*{box-sizing:border-box}body{font:13px/1.45 system-ui,sans-serif;color:var(--fg);margin:0;padding:18px;max-width:800px}
h1{font-size:19px;margin:0}h2{font-size:14px;margin:14px 0 4px;color:var(--ac);border-bottom:1px solid var(--bd)}.sub{color:var(--m);font-size:12px}
.tres{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.tres div{border:1px solid var(--bd);border-radius:10px;padding:8px}.tres b{display:block;font-size:20px}
table{width:100%;border-collapse:collapse}td{padding:3px 4px;border-bottom:1px solid var(--bd)}td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.neg{color:var(--bad)}
.al{background:#fff3d6;color:var(--warn);padding:6px 8px;border-radius:8px;margin:4px 0}.fim{color:var(--m);font-size:11px;margin-top:12px}@media print{body{padding:8mm}}@media(max-width:520px){.tres{grid-template-columns:1fr}}</style>
<h1>${escR(R.empresa.nome||'Sua empresa')} · resumo de ${escR(R.nomeComp)}</h1><div class="sub">${R.empresa.cnpj?'CNPJ '+escR(R.empresa.cnpj)+' · ':''}Lado a Lado Saúde</div>
<div class="tres"><div>Entrou<b>${brlR(R.entrou)}</b><span class="sub">${R.variacao.entrou!=null?(R.variacao.entrou>=0?'+':'')+String(R.variacao.entrou).replace('.',',')+'% sobre o mês anterior':'primeiro mês com movimento'}</span></div>
<div>Saiu<b>${brlR(R.despesas+R.das)}</b><span class="sub">despesas ${brlR(R.despesas)} + imposto ${brlR(R.das)}</span></div>
<div>Sobrou<b class="${sin(R.sobrou)}">${brlR(R.sobrou)}</b><span class="sub">${R.margem!=null?pctR(R.margem)+' da receita':''}</span></div></div>
<h2>Imposto e enquadramento</h2><table>${linha('Imposto do Simples (DAS) do mês',brlR(R.das))}${linha('Vencimento',dBR(R.imposto.vencimento))}${linha('Parte da receita que vira imposto',pctR(R.efetiva))}
${fr?linha('Tabela do Simples',`Anexo ${fr.anexo} (folha em ${pctR(fr.fatorR)} da receita; mínimo 28%)`):''}${fr?linha('Receita dos últimos 12 meses'+(fr.primeiroAno?' (estimada)':''),brlR(fr.rbt12)+' · '+fr.porte):''}</table>
<h2>Dinheiro</h2><table>${linha('Saldo no banco',brlR(R.caixa))}${linha('Recebido no mês (notas pagas)',brlR(R.recebido))}${linha('Notas emitidas ainda a receber',brlR(R.aReceber))}</table>
<h2>Sua retirada</h2><table>${linha('Pró-labore do mês',brlR(R.proLabore))}${linha('Lucro retirado no mês',brlR(R.distribuicoes))}${linha('Lucro registrado disponível para retirar',brlR(R.lucroDisponivel))}</table>
${R.folhaAtiva?`<h2>Funcionários</h2><table>${linha('Custo com pessoal no mês',brlR(R.pessoal))}</table>`:''}
${R.alertas.length?`<h2>Atenção</h2>${R.alertas.map(x=>`<div class="al">${escR(x)}</div>`).join('')}`:''}
<h2>O que vence nos próximos 30 dias</h2>${R.vencimentos.length?`<table>${R.vencimentos.map(e=>linha(e.titulo,dBR(e.data))).join('')}</table>`:'<div class="sub">Nada vence neste período.</div>'}
${R.acoes.length?`<h2>O que fazer agora</h2><ol>${R.acoes.map(x=>`<li>${escR(x)}</li>`).join('')}</ol>`:''}
<div class="fim">${escR(R.aviso)}</div></html>`}

if(typeof module!=='undefined')module.exports={relatorioMes,histDoLivro,fatorRDoHist,textoZap,htmlRelatorio,mesAnt,periodo};
