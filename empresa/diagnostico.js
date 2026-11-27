// Diagnóstico de situação fiscal de quem já chega com CNPJ (módulo C15, entrada B), 17/11/2026: transforma o que foi levantado no e-CAC e nos portais em achados, nível de risco, orçamento de regularização e recomendação.
// Só ORGANIZA o levantamento feito pelo contador (consulta ao e-CAC com a procuração); não acessa nada sozinho. RASCUNHO: limites de nível são padrão adotado, a calibrar no piloto.
// estado = {dasAtrasados:[{comp,valor}], defisPendentes:[anos], parcelamentos:[{ativo,parcelasAtrasadas}], esocialPendencias, certidoes:{federal,fgts,trabalhista,municipal: 'negativa'|'positiva_com_efeitos'|'positiva'|'nao_consultada'},
//   caixaPostalNaoLida, mesesDeHistoricoDisponivel (de 12), regime:'simples'|'mei'|'presumido'|'real'|'nao_sei', procuracaoAtiva, certificadoValido, cnaeImpeditivo, contadorAnteriorColabora}
function diagnosticoFiscal(e){const A=[],add=(tipo,grav,texto,acao,horas)=>A.push({tipo,gravidade:grav,texto,acao,horas:horas||0});
  const das=e.dasAtrasados||[],totDas=Math.round(das.reduce((s,x)=>s+(+x.valor||0),0)*100)/100;
  if(das.length)add('das',das.length>=3?'alta':'media',das.length+' competência(s) de DAS em atraso (R$ '+totDas.toFixed(2).replace('.',',')+')','emitir as guias, avaliar o parcelamento e orientar o pagamento',1+das.length*0.5);
  if((e.defisPendentes||[]).length)add('defis',e.defisPendentes.length>=2?'alta':'media','DEFIS pendente de '+e.defisPendentes.join(', ')+': trava o PGDAS-D','entregar a declaração em atraso antes de qualquer apuração',1+e.defisPendentes.length);
  (e.parcelamentos||[]).filter(p=>p.ativo&&p.parcelasAtrasadas>0).forEach(p=>add('parcelamento','alta','parcelamento ativo com '+p.parcelasAtrasadas+' parcela(s) atrasada(s): risco de exclusão','regularizar as parcelas antes de assumir',1));
  if((e.esocialPendencias||0)>0)add('esocial','media',e.esocialPendencias+' pendência(s) no eSocial','corrigir ou retificar os eventos',1+e.esocialPendencias*0.5);
  for(const [k,nome] of [['federal','federal'],['fgts','do FGTS'],['trabalhista','trabalhista'],['municipal','municipal']]){const v=(e.certidoes||{})[k];
    if(v==='positiva')add('certidao','alta','certidão '+nome+' positiva (há débito)','levantar o débito e regularizar',1.5);
    else if(v==='positiva_com_efeitos')add('certidao','baixa','certidão '+nome+' positiva com efeitos de negativa','acompanhar',0.25);
    else if(!v||v==='nao_consultada')add('certidao','baixa','certidão '+nome+' ainda não consultada','consultar',0.25)}
  if((e.caixaPostalNaoLida||0)>0)add('caixa-postal',e.caixaPostalNaoLida>=5?'media':'baixa',e.caixaPostalNaoLida+' mensagem(ns) não lida(s) na caixa postal do e-CAC','ler e responder dentro do prazo',0.5);
  if(e.regime==='mei')add('regime','alta','empresa como MEI: nenhuma profissão de saúde regulamentada cabe no MEI','desenquadrar com o contador e planejar a mudança',3);
  if(e.regime==='presumido'||e.regime==='real')add('regime','alta','regime '+e.regime+': fora do escopo por enquanto','indicar outro contador',0);
  if(e.cnaeImpeditivo)add('cnae','alta','CNAE impeditivo ou ambíguo para o Simples','o contador confere o enquadramento',2);
  if(!e.procuracaoAtiva)add('acesso','media','procuração eletrônica ainda não ativa: sem ela o levantamento é parcial','pedir a procuração no e-CAC',0.25);
  if(!e.certificadoValido)add('acesso','baixa','certificado digital da empresa vencido ou inexistente','emitir ou renovar (opção assistida)',0.5);
  if((e.mesesDeHistoricoDisponivel||0)<12)add('historico','media','só '+(e.mesesDeHistoricoDisponivel||0)+' de 12 meses de receita e folha disponíveis: o Fator R e a faixa do DAS ficam incertos','pedir ao contador anterior os 12 meses (planilha receita e folha)',1);
  if(e.contadorAnteriorColabora===false)add('transicao','media','o contador anterior não colabora com os documentos','notificar por escrito e pedir os arquivos pelos canais do conselho',1);
  const alta=A.filter(a=>a.gravidade==='alta').length,media=A.filter(a=>a.gravidade==='media').length,horas=Math.round(A.reduce((s,a)=>s+a.horas,0)*100)/100;
  const nivel=alta>0?'vermelho':media>0?'amarelo':'verde';
  const fora=e.regime==='presumido'||e.regime==='real';
  const recomendacao=fora?'nao_aceitar':alta>=3||(das.length>=6)?'aceitar_apos_regularizar':nivel==='vermelho'?'aceitar_apos_regularizar':'aceitar';
  const msg={aceitar:'A situação fiscal permite começar; os pontos em atenção entram no primeiro mês.',aceitar_apos_regularizar:'Há pendências graves: aceitar depois de um orçamento de regularização, à parte, aprovado pela cliente.',nao_aceitar:'Fora do escopo por enquanto: indicar outro contador, com cuidado e sem deixar a cliente sem saída.'}[recomendacao];
  return {nivel,recomendacao,mensagem:msg,achados:A.sort((x,y)=>({alta:0,media:1,baixa:2}[x.gravidade]-{alta:0,media:1,baixa:2}[y.gravidade])),totalDasAtrasado:totDas,
    orcamentoRegularizacao:{horasEstimadas:horas,observacao:'horas do contador para regularizar; valor combinado à parte, antes do contrato. Estimativa.'},
    aviso:'O diagnóstico organiza o que foi levantado pelo contador no e-CAC; nada foi consultado automaticamente.'}}
if(typeof module!=='undefined')module.exports={diagnosticoFiscal};
