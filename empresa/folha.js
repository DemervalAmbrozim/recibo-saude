// Folha de pagamento própria, fase 1 (17/11/2026): folha mensal de até 3 empregados CLT em empresa do Simples. Plano: projeto/folha-propria-plano-2026-11-17.md.
// Depende de regras.js (carneLeao: tabela mensal do IR com desconto simplificado e redução da Lei 15.270). ESTIMATIVA até a conferência do contador responsável (folha sombra).
// Fora do escopo desta fase: férias e 13º (F2), rescisão (F3), eventos do eSocial (F4), afastamentos e SST (F6), pensão alimentícia, consignado, insalubridade.

// Tabelas por competência (ano). Cada uma com fonte e o que foi conferido. Nova tabela em janeiro = novo item aqui + teste.
const TABELAS_FOLHA={
  2026:{sm:1621,teto:8475.55,inss:[[1621,.075],[2902.84,.09],[4354.27,.12],[8475.55,.14]],depIR:189.59,sfLimite:1980.38,sfCota:67.54,vtPct:.06,fgts:.08,
    fonte:'Portaria Interministerial MPS/MF 13/2026 (INSS, teto, salário-família); IR mensal e redução: Lei 15.270/2025 e regras.js',
    conferido:'21/11/2026: faixas do INSS (7,5% até 1.621,00; 9% até 2.902,84; 12% até 4.354,27; 14% até 8.475,55), teto de 8.475,55, salário-família de R$ 67,54 para remuneração até R$ 1.980,38 (filho até 14 anos ou inválido) LIDOS no texto da Portaria Interministerial MPS/MF 13, de 09/01/2026 (DOU 12/01/2026), em site de legislação; a contribuição máxima de 988,09 é conta nossa (confere). Conferir no DOU/gov.br ao assinar a 1ª folha.'}};
const r2f=x=>Math.round((x+Number.EPSILON)*100)/100;

// Registra a tabela de um ano com os parâmetros legais do banco (pj_parametro_legal). Recusa tabela incompleta.
function registraTabelaFolha(ano,t){const ok=t&&[t.sm,t.teto,t.depIR,t.sfLimite,t.sfCota,t.vtPct,t.fgts].every(x=>typeof x==='number'&&isFinite(x))&&Array.isArray(t.inss)&&t.inss.length>=2&&t.inss.every(f=>f.length===2&&isFinite(f[0])&&isFinite(f[1]));if(!ok)throw new Error('tabela da folha inválida para '+ano);TABELAS_FOLHA[ano]=t}
function tabelaFolha(ano){const t=TABELAS_FOLHA[ano];if(!t)throw new Error('Tabela da folha de '+ano+' não cadastrada: cadastre em TABELAS_FOLHA antes de calcular');return t}

// Modo do arredondamento do INSS (21/11/2026): 'total' = soma as faixas e arredonda no fim; 'truncado' = trunca cada faixa em centavos (como o eSocial S-5001, leitura de 17/11).
// O Daniel decide na 1ª folha-sombra; trocar aqui (ou na tela da folha em lote) vale para folha, férias, 13º e rescisão. Padrão: 'total' (não muda nenhum número já conferido).
let MODO_INSS='total';
function definirModoINSS(m){if(m!=='total'&&m!=='truncado')throw new Error("modo do INSS deve ser 'total' ou 'truncado'");MODO_INSS=m;return MODO_INSS}
function modoINSS(){return MODO_INSS}
function inssFolha(base,ano){if(MODO_INSS==='truncado')return inssFolhaTruncado(base,ano);const t=tabelaFolha(ano);let tot=0,ant=0;for(const [teto,al] of t.inss){if(base>ant)tot+=(Math.min(base,teto)-ant)*al;ant=teto}return r2f(tot)}

// emp: {salario, divisor (220 = 44 h/semana; 200 = 40 h; 180 = 36 h), dependentes (IR), filhosSF (até 14 anos ou inválidos; conferir a idade-limite na Portaria do ano), vtCusto (custo mensal do transporte, 0 = não optou)}
// mov: movimentos do mês. Retorna rubricas com incidência, bases, líquido e custo estimado. Lança erro em dado impossível (nunca "chuta").
// INSS com truncamento por faixa: o leiaute do eSocial (S-5001) calcula assim, segundo a leitura de 17/11 (projeto/esocial-leiaute-fase4-2026-11-17.md); o `inssFolha` arredonda o total e pode diferir em centavos. A escolha do contador na 1ª folha sombra decide qual vale.
function inssFolhaTruncado(base,ano){const t=tabelaFolha(ano);let tot=0,ant=0;for(const [teto,al] of t.inss){if(base>ant)tot+=Math.floor((Math.min(base,teto)-ant)*al*100+1e-9)/100;ant=teto}return r2f(tot)}
// Pró-labore do sócio (categoria 723 no eSocial; natureza de rubrica 3508; S-2300, S-1200 e S-1210): INSS de 11% sobre o valor até o teto, sem FGTS; IRRF pela tabela mensal (com o desconto simplificado e a redução da Lei 15.270, como o resto da folha). [conferir a regra do IRRF do pró-labore com o contador]
function calculaProLabore(socio,ano=2026){const T=tabelaFolha(ano),P=+socio.proLabore;if(!(P>0))return {ok:false,erros:['pró-labore inválido']};
  const inss=r2f(.11*Math.min(P,T.teto)),irrf=r2f(carneLeao(P,inss+(socio.dependentes||0)*T.depIR).devido);
  return {ok:true,bruto:r2f(P),inss,irrf,fgts:0,liquido:r2f(P-inss-irrf),categoriaESocial:723,naturezaRubrica:'3508',codReceitaIRRF:'056107',aviso:'Estimativa; o contador confere. Pró-labore não paga FGTS; INSS limitado ao teto.'}}
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
  let inss=inssFolha(baseINSS,ano),inssOutroVinculo=null;
  // Outro vínculo (075, pj_inss_outro_vinculo): o INSS do empregado tem teto único. O desconto aqui é o INSS sobre a soma das remunerações (com o teto) menos o que já foi descontado no outro vínculo, e nunca passa do que seria sem o outro vínculo [conferir com o S-1200: remuneração de outra empresa].
  if(emp.outroVinculo&&+emp.outroVinculo.remuneracao>0){const ov=emp.outroVinculo,total=inssFolha(baseINSS+ +ov.remuneracao,ano),aqui=Math.max(0,r2f(total-(+ov.inss||0))),semOutro=inss;
    inss=Math.min(semOutro,aqui);inssOutroVinculo={remuneracaoOutro:r2f(+ov.remuneracao),inssOutro:r2f(+ov.inss||0),inssTotalComTeto:total,inssSemOutroVinculo:semOutro,teto:T.teto}}
  // IRRF: o desconto simplificado (regras.js) vale se maior que INSS + dependentes; a redução da Lei 15.270 já está em carneLeao
  const ir=r2f(carneLeao(baseINSS,inss+(emp.dependentes||0)*T.depIR+(+emp.deducaoIRRFExtra||0)).devido); // deducaoIRRFExtra: pensão alimentícia judicial (dedutível do IRRF); 0 por padrão
  const vtDesc=emp.vtCusto>0?r2f(Math.min(.06*S,+emp.vtCusto)):0;
  add(D,'110','INSS',' ',inss);add(D,'120','IRRF',' ',ir);add(D,'130','Vale-transporte (até 6%)',' ',vtDesc);
  (m.outrosDescontos||[]).forEach(o=>add(D,o.cod||'190',o.desc||'Outros descontos',' ',o.valor));
  // salário-família: não incide INSS, IRRF nem FGTS; só para quem recebe até o limite; a empresa compensa no recolhimento [conferir a compensação no Simples]
  const sf=baseINSS<=T.sfLimite&&(emp.filhosSF||0)>0?r2f(T.sfCota*emp.filhosSF):0;
  add(P,'050','Salário-família',(emp.filhosSF||0)+' cota(s)',sf,{inss:false,irrf:false,fgts:false});
  const totP=r2f(P.reduce((s,x)=>s+x.valor,0)),totD=r2f(D.reduce((s,x)=>s+x.valor,0)),liquido=r2f(totP-totD);
  const fgtsAl=emp.fgtsAliq!=null?+emp.fgtsAliq:T.fgts; // aprendiz: 2% (Lei 8.036/1990 art. 15 §7º); demais: 8%
  const fgts=r2f(baseFGTS*fgtsAl);
  const prov=baseFGTS/12+baseFGTS/12*4/3,custo=r2f(bruto+sf+fgts+prov+fgtsAl*prov+Math.max(0,(+emp.vtCusto||0)-vtDesc));
  if(liquido<0)return {ok:false,erros:['líquido negativo: descontos maiores que os proventos; revisar os lançamentos']};
  return {ok:true,ano,proventos:P,descontos:D,bruto,baseINSS,baseIRRF:baseINSS,baseFGTS,inss,inssOutroVinculo,irrf:ir,fgts,vt:vtDesc,salarioFamilia:sf,totalProventos:totP,totalDescontos:totD,liquido,valorHora:r2f(vh),custoMensal:custo,
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
// Incidências adotadas: férias gozadas e 1/3: INSS, IRRF e FGTS. Abono pecuniário: nenhum (Lei 8.212 art. 28 §9º, e). 1/3 do abono: só IRRF (Solução de Consulta Cosit 209/2021, fonte secundária; o texto oficial não foi aberto: o contador confere) [conferir]; FGTS e INSS não.
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
  const tribINSS=fer+t1,tribIRRF=fer+t1+t1ab,dep=(emp.dependentes||0)*T.depIR+(+emp.deducaoIRRFExtra||0); // deducaoIRRFExtra: pensão judicial
  const inssTot=inssFolha(outras+tribINSS,ano),inssOut=inssFolha(outras,ano),inss=r2f(inssTot-inssOut);
  const irTot=carneLeao(outras+tribIRRF,inssTot+dep).devido,irOut=outras>0?carneLeao(outras,inssOut+dep).devido:0,irrf=r2f(Math.max(0,irTot-irOut));
  const fgts=r2f(tribINSS*(emp.fgtsAliq!=null?+emp.fgtsAliq:T.fgts)),bruto=r2f(fer+t1+abono+t1ab),liquido=r2f(bruto-inss-irrf);
  const P=[['201','Férias gozadas',g+' dias',fer],['202','1/3 constitucional sobre férias',' ',t1],['203','Abono pecuniário',ab+' dias',abono],['204','1/3 sobre o abono pecuniário',' ',t1ab]].filter(x=>x[3]>0).map(([cod,desc,ref,valor])=>({cod,desc,ref,valor}));
  return {ok:true,ano,diasDireito:dir,proventos:P,bruto,inss,irrf,fgts,liquido,valorDia:r2f(vd),
    aviso:'Estimativa; o contador confere. Prazos: aviso até 30 dias antes e pagamento até 2 dias antes do início (use prazosFerias).'}}

// IRRF do 13º: cálculo separado do salário, tributação exclusiva na fonte. Sem desconto simplificado por padrão [conferir se a Receita o admite no 13º];
// a redução da Lei 15.270 vale também para o 13º (fonte secundária; mesma fórmula do mensal: até R$ 5.000 zera, entre 5.000 e 7.350 reduz).
function irrf13(rend,inss,dependentes,T,{simplificado=false,reducao=true,extra=0}={}){const ded=inss+dependentes*T.depIR+extra,d=simplificado?Math.max(ded,SIMPL):ded,base=Math.max(0,rend-d);
  const [,al,pd]=TAB.find(f=>base<=f[0]),bruto=Math.max(0,base*al-pd);
  const red=!reducao?0:rend<=LIM?Math.min(bruto,312.89):rend<=LIM2?Math.max(0,978.62-0.133145*rend):0;
  return r2f(Math.max(0,bruto-red))}
// 13º: avos = meses com 15 dias ou mais trabalhados no ano. 1ª parcela (até 30/11): metade do 13º, sem INSS nem IRRF, com FGTS. 2ª (até 20/12): saldo menos INSS e IRRF calculados sobre o 13º inteiro.
function calculaDecimoTerceiro(emp,o={},ano=2026){const T=tabelaFolha(ano),erros=[];
  const S=+emp.salario,avos=o.avos==null?12:+o.avos,media=+(o.mediaVariaveis||0);
  if(!(S>0))erros.push('salário inválido');
  if(!(avos>=1&&avos<=12)||!Number.isInteger(avos))erros.push('avos deve ser um número inteiro de 1 a 12');
  if(erros.length)return {ok:false,erros};
  const total=r2f((S+media)/12*avos),p1=r2f(total/2),inss=inssFolha(total,ano),ir=irrf13(total,inss,emp.dependentes||0,T,{simplificado:!!o.simplificado13,reducao:o.reducao13!==false,extra:+emp.deducaoIRRFExtra||0}),fa=emp.fgtsAliq!=null?+emp.fgtsAliq:T.fgts;
  const p2bruto=r2f(total-p1),p2liq=r2f(p2bruto-inss-ir);
  if(p2liq<0)return {ok:false,erros:['2ª parcela negativa: revisar']};
  return {ok:true,ano,avos,total,parcela1:{valor:p1,inss:0,irrf:0,liquido:p1,fgts:r2f(p1*fa),vence:ano+'-11-30'},
    parcela2:{bruto:p2bruto,inss,irrf:ir,liquido:p2liq,fgts:r2f(p2bruto*fa),vence:ano+'-12-20'},fgtsTotal:r2f(total*fa),
    aviso:'Estimativa; IRRF do 13º sem desconto simplificado (a conferir) e com a redução da Lei 15.270.'}}

// ===== Fase 3: rescisão (17/11/2026) =====
// Cinco tipos: sem_justa_causa, pedido_demissao, justa_causa, acordo (CLT art. 484-A), termino_contrato (contrato por prazo, ex.: experiência).
// Fontes (a conferir no texto oficial pelo contador, ver projeto/folha-propria-plano): CLT arts. 477 (prazo de 10 dias para pagar), 482 (justa causa), 484-A (acordo), 487 e 488 (aviso prévio), 146 e 147 (férias na rescisão);
// Lei 12.506/2011 (aviso proporcional: 30 dias + 3 por ano completo, máximo 90); Lei 8.036/1990 (FGTS, multa de 40%, 20% no acordo); Súmulas 305 e 261 do TST.
// Incidências adotadas: saldo de salário e 13º proporcional pagam INSS e IRRF (o 13º em separado); aviso indenizado, férias indenizadas e 1/3 não pagam INSS nem IRRF; FGTS incide sobre saldo, 13º e aviso indenizado, não sobre férias indenizadas.
// ESTIMATIVA: rescisão é onde o passivo trabalhista nasce; o contador confere cada uma e o advogado trabalhista revisa as primeiras.
const TIPOS_RESCISAO=['sem_justa_causa','pedido_demissao','justa_causa','acordo','termino_contrato'];
const parseIsoR=s=>{const [a,m,d]=String(s).split('-').map(Number);return new Date(Date.UTC(a,m-1,d))};
const isoR=d=>d.toISOString().slice(0,10);
const diasEntre=(a,b)=>Math.round((b-a)/86400000);
const ultimoDiaMes=(a,m)=>new Date(Date.UTC(a,m+1,0)).getUTCDate();
const addMeses=(d,n)=>{const a=d.getUTCFullYear(),m=d.getUTCMonth()+n,dd=Math.min(d.getUTCDate(),ultimoDiaMes(a+Math.floor(m/12),((m%12)+12)%12));return new Date(Date.UTC(a,m,dd))};
function anosCompletos(adm,fim){const a=parseIsoR(adm),f=parseIsoR(fim);let k=f.getUTCFullYear()-a.getUTCFullYear();if(addMeses(a,k*12)>f)k--;return Math.max(0,k)}
// 13º: meses do ano da saída com 15 dias ou mais trabalhados
function avos13Rescisao(adm,fim){const a=parseIsoR(adm),f=parseIsoR(fim),Y=f.getUTCFullYear();let n=0;
  for(let m=0;m<=f.getUTCMonth();m++){const ini=new Date(Date.UTC(Y,m,1)),fm=new Date(Date.UTC(Y,m,ultimoDiaMes(Y,m))),de=a>ini?a:ini,ate=f<fm?f:fm,dias=diasEntre(de,ate)+1;if(dias>=15)n++}return n}
// Férias proporcionais: meses desde o último aniversário do contrato, a fração de 15 dias ou mais conta como mês (CLT art. 146 parágrafo único)
function avosFeriasRescisao(adm,fim){const a=parseIsoR(adm),f=parseIsoR(fim),k=anosCompletos(adm,fim),ann=addMeses(a,k*12),fe=new Date(f.getTime()+86400000);let m=0;
  while(addMeses(ann,m+1)<=fe)m++;const resto=diasEntre(addMeses(ann,m),fe);if(resto>=15)m++;return Math.min(12,m)}

// emp: {salario, dependentes}. o: {tipo, admissao, saida (último dia, ou data da comunicação se o aviso for indenizado), avisoIndenizado (bool), mediaVariaveis, periodosVencidos (férias vencidas não gozadas),
//   saldoFgts (saldo do FGTS antes da rescisão, do extrato), diasSaldo (dias trabalhados no mês, padrão: dia da saída), parcela13Paga (valor da 1ª parcela do 13º já paga neste ano), dispensaAviso (empregador dispensa o aviso no pedido de demissão)}
function calculaRescisao(emp,o={},ano){
  const erros=[],S=+emp.salario;
  if(!(S>0))erros.push('salário inválido');
  if(!TIPOS_RESCISAO.includes(o.tipo))erros.push('tipo de rescisão inválido');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(o.admissao||'')||!/^\d{4}-\d{2}-\d{2}$/.test(o.saida||''))erros.push('datas de admissão e saída são obrigatórias (AAAA-MM-DD)');
  if(erros.length)return {ok:false,erros};
  if(o.saida<o.admissao)erros.push('a saída não pode ser antes da admissão');
  const AN=+(ano||o.saida.slice(0,4)),T=tabelaFolha(AN),media=+(o.mediaVariaveis||0),base=S+media,tipo=o.tipo;
  const sg=+(o.saldoFgts||0),venc=Math.max(0,Math.floor(+(o.periodosVencidos||0)));
  if(sg<0)erros.push('saldo do FGTS inválido');
  if(erros.length)return {ok:false,erros};
  const anos=anosCompletos(o.admissao,o.saida),jc=tipo==='justa_causa',tem13=!jc,temProp=!jc;
  // aviso prévio
  let avisoDias=0,avisoValor=0,avisoDesconto=0,projDias=0;const nota=[];
  if(tipo==='sem_justa_causa'||tipo==='acordo'){const dias=Math.min(90,30+3*anos);
    if(o.avisoIndenizado){avisoDias=tipo==='acordo'?dias/2:dias;avisoValor=base/30*avisoDias;projDias=avisoDias;if(tipo==='acordo')nota.push('acordo: aviso indenizado pela metade; a projeção para 13º e férias foi limitada à metade [conferir]')}
    else nota.push('aviso trabalhado: o contrato termina no fim do aviso; informe a data de saída final')}
  if(tipo==='pedido_demissao'&&!o.avisoTrabalhado&&!o.dispensaAviso){avisoDesconto=S;nota.push('pedido de demissão sem cumprir o aviso: desconto de 30 dias, salvo dispensa do empregador')}
  nota.push('eSocial: enviar o S-2299 em até 10 dias a contar do desligamento, sem contar o dia do desligamento; se cair em dia não útil, antecipar (MOS S-1.3, lido 27/11). Exceção: transferência ou mudança de CPF, até o dia 15 do mês seguinte. Pagamento das verbas e comunicação da extinção: até 10 dias do término do contrato (CLT art. 477 §6º)');
  if(tipo==='sem_justa_causa'||tipo==='acordo')nota.push('Nota Orientativa FGTS Digital 13/2026 (lida; revoga a 11/2025): desligamento em dezembro ou janeiro: o FGTS do 13º vence junto com a rescisão (10 dias), e o FGTS Digital antecipa sozinho desde 28/10/2026, sem ajustar a folha anual. Se o 13º adiantado passou do proporcional e o excedente é descontado de verba mensal, a rubrica de desconto deve usar codIncFGTS 11 (não 12), senão o FGTS da folha mensal é cobrado a mais');
  if(tipo==='sem_justa_causa'||tipo==='acordo')nota.push('FGTS rescisório (Manual FGTS Digital v1.60 de 05/05/2026, lido): a guia rescisória é gerada no FGTS Digital (substitui a GRRF desde 01/03/2024) e vence 10 dias após a data do desligamento, antecipada se cair em dia não útil; cobre o FGTS do mês da rescisão, 13º proporcional, aviso indenizado e a multa (40% ou 20%). Doméstico e MEI seguem outro caminho (DAE/guia própria)');
  if(tipo==='sem_justa_causa')nota.push('seguro-desemprego (Res. Codefat 957/2022, texto lido 27/11): na dispensa sem justa causa o empregador transmite os dados no portal empregador web (certificado digital ICP-Brasil, art. 40 §1º) e entrega ao trabalhador o formulário do requerimento (§3º); o trabalhador requer do 7º ao 120º dia após a dispensa (art. 41; doméstico: 7 a 90 dias, art. 46). Confirme se norma posterior alterou o canal. [CONFERIR COM O CONTADOR]');
  if(tipo==='sem_justa_causa')nota.push('multa de 40% sobre todos os depósitos do contrato, atualizados (Lei 8.036 art. 18 §1º, texto lido no Planalto 27/11); culpa recíproca ou força maior reconhecida pela Justiça do Trabalho: 20% (§2º), caso fora desta conta');
  if(tipo==='termino_contrato')nota.push('contrato por prazo: sem aviso nem multa do FGTS; se a empresa encerrar antes do prazo, há indenização do art. 479 da CLT (fora desta conta)');
  const fim=projDias?isoR(new Date(parseIsoR(o.saida).getTime()+projDias*86400000)):o.saida;
  // verbas
  const diasSaldo=o.diasSaldo!=null?+o.diasSaldo:+o.saida.slice(8,10);
  const saldo=S/30*Math.min(30,diasSaldo),avos13=tem13?avos13Rescisao(o.admissao,fim):0,v13=base/12*avos13;
  const avosF=temProp?avosFeriasRescisao(o.admissao,fim):0,feriasProp=base/12*avosF,tercoProp=feriasProp/3,feriasVenc=base*venc,tercoVenc=feriasVenc/3;
  const P=[],D=[],add=(L,cod,desc,ref,v,inc={})=>{v=r2f(v);if(v!==0)L.push({cod,desc,ref,valor:v,...inc})};
  add(P,'R01','Saldo de salário',Math.min(30,diasSaldo)+' dias',saldo,{inss:true,irrf:true,fgts:true});
  add(P,'R02','Aviso prévio indenizado',avisoDias+' dias',avisoValor,{inss:false,irrf:false,fgts:true});
  add(P,'R03','13º salário proporcional',avos13+'/12',v13,{inss:true,irrf:true,fgts:true,separado13:true});
  add(P,'R04','Férias vencidas',venc+' período(s)',feriasVenc,{inss:false,irrf:false,fgts:false});
  add(P,'R05','1/3 sobre férias vencidas',' ',tercoVenc,{inss:false,irrf:false,fgts:false});
  add(P,'R06','Férias proporcionais',avosF+'/12',feriasProp,{inss:false,irrf:false,fgts:false});
  add(P,'R07','1/3 sobre férias proporcionais',' ',tercoProp,{inss:false,irrf:false,fgts:false});
  // descontos legais
  const inssSaldo=inssFolha(saldo,AN),irSaldo=saldo>0?r2f(carneLeao(saldo,inssSaldo+(emp.dependentes||0)*T.depIR).devido):0;
  const inss13=v13>0?inssFolha(v13,AN):0,ir13=v13>0?irrf13(v13,inss13,emp.dependentes||0,T):0;
  add(D,'D01','INSS sobre saldo de salário',' ',inssSaldo);add(D,'D02','IRRF sobre saldo de salário',' ',irSaldo);
  add(D,'D03','INSS sobre 13º',' ',inss13);add(D,'D04','IRRF sobre 13º',' ',ir13);
  add(D,'D05','Aviso prévio não cumprido',' ',avisoDesconto);
  if(+(o.parcela13Paga||0)>0)add(D,'D06','Adiantamento do 13º já pago',' ',+o.parcela13Paga);
  const totP=r2f(P.reduce((x,y)=>x+y.valor,0)),totD=r2f(D.reduce((x,y)=>x+y.valor,0)),liquido=r2f(totP-totD);
  if(liquido<0)return {ok:false,erros:['líquido negativo: os descontos passam das verbas; revisar (aviso não cumprido e adiantamentos)']};
  // FGTS: depósito sobre as verbas que incidem; multa e saque pelo saldo
  const baseFgts=saldo+avisoValor+v13,dep=r2f(baseFgts*(emp.fgtsAliq!=null?+emp.fgtsAliq:T.fgts));
  const multaPct=tipo==='sem_justa_causa'?.4:tipo==='acordo'?.2:0,saqPct=tipo==='sem_justa_causa'||tipo==='termino_contrato'?1:tipo==='acordo'?.8:0;
  const multa=r2f((sg+dep)*multaPct);
  // prazo: 10 dias da comunicação do aviso indenizado, da saída (aviso trabalhado) ou do término do contrato (CLT art. 477 §6º)
  const vencimento=isoR(new Date(parseIsoR(o.saida).getTime()+10*86400000));
  const alertas=[];if(venc>1)alertas.push('mais de um período de férias vencido: pode haver pagamento em dobro (CLT art. 137); o contador confere');
  if(jc)alertas.push('justa causa: confirme a falta grave e a prova; erro aqui gera reversão e indenização');
  if(tipo==='acordo')alertas.push('acordo (art. 484-A): sem seguro-desemprego e saque de 80% do FGTS; registrar o acordo por escrito');
  if(anos<1&&tipo!=='termino_contrato')alertas.push('menos de 1 ano de contrato: as férias proporcionais são devidas (Súmula 261 do TST)');
  return {ok:true,tipo,anosCompletos:anos,avos13,avosFerias:avosF,avisoDias,proventos:P,descontos:D,totalProventos:totP,totalDescontos:totD,liquido,
    fgts:{deposito:dep,multa,multaPct,saquePct:saqPct,saqueEstimado:r2f((sg+dep)*saqPct)},vencimento,projecaoAte:fim,notas:nota,alertas,
    aviso:'Estimativa; o contador confere cada rescisão e o advogado trabalhista revisa as primeiras. O termo de rescisão (TRCT) oficial é gerado a partir destes valores.'}}


// Multa do art. 477 §8º da CLT: se as verbas rescisórias passarem do prazo (vencimento da rescisão), a multa é de um salário do empregado. Fonte: resumo de acórdãos (TRT-3/TST); o texto do artigo no Planalto NÃO foi aberto: o contador/advogado confere. Datas em aaaa-mm-dd.
function multaAtraso477(salario,vencimento,pagamento){const atrasou=!!(vencimento&&pagamento&&pagamento>vencimento);return {atrasou,multa:atrasou?r2f(+salario||0):0,fonte:'CLT art. 477 §8º (a conferir no texto oficial)'}}
if(typeof module!=='undefined')module.exports={TABELAS_FOLHA,tabelaFolha,inssFolha,calculaFolha,holeriteHTML,direitoFerias,fracionamentoOk,prazosFerias,calculaFerias,calculaDecimoTerceiro,irrf13,inssFolhaTruncado,definirModoINSS,modoINSS,calculaProLabore,calculaRescisao,multaAtraso477,anosCompletos,avos13Rescisao,avosFeriasRescisao,TIPOS_RESCISAO};
