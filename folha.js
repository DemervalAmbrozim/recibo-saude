// Folha de pagamento própria, fase 1 (17/11/2026): folha mensal de até 3 empregados CLT em empresa do Simples. Plano: projeto/folha-propria-plano-2026-11-17.md.
// Depende de regras.js (carneLeao: tabela mensal do IR com desconto simplificado e redução da Lei 15.270). ESTIMATIVA até a conferência do contador responsável (folha sombra).
// Fora do escopo desta fase: férias e 13º (F2), rescisão (F3), eventos do eSocial (F4), afastamentos e SST (F6), pensão alimentícia, consignado, insalubridade.

// Tabelas por competência (ano). Cada uma com fonte e o que foi conferido. Nova tabela em janeiro = novo item aqui + teste.
const TABELAS_FOLHA={
  2026:{sm:1621,teto:8475.55,inss:[[1621,.075],[2902.84,.09],[4354.27,.12],[8475.55,.14]],depIR:189.59,sfLimite:1980.38,sfCota:67.54,vtPct:.06,fgts:.08,
    fonte:'Portaria Interministerial MPS/MF 13/2026 (INSS, teto, salário-família); IR mensal e redução: Lei 15.270/2025 e regras.js',
    conferido:'INSS: faixas 1, 2 e teto lidos em fonte secundária; a faixa 3 fecha com a contribuição máxima de R$ 988,09 (conferida por soma). Salário-família lido em fonte secundária. Confirmar no texto da Portaria.'}};
const r2f=x=>Math.round((x+Number.EPSILON)*100)/100;

function tabelaFolha(ano){const t=TABELAS_FOLHA[ano];if(!t)throw new Error('Tabela da folha de '+ano+' não cadastrada: cadastre em TABELAS_FOLHA antes de calcular');return t}

function inssFolha(base,ano){const t=tabelaFolha(ano);let tot=0,ant=0;for(const [teto,al] of t.inss){if(base>ant)tot+=(Math.min(base,teto)-ant)*al;ant=teto}return r2f(tot)}

// emp: {salario, divisor (220 = 44 h/semana; 200 = 40 h; 180 = 36 h), dependentes (IR), filhosSF (menores de 14 ou inválidos), vtCusto (custo mensal do transporte, 0 = não optou)}
// mov: movimentos do mês. Retorna rubricas com incidência, bases, líquido e custo estimado. Lança erro em dado impossível (nunca "chuta").
function calculaFolha(emp,mov={},ano=2026){
  const T=tabelaFolha(ano),erros=[];
  const S=+emp.salario,div=emp.divisor||220;
  if(!(S>0))erros.push('salário inválido');
  if(![180,200,220].includes(div)&&!(div>0&&div<=300))erros.push('divisor de jornada inválido');
  if(S>0&&S<T.sm&&!emp.jornadaParcial)erros.push('salário abaixo do mínimo ('+T.sm+'): só para jornada parcial proporcional ou piso diferente por convenção');
  const m={heNormais:0,heDescanso:0,horasNoturnas:0,faltasDias:0,dsrPerdidos:0,atrasoHoras:0,comissao:0,diasUteis:25,diasDescanso:5,outrosProventos:[],outrosDescontos:[],...mov};
  for(const k of['heNormais','heDescanso','horasNoturnas','faltasDias','dsrPerdidos','atrasoHoras','comissao'])if(!(m[k]>=0))erros.push('valor negativo ou inválido em '+k);
  if(m.diasUteis<=0||m.diasDescanso<0||m.diasUteis+m.diasDescanso<28||m.diasUteis+m.diasDescanso>31)erros.push('dias úteis + descanso devem fechar o mês (28 a 31)');
  if(m.faltasDias>31)erros.push('faltas acima de 31 dias');
  if(erros.length)return {ok:false,erros};
  const vh=S/div,P=[],D=[];
  const add=(L,cod,desc,ref,valor,inc={inss:true,irrf:true,fgts:true})=>{valor=r2f(valor);if(valor!==0)L.push({cod,desc,ref,valor,...inc})};
  add(P,'001','Salário',div===220?'30 dias':'mensal',S);
  add(P,'010','Horas extras 50%',m.heNormais+' h',m.heNormais*vh*1.5);
  add(P,'011','Horas extras 100% (descanso e feriado)',m.heDescanso+' h',m.heDescanso*vh*2);
  add(P,'020','Adicional noturno 20%',m.horasNoturnas+' h',m.horasNoturnas*vh*.2);
  add(P,'030','Comissões',' ',m.comissao);
  // DSR sobre variáveis habituais (horas extras, adicional noturno, comissões), para mensalista: (variável ÷ dias úteis) × dias de descanso
  const variavel=m.heNormais*vh*1.5+m.heDescanso*vh*2+m.horasNoturnas*vh*.2+m.comissao;
  add(P,'040','DSR sobre variáveis',m.diasDescanso+' dias',variavel/m.diasUteis*m.diasDescanso);
  (m.outrosProventos||[]).forEach(o=>add(P,o.cod||'090',o.desc||'Outros proventos',' ',o.valor,{inss:o.inss!==false,irrf:o.irrf!==false,fgts:o.fgts!==false}));
  const tributavel=P.reduce((s,x)=>s+x.valor,0);
  // descontos que reduzem a base (faltas, DSR perdido, atrasos) entram como rubrica de desconto com incidência negativa na base
  const dFalta=S/30*m.faltasDias,dDsr=S/30*m.dsrPerdidos,dAtraso=m.atrasoHoras*vh;
  add(D,'101','Faltas injustificadas',m.faltasDias+' dias',dFalta,{base:true});
  add(D,'102','DSR perdido por falta',m.dsrPerdidos+' dias',dDsr,{base:true});
  add(D,'103','Atrasos e saídas antecipadas',m.atrasoHoras+' h',dAtraso,{base:true});
  const redBase=D.filter(x=>x.base).reduce((s,x)=>s+x.valor,0);
  const bruto=r2f(tributavel-redBase),baseINSS=Math.max(0,bruto),baseFGTS=baseINSS;
  const inss=inssFolha(baseINSS,ano);
  // IRRF: o desconto simplificado (regras.js) vale se maior que INSS + dependentes; a redução da Lei 15.270 já está em carneLeao
  const ir=r2f(carneLeao(baseINSS,inss+(emp.dependentes||0)*T.depIR).devido);
  const vtDesc=emp.vtCusto>0?r2f(Math.min(.06*S,+emp.vtCusto)):0;
  add(D,'110','INSS',' ',inss);add(D,'120','IRRF',' ',ir);add(D,'130','Vale-transporte (até 6%)',' ',vtDesc);
  (m.outrosDescontos||[]).forEach(o=>add(D,o.cod||'190',o.desc||'Outros descontos',' ',o.valor));
  // salário-família: não incide INSS, IRRF nem FGTS; só para quem recebe até o limite; a empresa compensa no recolhimento [conferir a compensação no Simples]
  const sf=baseINSS<=T.sfLimite&&(emp.filhosSF||0)>0?r2f(T.sfCota*emp.filhosSF):0;
  add(P,'050','Salário-família',(emp.filhosSF||0)+' cota(s)',sf,{inss:false,irrf:false,fgts:false});
  const totP=r2f(P.reduce((s,x)=>s+x.valor,0)),totD=r2f(D.reduce((s,x)=>s+x.valor,0)),liquido=r2f(totP-totD);
  const fgts=r2f(baseFGTS*T.fgts);
  const prov=baseFGTS/12+baseFGTS/12*4/3,custo=r2f(bruto+sf+fgts+prov+T.fgts*prov+Math.max(0,(+emp.vtCusto||0)-vtDesc));
  if(liquido<0)return {ok:false,erros:['líquido negativo: descontos maiores que os proventos; revisar os lançamentos']};
  return {ok:true,ano,proventos:P,descontos:D,bruto,baseINSS,baseIRRF:baseINSS,baseFGTS,inss,irrf:ir,fgts,vt:vtDesc,salarioFamilia:sf,totalProventos:totP,totalDescontos:totD,liquido,valorHora:r2f(vh),custoMensal:custo,
    aviso:'Estimativa: o contador responsável confere a folha antes de qualquer pagamento ou envio ao eSocial.'}}

const esc2=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
// Holerite em HTML pronto para imprimir ou salvar como PDF pelo navegador. empresa: {nome,cnpj}; emp: {nome,cpf,cargo}; comp: 'AAAA-MM'
function holeriteHTML(r,empresa,emp,comp){
  const [a,m]=comp.split('-'),linhas=[...r.proventos.map(x=>[x.cod,x.desc,x.ref,x.valor,'']),...r.descontos.map(x=>[x.cod,x.desc,x.ref,'',x.valor])];
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Holerite ${esc2(emp.nome)} ${m}/${a}</title>
<style>body{font:14px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #999;padding:4px 6px;text-align:left}td.n,th.n{text-align:right}.cab{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.peq{color:#555;font-size:12px}@media print{body{margin:8mm}}</style>
<div class="cab"><div><h1>Recibo de pagamento de salário</h1><div>${esc2(empresa.nome)} · CNPJ ${esc2(empresa.cnpj||'')}</div></div><div>Competência ${m}/${a}</div></div>
<p>Empregado: <b>${esc2(emp.nome)}</b> · CPF ${esc2(emp.cpf||'')} · ${esc2(emp.cargo||'')}</p>
<table><tr><th>Cód.</th><th>Descrição</th><th>Ref.</th><th class="n">Proventos</th><th class="n">Descontos</th></tr>
${linhas.map(l=>`<tr><td>${l[0]}</td><td>${esc2(l[1])}</td><td>${esc2(l[2])}</td><td class="n">${l[3]===''?'':brl(l[3])}</td><td class="n">${l[4]===''?'':brl(l[4])}</td></tr>`).join('')}
<tr><th colspan="3">Totais</th><th class="n">${brl(r.totalProventos)}</th><th class="n">${brl(r.totalDescontos)}</th></tr></table>
<p><b>Líquido a receber: ${brl(r.liquido)}</b></p>
<p class="peq">Base INSS ${brl(r.baseINSS)} · Base IRRF ${brl(r.baseIRRF)} · Base e depósito do FGTS ${brl(r.baseFGTS)} (${brl(r.fgts)}) · Salário-hora ${brl(r.valorHora)}</p>
<p class="peq">Documento gerado pelo sistema como estimativa até a conferência do contador responsável. ${esc2(r.aviso)}</p>
<p class="peq">Recebi o valor líquido acima. Data: ____/____/______ Assinatura: ______________________________</p></html>`}

if(typeof module!=='undefined')module.exports={TABELAS_FOLHA,tabelaFolha,inssFolha,calculaFolha,holeriteHTML};
