// Tabelas legais em uso pela folha e quando foram CONFERIDAS (27/11/2026). Serve para avisar antes de usar tabela vencida: INSS, salário mínimo e teto mudam todo janeiro; IRRF e PLR quando a Receita reajusta.
// A data de "conferido" é a que está em folha.js (TABELAS_FOLHA) e nas notas de cada módulo; ao conferir uma tabela de novo, atualize AQUI a data e a fonte. Não busca nada na internet: só compara datas.
(function(){
  const TABELAS=[
    {id:'inss-sm',anual:true,nome:'INSS, teto, salário mínimo e salário-família',ano:2026,conferido:'2026-11-21',fonte:'Portaria Interministerial MPS/MF 13/2026 e Decreto 12.797/2025 (texto lido)',reajuste:'todo janeiro (Portaria nova)'},
    {id:'irrf-mensal',nome:'IRRF mensal (tabela, desconto simplificado e redução)',ano:2026,conferido:'2026-11-21',fonte:'Lei 15.270/2025 e app/regras.js',reajuste:'quando a Receita ou a lei reajustar'},
    {id:'plr',nome:'IRRF sobre PLR (tabela exclusiva na fonte)',ano:2026,conferido:'2026-11-27',fonte:'Receita Federal, página de tabelas (PLR "a partir de maio de 2025"), lida no gov.br em 27/11/2026',reajuste:'quando a Receita reajustar'},
    {id:'fgts',nome:'FGTS (8%; 2% aprendiz; multa 40% e 20%)',ano:null,conferido:'2026-11-27',fonte:'Lei 8.036/1990, art. 18 (texto lido no Planalto)',reajuste:'só se a lei mudar'},
    {id:'esocial',nome:'Leiaute do eSocial (S-1.3) e catálogo de mensagens',ano:null,conferido:'2026-11-27',fonte:'Leiaute S-1.3 NT 07/2026 e Mensagens do Sistema v2.5 (gov.br/esocial)',reajuste:'a cada nota técnica nova'}
  ];
  const dias=(a,b)=>Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000);
  // hoje: 'aaaa-mm-dd'. Devolve {ok, itens:[{id,nome,situacao:'ok'|'atencao'|'critico',motivo,...}], resumo}
  function statusTabelas(hoje,opc={}){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(hoje||'')||isNaN(Date.parse(hoje)))return{ok:false,erros:['informe a data de hoje (aaaa-mm-dd)']};
    const limite=opc.diasConferencia||90,anoHoje=+hoje.slice(0,4),mes=+hoje.slice(5,7),itens=[];
    TABELAS.forEach(t=>{let sit='ok',motivo='Em dia.';const d=dias(t.conferido,hoje);
      if(t.ano!=null&&anoHoje>t.ano&&t.anual){sit='critico';motivo='A tabela é de '+t.ano+' e estamos em '+anoHoje+': cadastre a nova antes de calcular a folha.'}
      else if(t.ano!=null&&anoHoje>t.ano){sit='atencao';motivo='A tabela é de '+t.ano+' e estamos em '+anoHoje+': confirme na fonte se a Receita reajustou; se não mudou, atualize a data de conferência aqui.'}
      else if(t.ano!=null&&(mes===12||mes===1)&&t.id==='inss-sm'){sit='atencao';motivo=mes===12?'Dezembro: a Portaria de '+(t.ano+1)+' costuma sair até janeiro; confira e cadastre em TABELAS_FOLHA.':'Janeiro: confirme se a Portaria nova do INSS e o salário mínimo já valem.'}
      else if(d>limite){sit='atencao';motivo='Conferida há '+d+' dias (limite '+limite+'): confirme na fonte se mudou.'}
      itens.push({id:t.id,nome:t.nome,ano:t.ano,conferido:t.conferido,diasDesdeConferencia:d,fonte:t.fonte,reajuste:t.reajuste,situacao:sit,motivo})});
    const resumo={ok:itens.filter(x=>x.situacao==='ok').length,atencao:itens.filter(x=>x.situacao==='atencao').length,critico:itens.filter(x=>x.situacao==='critico').length};
    return{ok:true,hoje,itens,resumo,aviso:'Só compara datas: quem confirma a tabela é o contador, na fonte oficial.'};
  }
  if(typeof module!=='undefined')module.exports={statusTabelas,TABELAS_VIGENCIA:TABELAS};
  if(typeof window!=='undefined')window.statusTabelas=statusTabelas;
})();
