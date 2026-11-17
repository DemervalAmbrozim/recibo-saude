// Lucros e pró-labore da ME do Simples (módulo C4, 17/11/2026): quanto pode ser distribuído SEM imposto, alerta de distribuição acima do limite, pró-labore que mantém o Fator R de 28%.
// Fontes lidas em 16/11 (projeto/contabilidade-pj-conferencia-oficial-2026-11-16.md): LC 123/2006 art. 14 §§ 1º e 2º e Res. CGSN 140/2018 art. 145 (isenção do lucro: base presumida da Lei 9.249 art. 15 aplicada à receita,
// menos o IRPJ e a CSLL devidos no Simples; o que passar disso só é isento se a escrituração contábil mostrar lucro maior); Lei 15.270/2025 (retenção de 10% a partir de R$ 50 mil por mês: o texto lido não cita o Simples).
// ESTIMATIVA: o contador confirma. O valor real de IRPJ e CSLL vem da apuração do PGDAS-D (ferramentas/das.py: tributos 1001 e 1002); a tabela abaixo serve só à prévia.

const PRESUNCAO={servicos:0.32,hospitalar:0.08}; // Lei 9.249 art. 15 §1º III: serviços em geral 32%; serviços hospitalares 8% (exigem requisitos próprios) [conferir o caso]
// Participação (IRPJ + CSLL) dentro do DAS por faixa de RBT12, a CONFERIR na LC 123 (repartição dos Anexos); só para a prévia
const PART_IRPJ_CSLL={III:[.075,.075,.075,.075,.5,.5],V:[.40,.38,.39,.36,.355,.50]};
const FAIXAS_RBT=[180e3,360e3,720e3,1.8e6,3.6e6,4.8e6];
function irpjCsllEstimado(das,anexo,rbt12){const i=FAIXAS_RBT.findIndex(x=>rbt12<=x),f=i<0?5:i;return Math.round(das*(PART_IRPJ_CSLL[anexo]||PART_IRPJ_CSLL.III)[f]*100)/100}

// Limite de distribuição isenta no período (normalmente o ano): receita × presunção − IRPJ/CSLL do Simples; ou o lucro da escrituração contábil completa, se maior.
function limiteIsento({receita,pct=PRESUNCAO.servicos,irpjCsll=0,lucroContabil=null,escrituracaoCompleta=false}){
  const base=Math.round((receita*pct-irpjCsll)*100)/100,presumido=Math.max(0,base);
  const contabil=escrituracaoCompleta&&lucroContabil!=null?Math.max(0,lucroContabil):0;
  return {presumido,contabil,limite:Math.max(presumido,contabil),regra:contabil>presumido?'lucro da escrituração contábil (LC 123 art. 14 §1º, II)':'lucro presumido menos IRPJ e CSLL do Simples (LC 123 art. 14 §1º, I)'}}

// Avalia uma distribuição: o que cabe como isento no ano e o que sobra como tributável. Nunca autoriza acima do lucro contábil disponível (essa trava está em contabil.js).
function avaliaDistribuicao({valor,distribuidoAno=0,receitaAno,irpjCsllAno=0,lucroContabilAno=null,escrituracaoCompleta=false,pct=PRESUNCAO.servicos,distribuidoMes=0,lucroDisponivel=null}){
  const L=limiteIsento({receita:receitaAno,pct,irpjCsll:irpjCsllAno,lucroContabil:lucroContabilAno,escrituracaoCompleta});
  const total=distribuidoAno+valor,isento=Math.max(0,Math.min(valor,L.limite-distribuidoAno)),tributavel=Math.round((valor-isento)*100)/100;
  const avisos=[];
  if(lucroDisponivel!=null&&valor>lucroDisponivel+0.005)avisos.push('acima do lucro contábil disponível: a distribuição não é permitida');
  if(tributavel>0)avisos.push('R$ '+tributavel.toFixed(2).replace('.',',')+' acima do limite isento do ano: pode ser tributado; falar com o contador'+(escrituracaoCompleta?'':' (sem escrituração contábil completa, vale só o lucro presumido)'));
  if(distribuidoMes+valor>50000)avisos.push('mais de R$ 50 mil no mês para a mesma pessoa: regra de retenção da Lei 15.270/2025; o contador confere se se aplica ao Simples');
  return {limite:L.limite,regra:L.regra,presumido:L.presumido,contabil:L.contabil,isento:Math.round(isento*100)/100,tributavel,totalAno:Math.round(total*100)/100,permitido:!(lucroDisponivel!=null&&valor>lucroDisponivel+0.005),avisos}}

// Pró-labore deste mês que mantém o Fator R em 28% olhando os 12 meses terminados nele (os 11 anteriores + este). Nunca abaixo de 1 salário mínimo.
function proLaboreParaFatorR({receita11,folha11,receitaMes,folhaOutrasMes=0,salarioMinimo=1621,alvo=0.28}){
  const rbt=receita11+receitaMes,precisa=alvo*rbt-folha11-folhaOutrasMes,p=Math.max(salarioMinimo,Math.round(precisa*100)/100);
  const folha12=folha11+folhaOutrasMes+p,fr=rbt>0?folha12/rbt:0;
  return {proLabore:p,fatorR:Math.round(fr*10000)/10000,anexo:fr>=alvo-1e-9?'III':'V',noMinimo:precisa<=salarioMinimo}}

if(typeof module!=='undefined')module.exports={PRESUNCAO,irpjCsllEstimado,limiteIsento,avaliaDistribuicao,proLaboreParaFatorR};
