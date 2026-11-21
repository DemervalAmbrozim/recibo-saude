/* FOLHA EM LOTE para o contador (21/11/2026): todos os clientes numa fila, só o que exige decisão dele.
   Usa folhaDoMes (fechamento.js) e calculaFolha (folha.js); carregar DEPOIS deles. Sem acesso ao banco.
   Regras: a folha nunca nasce aprovada; aprovar só se estiver completa e sem erro; mudou qualquer variável depois da aprovação,
   a aprovação cai (assinatura dos números) e volta para a fila. O sistema NÃO paga nada: aprovar libera FGTS e Fator R do mês. */
const r2L=x=>Math.round((+x||0)*100)/100;
// assinatura simples e estável dos números de uma folha (não é criptografia; serve para detectar mudança)
function assinaturaFolha(itens){const s=(itens||[]).map(i=>[i.id,i.pronto?1:0,i.folha?i.folha.liquido:'',i.folha?i.folha.fgts:''].join(':')).join('|');let h=5381;for(let k=0;k<s.length;k++)h=((h<<5)+h+s.charCodeAt(k))>>>0;return h.toString(16)}
// carteira: [{id,nome,anterior:[...funcionários],variaveis:{idFunc:mov|null}}]; aprovacoes: {idCliente:{por,em,assinatura}}
function loteFolha({carteira,aprovacoes={},comp,ano}){
  const clientes=(carteira||[]).map(c=>{
    const fo=folhaDoMes({anterior:c.anterior||[],variaveis:c.variaveis||{},comp,ano}),ass=assinaturaFolha(fo.itens);
    const erro=fo.itens.some(i=>!i.pronto&&/^(erro|dados inválidos)/.test(i.motivo||''));
    const ap=aprovacoes[c.id],aprovada=!!(ap&&ap.assinatura===ass&&fo.completa&&!erro);
    let status=!(c.anterior||[]).length?'sem funcionários':erro?'com erro':!fo.completa?'aguardando a cliente':aprovada?'aprovada':ap?'mudou depois de aprovada':'pronta para aprovar';
    // 21/11: avisos de afastamento/SST (afastamentos.js). Só informam o contador; NÃO entram na assinatura da aprovação. c.afastamentos = {idEmpregado:[eventos]}
    const avisos=[];
    if(typeof alertasAfastamento==='function'&&c.afastamentos)for(const e of c.anterior||[]){const ev=c.afastamentos[e.id];if(!ev||!ev.length)continue;
      const r=alertasAfastamento({nome:e.nome,salario:e.salario},ev,null);
      if(r&&r.ok===false)avisos.push({nivel:'atencao',texto:`${e.nome}: ${r.erros.join('; ')}`});else if(r&&r.alertas)avisos.push(...r.alertas);else if(Array.isArray(r))avisos.push(...r)}
    return {id:c.id,nome:c.nome,status,avisos,assinatura:ass,folha:fo,aprovada,faltam:fo.pendentes.length,liquido:fo.totalLiquido,fgts:fo.totalFGTS,funcionarios:(c.anterior||[]).length}});
  const ordem={'com erro':0,'mudou depois de aprovada':1,'pronta para aprovar':2,'aguardando a cliente':3,'aprovada':4,'sem funcionários':5};
  clientes.sort((a,b)=>ordem[a.status]-ordem[b.status]||a.nome.localeCompare(b.nome));
  const cont=s=>clientes.filter(c=>c.status===s).length;
  return {comp,clientes,resumo:{total:clientes.length,paraAprovar:cont('pronta para aprovar')+cont('mudou depois de aprovada'),aguardando:cont('aguardando a cliente'),erros:cont('com erro'),aprovadas:cont('aprovada'),
    liquido:r2L(clientes.filter(c=>c.aprovada).reduce((s,c)=>s+c.liquido,0)),fgts:r2L(clientes.filter(c=>c.aprovada).reduce((s,c)=>s+c.fgts,0))},
    aviso:'Folha-sombra: o contador confere e aprova; o sistema não paga salário nem guia.'}}
// Devolve o novo mapa de aprovações ou lança erro explicando a recusa
function aprovarFolha(lote,idCliente,por,agora,aprovacoes={}){
  const c=lote.clientes.find(x=>x.id===idCliente);
  if(!c)throw new Error('cliente não encontrado');
  if(!por||!String(por).trim())throw new Error('informe quem aprova (contador)');
  if(c.status==='com erro')throw new Error('há dados inválidos nesta folha: corrija antes de aprovar');
  if(!c.folha.completa)throw new Error('faltam respostas da cliente: não dá para aprovar');
  if(c.status==='sem funcionários')throw new Error('cliente sem funcionários');
  return {...aprovacoes,[idCliente]:{por:String(por).trim(),em:agora||new Date().toISOString(),assinatura:c.assinatura}}}
// Texto único de cobrança para as clientes que faltam (o envio depende do modelo do zap; aqui só o texto)
function cobrancaPendentes(lote){return lote.clientes.filter(c=>c.status==='aguardando a cliente').map(c=>({id:c.id,nome:c.nome,faltam:c.faltam,texto:mensagemVariaveis({nome:c.nome},lote.comp)}))}
if(typeof module!=='undefined')module.exports={loteFolha,aprovarFolha,cobrancaPendentes,assinaturaFolha};
