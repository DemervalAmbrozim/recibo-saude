// Lista numerada de RPA (recibo de pagamento a autônomo) do mês (27/11/2026): próximo número, saltos, duplicados, totais retidos e avisos.
// Fonte lida: MOS S-1.3, tabela 10.2.1 (categoria 701, autônomo em geral): o S-2300 é FACULTATIVO para a categoria 701; a remuneração é informada no S-1200. [CONFERIR COM O CONTADOR] como o escritório informa.
// Não calcula o RPA (use calculaRPA) nem gera guia: só organiza os recibos já calculados. ESTIMATIVA até o contador conferir.
(function(){
  const r2=x=>Math.round((+x+Number.EPSILON)*100)/100,dig=s=>String(s==null?'':s).replace(/\D/g,'');
  // recibos: [{numero, data:'aaaa-mm-dd', nome, cpf, valor, inss, irrf, iss, liquido}]
  function proximoNumeroRPA(recibos){const ns=(recibos||[]).map(r=>Math.trunc(+r.numero)).filter(n=>n>0);return ns.length?Math.max(...ns)+1:1}
  function listaRPA(recibos,o={}){
    const erros=[];if(!Array.isArray(recibos)||!recibos.length)return{ok:false,erros:['nenhum recibo informado']};
    recibos.forEach((r,i)=>{if(!(+r.numero>0))erros.push('recibo '+(i+1)+': número inválido');if(!/^\d{4}-\d{2}-\d{2}$/.test(r.data||''))erros.push('recibo '+(i+1)+': data inválida (aaaa-mm-dd)');if(dig(r.cpf).length!==11)erros.push('recibo '+(i+1)+': CPF deve ter 11 dígitos');if(!(+r.valor>0))erros.push('recibo '+(i+1)+': valor inválido')});
    if(erros.length)return{ok:false,erros};
    const comp=o.competencia||null,sel=recibos.filter(r=>!comp||r.data.slice(0,7)===comp).slice().sort((a,b)=>a.numero-b.numero);
    if(!sel.length)return{ok:false,erros:['nenhum recibo na competência '+comp]};
    const alertas=[],vistos=new Map();
    sel.forEach(r=>{if(vistos.has(r.numero))alertas.push('Número '+r.numero+' repetido: cada RPA tem número único.');vistos.set(r.numero,1)});
    const ns=[...vistos.keys()];for(let i=1;i<ns.length;i++)if(ns[i]-ns[i-1]>1)alertas.push('Salto na numeração entre '+ns[i-1]+' e '+ns[i]+': confira se houve recibo cancelado (guarde o cancelado, não apague).');
    // mesmo autônomo com mais de um RPA no mês: o INSS tem teto somado
    const porCpf=new Map();sel.forEach(r=>{const k=dig(r.cpf);porCpf.set(k,(porCpf.get(k)||0)+1)});
    porCpf.forEach((q,k)=>{if(q>1)alertas.push('O autônomo de CPF final '+k.slice(-4)+' tem '+q+' RPA no mês: o INSS retido tem teto somando os recibos (use o campo de INSS já recolhido em outras fontes no cálculo).')});
    const tot=k=>r2(sel.reduce((s,r)=>s+(+r[k]||0),0));
    alertas.push('S-2300 é facultativo para autônomo em geral (categoria 701); a remuneração é informada no S-1200. [CONFERIR COM O CONTADOR] como o escritório informa e como o INSS retido chega à DCTFWeb.');
    alertas.push('ISS: retenção e guia são do município do serviço. [CONFERIR COM O CONTADOR]');
    alertas.push('Guia: o que foi declarado no S-1200 e fechado no S-1299 do mês segue para a DCTFWeb (o eSocial devolve o S-5011 com as bases e os créditos apurados) e o pagamento é o DARF numerado emitido na DCTFWeb (texto oficial: Manual de Orientação do eSocial S-1.3, evento S-5011; Manual da DCTFWeb de jan/2025, cap. 16). Que o IRRF retido do autônomo vai no mesmo DARF e que isso vale de 05/2023 em diante só consta em ajuda de fabricante de sistema, não em texto oficial lido. [CONFERIR COM O CONTADOR]');
    return{ok:true,competencia:comp,recibos:sel,quantidade:sel.length,primeiro:sel[0].numero,ultimo:sel[sel.length-1].numero,proximo:proximoNumeroRPA(recibos),
      totais:{valor:tot('valor'),inss:tot('inss'),irrf:tot('irrf'),iss:tot('iss'),liquido:tot('liquido')},alertas,aviso:'Estimativa; o contador confere antes do pagamento.'};
  }
  const api={proximoNumeroRPA,listaRPA};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')Object.assign(window,api);
})();
