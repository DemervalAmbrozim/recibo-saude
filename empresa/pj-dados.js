// Camada de dados da frente Empresa (17/11/2026): fala com as funções e tabelas pj_* do supabase/048 pelo cliente do Supabase (ou por um simulado nos testes).
// Regra: nada de dado clínico de paciente. Erros do banco viram frases em português. RLS e permissões moram no banco; aqui só chamamos.
// Rascunho: o SQL 048 só existe no PC até o "pode publicar" da frente Empresa; sem ele, o banco real responde "função não existe" e a tela mostra o aviso certo.
const ERROS_PJ_EXTRA={
 'cnpj invalido':'O CNPJ não confere. Confira os 14 números e tente de novo.','cnpj ja cadastrado':'Este CNPJ já está cadastrado.','cpf invalido':'O CPF não confere. Confira os 11 números.','cpf ja cadastrado':'Este CPF já está cadastrado.',
 'regime fora do escopo por enquanto':'Por enquanto atendemos só empresas do Simples Nacional.','mais de 3 empregados: fora do escopo por enquanto':'Por enquanto a folha atende até 3 empregados.','limite de 3 empresas por profissional':'Cada profissional pode ter até 3 empresas.',
 'participacao total acima de 100':'A soma da participação dos sócios passa de 100%. Ajuste os percentuais.','lancamento desequilibrado':'O lançamento não fecha: o total de débitos precisa ser igual ao de créditos.',
 'cadastre-se como profissional primeiro':'Cadastre-se como profissional antes de abrir a empresa.','precisa aceitar os termos':'É preciso aceitar os termos para continuar.','precisa estar logado':'Entre na sua conta e tente de novo.',
 'entrada invalida':'Escolha como você chegou: já tenho CNPJ ou vou abrir.','ciclo invalido':'Escolha o ciclo do plano: mensal ou anual.','razao social invalida':'Informe a razão social da empresa.','nome invalido':'Informe o nome completo.','profissao invalida':'Escolha a profissão.','whatsapp invalido':'O WhatsApp não confere. Informe o DDD e o número.',
 'conta ja cadastrada':'Esta conta já existe. Entre com o seu e-mail.','so para titular da frente Empresa':'Esta função é só para quem tem a frente Empresa.','a frente Autonoma ja esta ativa':'A frente de autônomo já está ativa nesta conta.',
 'folha inexistente':'Não encontrei esta folha. Atualize a tela e tente de novo.','empresa inexistente':'Não encontrei esta empresa.','empresa cancelada':'Esta empresa está cancelada.','empresa nao e sua':'Esta empresa não é da sua conta.','conta nao encontrada':'Não encontrei a conta.',
 'evento aceito nao muda':'Este evento já foi aceito e não pode mudar.','evento ja enviado nao volta nem muda':'Este evento já foi enviado e não pode mudar.','retorno da transmissao so o servico grava':'O retorno da transmissão é gravado só pelo serviço de envio.','dados do pedido grandes demais':'O pedido ficou grande demais. Reduza o texto.',
 'empregado de outra empresa':'Este empregado é de outra empresa.','muitos pedidos abertos nesta empresa':'Há muitos pedidos abertos nesta empresa. Conclua alguns antes de abrir outro.','prova longa demais':'A prova ficou longa demais. Resuma em poucas linhas.',
 'link invalido':'Este link não vale mais. Peça um novo.','ja existe pedido de exclusao em andamento':'Já existe um pedido de exclusão em andamento.',
 'so o dono pode dar acesso':'Só o dono da conta pode dar acesso a outra pessoa.','so o dono da empresa pode dar acesso':'Só o dono da empresa pode dar acesso a outra pessoa.','so o dono tira acesso':'Só o dono da conta pode tirar um acesso.','so o dono ve quem tem acesso':'Só o dono da conta vê quem tem acesso.','essa pessoa ja tem outro acesso':'Esta pessoa já tem outro tipo de acesso.','nada para tirar':'Não há acesso para tirar.',
 'registro invalido':'Este registro profissional não confere.','ciclo so no teste':'O ciclo só pode ser escolhido durante o teste.','ciclo ja definido':'O ciclo do plano já foi escolhido.','sem cnpj':'Esta empresa ainda não tem CNPJ cadastrado.','incluido em nota':'Este pagamento já está em uma nota e não pode ser mudado.',
 'so a Assessoria confere a procuracao':'Só a Assessoria confere a procuração. Envie a sua e aguarde a conferência.','so a Assessoria informa a validade da procuracao':'Só a Assessoria informa a validade da procuração.','so a Assessoria muda a situacao da conta':'Só a Assessoria muda a situação da conta.',
 'ano invalido':'O ano informado não vale.','orcado invalido':'O orçado tem valor inválido. Use só números.','sem permissao':'Sua conta não tem permissão para esta ação.',
 'competencia fechada':'Esta competência está fechada. O contador precisa reabrir, com o motivo, para alterar.','so o contador fecha a competencia':'Só o contador fecha a competência.','so o contador reabre a competencia':'Só o contador reabre a competência.',
 'ha folha nao aprovada nesta competencia':'Ainda há folha em rascunho ou sombra neste mês. Aprove todas antes de fechar.','competencia ja fechada':'Esta competência já está fechada.','competencia deve ser o dia 1 do mes':'A competência deve ser o primeiro dia do mês.',
 'informe o motivo da reabertura':'Escreva o motivo da reabertura (pelo menos 10 letras).','competencia nao esta fechada':'Esta competência não está fechada.','o historico de parametros nao se reescreve':'O histórico de parâmetros não muda: registre uma nova vigência.',
 'pj_empregado_conta_coerente':'Para pagar em conta, informe banco, agência e conta.','pj_empregado_pix_coerente':'Para pagar por Pix, informe a chave Pix.','pj_empregado_pis_check':'O PIS/NIS deve ter 11 números.','pj_empregado_cbo_check':'O CBO deve ter 6 números.',
 'pj_empregado_pensao_coerente':'Confira a pensão: valor fixo precisa do valor; percentual precisa do percentual (até 50%).','pj_empregado_vinculo_coerente':'Confira o vínculo: aprendiz precisa de nascimento, horas e fim do contrato; estagiário, de nível e horas; intermitente, de valor da hora.'};
const ERROS_PJ={'essa pessoa ainda nao tem conta':'Essa pessoa ainda não entrou no app. Peça que ela entre com este e-mail e tente de novo.','voce ja tem acesso':'Esse é o seu próprio e-mail.','essa pessoa ja e dona':'Essa pessoa já é dona desta conta.','segundo fator necessario':'Confirme o código do 2º fator e tente de novo.','mensagem vazia':'Escreva a mensagem.','precisa estar logado':'Entre com o seu e-mail primeiro.','sem permissao':'Você não tem permissão para esta ação.','so o contador lanca':'Só o contador lança na escrituração.','so o contador aprova a folha':'Só o contador aprova a folha.',
  'passos anteriores ainda nao concluidos':'Conclua os passos anteriores antes deste.','informe a prova da conclusao':'Escreva a prova da conclusão (protocolo, número ou data).','passo anterior pendente':'Conclua o passo anterior antes deste.','so o contador conclui este passo':'Este passo é do contador.','passo invalido':'Passo inválido.','dados grandes demais':'Dados grandes demais para guardar.','segundo fator necessario':'Confirme o segundo fator (código do aplicativo autenticador) e tente de novo.','folha aprovada nao se altera':'Folha aprovada não pode ser alterada.','folha aprovada nao se apaga':'Folha aprovada não pode ser apagada.','passo concluido nao volta atras':'Passo concluído não volta atrás.','so a operacao altera':'Só a equipe altera situação, plano e dados de cobrança.','so o admin designa o contador':'Só o administrador designa o contador da empresa.','so o admin remove o contador':'Só o administrador remove o contador da empresa.','limite de 3 empresas por profissional':'Você já tem 3 empresas cadastradas (limite por profissional).','empresa inexistente':'Empresa não encontrada.','evento ja encerrado':'Este pedido já foi encerrado.','evento inexistente':'Pedido não encontrado.','total de passos invalido':'Pedido sem passos válidos.','evento ja enviado nao volta nem muda':'Evento já enviado não volta nem muda.','evento do esocial nao muda':'O evento do eSocial não muda de empresa, tipo ou empregado.','cpf invalido':'CPF inválido. Confira os números.','mais de 3 empregados':'Mais de 3 empregados: fora do escopo por enquanto.','passo inexistente':'Esse passo ainda não foi criado para a empresa.'};
function traduzErroPj(e,ctx){const s=String((e&&e.message)||e||'');
  if(/Could not find the function|PGRST202|PGRST205|does not exist|schema cache/i.test(s))return 'A frente Empresa ainda não está ligada no servidor.';
  const k=Object.keys(ERROS_PJ).find(x=>s.includes(x));if(k)return ERROS_PJ[k];const k2=Object.keys(ERROS_PJ_EXTRA).find(x=>s.includes(x));if(k2)return ERROS_PJ_EXTRA[k2];return (ctx==='ler'?'Não consegui carregar agora. Confira a internet e tente de novo.':'Não consegui salvar. Confira a internet e tente de novo.')}
// Converte o lançamento do livro (partidas com d e c) para o formato de pj_lancar: [{conta, d} | {conta, c}] em reais.
function partidasParaBanco(l){const out=[];for(const p of l.partidas||[]){if(p.d>0)out.push({conta:p.conta,d:Math.round(p.d*100)/100});if(p.c>0)out.push({conta:p.conta,c:Math.round(p.c*100)/100})}return out}
const primeiroDia=comp=>/^\d{4}-\d{2}$/.test(comp)?comp+'-01':comp;
// Campos do cadastro completo (070): só entram no envio se vierem preenchidos.
const CAMPOS_EMPREGADO_NOVOS=['pis','ctps_numero','ctps_serie','ctps_uf','cbo','categoria_esocial','sindicato','forma_pagamento','banco_codigo','agencia','conta_numero','pix_chave','tipo_vinculo','nascimento','fim_contrato','estagio_nivel','horas_semanais','valor_hora'];
function camposNovosEmpregado(e){const o={};for(const k of CAMPOS_EMPREGADO_NOVOS){if(e[k]!==undefined&&e[k]!==null&&String(e[k]).trim()!=='')o[k]=['horas_semanais','valor_hora'].includes(k)?+e[k]:String(e[k]).trim()}
  if(e.opcao_fgts!==undefined)o.opcao_fgts=!!e.opcao_fgts;if(e.pcd!==undefined)o.pcd=!!e.pcd;return o}
function criaDados(sb){
  const ck=r=>{if(r&&r.error)throw new Error(r.error.message||String(r.error));return r&&r.data};
  return {
    async empresas(){return ck(await sb.rpc('pj_minhas_empresas'))||[]},
    async passos(emp){return ck(await sb.from('pj_passo').select('passo,status,dono,prova,prazo').eq('empresa_id',emp).order('passo'))||[]},
    async empregados(emp){return ck(await sb.from('pj_empregado').select('id,nome').eq('empresa_id',emp).order('nome'))||[]},
    // Mensagens e documentos com o contador, e acesso de sócio (supabase/058)
    async mensagens(emp){return ck(await sb.from('pj_mensagem').select('id,lado,texto,criado_em,lida_em').eq('empresa_id',emp).order('id'))||[]},
    async enviarMensagem(emp,texto){return ck(await sb.rpc('pj_enviar_mensagem',{emp,p_texto:String(texto||'')}))},
    async marcarLidas(emp){return ck(await sb.rpc('pj_marcar_lidas',{emp}))},
    async documentos(emp){return ck(await sb.from('pj_documento').select('id,tipo,nome_arquivo,caminho,enviado_em').eq('empresa_id',emp).order('enviado_em',{ascending:false}))||[]},
    async enviarDocumento(emp,tipo,arquivo){
      if(!arquivo)throw new Error('Escolha o arquivo.');
      if(arquivo.size>10*1024*1024)throw new Error('Arquivo acima de 10 MB.');
      if(!/\.(pdf|png|jpe?g|xlsx?|csv|ofx|docx?)$/i.test(arquivo.name||''))throw new Error('Tipo de arquivo não aceito. Use PDF, imagem, planilha ou documento.');
      const nome=String(arquivo.name).replace(/[^\w.\-]+/g,'_').slice(-80),caminho=emp+'/'+Date.now()+'-'+nome;
      const up=await sb.storage.from('empresa-docs').upload(caminho,arquivo,{upsert:false});if(up.error)throw new Error(up.error.message||'envio');
      return ck(await sb.from('pj_documento').insert({empresa_id:emp,tipo,nome_arquivo:String(arquivo.name).slice(0,120),caminho}))},
    async linkDocumento(caminho){const r=await sb.storage.from('empresa-docs').createSignedUrl(caminho,60);if(r.error)throw new Error(r.error.message||'link');return r.data&&r.data.signedUrl},
    async souDono(){const r=await sb.rpc('minha_profissional');return !!ck(r)},
    async darAcessoSocio(emp,email){return ck(await sb.rpc('dar_acesso_socio',{emp,p_email:String(email||'')}))},
    async pessoasDaEmpresa(emp){const m=await sb.rpc('minha_profissional');const prof=ck(m);if(!prof)return[];const l=ck(await sb.rpc('pessoas_com_acesso',{prof}))||[];return l.filter(x=>x.papel==='socio'&&x.empresa_id===emp).map(x=>({...x,prof}))},
    async tirarAcessoSocio(prof,user,emp){return ck(await sb.rpc('tirar_acesso',{prof,p_user:user,emp}))},
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
    async empregadosFolha(emp){return ck(await sb.from('pj_empregado').select('id,nome,salario,admissao,desligamento,dependentes,filhos_sf,vt_custo').eq('empresa_id',emp).order('nome'))||[]},
    // Afastamentos (SQL 063): eventos de atestado, doença, acidente, maternidade, paternidade, demissão. Sem CID.
    async afastamentos(emp){return ck(await sb.from('pj_afastamento').select('id,empregado_id,tipo,inicio,fim,acidente_trabalho,nascimento,obs').eq('empresa_id',emp).order('inicio',{ascending:false}))||[]},
    async salvarAfastamento(emp,empregadoId,a){const tipos=['atestado','doenca','acidente','maternidade','paternidade','demissao','mudanca_funcao'];
      if(!tipos.includes(a.tipo))throw new Error('tipo de afastamento invalido');if(!/^\d{4}-\d{2}-\d{2}$/.test(a.inicio||''))throw new Error('data de inicio invalida');
      return ck(await sb.from('pj_afastamento').insert({empresa_id:emp,empregado_id:empregadoId,tipo:a.tipo,inicio:a.inicio,fim:a.fim||null,acidente_trabalho:!!a.acidenteTrabalho,nascimento:a.nascimento||null,obs:String(a.obs||'').slice(0,300)}))},
    // Trilha de auditoria (21/11/2026): quem aprovou o quê e quando. A leitura segue a regra do banco (equipe/contador); sem permissão volta vazio.
    async auditoria(emp,limite=30){return ck(await sb.from('pj_auditoria').select('id,acao,detalhe,em').eq('empresa_id',emp).order('em',{ascending:false}).limit(Math.min(100,Math.max(1,+limite||30))))||[]},
    async excluirAfastamento(emp,id){return ck(await sb.from('pj_afastamento').delete().eq('empresa_id',emp).eq('id',id))},
    async folhasDoMes(emp,comp){return ck(await sb.from('pj_folha_mes').select('id,empregado_id,status,resultado,aprovado_em').eq('empresa_id',emp).eq('competencia',primeiroDia(comp)))||[]},
    // 27/11 (supabase/069 e 070, já no banco): cadastro completo, parâmetros com vigência, lançamentos por competência e fechamento
    async empregadoCompleto(emp,id){return ck(await sb.from('pj_empregado').select('*').eq('empresa_id',emp).eq('id',id).maybeSingle())},
    async parametrosVigencia(emp){return ck(await sb.from('pj_parametro_vigencia').select('id,chave,valor,desde,motivo,criado_em').eq('empresa_id',emp).order('desde',{ascending:false}))||[]},
    async gravarParametro(emp,chave,valor,desde,motivo){return ck(await sb.from('pj_parametro_vigencia').insert({empresa_id:emp,chave:String(chave),valor,desde,motivo:String(motivo||'').trim()}))},
    async lancamentosDaCompetencia(emp,comp){return ck(await sb.from('pj_folha_lancamento').select('id,empregado_id,tipo,codigo,descricao,referencia,valor,origem').eq('empresa_id',emp).eq('competencia',primeiroDia(comp)).order('empregado_id'))||[]},
    async salvarLancamento(emp,empregadoId,comp,l){return ck(await sb.from('pj_folha_lancamento').insert({empresa_id:emp,empregado_id:empregadoId,competencia:primeiroDia(comp),tipo:l.tipo,codigo:String(l.codigo||'').trim(),descricao:String(l.descricao||'').trim(),referencia:l.referencia||null,valor:Math.round((+l.valor||0)*100)/100,origem:l.origem||'manual'}))},
    async apagarLancamento(emp,id){return ck(await sb.from('pj_folha_lancamento').delete().eq('empresa_id',emp).eq('id',id))},
    async competenciasFechadas(emp){return ck(await sb.from('pj_competencia_fechada').select('competencia,fechada_em').eq('empresa_id',emp).order('competencia',{ascending:false}))||[]},
    async fecharCompetencia(emp,comp){await ck(await sb.rpc('pj_fechar_competencia',{p_empresa:emp,p_competencia:primeiroDia(comp)}));return true},
    async reabrirCompetencia(emp,comp,motivo){await ck(await sb.rpc('pj_reabrir_competencia',{p_empresa:emp,p_competencia:primeiroDia(comp),p_motivo:String(motivo||'')}));return true},
    async reaberturas(emp){return ck(await sb.from('pj_competencia_reabertura').select('competencia,reaberta_em,motivo').eq('empresa_id',emp).order('reaberta_em',{ascending:false}))||[]},
    async empregadosFicha(emp){return ck(await sb.from('pj_empregado').select('id,nome,cargo,salario,admissao,desligamento').eq('empresa_id',emp).order('nome'))||[]},
    async salvarEmpregado(emp,e){const cpf=String(e.cpf||'').replace(/\D/g,'');return ck(await sb.from('pj_empregado').upsert({empresa_id:emp,nome:String(e.nome||'').trim(),cpf,cargo:String(e.cargo||''),salario:+e.salario,admissao:e.admissao,dependentes:+e.dependentes||0,vt_custo:+e.vt_custo||0,...camposNovosEmpregado(e)},{onConflict:'id'}))},
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
    async aprovarFolha(folhaId){await ck(await sb.rpc('pj_aprovar_folha',{p_folha:folhaId}));return true},
    // 055: diagnóstico fiscal e estado da baixa
    async guardarDiagnostico(emp,entrada,r){return ck(await sb.rpc('pj_guardar_diagnostico',{emp,p_entrada:entrada||{},p_nivel:r.nivel,p_recomendacao:r.recomendacao,p_horas:(r.orcamentoRegularizacao&&r.orcamentoRegularizacao.horasEstimadas)||0,p_resultado:{achados:r.achados,mensagem:r.mensagem,totalDasAtrasado:r.totalDasAtrasado}}))},
    async diagnosticos(emp){return ck(await sb.from('pj_diagnostico').select('id,nivel,recomendacao,horas_estimadas,criado_em').eq('empresa_id',emp).order('criado_em',{ascending:false}).limit(5))||[]},
    async baixaFeitos(emp){const r=ck(await sb.from('pj_baixa').select('feitos').eq('empresa_id',emp).maybeSingle());return (r&&r.feitos)||[]},
    async baixaMarcar(emp,passo,feito){return ck(await sb.rpc('pj_baixa_marcar',{emp,p_passo:passo,p_feito:!!feito}))||[]}
  }}
if(typeof module!=='undefined')module.exports={criaDados,traduzErroPj,partidasParaBanco,primeiroDia,camposNovosEmpregado};
