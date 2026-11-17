// Informe anual do sócio (módulo C6, parte do IRPF dos sócios) e empresa sem movimento (C16), 17/11/2026.
// Depende de lucros.js (limiteIsento). Fontes lidas: projeto/cnae-anexo-defis-irpf-socios-2026-11-17.md (pró-labore é rendimento tributável; lucros isentos até o limite da LC 123 art. 14 e CGSN 145; retenção de 10% quando passa de R$ 50 mil por mês, Lei 15.270, que a Receita diz valer para o Simples: controverso).
// ESTIMATIVA/RASCUNHO para o sócio e o contador se organizarem. Códigos das linhas do IRPF: a CONFIRMAR no Manual do IRPF 2027 (sai em março de 2027).
function informeSocio({ano,socio,proLaboreAnual=0,inssAnual=0,irrfAnual=0,lucrosPorMes=[],receitaAno,irpjCsllAno=0,lucroContabilAno=null,escrituracaoCompleta=false,pct=PRESUNCAO.servicos}){
  const part=(+socio.participacao||0)/100,L=limiteIsento({receita:receitaAno,pct,irpjCsll:irpjCsllAno,lucroContabil:lucroContabilAno,escrituracaoCompleta});
  const lucros=Math.round(lucrosPorMes.reduce((s,x)=>s+x,0)*100)/100,limiteSocio=Math.round(L.limite*part*100)/100;
  const isento=Math.round(Math.min(lucros,limiteSocio)*100)/100,excedente=Math.round((lucros-isento)*100)/100;
  const mesesAcima=lucrosPorMes.map((v,i)=>[i+1,v]).filter(([,v])=>v>50000).map(([m])=>m);
  const avisos=[];
  if(excedente>0)avisos.push('R$ '+excedente.toFixed(2).replace('.',',')+' de lucros acima do limite isento do sócio: pode ser tributado; o contador decide'+(escrituracaoCompleta?'':' (sem escrituração contábil completa, vale só o lucro presumido)'));
  if(mesesAcima.length)avisos.push('Meses com mais de R$ 50 mil de lucros para o mesmo sócio: '+mesesAcima.join(', ')+'. Retenção de 10% (Lei 15.270; a Receita entende que vale para o Simples, há tese contrária e ADI 7.917): o contador confere o que foi retido');
  if(proLaboreAnual>0&&inssAnual<=0)avisos.push('há pró-labore sem INSS registrado: conferir');
  return {ano,socio:{nome:socio.nome,cpf:socio.cpf,participacao:+socio.participacao||0},
    rendimentosTributaveis:{proLabore:Math.round(proLaboreAnual*100)/100,inssPrevidenciaOficial:Math.round(inssAnual*100)/100,irrfRetido:Math.round(irrfAnual*100)/100},
    rendimentosIsentos:{lucrosEDividendos:isento,limiteDoSocio:limiteSocio,regra:L.regra},lucrosAcimaDoLimite:excedente,lucrosTotais:lucros,mesesAcimaDe50mil:mesesAcima,avisos,
    linhasDoIR:['Rendimentos tributáveis recebidos de pessoa jurídica (pró-labore): informe de rendimentos da empresa','Previdência oficial (INSS do pró-labore)','Rendimentos isentos: lucros e dividendos recebidos (código a confirmar no Manual do IRPF 2027)'],
    aviso:'Estimativa para organização; o contador do sócio confere antes da declaração.'}}
// Empresa sem movimento: o que continua obrigatório. Sem faturamento, sem folha e sem pró-labore, ainda há declarações.
function obrigacoesSemMovimento({empregados=0,proLabore=false,temNotaNoMes=false}){
  const o=[{obrigacao:'PGDAS-D do mês com a declaração "sem movimento" (receita zero); não gera DAS a pagar',prazo:'dia 20 do mês seguinte'}];
  if(empregados>0||proLabore)o.push({obrigacao:'Folha e eSocial normais (há empregado ou sócio com pró-labore): não é "sem movimento"',prazo:'eSocial dia 15; FGTS Digital dia 20'});
  else o.push({obrigacao:'eSocial sem movimento: informar o fechamento do período sem folha (S-1299) conforme o leiaute [conferir o indicador no leiaute]',prazo:'dia 15 do mês seguinte'});
  o.push({obrigacao:'DCTFWeb "sem movimento" quando exigida [conferir]',prazo:'último dia útil do mês seguinte'});
  o.push({obrigacao:'Informações socioeconômicas anuais no PGDAS-D (a DEFIS foi substituída em 2027): entregar mesmo sem faturamento',prazo:'janeiro a março'});
  o.push({obrigacao:'Renovações e taxas que não param: certificado digital, anuidade do conselho, alvará',prazo:'conforme o vencimento'});
  const avisos=[];if(temNotaNoMes)avisos.push('há nota emitida no mês: então NÃO é sem movimento');
  return {obrigacoes:o,avisos,cobranca:'honorário reduzido combinado em contrato para o período sem movimento; o serviço continua (as declarações não param)'}}
if(typeof module!=='undefined')module.exports={informeSocio,obrigacoesSemMovimento};
