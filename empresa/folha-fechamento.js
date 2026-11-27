// Fechamento do mês da folha (27/11/2026): o que falta para FECHAR a competência de cada empresa e a rotina em lote (SIMULAÇÃO: não envia nada, não grava nada).
// Regra DURA = a mesma do banco (supabase/070, pj_fechar_competencia): não fecha com folha em rascunho ou sombra. As demais etapas são recomendações do Hexa (J) e não bloqueiam;
// o estado vem do que o usuário informa. Vencimentos de guia NÃO são calculados aqui: só os informados são conferidos. Envio real ao eSocial/FGTS Digital exige certificado e procuração.
(function(){
  const STATUS_FECHAVEL=['aprovada','paga'];
  // emp: {id, nome, competencia:'aaaa-mm', fechada:bool,
  //   folhas:[{empregado, status:'rascunho'|'sombra'|'aprovada'|'paga'}],
  //   conferenciaOk:bool|null, recibosGerados:bool|null,
  //   eventos:[{evento:'S-1200'|'S-1210'|'S-1299', status:'aceito'|'enviado'|'pendente'|'rejeitado'}],
  //   guias:[{tipo, vencimento:'aaaa-mm-dd', gerada:bool, paga:bool}] }
  function prontoParaFechar(emp,hoje){
    if(!emp||typeof emp!=='object')return{ok:false,erros:['empresa inválida']};
    const erros=[];if(!/^\d{4}-\d{2}$/.test(emp.competencia||''))erros.push('competência deve ser aaaa-mm');
    if(!Array.isArray(emp.folhas))erros.push('informe as folhas do mês');
    if(erros.length)return{ok:false,erros};
    const bloqueios=[],pendencias=[],passos=[],pas=(nome,estado,obrig,detalhe)=>passos.push({nome,estado,obrigatorio:!!obrig,detalhe:detalhe||''});
    if(emp.fechada){return{ok:true,id:emp.id,nome:emp.nome,competencia:emp.competencia,pode:false,jaFechada:true,bloqueios:[],pendencias:[],passos:[],proximaAcao:'Competência já fechada. Para alterar, reabrir com motivo (registrado).'}}
    const f=emp.folhas,naoAprov=f.filter(x=>!STATUS_FECHAVEL.includes(x.status));
    if(!f.length){bloqueios.push('Não há folha calculada nesta competência.');pas('Folhas calculadas','pendente',true,'nenhuma folha')}
    else if(naoAprov.length){bloqueios.push(naoAprov.length+' folha(s) ainda em rascunho ou sombra: o contador precisa aprovar ('+naoAprov.map(x=>x.empregado||'?').join(', ')+').');pas('Folhas aprovadas','pendente',true,naoAprov.length+' de '+f.length+' faltam')}
    else pas('Folhas aprovadas','ok',true,f.length+' de '+f.length);
    const tri=(v,msg,nome)=>{if(v===true)pas(nome,'ok',false);else{pendencias.push(msg);pas(nome,v===false?'pendente':'nao_informado',false)}};
    tri(emp.conferenciaOk,'Rodar as conferências antes de fechar (tela Conferências).','Conferências do mês');
    tri(emp.recibosGerados,'Gerar os recibos do mês.','Recibos gerados');
    const ev=Array.isArray(emp.eventos)?emp.eventos:[];
    for(const nome of['S-1200','S-1210','S-1299']){
      const e=ev.find(x=>x.evento===nome);
      if(!e){pendencias.push(nome+': sem informação de envio.');pas('eSocial '+nome,'nao_informado',false);continue}
      if(e.status==='aceito')pas('eSocial '+nome,'ok',false);
      else if(e.status==='rejeitado'){pendencias.push(nome+' rejeitado: ver a tela de rejeições do eSocial.');pas('eSocial '+nome,'rejeitado',false)}
      else{pendencias.push(nome+' ainda não aceito ('+(e.status||'?')+').');pas('eSocial '+nome,'pendente',false)}
    }
    (emp.guias||[]).forEach(g=>{
      const nome='Guia '+g.tipo;
      if(g.paga)pas(nome,'ok',false,'paga');
      else if(g.gerada){pas(nome,'gerada',false,g.vencimento?'vence '+g.vencimento:'');if(hoje&&g.vencimento&&g.vencimento<hoje)pendencias.push(nome+' vencida em '+g.vencimento+' e não paga.')}
      else{pendencias.push(nome+' ainda não gerada.');pas(nome,'pendente',false,g.vencimento?'vence '+g.vencimento:'')}
    });
    const pode=bloqueios.length===0;
    const proxima=!pode?bloqueios[0]:pendencias.length?'Pode fechar (a regra do banco permite), mas há '+pendencias.length+' pendência(s) recomendada(s): '+pendencias[0]:'Pode fechar a competência.';
    return{ok:true,id:emp.id,nome:emp.nome,competencia:emp.competencia,pode,jaFechada:false,bloqueios,pendencias,passos,proximaAcao:proxima};
  }
  // Rotina em lote (SIMULAÇÃO): ordena por urgência (bloqueadas primeiro, depois com pendência, depois prontas) e resume.
  function rotinaLote(empresas,hoje){
    if(!Array.isArray(empresas)||!empresas.length)return{ok:false,erros:['nenhuma empresa informada']};
    const itens=empresas.map(e=>prontoParaFechar(e,hoje)),erros=[];itens.forEach((x,i)=>{if(!x.ok)erros.push('empresa '+(i+1)+': '+x.erros.join('; '))});
    if(erros.length)return{ok:false,erros};
    const rank=x=>x.jaFechada?3:!x.pode?0:x.pendencias.length?1:2;
    const ord=itens.slice().sort((a,b)=>rank(a)-rank(b)||String(a.nome).localeCompare(String(b.nome),'pt-BR'));
    const resumo={total:itens.length,bloqueadas:itens.filter(x=>!x.jaFechada&&!x.pode).length,comPendencia:itens.filter(x=>!x.jaFechada&&x.pode&&x.pendencias.length).length,prontas:itens.filter(x=>!x.jaFechada&&x.pode&&!x.pendencias.length).length,jaFechadas:itens.filter(x=>x.jaFechada).length};
    return{ok:true,itens:ord,resumo,aviso:'Simulação: nada é enviado nem gravado. Fechar de verdade é do contador (função pj_fechar_competencia do banco) e o envio ao eSocial exige certificado e procuração.'};
  }
  const api={prontoParaFechar,rotinaLote};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')Object.assign(window,api);
})();
