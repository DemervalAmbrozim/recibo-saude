// Camada de dados da frente Empresa (17/11/2026): fala com as funções e tabelas pj_* do supabase/048 pelo cliente do Supabase (ou por um simulado nos testes).
// Regra: nada de dado clínico de paciente. Erros do banco viram frases em português. RLS e permissões moram no banco; aqui só chamamos.
// Rascunho: o SQL 048 só existe no PC até o "pode publicar" da frente Empresa; sem ele, o banco real responde "função não existe" e a tela mostra o aviso certo.
const ERROS_PJ={'precisa estar logado':'Entre com o seu e-mail primeiro.','sem permissao':'Você não tem permissão para esta ação.','so o contador lanca':'Só o contador lança na escrituração.','so o contador aprova a folha':'Só o contador aprova a folha.',
  'passos anteriores ainda nao concluidos':'Conclua os passos anteriores antes deste.','informe a prova da conclusao':'Escreva a prova da conclusão (protocolo, número ou data).','segundo fator necessario':'Confirme o segundo fator (código do aplicativo autenticador) e tente de novo.','folha aprovada nao se altera':'Folha aprovada não pode ser alterada.','folha aprovada nao se apaga':'Folha aprovada não pode ser apagada.','passo concluido nao volta atras':'Passo concluído não volta atrás.','so a operacao altera':'Só a equipe altera situação, plano e dados de cobrança.','so o admin designa o contador':'Só o administrador designa o contador da empresa.','so o admin remove o contador':'Só o administrador remove o contador da empresa.','limite de 3 empresas por profissional':'Você já tem 3 empresas cadastradas (limite por profissional).','empresa inexistente':'Empresa não encontrada.','evento ja encerrado':'Este pedido já foi encerrado.','evento inexistente':'Pedido não encontrado.','total de passos invalido':'Pedido sem passos válidos.','evento ja enviado nao volta nem muda':'Evento já enviado não volta nem muda.','evento do esocial nao muda':'O evento do eSocial não muda de empresa, tipo ou empregado.','cpf invalido':'CPF inválido. Confira os números.','mais de 3 empregados':'Mais de 3 empregados: fora do escopo por enquanto.','passo inexistente':'Esse passo ainda não foi criado para a empresa.'};
function traduzErroPj(e,ctx){const s=String((e&&e.message)||e||'');
  if(/Could not find the function|PGRST202|PGRST205|does not exist|schema cache/i.test(s))return 'A frente Empresa ainda não está ligada no servidor.';
  const k=Object.keys(ERROS_PJ).find(x=>s.includes(x));return k?ERROS_PJ[k]:(ctx==='ler'?'Não consegui carregar agora. Confira a internet e tente de novo.':'Não consegui salvar. Confira a internet e tente de novo.')}
// Converte o lançamento do livro (partidas com d e c) para o formato de pj_lancar: [{conta, d} | {conta, c}] em reais.
function partidasParaBanco(l){const out=[];for(const p of l.partidas||[]){if(p.d>0)out.push({conta:p.conta,d:Math.round(p.d*100)/100});if(p.c>0)out.push({conta:p.conta,c:Math.round(p.c*100)/100})}return out}
const primeiroDia=comp=>/^\d{4}-\d{2}$/.test(comp)?comp+'-01':comp;
function criaDados(sb){
  const ck=r=>{if(r&&r.error)throw new Error(r.error.message||String(r.error));return r&&r.data};
  return {
    async empresas(){return ck(await sb.rpc('pj_minhas_empresas'))||[]},
    async passos(emp){return ck(await sb.from('pj_passo').select('passo,status,dono,prova,prazo').eq('empresa_id',emp).order('passo'))||[]},
    async empregados(emp){return ck(await sb.from('pj_empregado').select('id,nome').eq('empresa_id',emp).order('nome'))||[]},
    async souTitular(){return ck(await sb.rpc('pj_sou_titular'))},
    async eventos(emp){return ck(await sb.from('pj_evento').select('id,tipo,status,passos,dados,criado_em,concluido_em').eq('empresa_id',emp).order('criado_em',{ascending:false}))||[]},
    async abrirEvento(emp,tipo,dados,total){return ck(await sb.rpc('pj_abrir_evento',{emp,p_tipo:tipo,p_dados:dados||{},p_total:total}))},
    async passoEvento(evento,i,prova){return ck(await sb.rpc('pj_evento_passo',{p_evento:evento,p_i:i,p_prova:String(prova||'')}))},
    async cancelarEvento(evento){await ck(await sb.rpc('pj_cancelar_evento',{p_evento:evento}));return true},
    async filaEsocial(emp){return ck(await sb.from('pj_esocial_evento').select('id,empresa_id,empregado_id,tipo,competencia,status,protocolo,recibo,erro,criado_em').eq('empresa_id',emp).order('criado_em',{ascending:false}))||[]},
    // Só entra como rascunho ou pronto; enviado e aceito vêm do retorno da transmissão (com protocolo e recibo)
    async marcarEsocialPronto(id){return ck(await sb.from('pj_esocial_evento').update({status:'pronto'}).eq('id',id).eq('status','rascunho'))},
    async enfileirarEsocial(emp,tipo,competencia,payload,empregadoId=null,status='rascunho'){if(!['rascunho','pronto'].includes(status))throw new Error('status invalido para enfileirar');if(!/^S-\d{4}$/.test(tipo))throw new Error('tipo do evento invalido');
      return ck(await sb.from('pj_esocial_evento').insert({empresa_id:emp,empregado_id:empregadoId,tipo,competencia:competencia?primeiroDia(competencia):null,payload,status}))},
    async socios(emp){return ck(await sb.from('pj_socio').select('id,nome,cpf,participacao,administrador,prolabore').eq('empresa_id',emp).order('nome'))||[]},
    async salvarSocio(emp,s){const cpf=String(s.cpf||'').replace(/\D/g,'');return ck(await sb.from('pj_socio').upsert({empresa_id:emp,nome:String(s.nome||'').trim(),cpf,participacao:+s.participacao,administrador:!!s.administrador,prolabore:s.prolabore==null||s.prolabore===''?null:+s.prolabore},{onConflict:'empresa_id,cpf'}))},
    async empregadosFicha(emp){return ck(await sb.from('pj_empregado').select('id,nome,cargo,salario,admissao,desligamento').eq('empresa_id',emp).order('nome'))||[]},
    async salvarEmpregado(emp,e){const cpf=String(e.cpf||'').replace(/\D/g,'');return ck(await sb.from('pj_empregado').upsert({empresa_id:emp,nome:String(e.nome||'').trim(),cpf,cargo:String(e.cargo||''),salario:+e.salario,admissao:e.admissao,dependentes:+e.dependentes||0,vt_custo:+e.vt_custo||0},{onConflict:'id'}))},
    async alertas(emp){return ck(await sb.from('pj_alerta').select('id,nivel,texto,criado_em,resolvido_em').eq('empresa_id',emp).order('criado_em',{ascending:false}))||[]},
    async relatorios(emp){return ck(await sb.from('pj_relatorio_mes').select('competencia,dados,enviado_em').eq('empresa_id',emp).order('competencia',{ascending:false}))||[]},
    async criarPassos(emp){return ck(await sb.rpc('pj_criar_passos',{emp}))},
    async concluirPasso(emp,passo,prova){await ck(await sb.rpc('pj_concluir_passo',{emp,p_passo:passo,p_prova:String(prova||'')}));return true},
    // Lança no livro do banco todos os lançamentos gerados pela conciliação. Devolve {ok, falhas:[{ref,motivo}]}; não para no primeiro erro.
    async lancarLote(emp,lancamentos,origem='conciliacao'){const res={ok:0,falhas:[]};
      for(const l of lancamentos){try{await ck(await sb.rpc('pj_lancar',{emp,p_data:l.data,p_historico:l.historico,p_partidas:partidasParaBanco(l),p_origem:origem,p_ref:l.ref||null}));res.ok++}catch(e){res.falhas.push({ref:l.ref||l.historico,motivo:traduzErroPj(e)})}}
      return res},
    async guardarRelatorio(emp,comp,dados){return ck(await sb.from('pj_relatorio_mes').upsert({empresa_id:emp,competencia:primeiroDia(comp),dados},{onConflict:'empresa_id,competencia'}))},
    async guardarFolha(emp,empregadoId,comp,resultado,versaoRegras,status='sombra'){if(!['rascunho','sombra'].includes(status))throw new Error('status de folha inválido para salvar');
      return ck(await sb.from('pj_folha_mes').upsert({empresa_id:emp,empregado_id:empregadoId,competencia:primeiroDia(comp),resultado,versao_regras:versaoRegras,status},{onConflict:'empregado_id,competencia'}))},
    async designarContador(emp,userId){await ck(await sb.rpc('pj_designar_contador',{emp,p_user:userId}));return true},
    async removerContador(emp,userId){await ck(await sb.rpc('pj_remover_contador',{emp,p_user:userId}));return true},
    async aprovarFolha(folhaId){await ck(await sb.rpc('pj_aprovar_folha',{p_folha:folhaId}));return true}
  }}
if(typeof module!=='undefined')module.exports={criaDados,traduzErroPj,partidasParaBanco,primeiroDia};
