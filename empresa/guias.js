// GUIAS ASSISTIDAS e OBRIGAÇÕES ACESSÓRIAS (20/11/2026, pedido do Demerval: "gerar as guias... DCTFWeb e EFD-Reinf").
// IMPORTANTE (decisão de honestidade): este módulo NÃO emite guia oficial e NÃO gera código de barras. DAS, DARF numerado (DCTFWeb) e DARF do Sicalc só valem
// quando emitidos pela Receita/Serpro; um código de barras montado por nós poderia ser pago errado. Aqui a gente PREPARA tudo (valor, código, competência,
// vencimento, onde emitir, passo a passo) e deixa claro que a emissão automática depende do contrato do Integra Contador (SERPRO), já ensaiado em ferramentas/das.py.
// Depende de regras.js (ultimoDiaUtil, diaUtil, dISO). ESTIMATIVA: o contador confere. Onde a regra não foi lida na fonte oficial, o texto traz [conferir].

const LINKS_GUIA={simples:'https://www8.receita.fazenda.gov.br/simplesnacional/',receita:'https://www.gov.br/receitafederal',fgts:'https://fgtsdigital.sit.trabalho.gov.br/',esocial:'https://www.gov.br/esocial'};
const brlG=v=>v==null?'-':(+v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const proxMes=c=>{const [a,m]=c.split('-').map(Number);return m===12?[a+1,1]:[a,m+1]};
const iso2=(a,m,d)=>`${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
// vencimento no dia 20 do mês seguinte; se o dia 20 não for dia útil, devolve o dia e marca "confirmarDia" (o contador confirma; não movemos sozinhos)
function dia20Guia(comp){const [a,m]=proxMes(comp),d=new Date(a,m-1,20);return {data:iso2(a,m,20),confirmarDia:!diaUtil(d)}}
// último dia útil do mês seguinte (Carnê-Leão e DCTFWeb)
function ultimoUtilSeguinte(comp){const [a,m]=proxMes(comp);return dISO(ultimoDiaUtil(a,m-1))}

// v: {carne, das, inssProLabore, irrfProLabore, fgts} em reais (qualquer um pode faltar). tipo: 'pf' (autônoma) ou 'pj' (empresa no Simples).
function guiasDoMes({comp,tipo='pj',v={},temFolha=false}){
  if(!/^\d{4}-\d{2}$/.test(comp||''))throw new Error('competência inválida');
  const G=[],auto={disponivel:false,via:'API Integra Contador (SERPRO)',motivo:'depende do contrato, do e-CNPJ e da procuração; ensaiado em ferramentas/das.py no ambiente de demonstração'};
  const nova=o=>G.push(Object.assign({competencia:comp,emissaoOficial:true,codigoDeBarras:null,emissaoAutomatica:auto,aviso:'Documento de apoio. A guia oficial é a emitida no portal indicado; confira valor e vencimento lá antes de pagar.'},o));
  if(tipo==='pf'){
    const val=+v.carne||0,pequeno=val>0&&val<10;
    nova({id:'darf-carne-leao',nome:'DARF do Carnê-Leão',codigoReceita:'0190',valor:pequeno?0:Math.round(val*100)/100,vencimento:ultimoUtilSeguinte(comp),confirmarDia:false,
      situacao:pequeno?'abaixo de R$ 10: a Receita não gera guia; o valor soma ao imposto do mês seguinte':(val>0?'a pagar':'sem imposto neste mês'),
      ondeEmitir:'Carnê-Leão Web (gov.br) > Emitir DARF, ou Sicalc',link:LINKS_GUIA.receita,
      passos:['Entre no gov.br e abra Meu Imposto de Renda > Carnê-Leão','Confira o demonstrativo do mês com os recibos importados','Emita o DARF com o código 0190 e o valor apurado','Pague até o vencimento e marque como pago no app']});
    return G}
  const das=v.das,inss=v.inssProLabore,irrf=v.irrfProLabore,fg=v.fgts;
  if(das!=null){const d=dia20Guia(comp);nova({id:'das',nome:'DAS do Simples Nacional',codigoReceita:'DAS (número gerado pelo PGDAS-D)',valor:Math.round(das*100)/100,vencimento:d.data,confirmarDia:d.confirmarDia,
    situacao:'a transmitir no PGDAS-D e depois gerar o DAS',ondeEmitir:'Portal do Simples Nacional > PGDAS-D > Gerar DAS',link:LINKS_GUIA.simples,
    passos:['Contador confere receita do mês, anexo e fator R','Transmitir a declaração do mês no PGDAS-D','Gerar o DAS do período e conferir o valor com o do app','Pagar até o vencimento (se o dia 20 não for dia útil, o contador confirma a data)']})}
  if(inss!=null){const d=dia20Guia(comp);nova({id:'inss-pro-labore',nome:'INSS do pró-labore (11%)',codigoReceita:'gerado na DCTFWeb (DARF numerado) [conferir o código no momento da emissão]',valor:Math.round(inss*100)/100,vencimento:d.data,confirmarDia:d.confirmarDia,
    situacao:'sai da DCTFWeb depois do fechamento do eSocial',ondeEmitir:'Portal e-CAC > DCTFWeb (guia do período)',link:LINKS_GUIA.receita,
    passos:['Transmitir os eventos do pró-labore no eSocial e fechar o período','Conferir a DCTFWeb do mês (os dados vêm do eSocial)','Transmitir a DCTFWeb e emitir o DARF do período','Pagar até o vencimento']})}
  if(irrf!=null&&irrf>0){const d=dia20Guia(comp);nova({id:'irrf-pro-labore',nome:'IRRF do pró-labore',codigoReceita:'0561-07 (trabalho assalariado) [conferir para pró-labore]',valor:Math.round(irrf*100)/100,vencimento:d.data,confirmarDia:d.confirmarDia,
    situacao:'sai da DCTFWeb junto com os demais tributos do período',ondeEmitir:'Portal e-CAC > DCTFWeb',link:LINKS_GUIA.receita,
    passos:['Eventos do eSocial transmitidos e período fechado','Conferir o IRRF na DCTFWeb','Emitir o DARF numerado e pagar até o vencimento']})}
  if(temFolha&&fg!=null){const d=dia20Guia(comp);nova({id:'fgts',nome:'FGTS Digital',codigoReceita:'guia gerada no FGTS Digital',valor:Math.round(fg*100)/100,vencimento:d.data,confirmarDia:d.confirmarDia,
    situacao:'a guia é gerada depois do fechamento da folha no eSocial',ondeEmitir:'FGTS Digital (gov.br)',link:LINKS_GUIA.fgts,
    passos:['Fechar a folha do mês no eSocial','Abrir o FGTS Digital e conferir o valor devido por empregado','Emitir a guia (Pix ou boleto) e pagar até o vencimento']})}
  return G}

// Quem precisa de quê. ficha: {temEmpregado, temProLabore, retencoesNaFonte (INSS em nota de serviço tomado, IR/CSLL/PIS/COFINS retidos ou sofridos), prestaServicoSaude}
function obrigacoesAcessorias(ficha){
  const f=ficha||{},O=[],add=(nome,obrigada,porque,prazo,fonte)=>O.push({nome,obrigada,porque,prazo,fonte});
  add('PGDAS-D (declaração mensal do Simples)',true,'Toda empresa optante entrega todo mês, mesmo sem receita (declaração sem movimento).','até o dia 20 do mês seguinte','Res. CGSN 140/2018 (conferir a redação vigente)');
  add('Informações socioeconômicas anuais (antiga DEFIS)',true,'Em 2027 a DEFIS deixa de existir e as informações do ano-calendário 2026 entram no PGDAS-D.','janeiro a março de 2027 [conferir o prazo no Portal]','Res. CGSN 190/2026, art. 38-B');
  const eso=!!(f.temEmpregado||f.temProLabore);
  add('eSocial',eso?true:'conferir',eso?'Há empregado ou sócio com pró-labore: os eventos de folha e remuneração são obrigatórios [conferir os eventos exigidos para o sócio].':'Sem empregado e sem pró-labore, só o eventos não periódicos que existirem [conferir].','dia 15 do mês seguinte (fechamento da folha)','Leiaute S-1.3; ferramentas/esocial_eventos.py gera e valida, a transmissão exige certificado');
  add('DCTFWeb',eso?true:'conferir',eso?'Os fatos geradores de contribuição previdenciária do eSocial (empregado, pró-labore) alimentam a DCTFWeb, que também gera o DARF numerado [conferir a obrigatoriedade para o Simples sem retenção].':'Sem movimento previdenciário a empresa pode ficar dispensada [conferir].','último dia útil do mês seguinte [conferir]','IN RFB 2.005/2021 e atualizações [conferir]; Integra Contador oferece transmitir e emitir a guia');
  const ret=!!f.retencoesNaFonte;
  add('EFD-Reinf',ret?true:false,ret?'Há retenção na fonte (INSS em serviço tomado, IR/CSLL/PIS/COFINS): eventos da série R-2000 e R-4000 [conferir quais].':'Sem retenção na fonte e sem movimento, a empresa não entrega EFD-Reinf "sem movimento" [conferir na IN RFB 2.043/2021]. Optante do Simples só entra nos casos de retenção.','dia 15 do mês seguinte (quando houver evento)','IN RFB 2.043/2021 [conferir]; NÃO desenvolvido: só orientamos e avisamos; o contador decide');
  add('DMED',f.prestaServicoSaude===false?'conferir':true,'Prestadora de serviços de saúde informa os recebimentos de pessoas físicas.','último dia útil de fevereiro','ADE Cofis 27/2025; ferramentas/dmed.py gera o arquivo, a empresa transmite');
  add('ECD e ECF',false,'Dispensadas para o optante do Simples [conferir], sem prejuízo da escrituração contábil que o sistema já mantém.','-','LC 123/2006 [conferir]');
  return O}

function htmlGuia(g,empresa){const e=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const [a,m,d]=g.vencimento.split('-');
  return `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${e(g.nome)} ${e(g.competencia)}</title><style>body{font-family:system-ui,sans-serif;max-width:640px;margin:20px auto;padding:0 14px;color:#111}h1{font-size:22px;margin:0 0 4px}.faixa{background:#fff3cd;border:2px solid #b7791f;border-radius:10px;padding:10px 12px;font-weight:700;margin:10px 0}table{width:100%;border-collapse:collapse;margin:10px 0}td{border-bottom:1px solid #ddd;padding:7px 4px;font-size:15px}td:first-child{color:#555;width:42%}ol{padding-left:20px}small{color:#555}</style>
<h1>${e(g.nome)}</h1><div>${e((empresa&&empresa.nome)||'')} ${empresa&&empresa.cnpj?'· CNPJ '+e(empresa.cnpj):''}</div>
<div class="faixa">NÃO É A GUIA OFICIAL. Documento de apoio: emita a guia no portal indicado abaixo e confira valor e vencimento lá.</div>
<table><tr><td>Competência</td><td>${e(g.competencia)}</td></tr><tr><td>Valor estimado</td><td><b>${brlG(g.valor)}</b></td></tr><tr><td>Vencimento</td><td>${d}/${m}/${a}${g.confirmarDia?' (dia sem expediente: o contador confirma a data)':''}</td></tr><tr><td>Código de receita</td><td>${e(g.codigoReceita)}</td></tr><tr><td>Situação</td><td>${e(g.situacao)}</td></tr><tr><td>Onde emitir</td><td>${e(g.ondeEmitir)}<br><small>${e(g.link)}</small></td></tr></table>
<b>Passo a passo</b><ol>${g.passos.map(p=>'<li>'+e(p)+'</li>').join('')}</ol>
<p><small>Emissão automática pela API Integra Contador (SERPRO): ${g.emissaoAutomatica.disponivel?'ligada':'ainda não ligada, '+e(g.emissaoAutomatica.motivo)+'.'} Estimativa; o contador responsável confere.</small></p></html>`}
if(typeof module!=='undefined')module.exports={guiasDoMes,obrigacoesAcessorias,htmlGuia,dia20Guia,ultimoUtilSeguinte};
