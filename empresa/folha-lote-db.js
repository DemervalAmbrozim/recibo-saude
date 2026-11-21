/* FOLHA EM LOTE com dados REAIS (21/11/2026): liga folha-lote.js ao banco pelo criaDados (pj-dados.js). Carregar DEPOIS de folha-lote.js.
   Regras: nunca rebaixa folha aprovada sem mudança de números; só grava como 'sombra'; aprovar chama pj_aprovar_folha (só o contador, com 2º fator, no servidor);
   o sistema não paga. As variáveis do mês (faltas, horas extras) o contador digita depois que a cliente responde; ficam só na tela até gravar a sombra. */
const empParaFolha=r=>({id:r.id,nome:r.nome,salario:+r.salario,divisor:220,dependentes:+r.dependentes||0,filhosSF:+r.filhos_sf||0,vtCusto:+r.vt_custo||0});
const ativoNaComp=(r,comp)=>{const ini=String(r.admissao||'0000').slice(0,7),fim=r.desligamento?String(r.desligamento).slice(0,7):'9999-99';return ini<=comp&&comp<=fim};
// Lê empresas, empregados e folhas já gravadas do mês. Devolve {carteira, folhas:{empregadoId:{id,status,resultado}}, empresaDe:{clienteId:empresaId}}
async function carregarCarteiraReal(DB,comp){
  const emps=(await DB.empresas()).filter(e=>e.situacao!=='cancelada'&&e.situacao!=='baixada');
  const carteira=[],folhas={},empresaDe={};
  for(const e of emps){
    const lista=(await DB.empregadosFolha(e.id)).filter(r=>ativoNaComp(r,comp));
    if(!lista.length&&!(+e.num_empregados>0))continue;   // empresa sem empregados não entra na fila
    carteira.push({id:e.id,nome:e.razao_social||'Empresa sem nome',anterior:lista.map(empParaFolha)});empresaDe[e.id]=e.id;
    for(const f of await DB.folhasDoMes(e.id,comp))folhas[f.empregado_id]={id:f.id,status:f.status,resultado:f.resultado}}
  return {carteira,folhas,empresaDe}}
// Aprovações vindas do banco: um cliente conta como aprovado se TODAS as folhas dos empregados estão 'aprovada' ou 'paga' e os números gravados batem com os calculados agora
function aprovacoesDoBanco(lote,folhas){
  const ap={};
  for(const c of lote.clientes){
    if(!c.folha.completa||!c.folha.itens.length)continue;
    const ok=c.folha.itens.every(i=>{const f=folhas[i.id];return i.pronto&&f&&(f.status==='aprovada'||f.status==='paga')&&f.resultado&&Math.abs((+f.resultado.liquido||0)-(i.folha.liquido||0))<0.005&&Math.abs((+f.resultado.fgts||0)-(i.folha.fgts||0))<0.005});
    if(ok)ap[c.id]={por:'banco',em:null,assinatura:c.assinatura}}
  return ap}
// Grava como sombra o que está pronto e ainda não existe igual no banco. Não toca em folha aprovada/paga com os mesmos números.
async function gravarSombras(DB,lote,folhas,versao){
  const r={gravadas:0,ignoradas:0,falhas:[]};
  for(const c of lote.clientes){if(!c.folha.completa)continue;
    for(const i of c.folha.itens){if(!i.pronto)continue;const f=folhas[i.id];
      const igual=f&&f.resultado&&Math.abs((+f.resultado.liquido||0)-(i.folha.liquido||0))<0.005&&Math.abs((+f.resultado.fgts||0)-(i.folha.fgts||0))<0.005;
      if(igual){r.ignoradas++;continue}
      try{await DB.guardarFolha(c.id,i.id,lote.comp,i.folha,versao||'folha.js','sombra');r.gravadas++}catch(e){r.falhas.push({cliente:c.nome,empregado:i.nome,motivo:String(e.message||e)})}}}
  return r}
// Aprova no banco todas as folhas do cliente (recarregue os ids antes: a gravação cria as linhas). Qualquer erro do servidor (sem 2º fator, sem permissão) volta para a tela.
async function aprovarClienteNoBanco(DB,cliente,folhas){
  const r={aprovadas:0,falhas:[]};
  for(const i of cliente.folha.itens){const f=folhas[i.id];if(!f){r.falhas.push({empregado:i.nome,motivo:'folha ainda não gravada'});continue}
    if(f.status==='aprovada'||f.status==='paga'){r.aprovadas++;continue}
    try{await DB.aprovarFolha(f.id);r.aprovadas++}catch(e){r.falhas.push({empregado:i.nome,motivo:String(e.message||e)})}}
  return r}
if(typeof module!=='undefined')module.exports={carregarCarteiraReal,aprovacoesDoBanco,gravarSombras,aprovarClienteNoBanco,empParaFolha,ativoNaComp};
