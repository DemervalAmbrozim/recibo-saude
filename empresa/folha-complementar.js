// Folha COMPLEMENTAR (27/11/2026): pagamento adicional de uma competência já calculada (diferença salarial, horas extras esquecidas, comissão, prêmio).
// Método marginal, o mesmo de calculaFerias: imposto sobre (base já calculada + complemento) MENOS o imposto já calculado na folha original.
// Assim INSS e IRRF do mês fecham exatamente como se tudo tivesse sido calculado de uma vez (teto do INSS respeitado). ESTIMATIVA até o contador conferir.
// Precisa de folha.js (inssFolha, carneLeao, tabelaFolha) carregado antes.
(function(){
  const r2=x=>Math.round((+x+Number.EPSILON)*100)/100;
  // original: resultado ok de calculaFolha da MESMA competência. compl: {motivo, proventos:[{cod,desc,valor,inss,irrf,fgts}], descontos:[{cod,desc,valor}]}
  function calculaComplementar(emp,original,compl,ano){
    const erros=[];
    if(!original||!original.ok)erros.push('informe a folha original calculada da mesma competência');
    if(!compl||!Array.isArray(compl.proventos)||!compl.proventos.length)erros.push('informe ao menos um provento da folha complementar');
    (compl&&compl.proventos||[]).forEach(p=>{if(!(+p.valor>0))erros.push('valor de provento inválido: '+(p.desc||p.cod||'sem descrição'));if(!p.desc)erros.push('todo provento precisa de descrição')});
    (compl&&compl.descontos||[]).forEach(d=>{if(!(+d.valor>0))erros.push('valor de desconto inválido: '+(d.desc||'sem descrição'))});
    if(erros.length)return{ok:false,erros};
    const a=ano||original.ano||2026,T=tabelaFolha(a),dep=((emp&&emp.dependentes)||0)*T.depIR+(+(emp&&emp.deducaoIRRFExtra)||0);
    const soma=k=>r2(compl.proventos.reduce((s,p)=>s+(p[k]===false?0:+p.valor),0));
    const bruto=r2(compl.proventos.reduce((s,p)=>s+ +p.valor,0)),addINSS=soma('inss'),addIRRF=soma('irrf'),addFGTS=soma('fgts');
    const baseINSS=r2(original.baseINSS+addINSS),inssTot=inssFolha(baseINSS,a),inssC=r2(Math.max(0,inssTot-original.inss));
    const baseIR=r2((original.baseIRRF!=null?original.baseIRRF:original.baseINSS)+addIRRF);
    const irTot=carneLeao(baseIR,inssTot+dep).devido,irrfC=r2(Math.max(0,irTot-original.irrf));
    const fgtsC=r2(addFGTS*(emp&&emp.fgtsAliq!=null?+emp.fgtsAliq:T.fgts));
    const outros=r2((compl.descontos||[]).reduce((s,d)=>s+ +d.valor,0)),liquido=r2(bruto-inssC-irrfC-outros);
    const alertas=[];
    if(liquido<0)alertas.push('Os descontos passam do valor da complementar: o líquido ficou negativo.');
    if(original.baseINSS+addINSS>T.teto)alertas.push('A base do INSS passou do teto (R$ '+String(T.teto.toFixed(2)).replace('.',',')+'): o INSS da complementar é só a diferença até o teto.');
    alertas.push('eSocial (MOS S-1.3, lido 27/11): se a folha do mês já foi enviada, o S-1200 é retificado com um NOVO demonstrativo (ideDmDev próprio) para o valor pago nesta data. [CONFERIR COM O DANIEL]');
    alertas.push('O recibo e o pagamento são separados da folha original. Pensão judicial, consignado e salário-família não foram recalculados aqui. [CONFERIR COM O DANIEL]');
    return{ok:true,tipo:'complementar',ano:a,motivo:compl.motivo||'',proventos:compl.proventos.map(p=>({cod:p.cod||'090',desc:p.desc,ref:p.ref||' ',valor:r2(p.valor)})),
      bruto,inss:inssC,irrf:irrfC,outrosDescontos:outros,fgts:fgtsC,liquido,
      totalMes:{inss:r2(original.inss+inssC),irrf:r2(original.irrf+irrfC),fgts:r2(original.fgts+fgtsC)},alertas,aviso:'Estimativa; o contador confere antes do pagamento.'};
  }
  if(typeof module!=='undefined')module.exports={calculaComplementar};
  if(typeof window!=='undefined')window.calculaComplementar=calculaComplementar;
})();
