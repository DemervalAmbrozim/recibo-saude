// Folha: verbas especiais e tipos de vínculo (26/11/2026, folha completa).
// Carregar DEPOIS de regras.js e folha.js (usa tabelaFolha, inssFolha, calculaFolha, calculaFerias, calculaDecimoTerceiro, irrf13, carneLeao).
// ESTIMATIVA até o contador conferir (folha sombra). Regra legal que a lei deixa em aberto vira PARÂMETRO e leva a marca [CONFERIR COM O DANIEL].
// Cada função devolve {ok, ..., alertas[], fonte}. Nada aqui paga, transmite ou grava: só calcula.
// Vigência das tabelas: tabelaFolha(ano) (folha.js). Valores em reais com 2 casas.

const r2x=x=>Math.round((+x+Number.EPSILON)*100)/100;
const falhaX=(...erros)=>({ok:false,erros});

// ===== 1. Adicionais de insalubridade e periculosidade
// Insalubridade: CLT art. 192: 10% (mínimo), 20% (médio) ou 40% (máximo) sobre o SALÁRIO MÍNIMO, salvo convenção/acordo que fixe outra base
// [CONFERIR COM O DANIEL: Súmula Vinculante 4 do STF veda usar o salário mínimo como indexador, mas o TST mantém o mínimo até lei nova; confira a convenção do sindicato].
// Periculosidade: CLT art. 193 §1º: 30% sobre o salário-base, sem gratificações, prêmios ou participação nos lucros.
// Não se acumulam: o empregado opta pelo mais favorável (CLT art. 193 §2º). Grau e enquadramento dependem de LAUDO (NR-15 e NR-16): o sistema não decide o grau.
const GRAUS_INSALUB={minimo:.10,medio:.20,maximo:.40};
function adicionalInsalubridade(grau,o={},ano=2026){
  const pct=GRAUS_INSALUB[grau];if(!pct)return falhaX("grau de insalubridade deve ser 'minimo' (10%), 'medio' (20%) ou 'maximo' (40%), conforme o laudo");
  const T=tabelaFolha(ano),base=o.base==='salario'?+o.salario:(+o.base>0?+o.base:T.sm);
  if(!(base>0))return falhaX('base do adicional inválida');
  return {ok:true,tipo:'insalubridade',grau,pct,base:r2x(base),valor:r2x(base*pct),fonte:'CLT art. 192 (laudo NR-15)',
    provento:{cod:'060',desc:'Adicional de insalubridade '+Math.round(pct*100)+'%',ref:' ',valor:r2x(base*pct),inss:true,irrf:true,fgts:true},
    alertas:['Grau definido por laudo técnico (NR-15); sem laudo, não pagar nem deixar de pagar por estimativa.','Base padrão: salário mínimo. [CONFERIR COM O DANIEL] se a convenção coletiva fixa outra base.']}}
function adicionalPericulosidade(salario,o={}){
  const S=+salario;if(!(S>0))return falhaX('salário inválido');const pct=o.pct>0?+o.pct:.30;
  return {ok:true,tipo:'periculosidade',pct,base:r2x(S),valor:r2x(S*pct),fonte:'CLT art. 193 §1º (laudo NR-16)',
    provento:{cod:'061',desc:'Adicional de periculosidade '+Math.round(pct*100)+'%',ref:' ',valor:r2x(S*pct),inss:true,irrf:true,fgts:true},
    alertas:['Atividade perigosa definida por laudo (NR-16). [CONFERIR COM O DANIEL] se a radiação ionizante (radiologia, odontologia) se enquadra no caso.']}}
// O empregado não recebe os dois: devolve o mais favorável e avisa.
function escolheAdicional(ins,per){
  if(ins&&ins.ok&&per&&per.ok){const m=ins.valor>=per.valor?ins:per;return {...m,alertas:(m.alertas||[]).concat(['Insalubridade e periculosidade não se acumulam (CLT art. 193 §2º): foi usado o mais favorável ao empregado ('+m.tipo+'); o empregado pode optar por escrito.'])}}
  return ins&&ins.ok?ins:per&&per.ok?per:null}

// ===== 2. Pensão alimentícia (desconto judicial)
// Fonte do valor: SEMPRE a sentença/ofício ou acordo homologado. A base (bruto, líquido, salário mínimo) varia: é parâmetro. [CONFERIR COM O DANIEL em cada ofício.]
// A pensão paga conforme decisão judicial é DEDUTÍVEL da base do IRRF (usa emp.deducaoIRRFExtra de calculaFolha).
// base 'liquido' = rendimento líquido depois de INSS e IRRF (o IRRF já considera a própria pensão: resolvido por iteração).
function pensaoValor(p,r){
  if(p.tipo==='valor_fixo')return r2x(p.valor);
  if(p.tipo==='percentual_sm')return r2x(tabelaFolha(r.ano).sm*p.percentual);
  if(p.tipo==='percentual_bruto')return r2x(r.bruto*p.percentual);
  return r2x(Math.max(0,r.bruto-r.inss-r.irrf)*p.percentual)}
function validaPensao(p){
  if(!p||typeof p!=='object')return 'pensão inválida';
  if(!['valor_fixo','percentual_bruto','percentual_liquido','percentual_sm'].includes(p.tipo))return "tipo da pensão: 'valor_fixo', 'percentual_bruto', 'percentual_liquido' ou 'percentual_sm'";
  if(p.tipo==='valor_fixo'&&!(+p.valor>0))return 'informe o valor fixo da pensão';
  if(p.tipo!=='valor_fixo'&&!(+p.percentual>0&&+p.percentual<=.5))return 'percentual da pensão deve ficar entre 0 e 50% (acima disso, só com decisão que o justifique)';
  return null}

// ===== 3. Consignado: limite sobre a remuneração disponível
// Lei 10.820/2003 (consignado em folha): limite de 35% da remuneração disponível (parâmetro; a lei já mudou de percentual antes) [CONFERIR COM O DANIEL a vigência].
// Remuneração disponível = bruto menos descontos obrigatórios (INSS, IRRF, pensão judicial). Se a parcela passa do limite, desconta só até o limite e avisa o trabalhador.
function consignadoLimite(disp,parcela,limite=.35){
  const max=r2x(Math.max(0,disp)*limite),desc=r2x(Math.min(+parcela,max)),dif=r2x(+parcela-desc);
  return {disponivel:r2x(disp),limite,maximo:max,parcela:r2x(+parcela),desconto:desc,diferenca:dif,parcial:dif>0.004,
    aviso:dif>0.004?'Desconto parcial: a parcela passa de '+Math.round(limite*100)+'% da remuneração disponível. Diferença de R$ '+dif.toFixed(2).replace('.',',')+' não descontada; avisar o trabalhador e o banco.':''}}

// ===== 4. Adiantamento salarial
// Adiantamento é antecipação do salário do mês (CLT art. 462 permite descontar adiantamento). Percentual é combinado ou da convenção (parâmetro, padrão 40%).
// Regra comum (fonte: curso de DP, [CONFERIR COM O DANIEL]): se a folha é paga até o fim do mês, o adiantamento não tem IR próprio (tributa-se tudo na folha).
// Se a folha é paga no mês seguinte, o adiantamento avulso exige retenção de IRRF: o sistema calcula bruto a partir do líquido e depois credita o IR já retido.
function adiantamentoValor(salario,o={}){
  const pct=o.percentual>0?+o.percentual:.40,v=o.valor>0?+o.valor:+salario*pct;
  if(!(+salario>0))return falhaX('salário inválido');
  if(v>+salario)return falhaX('adiantamento maior que o salário');
  return {ok:true,valor:r2x(v),percentual:o.valor>0?null:pct}}
function adiantamentoAvulsoPorLiquido(liquido,ano=2026){
  const L=+liquido;if(!(L>0))return falhaX('líquido inválido');
  const ir=b=>carneLeao(b,0).devido;let lo=L,hi=L*2+1000;
  for(let i=0;i<80;i++){const m=(lo+hi)/2;if(m-ir(m)<L)lo=m;else hi=m}
  const B=r2x((lo+hi)/2),I=r2x(ir(B));return {ok:true,liquido:r2x(L),bruto:B,irrf:I,aviso:'Cálculo reverso do IRRF do adiantamento avulso (sem INSS, sem dedução). [CONFERIR COM O DANIEL] a regra de retenção.'}}

// ===== 5. Folha completa: encaixa adicionais, retroativo, pensão, consignado e adiantamento em calculaFolha
// opc: {adicional:{grau}|{periculosidade:true}|{ins,per}, pensao:{tipo,valor|percentual}, consignado:{parcela,limite}, adiantamento:{valor|percentual,irRetido}, retroativo:resultado de calculaRetroativo, params}
function calculaFolhaCompleta(emp,mov={},ano=2026,opc={}){
  const alertas=[],P0=opc.params||{},extra=[];let ad=null;
  if(opc.adicional){
    const ins=opc.adicional.grau?adicionalInsalubridade(opc.adicional.grau,{base:P0.insalubridadeBase==='salario'?'salario':undefined,salario:emp.salario},ano):null;
    const per=opc.adicional.periculosidade?adicionalPericulosidade(emp.salario,{pct:P0.periculosidadePct}):null;
    ad=escolheAdicional(ins,per);
    if((ins&&!ins.ok)||(per&&!per.ok))return falhaX(...((ins&&ins.erros)||[]),...((per&&per.erros)||[]));
    if(ad){extra.push(ad.provento);alertas.push(...ad.alertas)}}
  if(opc.retroativo){if(!opc.retroativo.ok)return falhaX(...opc.retroativo.erros);extra.push(...opc.retroativo.proventosFolha);alertas.push(...opc.retroativo.alertas)}
  const emp2={...emp};if(emp.tipoVinculo==='aprendiz'&&emp2.fgtsAliq==null)emp2.fgtsAliq=P0.fgtsAprendiz>0?P0.fgtsAprendiz:.02;
  const mov2={...mov,outrosProventos:(mov.outrosProventos||[]).concat(extra)};
  const modoAnterior=modoINSS();if(P0.modoINSS)definirModoINSS(P0.modoINSS);
  try{
    let r=calculaFolha(emp2,mov2,ano);if(!r.ok)return r;
    let pensao=null;
    if(opc.pensao){
      const e=validaPensao(opc.pensao);if(e)return falhaX(e);
      let P=0;for(let i=0;i<40;i++){r=calculaFolha({...emp2,deducaoIRRFExtra:P},mov2,ano);if(!r.ok)return r;const nP=pensaoValor(opc.pensao,r);if(Math.abs(nP-P)<0.005){P=nP;break}P=nP}
      r=calculaFolha({...emp2,deducaoIRRFExtra:P},mov2,ano);if(!r.ok)return r;
      pensao={tipo:opc.pensao.tipo,percentual:opc.pensao.percentual||null,valor:P};
      r.descontos.push({cod:'140',desc:'Pensão alimentícia (judicial)',ref:opc.pensao.tipo==='valor_fixo'?' ':Math.round((opc.pensao.percentual||0)*1000)/10+'%',valor:P});
      alertas.push('Pensão alimentícia deduzida da base do IRRF (desconto judicial). Conferir o ofício: base (bruto/líquido/salário mínimo) e se incide sobre férias e 13º. [CONFERIR COM O DANIEL]')}
    let consignado=null;
    if(opc.consignado&&+opc.consignado.parcela>0){
      const disp=r.bruto-r.inss-r.irrf-(pensao?pensao.valor:0);
      consignado=consignadoLimite(disp,opc.consignado.parcela,opc.consignado.limite>0?opc.consignado.limite:(P0.limiteConsignado>0?P0.limiteConsignado:.35));
      if(consignado.desconto>0)r.descontos.push({cod:'141',desc:'Empréstimo consignado',ref:' ',valor:consignado.desconto});
      if(consignado.parcial){r.informativos=(r.informativos||[]).concat([{cod:'941',desc:'Consignado não descontado (limite)',valor:consignado.diferenca}]);alertas.push(consignado.aviso)}}
    let adiantamento=null;
    if(opc.adiantamento){
      const a=adiantamentoValor(emp.salario,{percentual:opc.adiantamento.percentual||P0.adiantamentoPct,valor:opc.adiantamento.valor});if(!a.ok)return a;
      adiantamento={valor:a.valor,irRetido:0};
      r.descontos.push({cod:'150',desc:'Adiantamento salarial',ref:a.percentual?Math.round(a.percentual*100)+'%':' ',valor:a.valor});
      if(opc.adiantamento.irRetido>0){adiantamento.irRetido=r2x(opc.adiantamento.irRetido);r.descontos.push({cod:'151',desc:'IRRF já retido no adiantamento (crédito)',ref:' ',valor:-adiantamento.irRetido});alertas.push('Adiantamento avulso com IRRF retido: o crédito foi abatido do IRRF da folha. [CONFERIR COM O DANIEL]')}}
    if(opc.retroativo&&opc.retroativo.irrfRRA>0)r.descontos.push({cod:'122',desc:'IRRF sobre rendimentos acumulados (RRA)',ref:' ',valor:opc.retroativo.irrfRRA});
    if(opc.retroativo&&opc.retroativo.inssRetroativo>0)r.descontos.push({cod:'112',desc:'INSS do retroativo (por competência)',ref:' ',valor:opc.retroativo.inssRetroativo});
    r.totalDescontos=r2x(r.descontos.reduce((s,x)=>s+x.valor,0));r.liquido=r2x(r.totalProventos-r.totalDescontos);
    if(r.liquido<0)return falhaX('líquido negativo: pensão, consignado e adiantamento passam das verbas; revisar os lançamentos');
    return {...r,adicional:ad,pensao,consignado,adiantamento,alertas}
  }finally{definirModoINSS(modoAnterior)}}

// ===== 6. Estagiário (Lei 11.788/2008)
// Sem vínculo de emprego (art. 3º): sem INSS patronal, sem FGTS, sem 13º. Bolsa e auxílio-transporte são obrigatórios no estágio NÃO obrigatório (art. 12).
// Recesso de 30 dias a cada 12 meses, remunerado quando há bolsa e proporcional se o estágio dura menos de 1 ano (art. 13). Seguro contra acidentes obrigatório (art. 9º IV).
// Jornada (art. 10): 4 h/dia e 20 h/semana (educação especial e anos finais do fundamental); 6 h/dia e 30 h/semana (ensino médio, superior, profissional).
// Duração máxima de 2 anos na mesma empresa, exceto pessoa com deficiência (art. 11). Cota (art. 17): 1 a 5 empregados: 1 estagiário; 6 a 10: até 2; 11 a 25: até 5; acima de 25: até 20%.
// IRRF sobre a bolsa: tabela mensal, sem dedução de INSS [CONFERIR COM O DANIEL: bolsa de estágio é rendimento tributável; confirme a regra atual].
const LIM_JORNADA_ESTAGIO={especial:[4,20],fundamental_final:[4,20],medio:[6,30],superior:[6,30],profissional:[6,30]};
function cotaEstagiarios(empregados){const n=+empregados;if(!(n>=1))return 0;if(n<=5)return 1;if(n<=10)return 2;if(n<=25)return 5;return Math.floor(n*.20)}
function mesesCompletos(ini,fim){const a=String(ini).split('-').map(Number),b=String(fim).split('-').map(Number);let m=(b[0]-a[0])*12+(b[1]-a[1]);if(b[2]<a[2])m--;return Math.max(0,m)}
function recessoEstagio(meses){return meses>=12?30:r2x(30/12*Math.max(0,meses))}
function calculaEstagiario(est,mov={},ano=2026,ctx={}){
  const erros=[],alertas=[],T=tabelaFolha(ano),B=+est.bolsa;
  if(!(B>0))erros.push('informe a bolsa-auxílio');
  const lim=LIM_JORNADA_ESTAGIO[est.nivel];if(!lim)erros.push("nível do estágio: 'especial', 'fundamental_final', 'medio', 'superior' ou 'profissional'");
  if(lim&&est.jornadaDiariaH>lim[0])erros.push('jornada diária de '+est.jornadaDiariaH+' h acima do limite de '+lim[0]+' h (Lei 11.788 art. 10)');
  if(lim&&est.jornadaSemanalH>lim[1])erros.push('jornada semanal de '+est.jornadaSemanalH+' h acima do limite de '+lim[1]+' h (Lei 11.788 art. 10)');
  if(est.inicioContrato&&ctx.dataRef){const m=mesesCompletos(est.inicioContrato,ctx.dataRef);if(m>24&&!est.pcd)erros.push('estágio com mais de 2 anos na mesma empresa (Lei 11.788 art. 11), salvo pessoa com deficiência');}
  if(ctx.totalEmpregados!=null&&ctx.estagiariosAtivos!=null){const c=cotaEstagiarios(ctx.totalEmpregados);if(ctx.estagiariosAtivos>c)erros.push('acima da cota de estagiários: '+c+' para '+ctx.totalEmpregados+' empregado(s) (Lei 11.788 art. 17)')}
  const m={faltasDias:0,diasRecesso:0,...mov};if(!(m.faltasDias>=0&&m.faltasDias<=31))erros.push('faltas inválidas');
  if(erros.length)return falhaX(...erros);
  const dep=(est.dependentes||0)*T.depIR,P=[],D=[],add=(L,cod,desc,ref,v)=>{v=r2x(v);if(v!==0)L.push({cod,desc,ref,valor:v})};
  add(P,'201','Bolsa-auxílio',' ',B);
  const falta=B/30*m.faltasDias;add(D,'202','Faltas injustificadas',m.faltasDias+' dias',falta);
  const baseIR=Math.max(0,B-falta),ir=baseIR>0?r2x(carneLeao(baseIR,dep).devido):0;add(D,'203','IRRF sobre a bolsa',' ',ir);
  add(P,'204','Auxílio-transporte (não tributável)',' ',+est.auxTransporte||0);
  const totP=r2x(P.reduce((s,x)=>s+x.valor,0)),totD=r2x(D.reduce((s,x)=>s+x.valor,0));
  const meses=est.inicioContrato&&ctx.dataRef?mesesCompletos(est.inicioContrato,ctx.dataRef):null;
  const seguro=+est.seguroMensal||0,custo=r2x(totP+seguro+B/12);
  alertas.push('Recesso de 30 dias a cada 12 meses de estágio, remunerado e proporcional se menor que 1 ano (art. 13).');
  alertas.push('Sem INSS, FGTS e 13º (sem vínculo, art. 3º). Termo de compromisso e seguro de acidentes pessoais são obrigatórios.');
  if(!seguro)alertas.push('Informe o valor mensal do seguro de acidentes pessoais (apólice) para o custo ficar completo.');
  alertas.push('IRRF da bolsa pela tabela mensal [CONFERIR COM O DANIEL].');
  return {ok:true,tipo:'estagiario',ano,proventos:P,descontos:D,totalProventos:totP,totalDescontos:totD,liquido:r2x(totP-totD),irrf:ir,inss:0,fgts:0,
    recessoDiasDireito:meses==null?null:recessoEstagio(meses),custoMensal:custo,cotaMaxima:ctx.totalEmpregados!=null?cotaEstagiarios(ctx.totalEmpregados):null,alertas,
    aviso:'Estimativa; o contador confere antes de qualquer pagamento.'}}

// ===== 5-B. Férias e 13º completos: pensão alimentícia e médias do histórico
// A pensão por PERCENTUAL do ofício vale também sobre férias e 13º (o ofício diz a base: bruto ou líquido). Pensão de VALOR FIXO e % do salário mínimo valem só na folha mensal: aqui não são aplicadas e o resultado avisa.
// [CONFERIR COM O DANIEL em cada ofício.] A pensão é dedutível da base do IRRF: resolvida por iteração (usa emp.deducaoIRRFExtra).
function comPensaoEventual(emp,pensao,calc,baseDe,liquidoDe){
  let r=calc(emp);if(!r.ok||!pensao)return r;
  const e=validaPensao(pensao);if(e)return falhaX(e);
  if(pensao.tipo==='valor_fixo'||pensao.tipo==='percentual_sm')return {...r,pensao:null,alertas:(r.alertas||[]).concat(['Pensão de valor fixo ou em % do salário mínimo não foi aplicada: vale só na folha mensal. Confirme no ofício se incide aqui. [CONFERIR COM O DANIEL]'])};
  let P=0;for(let i=0;i<40;i++){r=calc({...emp,deducaoIRRFExtra:P});if(!r.ok)return r;const nP=r2x((pensao.tipo==='percentual_bruto'?baseDe(r):liquidoDe(r))*pensao.percentual);if(Math.abs(nP-P)<0.005){P=nP;break}P=nP}
  r=calc({...emp,deducaoIRRFExtra:P});if(!r.ok)return r;
  return {...r,pensao:{tipo:pensao.tipo,percentual:pensao.percentual,valor:P},liquidoAposPensao:r2x(r.liquido-P),alertas:(r.alertas||[]).concat(['Pensão alimentícia de '+Math.round(pensao.percentual*1000)/10+'% aplicada sobre esta verba e deduzida do IRRF. [CONFERIR COM O DANIEL] a base no ofício.'])}}
function calculaFeriasCompleta(emp,o,ano=2026,opc={}){
  let oo=o,medias=null;
  if(opc.historico){medias=mediasVariaveis(opc.historico,opc.opMedia||{});if(!medias.ok)return medias;oo={...o,mediaVariaveis:medias.media}}
  const e2=emp.tipoVinculo==='aprendiz'&&emp.fgtsAliq==null?{...emp,fgtsAliq:.02}:emp;
  const r=comPensaoEventual(e2,opc.pensao,x=>calculaFerias(x,oo,ano),x=>x.bruto,x=>x.bruto-x.inss-x.irrf);
  return medias&&r.ok?{...r,medias}:r}
function calculaDecimoCompleto(emp,o,ano=2026,opc={}){
  let oo=o,medias=null;
  if(opc.historico){medias=mediasVariaveis(opc.historico,opc.opMedia||{});if(!medias.ok)return medias;oo={...o,mediaVariaveis:medias.media}}
  const e2=emp.tipoVinculo==='aprendiz'&&emp.fgtsAliq==null?{...emp,fgtsAliq:.02}:emp;
  const r=comPensaoEventual(e2,opc.pensao,x=>calculaDecimoTerceiro(x,oo,ano),x=>x.total,x=>x.total-x.parcela2.inss-x.parcela2.irrf);
  if(r.ok&&r.pensao)r.liquidoAposPensao=r2x(r.parcela1.liquido+r.parcela2.liquido-r.pensao.valor);
  return medias&&r.ok?{...r,medias}:r}

// Fim do estágio (rescisão do termo de compromisso): saldo da bolsa dos dias trabalhados e RECESSO PROPORCIONAL não gozado (Lei 11.788 art. 13 §2º). Sem aviso prévio, sem multa de FGTS, sem 13º.
// o: {saidaDia (1 a 31, dia do desligamento), diasMes, diasRecessoGozados}. IRRF pela tabela mensal sobre saldo + recesso [CONFERIR COM O DANIEL].
function rescisaoEstagiario(est,o,ano=2026,ctx={}){
  const erros=[],T=tabelaFolha(ano),B=+est.bolsa,dm=+(o.diasMes||30),sd=+o.saidaDia;
  if(!(B>0))erros.push('informe a bolsa-auxílio');if(!(sd>=1&&sd<=dm))erros.push('dia da saída deve ficar entre 1 e '+dm);
  if(!est.inicioContrato||!ctx.dataSaida)erros.push('informe o início do estágio e a data de saída');
  if(erros.length)return falhaX(...erros);
  const meses=mesesCompletos(est.inicioContrato,ctx.dataSaida),direito=recessoEstagio(meses),gozados=+o.diasRecessoGozados||0,aGozar=r2x(Math.max(0,direito-gozados));
  const saldo=r2x(B/30*sd),recesso=r2x(B/30*aGozar),total=r2x(saldo+recesso),ir=total>0?r2x(carneLeao(total,(est.dependentes||0)*T.depIR).devido):0;
  const P=[{cod:'201',desc:'Saldo da bolsa',ref:sd+' dias',valor:saldo},{cod:'205',desc:'Recesso proporcional não gozado',ref:aGozar+' dias',valor:recesso}].filter(x=>x.valor>0),D=ir>0?[{cod:'203',desc:'IRRF',valor:ir}]:[];
  return {ok:true,tipo:'rescisao_estagiario',ano,mesesEstagio:meses,recessoDireito:direito,recessoGozado:gozados,recessoAGozar:aGozar,proventos:P,descontos:D,totalProventos:total,totalDescontos:ir,liquido:r2x(total-ir),irrf:ir,inss:0,fgts:0,
    alertas:['Sem aviso prévio, multa de FGTS ou 13º (estágio não gera vínculo).','Entregar ao estagiário o termo de realização do estágio, com período e atividades (Lei 11.788 art. 9º, V). [CONFERIR COM O DANIEL] o artigo e o modelo.','IRRF pela tabela mensal. [CONFERIR COM O DANIEL]'],aviso:'Estimativa; o contador confere antes do pagamento.'}}

// ===== 7. Aprendiz (CLT arts. 428 a 433)
// Contrato por prazo determinado de até 2 anos, exceto pessoa com deficiência (art. 428 §3º); idade de 14 a 24 anos, sem limite para PcD (art. 428).
// Jornada de até 6 h/dia (30 h/semana) para quem não concluiu o fundamental; até 8 h/dia (40 h/semana) para quem concluiu, contando as horas de aula teórica; vedadas prorrogação e compensação (art. 432).
// Salário: salário mínimo-hora × horas trabalhadas, salvo condição mais favorável (Decreto 9.579/2018). FGTS de 2% (Lei 8.036/1990 art. 15 §7º). INSS, 13º e VT como o empregado comum.
// Cota de aprendizes (art. 429, 5% a 15% da função que exige formação) NÃO se aplica a microempresa e empresa de pequeno porte [CONFERIR COM O DANIEL: Lei 9.841/1999 e Decreto 9.579 art. 54].
function calculaAprendiz(emp,mov={},ano=2026){
  const erros=[],alertas=[],T=tabelaFolha(ano),h=+emp.horasSemanais;
  if(!(h>0))erros.push('informe as horas semanais');
  const idade=+emp.idade;if(!(idade>=14))erros.push('aprendiz precisa ter 14 anos ou mais');
  if(idade>24&&!emp.pcd)erros.push('aprendiz com mais de 24 anos só se pessoa com deficiência (art. 428)');
  const dMax=emp.fundamentalConcluido?8:6,sMax=emp.fundamentalConcluido?40:30;
  if(h>sMax)erros.push('jornada semanal de '+h+' h acima do limite de '+sMax+' h (art. 432)');
  if(+emp.horasDia>dMax)erros.push('jornada diária de '+emp.horasDia+' h acima do limite de '+dMax+' h (art. 432)');
  if((+mov.heNormais||0)+(+mov.heDescanso||0)>0)erros.push('aprendiz: prorrogação e compensação de jornada são vedadas (art. 432); não lançar hora extra');
  if(emp.admissao&&emp.fimContrato&&mesesCompletos(emp.admissao,emp.fimContrato)>24&&!emp.pcd)erros.push('contrato de aprendizagem acima de 2 anos (art. 428 §3º)');
  const minimo=h>0?r2x(T.sm*h/44):0;
  if(h>0&&+emp.salario<minimo)erros.push('salário abaixo do mínimo-hora × jornada: mínimo de R$ '+minimo.toFixed(2).replace('.',',')+' para '+h+' h/semana');
  if(erros.length)return falhaX(...erros);
  const r=calculaFolhaCompleta({...emp,divisor:h*5,tipoVinculo:'aprendiz',fgtsAliq:.02,jornadaParcial:true},mov,ano,{});
  if(!r.ok)return r;
  alertas.push('FGTS de 2% (Lei 8.036 art. 15 §7º). Contrato por prazo determinado; férias coincidem com as férias escolares (CLT art. 136 §2º).');
  alertas.push('Cota de aprendizes não vale para ME e EPP [CONFERIR COM O DANIEL].');
  return {...r,tipo:'aprendiz',minimoSalario:minimo,alertas:(r.alertas||[]).concat(alertas)}}

// ===== 8. Trabalho intermitente (CLT art. 443 §3º e 452-A)
// Pagamento ao FIM de cada período de convocação: remuneração, férias proporcionais com 1/3, 13º proporcional, repouso semanal remunerado e adicionais (art. 452-A §6º).
// Valor-hora nunca abaixo do salário mínimo-hora nem do valor pago aos demais empregados da função (art. 452-A). Convocação com 3 dias corridos de antecedência; resposta em 1 dia útil;
// multa de 50% da remuneração para quem descumpre sem motivo (art. 452-A §§1º a 4º). FGTS e INSS sobre as parcelas pagas (art. 452-A §8º).
// RSR: padrão = (remuneração ÷ dias úteis) × dias de descanso, como no horista; pode vir embutido no valor-hora (rsrEmbutido) [CONFERIR COM O DANIEL].
function calculaIntermitente(emp,conv,ano=2026){
  const erros=[],T=tabelaFolha(ano),vh=+emp.valorHora,horas=+conv.horas;
  if(!(vh>0))erros.push('informe o valor-hora');if(!(horas>0))erros.push('informe as horas trabalhadas na convocação');
  const vhMin=r2x(T.sm/220);if(vh>0&&vh<vhMin)erros.push('valor-hora abaixo do salário mínimo-hora (R$ '+vhMin.toFixed(2).replace('.',',')+')');
  if(emp.valorHoraPares>0&&vh<emp.valorHoraPares)erros.push('valor-hora abaixo do pago aos demais empregados da função (art. 452-A)');
  const du=+(conv.diasUteis||25),dd=+(conv.diasDescanso||5);
  if(erros.length)return falhaX(...erros);
  const rem=r2x(horas*vh),rsr=emp.rsrEmbutido?0:r2x(rem/du*dd),ferias=r2x((rem+rsr)/12),terco=r2x(ferias/3),d13=r2x((rem+rsr)/12);
  const baseMensal=r2x(rem+rsr+ferias+terco),inss=inssFolha(baseMensal,ano),inss13=inssFolha(d13,ano);
  const ir=r2x(carneLeao(baseMensal,inss+(emp.dependentes||0)*T.depIR).devido),ir13=irrf13(d13,inss13,emp.dependentes||0,T);
  const bruto=r2x(baseMensal+d13),fgts=r2x(bruto*T.fgts),liquido=r2x(bruto-inss-inss13-ir-ir13);
  const P=[{cod:'301',desc:'Horas trabalhadas',ref:horas+' h',valor:rem},{cod:'302',desc:'Repouso semanal remunerado',ref:' ',valor:rsr},{cod:'303',desc:'Férias proporcionais',ref:'1/12',valor:ferias},{cod:'304',desc:'1/3 de férias',ref:' ',valor:terco},{cod:'305',desc:'13º proporcional',ref:'1/12',valor:d13}].filter(x=>x.valor>0);
  const D=[{cod:'110',desc:'INSS',valor:inss},{cod:'111',desc:'INSS sobre o 13º',valor:inss13},{cod:'120',desc:'IRRF',valor:ir},{cod:'121',desc:'IRRF sobre o 13º',valor:ir13}].filter(x=>x.valor>0);
  return {ok:true,tipo:'intermitente',ano,proventos:P,descontos:D,bruto,inss,inss13,irrf:ir,irrf13:ir13,fgts,liquido,totalProventos:bruto,totalDescontos:r2x(inss+inss13+ir+ir13),
    alertas:['Pagamento ao fim da convocação, com todas as parcelas (art. 452-A §6º). Registrar convocação (3 dias corridos), aceite (1 dia útil) e o contrato por escrito.','Multa de 50% da remuneração por descumprimento sem motivo (art. 452-A §4º).','RSR calculado como no horista; confirme a prática do escritório. [CONFERIR COM O DANIEL]'],
    aviso:'Estimativa; o contador confere antes de qualquer pagamento ou envio ao eSocial.'}}

// ===== 8-B. Rendimentos recebidos acumuladamente (RRA), Lei 7.713/1988 art. 12-A
// Vale para rendimento de AÇÃO JUDICIAL pago de uma vez. Base = rendimento − despesas da ação (custas, honorários) − INSS − pensão alimentícia.
// Divide-se a base pelo número de meses (NM), aplica-se a tabela progressiva MENSAL ao valor de 1 mês e multiplica-se o imposto por NM.
// Sem desconto simplificado e sem dedução de dependentes aqui. [CONFERIR COM O DANIEL: a redução da Lei 15.270/2025 e os dependentes no RRA; o texto de 12-A e a IN RFB vigente.]
function calculaRRA(o){
  const erros=[],R=+o.rendimentos,NM=+o.meses;
  if(!(R>0))erros.push('informe o rendimento acumulado');if(!(NM>=1&&Number.isInteger(NM)))erros.push('informe o número de meses (inteiro, 1 ou mais)');
  const ded=(+o.despesasAcao||0)+(+o.inss||0)+(+o.pensao||0);if(ded<0||ded>R)erros.push('deduções maiores que o rendimento');
  if(erros.length)return falhaX(...erros);
  const base=r2x(R-ded),mensal=base/NM,[,al,pd]=TAB.find(f=>mensal<=f[0]),irMes=Math.max(0,mensal*al-pd),ir=r2x(irMes*NM);
  return {ok:true,rendimentos:r2x(R),deducoes:r2x(ded),base,meses:NM,baseMensal:r2x(mensal),aliquota:al,irrf:ir,aliquotaEfetiva:R>0?r2x(ir/R*100):0,fonte:'Lei 7.713/1988 art. 12-A',
    alertas:['IRRF calculado como rendimento recebido acumuladamente (RRA), só para ação judicial. [CONFERIR COM O DANIEL] a redução da Lei 15.270 e dependentes.']}}

// ===== 9. Retroativo e dissídio (diferença salarial paga depois)
// Calcula, mês a mês, a diferença entre o salário novo e o que foi pago; reflexos de 13º (1/12) e férias com 1/3 (1/12 × 4/3) sobre a diferença; FGTS de 8% sobre tudo.
// INSS: apurado POR COMPETÊNCIA (diferença entre o INSS com o salário novo e o que foi recolhido, respeitando o teto de cada mês).
// IRRF: pago no mês do pagamento, junto da folha (regime de caixa). Se a diferença vier de AÇÃO JUDICIAL, pode valer o cálculo de rendimentos acumulados (RRA); NÃO implementado: [CONFERIR COM O DANIEL].
// Os dados do processo/acordo (homologação, número, vara) vão ao eSocial; o sistema só exige que existam.
function calculaRetroativo(emp,r,ano=2026){
  const erros=[],T=tabelaFolha(ano);
  if(!(+r.salarioNovo>0))erros.push('informe o salário novo');
  if(!Array.isArray(r.meses)||!r.meses.length)erros.push('informe os meses (competências aaaa-mm) com o salário que foi pago em cada um');
  if(!r.motivo||!String(r.motivo).trim())erros.push('o motivo é obrigatório (acordo coletivo, dissídio, reajuste retroativo)');
  if(r.judicial&&!(r.processo&&r.processo.numero&&r.processo.vara&&r.processo.homologacao))erros.push('retroativo judicial: informe número, vara e data de homologação do processo (vão ao eSocial)');
  if(erros.length)return falhaX(...erros);
  const linhas=[];let dif=0,inssRetro=0;
  for(const m of r.meses){
    if(!m||!/^\d{4}-\d{2}$/.test(m.competencia||'')||!(+m.salarioPago>0))return falhaX('mês inválido: informe competência aaaa-mm e salarioPago');
    const d=r2x(+r.salarioNovo-+m.salarioPago);if(d<0)return falhaX('salário novo menor que o pago em '+m.competencia+': não é retroativo');
    const outras=+m.variaveis||0,iNovo=inssFolha(+r.salarioNovo+outras,ano),iVelho=inssFolha(+m.salarioPago+outras,ano),di=r2x(iNovo-iVelho);
    linhas.push({competencia:m.competencia,salarioPago:r2x(+m.salarioPago),salarioNovo:r2x(+r.salarioNovo),diferenca:d,inss:di});dif+=d;inssRetro+=di}
  dif=r2x(dif);inssRetro=r2x(inssRetro);
  const refl13=r2x(dif/12),reflFerias=r2x(dif/12*4/3),totalBruto=r2x(dif+refl13+reflFerias),fgts=r2x(totalBruto*T.fgts);
  let rra=null;
  if(r.judicial&&r.usarRRA){rra=calculaRRA({rendimentos:totalBruto,meses:+r.mesesRRA>0?+r.mesesRRA:linhas.length,despesasAcao:r.despesasAcao,inss:inssRetro,pensao:r.pensaoRRA});if(!rra.ok)return falhaX(...rra.erros)}
  return {ok:true,motivo:r.motivo,linhas,diferenca:dif,reflexo13:refl13,reflexoFerias:reflFerias,totalBruto,inssRetroativo:inssRetro,fgts,
    rra,irrfRRA:rra?rra.irrf:0,proventosFolha:[{cod:'070',desc:'Retroativo ('+r.motivo+')',ref:linhas.length+' mês(es)',valor:dif,inss:false,irrf:!rra,fgts:true},
      {cod:'071',desc:'Reflexo no 13º',ref:'1/12',valor:refl13,inss:false,irrf:!rra,fgts:true},{cod:'072',desc:'Reflexo nas férias + 1/3',ref:'1/12 + 1/3',valor:reflFerias,inss:false,irrf:!rra,fgts:true}].filter(x=>x.valor>0),
    alertas:['INSS do retroativo apurado por competência (R$ '+inssRetro.toFixed(2).replace('.',',')+'): vira linha própria de desconto na folha completa.',rra?'IRRF pelo cálculo de rendimentos acumulados (RRA), em desconto separado. [CONFERIR COM O DANIEL]':'IRRF no mês do pagamento. Retroativo judicial pode pedir rendimentos acumulados (RRA): marque usarRRA. [CONFERIR COM O DANIEL]'].concat(rra?rra.alertas:[]),
    aviso:'Estimativa; o contador confere antes de pagar ou enviar ao eSocial.'}}

// ===== 10. Médias de férias e 13º (CLT art. 142 §§ 3º a 5º; art. 130, 13º: Lei 4.090/1962)
// Horas extras e adicionais pagos por hora: média das QUANTIDADES do período × valor atual da hora. Comissões e valores variáveis: média dos VALORES do período.
// Período: 12 meses do aquisitivo (padrão); aceita 6 ou 3 para a empresa que adota. Meses sem lançamento contam como zero (divide pelo total do período).
// historico: [{competencia:'aaaa-mm', verbas:{codigo:{valor,qtd}}}] das verbas variáveis HABITUAIS. Resultado entra como mediaVariaveis de calculaFerias/calculaDecimoTerceiro.
function mediasVariaveis(historico,o={}){
  const meses=o.meses>0?+o.meses:12;if(!Array.isArray(historico))return falhaX('informe o histórico de verbas variáveis');
  const ordenado=historico.filter(h=>h&&/^\d{4}-\d{2}$/.test(h.competencia)).sort((a,b)=>a.competencia<b.competencia?1:-1).slice(0,meses);
  const porVerba={},unidade=o.valorAtualPorVerba||{};
  for(const h of ordenado)for(const [cod,v] of Object.entries(h.verbas||{})){const x=porVerba[cod]||(porVerba[cod]={somaValor:0,somaQtd:0,meses:0});x.somaValor+=+v.valor||0;x.somaQtd+=+v.qtd||0;x.meses++}
  const linhas=[];let total=0;
  for(const [cod,x] of Object.entries(porVerba)){
    const metodo=(o.metodoPorVerba&&o.metodoPorVerba[cod])||'valor',mediaValor=x.somaValor/meses,mediaQtd=x.somaQtd/meses;
    let media;if(metodo==='quantidade'){const vu=+unidade[cod];if(!(vu>0))return falhaX('verba '+cod+': para média por quantidade informe o valor atual da hora em valorAtualPorVerba');media=mediaQtd*vu}else media=mediaValor;
    media=r2x(media);total+=media;linhas.push({verba:cod,metodo,mesesComLancamento:x.meses,mediaQuantidade:r2x(mediaQtd),mediaValor:r2x(mediaValor),media})}
  return {ok:true,meses,mesesLidos:ordenado.length,linhas,media:r2x(total),
    alertas:ordenado.length<meses?['Histórico com '+ordenado.length+' de '+meses+' meses; meses sem registro contam como zero. Confirme se o empregado trabalhou o período inteiro. [CONFERIR COM O DANIEL]']:[],
    fonte:'CLT art. 142 §§ 3º a 5º; Lei 4.090/1962 (13º)'}}
function calculaFeriasComHistorico(emp,o,historico,opMedia={},ano=2026){
  const m=mediasVariaveis(historico,opMedia);if(!m.ok)return m;
  const f=calculaFerias(emp,{...o,mediaVariaveis:m.media},ano);if(!f.ok)return f;return {...f,medias:m}}
function calculaDecimoComHistorico(emp,o,historico,opMedia={},ano=2026){
  const m=mediasVariaveis(historico,opMedia);if(!m.ok)return m;
  const d=calculaDecimoTerceiro(emp,{...o,mediaVariaveis:m.media},ano);if(!d.ok)return d;return {...d,medias:m}}

// ===== 11. RPA: recibo de pagamento a autônomo (pessoa física sem vínculo)
// INSS do contribuinte individual: 11% sobre o valor, limitado ao teto da competência (Lei 10.666/2003 art. 4º; Lei 8.212/1991). Se já houve INSS em outra fonte no mês, desconta só até o teto.
// IRRF: tabela mensal progressiva com dedução do INSS e dependentes. ISS: retenção só se o município exigir; alíquota é do município (parâmetro).
// Parte da empresa: 20% sobre o valor pago (Lei 8.212 art. 22 III), EXCETO empresa do Simples nos Anexos I a III, em que a contribuição patronal já está no DAS [CONFERIR COM O DANIEL].
function calculaRPA(a,ano=2026){
  const erros=[],T=tabelaFolha(ano),V=+a.valor;if(!(V>0))erros.push('informe o valor do serviço');
  if(!a.cpf)erros.push('informe o CPF do autônomo');if(!a.nome)erros.push('informe o nome do autônomo');
  const iss=+a.aliquotaISS||0;if(iss<0||iss>.05)erros.push('alíquota de ISS deve ficar entre 0% e 5%');
  if(erros.length)return falhaX(...erros);
  const pI=a.inssPct>0?+a.inssPct:.11,sobra=Math.max(0,T.teto-(+a.inssOutrasFontes||0)),inss=r2x(Math.min(V,sobra)*pI);
  const ir=r2x(carneLeao(V,inss+(a.dependentes||0)*T.depIR).devido),issV=r2x(V*iss),liquido=r2x(V-inss-ir-issV);
  const patronal=a.anexoSimples&&['I','II','III'].includes(String(a.anexoSimples).toUpperCase())?0:r2x(V*.20);
  return {ok:true,tipo:'rpa',ano,valor:r2x(V),inss,irrf:ir,iss:issV,liquido,patronal,custoEmpresa:r2x(V+patronal),
    alertas:['INSS de 11% limitado ao teto ('+T.teto.toFixed(2).replace('.',',')+') menos o já recolhido em outras fontes.','ISS: alíquota e retenção são do município do serviço. [CONFERIR COM O DANIEL]','Contribuição patronal: Simples Anexos I a III já inclui no DAS. [CONFERIR COM O DANIEL]','Informar o pagamento no eSocial como contribuinte individual [CONFERIR COM O DANIEL o evento e a categoria].'],
    aviso:'Estimativa; o contador confere antes do pagamento.'}}

// ===== 12. Ficha financeira e informe de rendimentos do empregado
// Cada cálculo da folha devolve um formato (mensal, férias, 13º, rescisão): normalizaResultado põe todos no mesmo formato antes de somar.
// itens: [{comp:'aaaa-mm', tipo:'mensal'|'ferias'|'13o'|'rescisao', r:resultado}]
function somaDesc(r,re){return r2x(((r&&r.descontos)||[]).filter(d=>re.test(String(d.desc||d.cod))).reduce((s,d)=>s+(+d.valor||0),0))}
function normalizaResultado(tipo,r){
  if(!r||!r.ok)return null;
  if(tipo==='13o')return {proventos:[{cod:'13',desc:'13º salário ('+r.avos+'/12)',ref:' ',valor:r.total}],descontos:[{cod:'110',desc:'INSS sobre o 13º',valor:r2x((r.parcela1.inss||0)+(r.parcela2.inss||0))},{cod:'120',desc:'IRRF sobre o 13º',valor:r2x((r.parcela1.irrf||0)+(r.parcela2.irrf||0))}].filter(x=>x.valor>0),
    totalProventos:r2x(r.total),inss:r2x((r.parcela1.inss||0)+(r.parcela2.inss||0)),irrf:r2x((r.parcela1.irrf||0)+(r.parcela2.irrf||0)),liquido:r2x((r.parcela1.liquido||0)+(r.parcela2.liquido||0)),fgts:r2x(r.fgtsTotal||0),salarioFamilia:0,bruto:r2x(r.total)};
  if(tipo==='ferias')return {proventos:r.proventos||[],descontos:[{cod:'110',desc:'INSS',valor:r.inss},{cod:'120',desc:'IRRF',valor:r.irrf}].filter(x=>x.valor>0),totalProventos:r2x(r.bruto),inss:r2x(r.inss),irrf:r2x(r.irrf),liquido:r2x(r.liquido),fgts:r2x(r.fgts),salarioFamilia:0,bruto:r2x(r.bruto)};
  if(tipo==='rescisao'){const ig=somaDesc(r,/^IRRF/i),is=somaDesc(r,/^INSS/i);return {proventos:r.proventos||[],descontos:r.descontos||[],totalProventos:r2x(r.totalProventos),inss:is,irrf:ig,liquido:r2x(r.liquido),fgts:r2x((r.fgts&&r.fgts.deposito)||0),salarioFamilia:0,bruto:r2x(r.totalProventos)}}
  return {proventos:r.proventos||[],descontos:r.descontos||[],totalProventos:r2x(r.totalProventos),inss:r2x(r.inss||0),irrf:r2x(r.irrf||0),liquido:r2x(r.liquido),fgts:r2x(typeof r.fgts==='object'?(r.fgts.deposito||0):(r.fgts||0)),salarioFamilia:r2x(r.salarioFamilia||0),bruto:r2x(r.bruto!=null?r.bruto:r.totalProventos)}}
function fichaFinanceira(itens){
  if(!Array.isArray(itens)||!itens.length)return falhaX('informe os resultados calculados');
  const meses={},rub={};
  for(const it of itens){const n=it&&normalizaResultado(it.tipo||'mensal',it.r);if(!n)return falhaX('resultado inválido em '+(it&&it.comp));
    const m=meses[it.comp]||(meses[it.comp]={comp:it.comp,proventos:0,descontos:0,liquido:0,inss:0,irrf:0,fgts:0,itens:0});
    m.proventos=r2x(m.proventos+n.totalProventos);m.descontos=r2x(m.descontos+(n.totalProventos-n.liquido));m.liquido=r2x(m.liquido+n.liquido);
    m.inss=r2x(m.inss+n.inss);m.irrf=r2x(m.irrf+n.irrf);m.fgts=r2x(m.fgts+n.fgts);m.itens++;
    for(const x of n.proventos)rub['P'+x.cod+' '+x.desc]=r2x((rub['P'+x.cod+' '+x.desc]||0)+x.valor);
    for(const x of n.descontos)rub['D'+x.cod+' '+x.desc]=r2x((rub['D'+x.cod+' '+x.desc]||0)+x.valor)}
  const lista=Object.values(meses).sort((a,b)=>a.comp<b.comp?-1:1),tot=k=>r2x(lista.reduce((s,x)=>s+x[k],0));
  return {ok:true,meses:lista,rubricas:rub,totais:{proventos:tot('proventos'),descontos:tot('descontos'),liquido:tot('liquido'),inss:tot('inss'),irrf:tot('irrf'),fgts:tot('fgts')}}}
// Informe de rendimentos (resumo dos quadros): rendimentos tributáveis, previdência oficial, IRRF, 13º (tributação exclusiva na fonte), pensão paga.
// RESCISÃO fica FORA deste resumo: indenizações isentas (aviso indenizado, multa do FGTS) precisam de separação própria. [CONFERIR COM O DANIEL]
// Layout oficial da Receita: [CONFERIR COM O DANIEL] antes de entregar ao empregado.
function informeRendimentos(itens,ano){
  const f=fichaFinanceira(itens);if(!f.ok)return f;let trib=0,prev=0,ir=0,d13=0,ir13=0,pensao=0,sf=0;const fora=[];
  for(const it of itens){if(!String(it.comp).startsWith(String(ano)))continue;const tipo=it.tipo||'mensal';
    if(tipo==='rescisao'){fora.push(it.comp);continue}
    const n=normalizaResultado(tipo,it.r);
    if(tipo==='13o'){d13+=n.totalProventos;ir13+=n.irrf;prev+=n.inss;continue}
    trib+=n.bruto;prev+=n.inss;ir+=n.irrf;sf+=n.salarioFamilia;
    for(const d of n.descontos)if(d.cod==='140')pensao+=d.valor}
  return {ok:true,ano,rendimentosTributaveis:r2x(trib),previdenciaOficial:r2x(prev),irrf:r2x(ir),decimoTerceiro:r2x(d13),irrf13:r2x(ir13),pensaoAlimenticia:r2x(pensao),salarioFamiliaIsento:r2x(sf),rescisoesForaDoResumo:fora,
    alertas:['Resumo calculado das folhas lançadas. Conferir contra o layout oficial do informe de rendimentos. [CONFERIR COM O DANIEL]'].concat(fora.length?['Rescisão em '+fora.join(', ')+' não entra neste resumo: indenizações isentas exigem separação própria. [CONFERIR COM O DANIEL]']:[])}}

// ===== 13. Integração contábil: o gerador folha(), adiantamentoPago(), repassePensao() e repasseConsignado() ficam em contabil.js (contas 2.1.3.06, 2.1.3.07, 2.1.3.08 e 1.1.4.01).

// ===== 14. Parâmetros por empresa com vigência
// Cada chave tem explicação em português simples, base legal e padrão. A mudança entra como NOVA vigência (nunca sobrescreve): dá para ver o que valia em qualquer data.
const CATALOGO_PARAMETROS={
  modoINSS:{padrao:'total',opcoes:['total','truncado'],titulo:'Como arredondar o INSS na folha',explicacao:'"total" calcula o INSS sobre o total e arredonda uma vez; "truncado" calcula faixa por faixa. Muda centavos.',base:'Decisão do contador (Daniel): pendente.',conferir:true},
  adiantamentoPct:{padrao:.40,min:0.01,max:1,titulo:'Percentual do adiantamento salarial',explicacao:'Quanto do salário a empresa adianta no meio do mês.',base:'Convenção coletiva ou combinado; CLT art. 462 permite descontar adiantamento.',conferir:true},
  adiantamentoDia:{padrao:20,min:1,max:28,titulo:'Dia do adiantamento',explicacao:'Dia do mês em que o adiantamento é pago.',base:'Combinado com o empregado.'},
  limiteConsignado:{padrao:.35,min:0.01,max:.6,titulo:'Limite do consignado',explicacao:'Parte máxima da remuneração disponível que pode ir para empréstimo consignado.',base:'Lei 10.820/2003 (percentual já mudou antes).',conferir:true},
  insalubridadeBase:{padrao:'salarioMinimo',opcoes:['salarioMinimo','salario'],titulo:'Base da insalubridade',explicacao:'O adicional de insalubridade incide sobre o salário mínimo, salvo convenção que diga outra base.',base:'CLT art. 192; Súmula Vinculante 4 do STF.',conferir:true},
  periculosidadePct:{padrao:.30,min:0.01,max:1,titulo:'Percentual de periculosidade',explicacao:'Adicional sobre o salário-base para atividade perigosa, por laudo.',base:'CLT art. 193 §1º.'},
  fgtsAprendiz:{padrao:.02,min:0,max:.08,titulo:'FGTS do aprendiz',explicacao:'Alíquota reduzida do FGTS para contrato de aprendizagem.',base:'Lei 8.036/1990 art. 15 §7º.'},
  pagamentoRegra:{padrao:'quinto_dia_util',opcoes:['quinto_dia_util','ultimo_dia_util','dia_fixo'],titulo:'Quando paga a folha',explicacao:'O salário do mês tem de ser pago até o 5º dia útil do mês seguinte.',base:'CLT art. 459 §1º.'},
  diaFixoPagamento:{padrao:5,min:1,max:30,titulo:'Dia fixo de pagamento',explicacao:'Usado quando a regra é "dia fixo".',base:'Combinado; nunca depois do 5º dia útil.'},
  sabadoDiaUtil:{padrao:true,opcoes:[true,false],titulo:'Sábado conta como dia útil para pagar',explicacao:'Muitos tribunais contam o sábado como dia útil no prazo do pagamento; a convenção pode dizer o contrário.',base:'Jurisprudência do TST e convenção.',conferir:true},
  antecipaNaoUtil:{padrao:true,opcoes:[true,false],titulo:'Antecipar quando cair em dia sem expediente',explicacao:'Se o dia do pagamento for feriado ou domingo, paga no dia útil anterior.',base:'Boa prática; evita atraso.'},
  mediaMeses:{padrao:12,opcoes:[3,6,12],titulo:'Meses da média de férias e 13º',explicacao:'Quantos meses entram na média das verbas variáveis.',base:'CLT art. 142; 12 meses é o período aquisitivo.',conferir:true},
  inssAutonomoPct:{padrao:.11,min:.01,max:.2,titulo:'INSS do autônomo (RPA)',explicacao:'Percentual descontado do autônomo, até o teto.',base:'Lei 10.666/2003 art. 4º.',conferir:true},
  aliquotaISSAutonomo:{padrao:0,min:0,max:.05,titulo:'ISS retido do autônomo',explicacao:'Percentual do ISS que o município manda reter. Zero se o município não exige.',base:'Lei do município do serviço.',conferir:true}
};
function validaParametro(chave,valor){
  const c=CATALOGO_PARAMETROS[chave];if(!c)return 'parâmetro desconhecido: '+chave;
  if(c.opcoes&&!c.opcoes.includes(valor))return chave+': valor deve ser um destes: '+c.opcoes.join(', ');
  if(typeof c.padrao==='number'&&!c.opcoes){if(typeof valor!=='number'||isNaN(valor))return chave+': informe um número';if(c.min!=null&&valor<c.min)return chave+': mínimo '+c.min;if(c.max!=null&&valor>c.max)return chave+': máximo '+c.max}
  return null}
function novaVigencia(config,desde,valores,motivo){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(desde||''))return falhaX('informe a data de início (aaaa-mm-dd)');
  if(!motivo||!String(motivo).trim())return falhaX('informe o motivo da mudança (fica no histórico)');
  const erros=[];for(const [k,v] of Object.entries(valores||{})){const e=validaParametro(k,v);if(e)erros.push(e)}
  if(!Object.keys(valores||{}).length)erros.push('nenhum parâmetro informado');if(erros.length)return falhaX(...erros);
  const base=(config&&config.vigencias)||[];if(base.some(v=>v.desde===desde))return falhaX('já existe uma vigência com início em '+desde+': use outra data (o histórico não se reescreve)');
  const vig=base.concat([{desde,valores:{...valores},motivo:String(motivo).trim()}]).sort((a,b)=>a.desde<b.desde?-1:1);
  return {ok:true,vigencias:vig}}
function parametrosEm(config,data){
  const out={};for(const [k,c] of Object.entries(CATALOGO_PARAMETROS))out[k]=c.padrao;
  for(const v of ((config&&config.vigencias)||[]))if(v.desde<=data)Object.assign(out,v.valores);return out}
function parametrosQuePedemConferir(){return Object.entries(CATALOGO_PARAMETROS).filter(([,c])=>c.conferir).map(([k,c])=>({chave:k,titulo:c.titulo,base:c.base}))}

// ===== 15. Data de pagamento (calendário com feriados municipais)
// Regra padrão: até o 5º dia útil do mês seguinte (CLT art. 459 §1º). Feriados (nacionais e do município) entram como lista aaaa-mm-dd.
function diaUtilX(d,fer,sab){const w=d.getUTCDay();if(w===0)return false;if(w===6&&!sab)return false;return !fer.includes(d.toISOString().slice(0,10))}
function dataDePagamento(competencia,p={},feriados=[]){
  if(!/^\d{4}-\d{2}$/.test(competencia||''))return falhaX('competência deve ser aaaa-mm');
  const regra=p.pagamentoRegra||'quinto_dia_util',sab=p.sabadoDiaUtil!==false,[a,m]=competencia.split('-').map(Number);
  let alvo;
  if(regra==='ultimo_dia_util'){alvo=new Date(Date.UTC(a,m,0));while(!diaUtilX(alvo,feriados,sab))alvo.setUTCDate(alvo.getUTCDate()-1)}
  else if(regra==='dia_fixo'){alvo=new Date(Date.UTC(a,m,+(p.diaFixoPagamento||5)));if(p.antecipaNaoUtil!==false)while(!diaUtilX(alvo,feriados,sab))alvo.setUTCDate(alvo.getUTCDate()-1)}
  else{alvo=new Date(Date.UTC(a,m,1));let n=0;while(true){if(diaUtilX(alvo,feriados,sab)){n++;if(n===5)break}alvo.setUTCDate(alvo.getUTCDate()+1)}}
  const iso=alvo.toISOString().slice(0,10),limite=regra==='quinto_dia_util'?iso:null;
  return {ok:true,competencia,regra,data:iso,limiteLegal:limite,
    alertas:['Pagamento até o 5º dia útil do mês seguinte (CLT art. 459 §1º). Sábado '+(sab?'conta':'não conta')+' como dia útil [CONFERIR COM O DANIEL].']}}

// ===== 16. Avisos de vencimento (férias em dobro, experiência, estágio, aprendiz)
// Cada aviso traz a data, os dias que faltam e o nível: critico, atencao ou info. Ninguém é desligado nem pago por aqui: é só o alerta para o contador agir a tempo.
// Férias: período aquisitivo de 12 meses e concessivo de 12 meses seguintes (CLT arts. 129 e 134); vencido o concessivo, pagam-se em dobro (art. 137).
// Experiência: até 90 dias no total, com uma prorrogação (CLT art. 445 parágrafo único e art. 451). Estágio: 2 anos (Lei 11.788 art. 11). Aprendiz: o contrato termina no prazo ou aos 24 anos, salvo PcD (CLT art. 433).
const pU=s=>{const [a,m,d]=String(s).split('-').map(Number);return new Date(Date.UTC(a,m-1,d))};
const isoU=d=>d.toISOString().slice(0,10);
const diasU=(a,b)=>Math.round((pU(b)-pU(a))/86400000);
const somaDiasU=(s,n)=>{const d=pU(s);d.setUTCDate(d.getUTCDate()+n);return isoU(d)};
const somaMesesU=(s,n)=>{const d=pU(s),dia=d.getUTCDate(),x=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+n,1)),ult=new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0)).getUTCDate();x.setUTCDate(Math.min(dia,ult));return isoU(x)};
const nivelU=(dias,crit,aten)=>dias<=crit?'critico':dias<=aten?'atencao':'info';
function avisosVencimento(emp,ref){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(ref||''))return falhaX('informe a data de referência (aaaa-mm-dd)');
  if(!emp||!/^\d{4}-\d{2}-\d{2}$/.test(emp.admissao||''))return falhaX('informe a admissão (aaaa-mm-dd)');
  const av=[],erros=[],pg=Math.max(0,Math.floor(+emp.periodosGozados||0));
  if(emp.tipoVinculo!=='estagiario'&&emp.tipoVinculo!=='intermitente'||emp.tipoVinculo==='intermitente'){
    const aqFim=somaDiasU(somaMesesU(emp.admissao,12*(pg+1)),-1),limite=somaDiasU(somaMesesU(emp.admissao,12*(pg+2)),-1);
    if(diasU(ref,aqFim)>=0)av.push({tipo:'ferias',nivel:'info',data:aqFim,dias:diasU(ref,aqFim),texto:'Período aquisitivo de férias em andamento: completa em '+aqFim+'.'});
    else{const d=diasU(ref,limite);av.push(d<0?{tipo:'ferias',nivel:'critico',data:limite,dias:d,texto:'Férias VENCIDAS desde '+limite+': o prazo de concessão passou e as férias são devidas em dobro (CLT art. 137). Programar já.'}
      :{tipo:'ferias',nivel:nivelU(d,30,90),data:limite,dias:d,texto:'Férias precisam começar até '+limite+' ('+d+' dia(s)). Depois disso, pagam-se em dobro (CLT art. 137). Avisar o empregado com 30 dias de antecedência.'})}}
  if(emp.experienciaDias){
    const dd=+emp.experienciaDias;
    if(!(dd>=1&&dd<=90))erros.push('contrato de experiência vai de 1 a 90 dias no total (CLT art. 445)');
    else{const fim=somaDiasU(emp.admissao,dd-1),d=diasU(ref,fim);
      av.push(d<0?{tipo:'experiencia',nivel:'atencao',data:fim,dias:d,texto:'Experiência terminou em '+fim+'. Se o empregado continua, o contrato passou a prazo indeterminado: confirmar e registrar. [CONFERIR COM O DANIEL]'}
        :{tipo:'experiencia',nivel:nivelU(d,10,30),data:fim,dias:d,texto:'Experiência termina em '+fim+' ('+d+' dia(s)). Decidir: efetivar, prorrogar (uma vez, até 90 dias no total) ou encerrar, avisando por escrito.'})}}
  if(emp.tipoVinculo==='estagiario'&&emp.inicioContrato&&!emp.pcd){
    const fim=somaDiasU(somaMesesU(emp.inicioContrato,24),-1),d=diasU(ref,fim);
    av.push({tipo:'estagio',nivel:d<0?'critico':nivelU(d,30,90),data:fim,dias:d,texto:d<0?'Estágio passou de 2 anos em '+fim+' (Lei 11.788 art. 11): encerrar ou regularizar.':'Estágio completa 2 anos em '+fim+' ('+d+' dia(s)): último dia na mesma empresa, salvo pessoa com deficiência.'})}
  if(emp.tipoVinculo==='aprendiz'){
    const lim=[];if(emp.fimContrato)lim.push(emp.fimContrato);if(emp.nascimento&&!emp.pcd)lim.push(somaDiasU(somaMesesU(emp.nascimento,288),-1));
    if(lim.length){const fim=lim.sort()[0],d=diasU(ref,fim);av.push({tipo:'aprendiz',nivel:d<0?'critico':nivelU(d,30,60),data:fim,dias:d,texto:d<0?'Contrato de aprendizagem já devia ter terminado em '+fim+'.':'Contrato de aprendizagem termina em '+fim+' ('+d+' dia(s)): no prazo ou ao completar 24 anos, o que vier primeiro (CLT art. 433).'})}}
  if(erros.length)return falhaX(...erros);
  const ord={critico:0,atencao:1,info:2};av.sort((a,b)=>ord[a.nivel]-ord[b.nivel]||a.dias-b.dias);
  return {ok:true,referencia:ref,avisos:av,alertas:['Prazos calculados por data corrida; feriado e acordo coletivo podem mudar a contagem. [CONFERIR COM O DANIEL]']}}

// ===== 17. Conferências antes do cálculo (avisos de conferência antes do cálculo)
// Olha o cadastro e o movimento de UM empregado e avisa o erro antes de a folha fechar. Cada regra diz o porquê e a base. Nada é corrigido sozinho.
// Regras ligadas a lei trazem a marca [CONFERIR COM O DANIEL] quando dependem de convenção ou de leitura do caso.
function conferenciasFolha(emp,mov={},ano=2026){
  const T=tabelaFolha(ano),av=[],S=+emp.salario,M={heNormais:0,heDescanso:0,horasNoturnas:0,faltasDias:0,diasTrabalhados:22,...mov};
  const add=(regra,nivel,texto)=>av.push({regra,nivel,texto});
  const he=(+M.heNormais||0)+(+M.heDescanso||0);
  if(emp.tipoVinculo==='aprendiz'){
    if(emp.fgtsAliq!=null&&+emp.fgtsAliq!==0.02)add('aprendiz-fgts','critico','Aprendiz com FGTS de '+Math.round(emp.fgtsAliq*1000)/10+'%: a alíquota do contrato de aprendizagem é 2% (Lei 8.036/1990 art. 15 §7º).');
    if(he>0)add('aprendiz-hora-extra','critico','Aprendiz com hora extra lançada: prorrogação e compensação de jornada são vedadas (CLT art. 432).');
  }
  if(emp.tipoVinculo==='estagiario'){
    if(he>0)add('estagiario-hora-extra','atencao','Estagiário com hora extra: a jornada do estágio é limitada pelo termo de compromisso e pela Lei 11.788 art. 10. [CONFERIR COM O DANIEL]');
    if(emp.fgtsAliq>0)add('estagiario-fgts','critico','Estagiário com FGTS: estágio não gera vínculo de emprego (Lei 11.788 art. 3º); não há FGTS.');
  }
  if(S>0&&S<T.sm&&!emp.jornadaParcial&&emp.tipoVinculo!=='estagiario'&&emp.tipoVinculo!=='intermitente')add('abaixo-do-minimo','critico','Salário de R$ '+S.toFixed(2).replace('.',',')+' abaixo do mínimo vigente (R$ '+T.sm.toFixed(2).replace('.',',')+'). Só vale para jornada parcial proporcional ou piso diferente por convenção.');
  const dias=+M.diasTrabalhados>0?+M.diasTrabalhados:22;
  if(he>0&&he/dias>2)add('hora-extra-excesso','atencao','Média de '+(he/dias).toFixed(1).replace('.',',')+' h extras por dia trabalhado: o acréscimo diário tem limite de 2 horas (CLT art. 59). [CONFERIR COM O DANIEL] acordo ou convenção.');
  if(he>0&&emp.cargoConfianca)add('cargo-confianca-hora-extra','atencao','Cargo de confiança com hora extra: quem ocupa função de gestão com adicional de 40% fica fora do controle de jornada (CLT art. 62, II). Conferir o enquadramento. [CONFERIR COM O DANIEL]');
  if(emp.adicionalTipo&&!emp.adicionalLaudo)add('adicional-sem-laudo','atencao','Adicional de '+String(emp.adicionalTipo).replace('_',' ')+' sem a referência do laudo (NR-15 / NR-16) no cadastro. O pagamento precisa do laudo.');
  if(emp.pensaoTipo&&!(+emp.pensaoValor>0||+emp.pensaoPercentual>0))add('pensao-incompleta','critico','Pensão alimentícia cadastrada sem valor ou percentual: desconto não será feito. Conferir o ofício.');
  if(+emp.vtCusto>0&&+emp.vtCusto>0.06*S&&S>0)add('vt-acima-6','info','Custo do vale-transporte (R$ '+(+emp.vtCusto).toFixed(2).replace('.',',')+') passa de 6% do salário: o desconto do empregado fica limitado a 6%; o resto é custo da empresa.');
  if((+emp.filhosSF||0)>0&&S>T.sfLimite)add('sf-acima-do-limite','info','Cota de salário-família cadastrada, mas o salário passa de R$ '+T.sfLimite.toFixed(2).replace('.',',')+': não terá direito neste mês.');
  if((+emp.filhosSF||0)>(+emp.dependentes||0)&&emp.dependentes!=null)add('sf-maior-que-dependentes','atencao','Mais filhos para salário-família ('+emp.filhosSF+') do que dependentes no cadastro ('+emp.dependentes+'). Conferir; são cadastros diferentes (IR × salário-família).');
  if(M.faltasDias>5)add('faltas-reduzem-ferias','info',M.faltasDias+' faltas no mês: faltas injustificadas no período aquisitivo reduzem os dias de férias (CLT art. 130).');
  if(emp.tipoVinculo==='intermitente'&&S>0)add('intermitente-mensalista','atencao','Intermitente calculado como mensalista: o intermitente é pago por convocação, ao fim de cada período (CLT art. 452-A). Use o cálculo do intermitente.');
  if(M.horasNoturnas>0&&!(S>0))add('noturno-sem-salario','critico','Horas noturnas sem salário no cadastro.');
  const ord={critico:0,atencao:1,info:2};av.sort((a,b)=>ord[a.nivel]-ord[b.nivel]);
  return {ok:true,total:av.length,criticos:av.filter(a=>a.nivel==='critico').length,avisos:av,
    alertas:['Conferência automática do cadastro e do movimento. Não substitui a revisão do contador.']}}

// ===== 18. Memória de cálculo da folha do mês: cada valor com a conta e a base legal, em português simples
// (memória de cálculo: mostra o IRRF com a comparação simplificado × completo.) Só explica: não recalcula nada de novo além de refazer as contas das faixas para mostrar.
// Entra o resultado de calculaFolha ou calculaFolhaCompleta. Se o INSS estiver no modo "truncado", a soma por faixa pode diferir em centavos e a linha avisa.
const fmtM=v=>(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
function memoriaDeCalculo(r,emp,mov={},ano=2026){
  if(!r||!r.ok)return falhaX('informe uma folha calculada sem erro');
  const T=tabelaFolha(ano),L=[],add=(item,conta,valor,base)=>L.push({item,conta,valor:valor==null?null:r2x(valor),base:base||''});
  const S=+emp.salario,div=emp.divisor||220,vh=S/div;
  add('Valor da hora','salário R$ '+fmtM(S)+' ÷ '+div+' horas',vh,'CLT art. 64 (divisor da jornada)');
  const m={heNormais:0,heDescanso:0,horasNoturnas:0,faltasDias:0,diasUteis:25,diasDescanso:5,comissao:0,...mov};
  if(m.heNormais>0)add('Horas extras 50%',m.heNormais+' h × R$ '+fmtM(vh)+' × 1,5',m.heNormais*vh*1.5,'CF art. 7º XVI; CLT art. 59');
  if(m.heDescanso>0)add('Horas extras 100% (descanso e feriado)',m.heDescanso+' h × R$ '+fmtM(vh)+' × 2',m.heDescanso*vh*2,'Lei 605/1949; convenção coletiva [CONFERIR COM O DANIEL]');
  if(m.horasNoturnas>0)add('Adicional noturno 20%',m.horasNoturnas+' h × R$ '+fmtM(vh)+' × 0,20',m.horasNoturnas*vh*.2,'CLT art. 73');
  const variavel=m.heNormais*vh*1.5+m.heDescanso*vh*2+m.horasNoturnas*vh*.2+(+m.comissao||0);
  if(variavel>0)add('DSR sobre variáveis','R$ '+fmtM(variavel)+' ÷ '+m.diasUteis+' dias úteis × '+m.diasDescanso+' dias de descanso',variavel/m.diasUteis*m.diasDescanso,'Lei 605/1949 art. 7º');
  if(m.faltasDias>0)add('Desconto de faltas',m.faltasDias+' dia(s) × R$ '+fmtM(S/30)+' (salário ÷ 30)',-(S/30*m.faltasDias),'CLT art. 130 e 473 (faltas justificadas não descontam)');
  add('Bruto tributável','soma dos proventos que incidem, menos faltas e atrasos',r.bruto,'');
  // INSS por faixa
  let ant=0,tot=0;const base=r.baseINSS;
  for(const [teto,al] of T.inss){const dentro=Math.max(0,Math.min(base,teto)-ant);if(dentro>0){const v=dentro*al;tot+=v;add('INSS: faixa até R$ '+fmtM(teto),'R$ '+fmtM(dentro)+' × '+(al*100).toLocaleString('pt-BR')+'%',v,'Portaria Interministerial MPS/MF 13/2026')}ant=teto}
  add('INSS descontado','soma das faixas sobre R$ '+fmtM(base)+' (teto de R$ '+fmtM(T.teto)+')',r.inss,Math.abs(r2x(tot)-r.inss)>0.011?'Modo de arredondamento do INSS ('+modoINSS()+') difere da soma simples por centavos.':'');
  // IRRF
  const dep=(emp.dependentes||0)*T.depIR,extra=+emp.deducaoIRRFExtra||0,cl=carneLeao(base,r.inss+dep+extra);
  add('IRRF: dedução usada',cl.usaSimpl?'desconto simplificado R$ '+fmtM(cl.deducao)+' (maior que INSS + dependentes + pensão = R$ '+fmtM(r.inss+dep+extra)+')':'INSS R$ '+fmtM(r.inss)+' + dependentes R$ '+fmtM(dep)+(extra?' + pensão R$ '+fmtM(extra):'')+' = R$ '+fmtM(cl.deducao),cl.deducao,'Lei 15.270/2025; regras.js');
  add('IRRF: base de cálculo','R$ '+fmtM(base)+' − R$ '+fmtM(cl.deducao),cl.base,'');
  add('IRRF: imposto na tabela','base × alíquota − parcela a deduzir da faixa',cl.bruto,'Tabela mensal progressiva');
  if(cl.red>0)add('IRRF: redução','redução da Lei 15.270 para rendimento até R$ 7.350,00',-cl.red,'Lei 15.270/2025');
  add('IRRF devido','imposto − redução',r.irrf,'');
  if(r.vt>0)add('Vale-transporte',"menor valor entre 6% do salário (R$ "+fmtM(S*.06)+') e o custo (R$ '+fmtM(emp.vtCusto)+')',r.vt,'Lei 7.418/1985');
  if(r.salarioFamilia>0)add('Salário-família',(emp.filhosSF||0)+' cota(s) × R$ '+fmtM(T.sfCota),r.salarioFamilia,'Portaria Interministerial MPS/MF 13/2026');
  add('FGTS (depósito da empresa)','R$ '+fmtM(r.baseFGTS)+' × '+((emp.fgtsAliq!=null?+emp.fgtsAliq:T.fgts)*100).toLocaleString('pt-BR')+'%',r.fgts,'Lei 8.036/1990 art. 15');
  (r.descontos||[]).filter(d=>['140','141','150','151','112','122'].includes(d.cod)).forEach(d=>add(d.desc,d.ref&&d.ref!==' '?'ref. '+d.ref:'lançado conforme o cadastro',d.valor,''));
  add('Líquido a pagar','proventos R$ '+fmtM(r.totalProventos)+' − descontos R$ '+fmtM(r.totalDescontos),r.liquido,'');
  return {ok:true,linhas:L,alertas:['Memória de cálculo: mostra como cada valor saiu. A folha continua sendo conferida pelo contador.']}}

// ===== 19. Programação de férias em lote e férias coletivas
// Regras: aviso ao empregado 30 dias antes (CLT art. 135); pagamento até 2 dias antes do início (art. 145); fracionamento em até 3 períodos, um com 14 dias ou mais e os outros com 5 dias ou mais (art. 134 §1º);
// é vedado começar as férias nos 2 dias que antecedem feriado ou dia de repouso semanal (art. 134 §3º). Coletivas (arts. 139 a 141): até 2 períodos, nenhum com menos de 10 dias; comunicar o órgão local do Ministério do Trabalho
// e o sindicato com 15 dias de antecedência (§§ 2º e 3º) [CONFERIR COM O DANIEL o canal e o prazo vigentes].
const dowU=s=>pU(s).getUTCDay();
function inicioValidoFerias(iso,feriados=[],dsr=0){
  for(let k=1;k<=2;k++){const d=somaDiasU(iso,k);if(dowU(d)===dsr||feriados.includes(d))return {ok:false,motivo:'o início cai em um dos 2 dias que antecedem '+(dowU(d)===dsr?'o repouso semanal':'um feriado')+' ('+d+'): vedado pela CLT art. 134 §3º'}}
  if(dowU(iso)===dsr||feriados.includes(iso))return {ok:false,motivo:'o início cai em dia de repouso ou feriado'};
  return {ok:true}}
function proximoInicioValido(desde,feriados,dsr){let d=desde;for(let i=0;i<30;i++){if(inicioValidoFerias(d,feriados,dsr).ok)return d;d=somaDiasU(d,1)}return desde}
// empregados: [{id,nome,admissao,periodosGozados,diasGozo(padrão 30)}]. opc: {feriados[], dsr(0=domingo), maxSimultaneos}
// Ordena por urgência (quem vence antes), sugere o primeiro início válido depois do aviso de 30 dias e respeita o limite de pessoas em férias ao mesmo tempo.
function programaFeriasLote(empregados,ref,opc={}){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(ref||''))return falhaX('informe a data de referência (aaaa-mm-dd)');
  if(!Array.isArray(empregados)||!empregados.length)return falhaX('informe os empregados');
  const fer=opc.feriados||[],dsr=opc.dsr==null?0:opc.dsr,maxS=opc.maxSimultaneos>0?+opc.maxSimultaneos:Infinity,linhas=[],ocupa=[];
  const base=empregados.map(e=>{const pg=Math.max(0,Math.floor(+e.periodosGozados||0)),aqFim=somaDiasU(somaMesesU(e.admissao,12*(pg+1)),-1),limite=somaDiasU(somaMesesU(e.admissao,12*(pg+2)),-1);
    return {e,pg,aqFim,limite,dias:+e.diasGozo>0?+e.diasGozo:30}}).sort((a,b)=>a.limite<b.limite?-1:1);
  for(const b of base){
    const {e}=b,l={id:e.id,nome:e.nome,limiteConcessivo:b.limite,diasGozo:b.dias,alertas:[]};
    if(!/^\d{4}-\d{2}-\d{2}$/.test(e.admissao||'')){l.erro='admissão inválida';linhas.push(l);continue}
    if(diasU(ref,b.aqFim)>=0){l.situacao='em aquisição';l.alertas.push('Direito às férias a partir de '+somaDiasU(b.aqFim,1));linhas.push(l);continue}
    const avisoMin=somaDiasU(ref,30);let ini=proximoInicioValido(avisoMin>somaDiasU(b.aqFim,1)?avisoMin:somaDiasU(b.aqFim,1),fer,dsr);
    for(let t=0;t<120;t++){const fim=somaDiasU(ini,b.dias-1),choca=ocupa.filter(o=>!(fim<o[0]||ini>o[1])).length;if(choca<maxS)break;ini=proximoInicioValido(somaDiasU(ini,1),fer,dsr)}
    const fim=somaDiasU(ini,b.dias-1);ocupa.push([ini,fim]);
    l.situacao=ini>b.limite?'fora do prazo: dobro':'programada';l.inicio=ini;l.fim=fim;l.avisarAte=somaDiasU(ini,-30);l.pagarAte=somaDiasU(ini,-2);
    if(ini>b.limite)l.alertas.push('O início sugerido passa do limite concessivo ('+b.limite+'): as férias saem em dobro (CLT art. 137). Antecipar o aviso e negociar uma data anterior.');
    if(diasU(ref,l.avisarAte)<0)l.alertas.push('O aviso de 30 dias já devia ter sido dado ('+l.avisarAte+'). [CONFERIR COM O DANIEL] o aviso ou o acordo por escrito.');
    linhas.push(l)}
  return {ok:true,referencia:ref,linhas,alertas:['Sugestão de datas: o contador e o empregado confirmam. Feriado municipal entra em opc.feriados.']}}
function feriasColetivas(o){
  const erros=[],p=(o&&o.periodos)||[];
  if(!Array.isArray(p)||!p.length)erros.push('informe os períodos da coletiva (dias)');
  if(p.length>2)erros.push('férias coletivas em até 2 períodos (CLT art. 139 §1º)');
  if(p.some(d=>!(d>=10)))erros.push('nenhum período de férias coletivas pode ter menos de 10 dias (art. 139 §1º)');
  if(!/^\d{4}-\d{2}-\d{2}$/.test((o&&o.inicio)||''))erros.push('informe o início (aaaa-mm-dd)');
  if(erros.length)return falhaX(...erros);
  const fer=o.feriados||[],v=inicioValidoFerias(o.inicio,fer,o.dsr==null?0:o.dsr),alertas=[];
  if(!v.ok)alertas.push('Início inválido: '+v.motivo);
  const fim=somaDiasU(o.inicio,p[0]-1);
  return {ok:true,inicio:o.inicio,fimPrimeiroPeriodo:fim,comunicarAte:somaDiasU(o.inicio,-15),avisarEmpregadosAte:somaDiasU(o.inicio,-30),pagarAte:somaDiasU(o.inicio,-2),inicioValido:v.ok,
    alertas:alertas.concat(['Comunicar o órgão local do Ministério do Trabalho e o sindicato com 15 dias de antecedência (art. 139 §§ 2º e 3º). [CONFERIR COM O DANIEL] o canal e o prazo.','Quem não completou o período aquisitivo goza só as férias proporcionais e inicia novo período aquisitivo (art. 140). [CONFERIR COM O DANIEL]'])}}

if(typeof module!=='undefined')module.exports={adicionalInsalubridade,adicionalPericulosidade,escolheAdicional,calculaFeriasCompleta,calculaDecimoCompleto,rescisaoEstagiario,pensaoValor,validaPensao,consignadoLimite,adiantamentoValor,adiantamentoAvulsoPorLiquido,calculaFolhaCompleta,
  cotaEstagiarios,recessoEstagio,calculaEstagiario,calculaAprendiz,calculaIntermitente,programaFeriasLote,feriasColetivas,inicioValidoFerias,memoriaDeCalculo,conferenciasFolha,avisosVencimento,calculaRRA,calculaRetroativo,mediasVariaveis,calculaFeriasComHistorico,calculaDecimoComHistorico,calculaRPA,
  normalizaResultado,fichaFinanceira,informeRendimentos,CATALOGO_PARAMETROS,validaParametro,novaVigencia,parametrosEm,parametrosQuePedemConferir,dataDePagamento};
