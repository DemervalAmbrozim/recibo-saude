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
  const m={diasFerias:0,heNormais:0,heDescanso:0,horasNoturnas:0,faltasDias:0,dsrPerdidos:0,atrasoHoras:0,comissao:0,diasUteis:25,diasDescanso:5,outrosProventos:[],outrosDescontos:[],...mov};
  for(const k of['diasFerias','heNormais','heDescanso','horasNoturnas','faltasDias','dsrPerdidos','atrasoHoras','comissao'])if(!(m[k]>=0))erros.push('valor negativo ou inválido em '+k);
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
  add(D,'104','Dias de férias (pagos no recibo de férias)',m.diasFerias+' dias',S/30*m.diasFerias,{base:true});
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


// ===== Fase 2: férias e 13º salário (17/11/2026) =====
// Fontes: CLT arts. 129 a 153 (férias), art. 130 (escala por faltas), art. 134 §1º (fracionamento), art. 135 (aviso 30 dias), art. 145 (pagar até 2 dias antes), art. 143-144 (abono);
// Lei 4.090/62 e 4.749/65 (13º); Lei 15.270/2025 (a redução do IRRF vale também para o 13º, fonte secundária). Pontos ainda a conferir no texto oficial estão marcados [conferir].
const dIsoF=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const somaDias=(iso,n)=>{const [a,m,d]=iso.split('-').map(Number),x=new Date(a,m-1,d+n);return dIsoF(x)};
// Dias de férias a que tem direito conforme faltas injustificadas no período aquisitivo (CLT art. 130) [conferir o texto]
function direitoFerias(faltas){return faltas<=5?30:faltas<=14?24:faltas<=23?18:faltas<=32?12:0}
// Fracionamento: até 3 períodos, um com 14 dias ou mais, os outros com 5 ou mais (CLT art. 134 §1º, Reforma Trabalhista) [conferir]
function fracionamentoOk(periodos){if(!Array.isArray(periodos)||!periodos.length||periodos.length>3)return {ok:false,motivo:'até 3 períodos'};
  if(periodos.some(d=>!(d>=5)))return {ok:false,motivo:'nenhum período pode ter menos de 5 dias'};
  if(periodos.length>1&&!periodos.some(d=>d>=14))return {ok:false,motivo:'um dos períodos precisa ter 14 dias ou mais'};
  return {ok:true}}
// Aviso até 30 dias antes do início; pagamento até 2 dias antes (CLT arts. 135 e 145)
function prazosFerias(inicio){return {avisoAte:somaDias(inicio,-30),pagarAte:somaDias(inicio,-2)}}

// Recibo de férias. o: {diasGozo, diasAbono, mediaVariaveis, faltasPeriodo, outrasRemuneracoesMes}. INSS e IRRF saem pelo método marginal:
// imposto sobre (outras remunerações do mês + férias) menos o imposto sobre as outras remunerações do mês. Sem outras = recibo isolado.
// Incidências adotadas: férias gozadas e 1/3: INSS, IRRF e FGTS. Abono pecuniário: nenhum (Lei 8.212 art. 28 §9º, e). 1/3 do abono: só IRRF (Solução de Consulta Cosit 8/2015) [conferir]; FGTS e INSS não.
function calculaFerias(emp,o={},ano=2026){const T=tabelaFolha(ano),erros=[];
  const S=+emp.salario,g=+(o.diasGozo||0),ab=+(o.diasAbono||0),media=+(o.mediaVariaveis||0),faltas=+(o.faltasPeriodo||0),outras=+(o.outrasRemuneracoesMes||0);
  if(!(S>0))erros.push('salário inválido');
  const dir=direitoFerias(faltas);if(dir===0)erros.push('mais de 32 faltas injustificadas: perde o direito às férias deste período (art. 130)');
  if(!(g>=0)||!(ab>=0)||g+ab<=0)erros.push('informe os dias de gozo e/ou de abono');
  if(dir&&g+ab>dir)erros.push('gozo + abono ('+(g+ab)+') acima dos '+dir+' dias a que tem direito');
  if(dir&&ab>Math.floor(dir/3))erros.push('o abono pecuniário é de no máximo 1/3 das férias ('+Math.floor(dir/3)+' dias)');
  if(o.periodos){const f=fracionamentoOk(o.periodos);if(!f.ok)erros.push('fracionamento inválido: '+f.motivo);else if(o.periodos.reduce((s,x)=>s+x,0)!==g)erros.push('a soma dos períodos deve fechar os dias de gozo')}
  if(erros.length)return {ok:false,erros};
  const base=S+media,vd=base/30,fer=r2f(vd*g),t1=r2f(fer/3),abono=r2f(vd*ab),t1ab=r2f(abono/3);
  const tribINSS=fer+t1,tribIRRF=fer+t1+t1ab,dep=(emp.dependentes||0)*T.depIR;
  const inssTot=inssFolha(outras+tribINSS,ano),inssOut=inssFolha(outras,ano),inss=r2f(inssTot-inssOut);
  const irTot=carneLeao(outras+tribIRRF,inssTot+dep).devido,irOut=outras>0?carneLeao(outras,inssOut+dep).devido:0,irrf=r2f(Math.max(0,irTot-irOut));
  const fgts=r2f(tribINSS*T.fgts),bruto=r2f(fer+t1+abono+t1ab),liquido=r2f(bruto-inss-irrf);
  const P=[['201','Férias gozadas',g+' dias',fer],['202','1/3 constitucional sobre férias',' ',t1],['203','Abono pecuniário',ab+' dias',abono],['204','1/3 sobre o abono pecuniário',' ',t1ab]].filter(x=>x[3]>0).map(([cod,desc,ref,valor])=>({cod,desc,ref,valor}));
  return {ok:true,ano,diasDireito:dir,proventos:P,bruto,inss,irrf,fgts,liquido,valorDia:r2f(vd),
    aviso:'Estimativa; o contador confere. Prazos: aviso até 30 dias antes e pagamento até 2 dias antes do início (use prazosFerias).'}}

// IRRF do 13º: cálculo separado do salário, tributação exclusiva na fonte. Sem desconto simplificado por padrão [conferir se a Receita o admite no 13º];
// a redução da Lei 15.270 vale também para o 13º (fonte secundária; mesma fórmula do mensal: até R$ 5.000 zera, entre 5.000 e 7.350 reduz).
function irrf13(rend,inss,dependentes,T,{simplificado=false,reducao=true}={}){const ded=inss+dependentes*T.depIR,d=simplificado?Math.max(ded,SIMPL):ded,base=Math.max(0,rend-d);
  const [,al,pd]=TAB.find(f=>base<=f[0]),bruto=Math.max(0,base*al-pd);
  const red=!reducao?0:rend<=LIM?Math.min(bruto,312.89):rend<=LIM2?Math.max(0,978.62-0.133145*rend):0;
  return r2f(Math.max(0,bruto-red))}
// 13º: avos = meses com 15 dias ou mais trabalhados no ano. 1ª parcela (até 30/11): metade do 13º, sem INSS nem IRRF, com FGTS. 2ª (até 20/12): saldo menos INSS e IRRF calculados sobre o 13º inteiro.
function calculaDecimoTerceiro(emp,o={},ano=2026){const T=tabelaFolha(ano),erros=[];
  const S=+emp.salario,avos=o.avos==null?12:+o.avos,media=+(o.mediaVariaveis||0);
  if(!(S>0))erros.push('salário inválido');
  if(!(avos>=1&&avos<=12)||!Number.isInteger(avos))erros.push('avos deve ser um número inteiro de 1 a 12');
  if(erros.length)return {ok:false,erros};
  const total=r2f((S+media)/12*avos),p1=r2f(total/2),inss=inssFolha(total,ano),ir=irrf13(total,inss,emp.dependentes||0,T,{simplificado:!!o.simplificado13,reducao:o.reducao13!==false});
  const p2bruto=r2f(total-p1),p2liq=r2f(p2bruto-inss-ir);
  if(p2liq<0)return {ok:false,erros:['2ª parcela negativa: revisar']};
  return {ok:true,ano,avos,total,parcela1:{valor:p1,inss:0,irrf:0,liquido:p1,fgts:r2f(p1*T.fgts),vence:ano+'-11-30'},
    parcela2:{bruto:p2bruto,inss,irrf:ir,liquido:p2liq,fgts:r2f(p2bruto*T.fgts),vence:ano+'-12-20'},fgtsTotal:r2f(total*T.fgts),
    aviso:'Estimativa; IRRF do 13º sem desconto simplificado (a conferir) e com a redução da Lei 15.270.'}}

if(typeof module!=='undefined')module.exports={TABELAS_FOLHA,tabelaFolha,inssFolha,calculaFolha,holeriteHTML,direitoFerias,fracionamentoOk,prazosFerias,calculaFerias,calculaDecimoTerceiro,irrf13};
