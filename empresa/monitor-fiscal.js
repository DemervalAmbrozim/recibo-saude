/* MONITOR FISCAL (21/11/2026): transforma as respostas do Integra Contador (SERPRO) em alertas e em baixa de guia, sem tela de portal.
   Formatos conferidos nas respostas reais do ambiente de demonstração (app/empresa/exemplos-serpro.json). Em produção exige contrato, e-CNPJ A1 e procuração.
   Funções puras, sem rede. Carregar DEPOIS de guias.js (só para o nome das guias). */
const dIso=s=>{const t=String(s||'');return /^\d{8}$/.test(t)?`${t.slice(0,4)}-${t.slice(4,6)}-${t.slice(6,8)}`:/^\d{4}-\d{2}-\d{2}/.test(t)?t.slice(0,10):''};
const dEntre=(a,b)=>Math.round((Date.UTC(+b.slice(0,4),+b.slice(5,7)-1,+b.slice(8,10))-Date.UTC(+a.slice(0,4),+a.slice(5,7)-1,+a.slice(8,10)))/86400000);
const limpaAssunto=m=>String(m.assuntoModelo||'').replace('++VARIAVEL++',m.valorParametroAssunto||'').replace(/\s+/g,' ').trim();
// Caixa Postal: mensagens não lidas e com validade chegando. resp = {conteudo:[{listaMensagens:[...]}]}
function alertasCaixaPostal(resp,hoje){
  const msgs=((((resp||{}).conteudo||[])[0]||{}).listaMensagens)||[],out=[];
  for(const m of msgs){
    const naoLida=String(m.indicadorLeitura)==='0'&&!m.dataLeitura,val=dIso(m.dataValidade),dias=val&&hoje?dEntre(hoje,val):null;
    if(!naoLida)continue;
    const rel=+m.relevancia||2;   // 1 = alta (a Receita marca), 2 = normal
    const vencida=dias!==null&&dias<0;
    out.push({tipo:'caixa-postal',prioridade:rel===1?'alta':'media',texto:`Mensagem da Receita não lida: ${limpaAssunto(m)} (enviada em ${dIso(m.dataEnvio).split('-').reverse().join('/')}${val?`, validade ${val.split('-').reverse().join('/')}${vencida?' — JÁ VENCIDA':dias<=15?` — faltam ${dias} dias`:''}`:''}).`,
      dias,vencida,numeroControle:m.numeroControle||'',origem:m.descricaoOrigem||''})}
  return out.sort((a,b)=>(a.prioridade==='alta'?0:1)-(b.prioridade==='alta'?0:1)||(a.dias??9e9)-(b.dias??9e9))}
// Procurações: a que expira em até 30 dias (ou já expirou) vira alerta; sem ela o levantamento do cliente fica parcial
function alertasProcuracoes(lista,hoje){
  const out=[];
  for(const p of (Array.isArray(lista)?lista:[])){const ex=dIso(p.dtexpiracao);if(!ex||!hoje)continue;const dias=dEntre(hoje,ex);
    if(dias<0)out.push({tipo:'procuracao',prioridade:'alta',texto:`Procuração vencida em ${ex.split('-').reverse().join('/')} (${(p.sistemas||[]).join(', ')}): peça a renovação no e-CAC.`,dias});
    else if(dias<=30)out.push({tipo:'procuracao',prioridade:dias<=7?'alta':'media',texto:`Procuração vence em ${dias} dia(s), ${ex.split('-').reverse().join('/')} (${(p.sistemas||[]).join(', ')}): peça a renovação.`,dias})}
  return out.sort((a,b)=>a.dias-b.dias)}
// Baixa de guia pelo comprovante oficial (PagtoWeb): casa pelo tipo (DAS, DARF...) e período de apuração; prefere o oficial ao extrato.
// guias: saída de guiasDoMes ({id,nome,competencia,valor,vencimento}); pagamentos: lista do PAGAMENTOS71
function marcaPagoPorPagtoWeb(guias,pagamentos){
  const L=Array.isArray(pagamentos)?pagamentos:[];
  return (guias||[]).map(g=>{
    const alvo=/das/i.test(g.id+g.nome)?'DAS':/darf|carn|irpf/i.test(g.id+g.nome)?'DARF':/gps|inss/i.test(g.id+g.nome)?'GPS':'';
    const p=L.find(x=>{const t=String((x.tipo||{}).descricaoAbreviada||'').toUpperCase(),pa=dIso(x.periodoApuracao).slice(0,7);return alvo&&t===alvo&&pa===String(g.competencia||'').slice(0,7)});
    if(!p)return {guiaId:g.id,status:'sem comprovante',fonte:null};
    const pago=dIso(p.dataArrecadacao),atraso=g.vencimento&&pago>g.vencimento?dEntre(g.vencimento,pago):0,valorConfere=Math.abs((+p.valorTotal||0)-(+g.valor||0))<0.02;
    return {guiaId:g.id,status:atraso?'pago com atraso':'pago',dataPagamento:pago,atrasoDias:atraso,valorPago:+p.valorTotal||0,conferirValor:!valorConfere,fonte:'PagtoWeb (oficial)',numeroDocumento:p.numeroDocumento||''}})}
// Situação do contribuinte no DTE (domicílio tributário eletrônico)
function alertaDTE(r){return r&&r.statusEnquadramento?{tipo:'dte',prioridade:'baixa',texto:`Situação no DTE: ${r.statusEnquadramento}.`}:null}
// Junta tudo do cliente em uma lista de alertas ordenada (alta, média, baixa)
function monitorFiscalDoCliente({caixa,procuracoes,dte,hoje}){
  const A=[...alertasCaixaPostal(caixa,hoje),...alertasProcuracoes(procuracoes,hoje)],d=alertaDTE(dte);if(d)A.push(d);
  const o={alta:0,media:1,baixa:2};return A.sort((a,b)=>o[a.prioridade]-o[b.prioridade])}
if(typeof module!=='undefined')module.exports={alertasCaixaPostal,alertasProcuracoes,marcaPagoPorPagtoWeb,alertaDTE,monitorFiscalDoCliente,dIso};
