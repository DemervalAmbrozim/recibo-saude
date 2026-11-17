// Virada de autônoma para empresa, regime misto (módulo B10) e retorno à pessoa física (B11), 17/11/2026.
// Regra de ouro: cada atendimento sai por UM documento só: recibo pessoal (Receita Saúde e Carnê-Leão) ou nota fiscal da empresa. A receita é de quem presta o serviço.
// ESTIMATIVA/RASCUNHO: decisões de enquadramento são do contador responsável. Itens a conferir estão marcados [conferir].

// ap = {dataServico, pagador:'pessoa'|'convenio', preferencia:'auto'|'empresa'|'cpf'}; empresaApta = data em que a empresa pode emitir nota (CNPJ ativo, inscrição municipal e NFS-e habilitada) ou null
function classificaAtendimento(ap,empresaApta){
  const av=[];
  if(!empresaApta)return {documento:'recibo_pf',motivo:'a empresa ainda não pode emitir nota',avisos:ap.pagador==='convenio'?['convênio exige CNPJ apto para faturar: abrir antes de atender o plano']:[]};
  if(ap.pagador==='convenio'){
    if(ap.dataServico<empresaApta)return {documento:'recibo_pf',motivo:'serviço prestado antes de a empresa estar apta',avisos:['convênio atendido antes da empresa estar apta: conferir com o contador como faturar']};
    return {documento:'nota_pj',motivo:'convênio é faturado pela empresa',avisos:av};
  }
  if(ap.dataServico<empresaApta)return {documento:'recibo_pf',motivo:'serviço prestado antes de a empresa estar apta: segue pelo Carnê-Leão mesmo se recebido depois',avisos:av};
  if(ap.preferencia==='cpf'){av.push('mantido no CPF por escolha: continua no Carnê-Leão e no INSS de autônoma; o contador avalia se mistura os dois no mesmo ano');return {documento:'recibo_pf',motivo:'escolha da profissional, depois de a empresa estar apta',avisos:av}}
  return {documento:'nota_pj',motivo:'serviço depois de a empresa estar apta',avisos:av};
}
// Resumo do período: quantos atendimentos vão por cada documento e o que merece alerta ao contador
function resumoVirada(atendimentos,empresaApta){
  const r={nota_pj:0,recibo_pf:0,valorNota:0,valorRecibo:0,avisos:new Set(),mistoDepoisDaVirada:0};
  for(const a of atendimentos){const c=classificaAtendimento(a,empresaApta);r[c.documento]++;const v=+a.valor||0;if(c.documento==='nota_pj')r.valorNota+=v;else r.valorRecibo+=v;c.avisos.forEach(x=>r.avisos.add(x));
    if(empresaApta&&a.dataServico>=empresaApta&&c.documento==='recibo_pf')r.mistoDepoisDaVirada++}
  r.valorNota=Math.round(r.valorNota*100)/100;r.valorRecibo=Math.round(r.valorRecibo*100)/100;r.avisos=[...r.avisos];
  if(r.mistoDepoisDaVirada>0)r.avisos.push(r.mistoDepoisDaVirada+' atendimento(s) depois da virada continuam no CPF: regime misto, com o contador acompanhando');
  return r}
// Sobreposição: o plano de autônoma segue por 1 mês depois de a empresa ficar apta (decisão do manual v3). Devolve o último dia do plano de autônoma.
function fimSobreposicao(empresaApta){const d=new Date(empresaApta+'T12:00:00');d.setMonth(d.getMonth()+1);return d.toISOString().slice(0,10)}

// B11: baixa do CNPJ e volta para a pessoa física. estado = {feito:[ids]}. Cada passo só libera quando os anteriores de que depende estão feitos.
const PASSOS_BAIXA=[
  {id:'b1',titulo:'Decidir a baixa e avisar o contador (aviso prévio do contrato: 30 dias, 60 de janeiro a abril)',dono:'cliente',depende:[]},
  {id:'b2',titulo:'Rescindir contratos de empregados e encerrar a folha e o eSocial',dono:'contador',depende:['b1']},
  {id:'b3',titulo:'Emitir as últimas notas e conferir recebimentos a receber',dono:'contador',depende:['b1']},
  {id:'b4',titulo:'Pagar o último DAS e quitar ou parcelar pendências fiscais',dono:'cliente',depende:['b3']},
  {id:'b5',titulo:'Fechar a escrituração e distribuir o lucro até o limite isento; levantar o balanço final',dono:'contador',depende:['b3']},
  {id:'b6',titulo:'DEFIS de extinção [conferir prazo: CGSN art. 72] e informe de rendimentos dos sócios',dono:'contador',depende:['b4','b5']},
  {id:'b7',titulo:'Distrato social na Junta Comercial e baixa do CNPJ (Receita, Estado e Prefeitura)',dono:'contador',depende:['b2','b6']},
  {id:'b8',titulo:'Baixar a inscrição municipal da empresa e cancelar certificado e procurações',dono:'contador',depende:['b7']},
  {id:'b9',titulo:'Voltar ao plano de autônoma: Carnê-Leão, recibos, inscrição de autônomo na prefeitura (ISS fixo) e INSS',dono:'app',depende:['b7']},
  {id:'b10',titulo:'Devolver documentos e arquivos da empresa em até 10 dias úteis; distrato do contrato contábil',dono:'contador',depende:['b8']}
];
function proximosPassosBaixa(feitos){const f=new Set(feitos||[]);return PASSOS_BAIXA.filter(p=>!f.has(p.id)&&p.depende.every(d=>f.has(d)))}
function pendenciasBloqueiam(e){const m=[];
  if((e.empregadosAtivos||0)>0)m.push('há empregados ativos: rescindir antes da baixa');
  if((e.dasEmAberto||0)>0)m.push('há DAS em aberto');
  if(e.defisPendente)m.push('há DEFIS pendente');
  if(e.parcelamentoAtivo)m.push('há parcelamento ativo: confirmar com o contador se bloqueia a baixa [conferir]');
  return m}

if(typeof module!=='undefined')module.exports={classificaAtendimento,resumoVirada,fimSobreposicao,PASSOS_BAIXA,proximosPassosBaixa,pendenciasBloqueiam};
