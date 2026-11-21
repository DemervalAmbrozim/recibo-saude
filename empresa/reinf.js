/* EFD-Reinf ASSISTIDA e verificador de ECD/ECF (21/11/2026, pedido do Demerval: "Faz poxa").
   O que faz: apura retenções na fonte (IR, CSRF, INSS) de pagamentos a pessoas jurídicas, monta os eventos da EFD-Reinf
   (R-1000, R-2010, R-4010/4020, fechamento R-2099/R-4099) como RASCUNHO em objeto e em XML, e valida campos obrigatórios.
   O que NÃO faz: assinar nem transmitir (exige e-CNPJ A1 e procuração); não afirma validação contra o XSD oficial.
   Alíquotas são parâmetros editáveis com [conferir] para o contador; o contador decide e transmite.
   Carregar sem dependências; funciona no navegador e no teste (vm). */
const r2R=x=>Math.round((+x||0)*100)/100;
const PARAM_REINF={irServico:0.015,csrf:0.0465,inssCessao:0.11,minRetencao:10,
  codIR:'1708',codCSRF:'5952',nota:'Alíquotas e códigos de partida [conferir com o contador]: IR 1,5% serviços profissionais (cód. 1708), CSRF 4,65% (cód. 5952), INSS 11% na cessão de mão de obra; retenção abaixo de R$ 10,00 não é recolhida.'};
const soDig=s=>String(s==null?'':s).replace(/\D/g,'');
const escX=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

// pag: [{data,cnpjBeneficiario,nomeBeneficiario,natureza:'servico'|'cessao',valorBruto,optanteSimples:boolean,declaracaoSimples:boolean}]
// Prestador optante do Simples com declaração anexa (Lei 9.430/96, art. 3º-4º [conferir]) não sofre IR/CSRF.
function apurarRetencoes(pag,competencia,param){
  const P={...PARAM_REINF,...(param||{})},linhas=[],avisos=[];
  (pag||[]).filter(p=>String(p.data||'').startsWith(competencia)).forEach(p=>{
    const bruto=r2R(p.valorBruto),cnpj=soDig(p.cnpjBeneficiario),L={...p,cnpj,bruto,ir:0,csrf:0,inss:0,motivo:''};
    if(cnpj.length!==14){avisos.push(`Pagamento de ${bruto} sem CNPJ válido do beneficiário: não entra na Reinf; conferir se é pessoa física (R-4010) [conferir].`);L.motivo='sem CNPJ válido';linhas.push(L);return}
    if(!(bruto>0)){L.motivo='valor zero';linhas.push(L);return}
    if(p.natureza==='cessao'){L.inss=r2R(bruto*P.inssCessao);L.motivo='cessão de mão de obra: INSS retido (R-2010)'}
    else if(p.optanteSimples&&p.declaracaoSimples){L.motivo='prestador optante do Simples com declaração: sem retenção de IR/CSRF'}
    else{L.ir=r2R(bruto*P.irServico);L.csrf=r2R(bruto*P.csrf);L.motivo='serviço de PJ: IR e CSRF (R-4020)';
      if(p.optanteSimples&&!p.declaracaoSimples)avisos.push(`Beneficiário ${cnpj} é optante do Simples mas não há declaração: pedir a declaração antes de reter.`)}
    // retenção de IR abaixo do mínimo não é recolhida; CSRF idem (regra de partida, conferir)
    if(L.ir>0&&L.ir<P.minRetencao){L.ir=0;L.motivo+=' (IR abaixo de R$ 10: não recolhe)'}
    if(L.csrf>0&&L.csrf<P.minRetencao&&L.ir===0){L.csrf=0}
    linhas.push(L)});
  const t={ir:0,csrf:0,inss:0,bruto:0};linhas.forEach(l=>{t.ir+=l.ir;t.csrf+=l.csrf;t.inss+=l.inss;t.bruto+=l.bruto});
  Object.keys(t).forEach(k=>t[k]=r2R(t[k]));
  return {competencia,linhas,totais:t,movimento:linhas.some(l=>l.ir||l.csrf||l.inss),avisos,parametros:P}}

// Eventos da EFD-Reinf em rascunho. empresa: {cnpj,razao,classificacaoTributaria}; software: {nome}
function eventosReinf(ap,empresa,opc){
  const E=empresa||{},ev=[],er=[],o=opc||{};
  if(soDig(E.cnpj).length!==14)er.push('CNPJ da empresa inválido ou ausente.');
  if(!/^\d{4}-\d{2}$/.test(String(ap.competencia||'')))er.push('Competência deve ser AAAA-MM.');
  if(!E.razao)er.push('Razão social ausente.');
  if(er.length)return {eventos:[],erros:er,avisos:ap.avisos||[]};
  ev.push({tipo:'R-1000',nome:'Informações do contribuinte',dados:{cnpj:soDig(E.cnpj),razao:E.razao,classificacaoTributaria:E.classificacaoTributaria||'[conferir: 99 – Pessoas jurídicas em geral / 01 Simples?]',contato:E.contato||''}});
  const inss=ap.linhas.filter(l=>l.inss>0);
  inss.forEach(l=>ev.push({tipo:'R-2010',nome:'Retenção de contribuição previdenciária – serviços tomados',dados:{cnpjPrestador:l.cnpj,valorBruto:l.bruto,retencaoInss:l.inss,competencia:ap.competencia}}));
  const pj=ap.linhas.filter(l=>l.ir>0||l.csrf>0);
  pj.forEach(l=>ev.push({tipo:'R-4020',nome:'Pagamentos a beneficiário pessoa jurídica',dados:{cnpjBeneficiario:l.cnpj,valorBruto:l.bruto,ir:l.ir,codIR:ap.parametros.codIR,csrf:l.csrf,codCSRF:ap.parametros.codCSRF,competencia:ap.competencia}}));
  if(inss.length||o.fecharSempre)ev.push({tipo:'R-2099',nome:'Fechamento dos eventos da série R-2000',dados:{competencia:ap.competencia,semMovimento:!inss.length}});
  if(pj.length||o.fecharSempre)ev.push({tipo:'R-4099',nome:'Fechamento dos eventos da série R-4000',dados:{competencia:ap.competencia,semMovimento:!pj.length}});
  return {eventos:ev,erros:[],avisos:ap.avisos||[],movimento:ap.movimento}}

function xmlReinf(evento){
  const linhas=Object.entries(evento.dados).map(([k,v])=>`  <${k}>${escX(v)}</${k}>`).join('\n');
  return `<!-- RASCUNHO NÃO ASSINADO, NÃO TRANSMITIDO. Conferir leiaute e XSD oficial vigentes antes de qualquer envio. -->\n<Reinf evento="${escX(evento.tipo)}">\n${linhas}\n</Reinf>`}

// ECD e ECF: verificador de obrigatoriedade. Não gera arquivo SPED: diz se é exigida e por quê.
// ficha: {regime:'simples'|'presumido'|'real'|'mei', inativa:boolean, distribuiuLucroAcimaBase:boolean}
function verificarECDECF(ficha){
  const f=ficha||{},R=f.regime||'simples',O=[];
  const add=(nome,obrigada,porque,fonte)=>O.push({nome,obrigada,porque,fonte});
  if(R==='simples'||R==='mei'){
    add('ECD',false,'Optante do Simples e MEI são dispensados da ECD, exceto o optante que distribui lucro acima do limite isento sem escrituração completa ou que tenha sido [conferir hipóteses da IN RFB 2.003/2021, art. 3º].','IN RFB 2.003/2021 [conferir]');
    add('ECF',false,'Optante do Simples e MEI são dispensados da ECF (IN RFB 2.004/2021) [conferir].','IN RFB 2.004/2021 [conferir]')}
  else{
    add('ECD',R==='real'?true:'conferir',R==='real'?'Lucro real é obrigado à ECD.':'Lucro presumido só é obrigado à ECD se distribuir lucros acima da base presumida sem escrituração completa [conferir].','IN RFB 2.003/2021 [conferir]');
    add('ECF',!f.inativa,f.inativa?'Pessoa jurídica inativa é dispensada [conferir].':'Lucro presumido e real entregam a ECF até o último dia útil de julho do ano seguinte [conferir].','IN RFB 2.004/2021 [conferir]')}
  return O.map(x=>({...x,aviso:R==='simples'||R==='mei'?'Se a empresa sair do Simples (excesso de receita ou mudança de regime), o sistema deve reavaliar ECD e ECF no mesmo mês.':''}))}
if(typeof module!=='undefined')module.exports={apurarRetencoes,eventosReinf,xmlReinf,verificarECDECF,PARAM_REINF};
