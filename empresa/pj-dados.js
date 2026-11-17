// Camada de dados da frente Empresa (17/11/2026): fala com as funções e tabelas pj_* do supabase/048 pelo cliente do Supabase (ou por um simulado nos testes).
// Regra: nada de dado clínico de paciente. Erros do banco viram frases em português. RLS e permissões moram no banco; aqui só chamamos.
// Rascunho: o SQL 048 só existe no PC até o "pode publicar" da frente Empresa; sem ele, o banco real responde "função não existe" e a tela mostra o aviso certo.
const ERROS_PJ={'precisa estar logado':'Entre com o seu e-mail primeiro.','sem permissao':'Você não tem permissão para esta ação.','so o contador lanca':'Só o contador lança na escrituração.','so o contador aprova a folha':'Só o contador aprova a folha.',
  'passos anteriores ainda nao concluidos':'Conclua os passos anteriores antes deste.','informe a prova da conclusao':'Escreva a prova da conclusão (protocolo, número ou data).','passo inexistente':'Esse passo ainda não foi criado para a empresa.'};
function traduzErroPj(e){const s=String((e&&e.message)||e||'');
  if(/Could not find the function|PGRST202|PGRST205|does not exist|schema cache/i.test(s))return 'A frente Empresa ainda não está ligada no servidor.';
  const k=Object.keys(ERROS_PJ).find(x=>s.includes(x));return k?ERROS_PJ[k]:'Não consegui salvar. Confira a internet e tente de novo.'}
// Converte o lançamento do livro (partidas com d e c) para o formato de pj_lancar: [{conta, d} | {conta, c}] em reais.
function partidasParaBanco(l){const out=[];for(const p of l.partidas||[]){if(p.d>0)out.push({conta:p.conta,d:Math.round(p.d*100)/100});if(p.c>0)out.push({conta:p.conta,c:Math.round(p.c*100)/100})}return out}
const primeiroDia=comp=>/^\d{4}-\d{2}$/.test(comp)?comp+'-01':comp;
function criaDados(sb){
  const ck=r=>{if(r&&r.error)throw new Error(r.error.message||String(r.error));return r&&r.data};
  return {
    async empresas(){return ck(await sb.rpc('pj_minhas_empresas'))||[]},
    async passos(emp){return ck(await sb.from('pj_passo').select('passo,status,dono,prova,prazo').eq('empresa_id',emp).order('passo'))||[]},
    async empregados(emp){return ck(await sb.from('pj_empregado').select('id,nome').eq('empresa_id',emp).order('nome'))||[]},
    async criarPassos(emp){return ck(await sb.rpc('pj_criar_passos',{emp}))},
    async concluirPasso(emp,passo,prova){await ck(await sb.rpc('pj_concluir_passo',{emp,p_passo:passo,p_prova:String(prova||'')}));return true},
    // Lança no livro do banco todos os lançamentos gerados pela conciliação. Devolve {ok, falhas:[{ref,motivo}]}; não para no primeiro erro.
    async lancarLote(emp,lancamentos,origem='conciliacao'){const res={ok:0,falhas:[]};
      for(const l of lancamentos){try{await ck(await sb.rpc('pj_lancar',{emp,p_data:l.data,p_historico:l.historico,p_partidas:partidasParaBanco(l),p_origem:origem,p_ref:l.ref||null}));res.ok++}catch(e){res.falhas.push({ref:l.ref||l.historico,motivo:traduzErroPj(e)})}}
      return res},
    async guardarRelatorio(emp,comp,dados){return ck(await sb.from('pj_relatorio_mes').upsert({empresa_id:emp,competencia:primeiroDia(comp),dados},{onConflict:'empresa_id,competencia'}))},
    async guardarFolha(emp,empregadoId,comp,resultado,versaoRegras,status='sombra'){if(!['rascunho','sombra'].includes(status))throw new Error('status de folha inválido para salvar');
      return ck(await sb.from('pj_folha_mes').upsert({empresa_id:emp,empregado_id:empregadoId,competencia:primeiroDia(comp),resultado,versao_regras:versaoRegras,status},{onConflict:'empregado_id,competencia'}))},
    async aprovarFolha(folhaId){await ck(await sb.rpc('pj_aprovar_folha',{p_folha:folhaId}));return true}
  }}
if(typeof module!=='undefined')module.exports={criaDados,traduzErroPj,partidasParaBanco,primeiroDia};
