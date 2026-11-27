// Fluxo GUIADO do mês da folha (27/11/2026): em que passo estou e qual é o próximo. Só organiza o que o usuário informa: não calcula nada, não envia nada.
// Cada passo aponta para a tela da aba "Verbas e vínculos" que o resolve (campo "tela"). Os passos 1 e 2 são do cliente/escritório; aprovar e fechar são do contador.
(function(){
  const PASSOS=[
    {id:'variaveis',nome:'Receber as variáveis do mês (ponto, faltas, comissões)',tela:'ponto',quem:'escritório',obrigatorio:false},
    {id:'conferir',nome:'Rodar as conferências antes de calcular',tela:'conf',quem:'escritório',obrigatorio:true},
    {id:'calcular',nome:'Calcular a folha do mês',tela:'mensal',quem:'escritório',obrigatorio:true},
    {id:'aprovar',nome:'Aprovar a folha',tela:'fech',quem:'contador',obrigatorio:true},
    {id:'recibos',nome:'Gerar os recibos',tela:'rec',quem:'escritório',obrigatorio:true},
    {id:'esocial',nome:'Preparar o evento do eSocial (S-1200)',tela:'s1200',quem:'contador',obrigatorio:true},
    {id:'guias',nome:'Gerar as guias (FGTS Digital e DARF da DCTFWeb)',tela:'fech',quem:'contador',obrigatorio:true},
    {id:'fechar',nome:'Fechar a competência',tela:'fech',quem:'contador',obrigatorio:true}
  ];
  // e: {competencia:'aaaa-mm', variaveis:bool, conferencia:bool, calculada:bool, aprovada:bool, recibos:bool, esocial:bool, guias:bool, fechada:bool}
  function fluxoDoMes(e){
    if(!e||!/^\d{4}-(0[1-9]|1[0-2])$/.test(e.competencia||''))return{ok:false,erros:['informe a competência (aaaa-mm)']};
    const chave={variaveis:'variaveis',conferir:'conferencia',calcular:'calculada',aprovar:'aprovada',recibos:'recibos',esocial:'esocial',guias:'guias',fechar:'fechada'};
    let atual=null;const passos=PASSOS.map((p,i)=>{const feito=!!e[chave[p.id]];return{...p,n:i+1,feito}});
    // atual = primeiro passo OBRIGATÓRIO ainda não feito
    for(const p of passos){if(!p.feito&&p.obrigatorio){atual=p.id;break}}
    const out=passos.map(p=>({...p,estado:p.feito?'feito':p.id===atual?'atual':(!p.obrigatorio?'opcional':'aguarda')}));
    const incoerencias=[];
    // coerência: não pode ter feito um passo posterior sem os obrigatórios anteriores
    out.forEach((p,i)=>{if(p.feito&&out.slice(0,i).some(q=>q.obrigatorio&&!q.feito))incoerencias.push('"'+p.nome+'" aparece como feito, mas há passo anterior obrigatório sem fazer.')});
    const feitos=out.filter(p=>p.feito).length,obrig=out.filter(p=>p.obrigatorio),obrigFeitos=obrig.filter(p=>p.feito).length;
    const prox=out.find(p=>p.id===atual)||null;
    return{ok:true,competencia:e.competencia,passos:out,feitos,total:out.length,obrigatoriosFeitos:obrigFeitos,obrigatoriosTotal:obrig.length,
      concluido:obrigFeitos===obrig.length,proximo:prox,incoerencias,
      resumo:obrigFeitos===obrig.length?'Mês concluído: competência fechada.':'Próximo passo: '+prox.nome+' ('+prox.quem+').'};
  }
  if(typeof module!=='undefined')module.exports={fluxoDoMes,PASSOS_FLUXO:PASSOS};
  if(typeof window!=='undefined')window.fluxoDoMes=fluxoDoMes;
})();
