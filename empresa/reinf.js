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
    else{L.ir=r2R(bruto*P.irServico);L.csll=r2R(bruto*0.01);L.cofins=r2R(bruto*0.03);L.pp=r2R(bruto*0.0065);L.csrf=r2R(L.csll+L.cofins+L.pp);L.motivo='serviço de PJ: IR e CSRF (R-4020)';
      if(p.optanteSimples&&!p.declaracaoSimples)avisos.push(`Beneficiário ${cnpj} é optante do Simples mas não há declaração: pedir a declaração antes de reter.`)}
    // retenção de IR abaixo do mínimo não é recolhida; CSRF idem (regra de partida, conferir)
    if(L.ir>0&&L.ir<P.minRetencao){L.ir=0;L.motivo+=' (IR abaixo de R$ 10: não recolhe)'}
    if(L.csrf>0&&L.csrf<P.minRetencao&&L.ir===0){L.csrf=0;L.csll=L.cofins=L.pp=0}
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
    add('ECD',false,'Optante do Simples e MEI são dispensados da ECD (IN RFB 2.003/2021, art. 3º, I), exceto se no ano receberam aporte de capital de investidor-anjo (LC 123/2006, arts. 61-A a 61-D). Fonte: comentário contábil de 21/11/2026; a IN foi alterada pela IN RFB 2.142/2023: o contador confere a redação consolidada [conferir].','IN RFB 2.003/2021 [conferir]');
    add('ECF',false,'Optante do Simples e MEI são dispensados da ECF (IN RFB 2.004/2021) [conferir].','IN RFB 2.004/2021 [conferir]')}
  else{
    add('ECD',R==='real'?true:'conferir',R==='real'?'Lucro real é obrigado à ECD.':'Lucro presumido só é obrigado à ECD se distribuir lucros acima da base presumida sem escrituração completa [conferir].','IN RFB 2.003/2021 [conferir]');
    add('ECF',!f.inativa,f.inativa?'Pessoa jurídica inativa é dispensada [conferir].':'Lucro presumido e real entregam a ECF até o último dia útil de julho do ano seguinte [conferir].','IN RFB 2.004/2021 [conferir]')}
  return O.map(x=>({...x,aviso:R==='simples'||R==='mei'?'Se a empresa sair do Simples (excesso de receita ou mudança de regime), o sistema deve reavaliar ECD e ECF no mesmo mês.':''}))}

// Liga a Reinf aos pagamentos do sistema: itens do extrato conciliado (concilia.js: {data,valor<0,descricao,tipo:'despesa'}) + cadastro de prestadores
// cadastro: [{palavra:'CONTABILIDADE XYZ',cnpj,natureza:'servico'|'cessao',optanteSimples,declaracaoSimples}]. Sem cadastro, o pagamento NÃO é adivinhado:
// vai para "semCadastro" para o contador informar o CNPJ e a natureza (ou marcar que não é serviço de PJ).
function pagamentosParaReinf(itens,cadastro){
  const cad=(cadastro||[]).map(c=>({...c,_k:String(c.palavra||'').toUpperCase().trim()})).filter(c=>c._k);
  const pagamentos=[],semCadastro=[];
  (itens||[]).filter(i=>i&&i.tipo==='despesa'&&+i.valor<0).forEach(i=>{
    const d=String(i.descricao||'').toUpperCase(),c=cad.find(x=>d.includes(x._k));
    if(c)pagamentos.push({data:i.data,cnpjBeneficiario:c.cnpj,nomeBeneficiario:c.palavra,natureza:c.natureza||'servico',valorBruto:Math.abs(+i.valor),optanteSimples:!!c.optanteSimples,declaracaoSimples:!!c.declaracaoSimples,origemId:i.id});
    else semCadastro.push({data:i.data,descricao:i.descricao,valor:Math.abs(+i.valor),id:i.id})});
  return {pagamentos,semCadastro,aviso:semCadastro.length?`${semCadastro.length} pagamento(s) sem prestador cadastrado: informe o CNPJ e a natureza, ou marque que não é serviço de pessoa jurídica.`:''}}


// ---- XML no leiaute oficial v2.1.2 (xmlns por evento), SEM assinatura: a assinatura (e-CNPJ A1) é feita na transmissão. Validado com referencias/reinf-xsd (ferramentas/reinf-validar.py).
const NS_REINF={'R-1000':'evtInfoContribuinte','R-2099':'evtFechamento','R-4020':'evt4020PagtoBeneficiarioPJ','R-4099':'evt4099FechamentoDirf','R-2010':'evtTomadorServicos'};
const tg=(n,v)=>`<${n}>${escX(v)}</${n}>`, dec=v=>(Math.round((+v||0)*100)/100).toFixed(2).replace('.',',');   // o leiaute exige vírgula decimal
// ctx: {cnpj, razao, tpAmb:'2'(homologação)|'1', verProc, classTrib, contato:{nmCtt,cpfCtt}, natRend, perApur:'AAAA-MM', indEscrituracao:'0'|'1'}
function xmlReinfOficial(tipo,dados,ctx){
  const c=ctx||{},er=[],cnpj=soDig(c.cnpj),base=cnpj.slice(0,8);
  if(cnpj.length!==14)er.push('CNPJ da empresa inválido.');
  const ns=`http://www.reinf.esocial.gov.br/schemas/${NS_REINF[tipo]}/v2_01_02`;
  const seq=String(c.seq||1).padStart(5,'0'),agora=(c.agora||'20260101000000').replace(/\D/g,'').padEnd(14,'0').slice(0,14),id='ID1'+cnpj+agora+seq;
  const ideEvento=(ret)=>'<ideEvento>'+(ret||tipo==='R-2010'?tg('indRetif','1'):'')+(tipo==='R-1000'?'':tg('perApur',c.perApur||''))+tg('tpAmb',c.tpAmb||'2')+tg('procEmi','1')+tg('verProc',c.verProc||'LadoALadoSaude-1')+'</ideEvento>';
  const ideContri='<ideContri>'+tg('tpInsc','1')+tg('nrInsc',base)+'</ideContri>';
  if(tipo!=='R-1000'&&!/^\d{4}-\d{2}$/.test(String(c.perApur||'')))er.push('Competência (perApur) AAAA-MM obrigatória.');
  let corpo='',raiz='';
  if(tipo==='R-1000'){raiz='evtInfoContri';
    const ct=c.contato||{};if(!ct.nmCtt||soDig(ct.cpfCtt).length!==11)er.push('R-1000 exige contato com nome e CPF (11 dígitos).');
    if(!/^\d{2}$/.test(String(c.classTrib||'')))er.push('R-1000 exige classTrib (2 dígitos, tabela 08 do manual: o contador define).');
    corpo=ideEvento(false)+ideContri+'<infoContri><inclusao><idePeriodo>'+tg('iniValid',c.iniValid||c.perApur||'')+'</idePeriodo><infoCadastro>'+tg('classTrib',c.classTrib||'')+tg('indEscrituracao',c.indEscrituracao||'0')+tg('indDesoneracao','0')+tg('indAcordoIsenMulta','0')+'<contato>'+tg('nmCtt',ct.nmCtt||'')+tg('cpfCtt',soDig(ct.cpfCtt))+'</contato></infoCadastro></inclusao></infoContri>'}
  else if(tipo==='R-2099'){raiz='evtFechaEvPer';
    const cp=c.respInf;corpo=ideEvento(false)+ideContri+(cp?'<ideRespInf>'+tg('nmResp',cp.nmResp)+tg('cpfResp',soDig(cp.cpfResp))+'</ideRespInf>':'')+'<infoFech>'+['evtServTm','evtServPr','evtAssDespRec','evtAssDespRep','evtComProd','evtCPRB','evtAquis'].map(k=>tg(k,k==='evtServTm'&&dados.temR2010?'S':'N')).join('')+'</infoFech>'}
  else if(tipo==='R-4099'){raiz='evtFech'; /* fechRet 0 = fechamento, 1 = reabertura (XSD v2.1.2) */
    corpo=ideEvento(false)+ideContri+'<infoFech>'+tg('fechRet','0')+'</infoFech>'}
  else if(tipo==='R-4020'){raiz='evtRetPJ';
    if(!/^\d{5}$/.test(String(c.natRend||'')))er.push('R-4020 exige natRend (5 dígitos, tabela 01 do manual da EFD-Reinf: o contador define para cada serviço).');
    const b=dados;if(soDig(b.cnpjBeneficiario).length!==14)er.push('R-4020: CNPJ do beneficiário inválido.');
    const pg=(b.pagamentos||[]).map(x=>'<infoPgto>'+tg('dtFG',x.data)+tg('vlrBruto',dec(x.valorBruto))+'<retencoes>'+(x.ir>0?tg('vlrBaseIR',dec(x.valorBruto))+tg('vlrIR',dec(x.ir)):'')+(x.csll>0?tg('vlrBaseCSLL',dec(x.valorBruto))+tg('vlrCSLL',dec(x.csll))+tg('vlrBaseCofins',dec(x.valorBruto))+tg('vlrCofins',dec(x.cofins))+tg('vlrBasePP',dec(x.valorBruto))+tg('vlrPP',dec(x.pp)):'')+'</retencoes></infoPgto>').join('');
    corpo=ideEvento(true)+ideContri+'<ideEstab>'+tg('tpInscEstab','1')+tg('nrInscEstab',cnpj)+'<ideBenef>'+tg('cnpjBenef',soDig(b.cnpjBeneficiario))+'<idePgto>'+tg('natRend',c.natRend||'')+pg+'</idePgto></ideBenef></ideEstab>'}
  else if(tipo==='R-2010'){raiz='evtServTom';
    // Serviços TOMADOS com retenção de INSS (cessão de mão de obra/empreitada): dados = {cnpjPrestador, indObra, indCPRB, notas:[{serie,numDocto,dtEmissaoNF,vlrBruto,obs,servicos:[{tpServico,vlrBaseRet,vlrRetencao}]}]}.
    // tpServico (9 dígitos, tabela 06 do manual) e a obrigação de reter são do contador; sem vlrRetencao, calculo 11% da base (conferir).
    const b=dados||{};if(soDig(b.cnpjPrestador).length!==14)er.push('R-2010: CNPJ do prestador inválido.');
    if(!(b.notas||[]).length)er.push('R-2010 exige ao menos uma nota (série, número, data, valor bruto).');
    let tb=0,tbase=0,tret=0;
    const nfs=(b.notas||[]).map((n,i)=>{const rot='R-2010 nota '+(i+1)+': ';
      if(!n.numDocto)er.push(rot+'número do documento obrigatório.');if(!/^\d{4}-\d{2}-\d{2}$/.test(String(n.dtEmissaoNF||'')))er.push(rot+'data de emissão AAAA-MM-DD.');
      if(!(+n.vlrBruto>0))er.push(rot+'valor bruto deve ser maior que zero.');
      if(!(n.servicos||[]).length)er.push(rot+'informe ao menos um tipo de serviço (tpServico, tabela 06).');
      const sv=(n.servicos||[]).map(x=>{if(!/^\d{9}$/.test(String(x.tpServico||'')))er.push(rot+'tpServico deve ter 9 dígitos (tabela 06 do manual: o contador define).');
        const base=+x.vlrBaseRet||0,ret=x.vlrRetencao===undefined||x.vlrRetencao===null?Math.round(base*0.11*100)/100:+x.vlrRetencao;
        if(!(base>0))er.push(rot+'base de retenção deve ser maior que zero.');if(base>n.vlrBruto+0.005)er.push(rot+'base de retenção maior que o valor bruto.');
        tbase+=base;tret+=ret;return '<infoTpServ>'+tg('tpServico',x.tpServico)+tg('vlrBaseRet',dec(base))+tg('vlrRetencao',dec(ret))+'</infoTpServ>'}).join('');
      tb+=+n.vlrBruto||0;
      return '<nfs>'+tg('serie',n.serie||'1')+tg('numDocto',n.numDocto)+tg('dtEmissaoNF',n.dtEmissaoNF)+tg('vlrBruto',dec(n.vlrBruto))+(n.obs?tg('obs',String(n.obs).slice(0,250)):'')+sv+'</nfs>'}).join('');
    corpo=ideEvento(false)+ideContri+'<infoServTom><ideEstabObra>'+tg('tpInscEstab','1')+tg('nrInscEstab',cnpj)+tg('indObra',String(b.indObra||0))+'<idePrestServ>'+tg('cnpjPrestador',soDig(b.cnpjPrestador))+tg('vlrTotalBruto',dec(tb))+tg('vlrTotalBaseRet',dec(tbase))+tg('vlrTotalRetPrinc',dec(tret))+tg('indCPRB',String(b.indCPRB||0))+nfs+'</idePrestServ></ideEstabObra></infoServTom>'}
  else er.push('Evento '+tipo+' não suportado.');
  if(er.length)return {ok:false,erros:er};
  return {ok:true,erros:[],id,xml:`<Reinf xmlns="${ns}"><${raiz} id="${id}">${corpo}</${raiz}></Reinf>`}}
// Todos os eventos do mês no leiaute oficial: R-1000 (se pedir), R-4020 por beneficiário, R-4099; (R-2099 se houver R-2010, ainda não gerado)
function lotesReinfOficial(ap,ctx,opc){
  const o=opc||{},out=[],erros=[];let seq=0;const c0=()=>({...ctx,perApur:ap.competencia,seq:++seq});
  const add=(t,d)=>{const r=xmlReinfOficial(t,d,c0());(r.ok?out.push({tipo:t,id:r.id,xml:r.xml}):erros.push(...r.erros.map(e=>t+': '+e)))};
  if(o.incluirR1000)add('R-1000',{});
  const por={};ap.linhas.filter(l=>l.ir>0||l.csrf>0).forEach(l=>{(por[l.cnpj]=por[l.cnpj]||{cnpjBeneficiario:l.cnpj,pagamentos:[]}).pagamentos.push(l)});
  Object.values(por).forEach(b=>add('R-4020',b));
  const tem4020=Object.keys(por).length>0;
  if(tem4020||o.fecharSempre)add('R-4099',{semMovimento:!tem4020});
  const t2010=o.servicosTomados||[];t2010.forEach(b=>add('R-2010',b));
  if(t2010.length)add('R-2099',{temR2010:true,respInf:o.respInf});   // fechamento da série R-2xxx: evtServTm = S
  if(!t2010.length&&ap.linhas.some(l=>l.inss>0))erros.push('R-2010: há retenção de INSS (cessão de mão de obra), mas o evento exige as notas: informe em servicosTomados (série, número, data, tipo de serviço).');
  return {eventos:out,erros}}
if(typeof module!=='undefined')module.exports={xmlReinfOficial,lotesReinfOficial,pagamentosParaReinf,apurarRetencoes,eventosReinf,xmlReinf,verificarECDECF,PARAM_REINF};
