// Prazo de envio do S-2230 (afastamento temporário) e do término (27/11/2026). Fonte LIDA: MOS S-1.3 consolidado, evento S-2230, "Prazo de envio" itens a a g e "Informações adicionais" 1.1 a 1.4.
// Só PREPARA a data e os avisos: não gera nem envia o evento. A tabela de obrigatoriedade por motivo (item 2.1 do MOS) NÃO foi usada aqui: [CONFERIR COM O DANIEL] se o motivo exige o evento.
(function(){
  const MS=86400000;
  const parse=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const [a,m,d]=s.split('-').map(Number),x=new Date(Date.UTC(a,m-1,d));return(x.getUTCFullYear()===a&&x.getUTCMonth()===m-1&&x.getUTCDate()===d)?x:null};
  const iso=d=>d.toISOString().slice(0,10),soma=(s,n)=>iso(new Date(parse(s).getTime()+n*MS)),dow=s=>parse(s).getUTCDay();
  // dia 15 do mês seguinte ao da data
  const dia15Seguinte=s=>{const d=parse(s),a=d.getUTCFullYear(),m=d.getUTCMonth()+1;return iso(new Date(Date.UTC(a+Math.floor(m/12),m%12,15)))};
  // não útil (sábado, domingo ou feriado informado): posterga para o primeiro dia útil seguinte (observação do MOS)
  const util=(s,fer)=>{let x=s;while(dow(x)===0||dow(x)===6||(fer||[]).includes(x))x=soma(x,1);return x};
  // o: {tipo:'acidente_trabalho'|'doenca_trabalho'|'acidente_outro'|'doenca'|'outro', inicio, duracaoDias (prevista ou real), retorno?, diasAnteriores60d?, mesmaDoencaAuxilio60d?, feriados?:[]}
  function prazoS2230(o={}){
    const erros=[];if(!parse(o.inicio))erros.push('informe a data de início do afastamento (aaaa-mm-dd)');
    if(!(+o.duracaoDias>0))erros.push('informe a duração em dias');if(o.retorno&&!parse(o.retorno))erros.push('data de retorno inválida');
    const T=['acidente_trabalho','doenca_trabalho','acidente_outro','doenca','outro'];if(!T.includes(o.tipo))erros.push('tipo inválido: '+T.join(', '));
    if(erros.length)return{ok:false,erros};
    const dur=+o.duracaoDias,prev=+o.diasAnteriores60d||0,fer=o.feriados||[],trab=o.tipo==='acidente_trabalho'||o.tipo==='doenca_trabalho';
    let regra,bruto;
    if(o.mesmaDoencaAuxilio60d){regra='d: novo afastamento em até 60 dias do retorno de afastamento anterior pela mesma doença que gerou auxílio por incapacidade: enviar no primeiro dia do novo afastamento';bruto=o.inicio}
    else if(!trab&&prev>0&&prev+dur>15){regra='c: mesmo acidente ou doença não relacionados ao trabalho em até 60 dias, somando mais de 15 dias: enviar até o dia em que se completam 16 dias de afastamento';bruto=soma(o.inicio,Math.max(0,16-prev-1))}
    else if(trab&&dur<=15){regra='a: acidente ou doença do trabalho com duração de até 15 dias: até o dia 15 do mês seguinte à ocorrência';bruto=dia15Seguinte(o.inicio)}
    else if(dur>15){regra='b: acidente ou doença com duração acima de 15 dias: enviar até o 16º dia da ocorrência';bruto=soma(o.inicio,15)}
    else{regra='f: demais afastamentos: até o dia 15 do mês seguinte à ocorrência';bruto=dia15Seguinte(o.inicio)}
    const inicioAte=util(bruto,fer);
    const alertas=['O eSocial não aceita afastamentos ao mesmo tempo: informe o término de um antes de informar o início de outro (por exemplo, férias e depois licença-maternidade). (MOS S-2230, item 1.1)','Desligamento por pedido de demissão, encerramento da empresa, falecimento do empregador individual, transferência ou óbito dispensa o envio do retorno. (item 1.2)'];
    if(trab)alertas.push('Acidente ou doença do trabalho (e licença-maternidade paga direto pelo INSS): observar também o item 36 do S-1200. (item 1.4) [CONFERIR COM O DANIEL]');
    alertas.push('Se o motivo exige o evento para este tipo de trabalhador (tabela do item 2.1 do MOS) não foi conferido aqui. [CONFERIR COM O DANIEL]');
    if(bruto!==inicioAte)alertas.push('O prazo caía em dia não útil e foi levado para o primeiro dia útil seguinte (informe os feriados para conferir).');
    const r={ok:true,regra,inicioAte,alertas,aviso:'Estimativa; o contador confere.'};
    if(o.retorno){const ate=dia15Seguinte(o.retorno);r.terminoAte=util(ate,fer);r.terminoRegra='g: término do afastamento: até o dia 15 do mês seguinte à competência do retorno'}
    return r;
  }
  if(typeof module!=='undefined')module.exports={prazoS2230};
  if(typeof window!=='undefined')window.prazoS2230=prazoS2230;
})();
