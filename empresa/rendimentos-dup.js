// Controle de duplicidade antes de importar rendimentos (27/11/2026). Motivo: no levantamento r10c a importação do Carnê-Leão da Receita SOMA e não sobrescreve;
// importar duas vezes o mesmo recibo duplica o rendimento. Chave: data + CPF do pagador (só dígitos) + valor em centavos. Não gera o CSV da Receita (formato oficial ainda não lido).
(function(){
  const dig=s=>String(s==null?'':s).replace(/\D/g,'');
  const cent=v=>{if(typeof v==='number')return Math.round((v+Number.EPSILON)*100);let x=String(v==null?'':v).trim().replace(/[^\d.,-]/g,'');if(x.indexOf(',')>=0)x=x.replace(/\./g,'').replace(',','.');const n=parseFloat(x);return isNaN(n)?NaN:Math.round((n+Number.EPSILON)*100)};
  const chave=r=>{const d=String(r.data||'').trim(),c=cent(r.valor),p=dig(r.cpf);return(/^\d{4}-\d{2}-\d{2}$/.test(d)&&!isNaN(c)&&c>0&&p.length>=11)?d+'|'+p+'|'+c:null};
  // existentes e novos: [{data:'aaaa-mm-dd', cpf, valor}]. Devolve {importar, duplicados, invalidos, resumo}. Duplicado dentro do próprio lote novo também conta.
  function separaDuplicados(existentes,novos){
    const vistos=new Set((existentes||[]).map(chave).filter(Boolean)),importar=[],duplicados=[],invalidos=[];
    (novos||[]).forEach((r,i)=>{const k=chave(r);if(!k){invalidos.push({linha:i+1,registro:r});return}
      if(vistos.has(k))duplicados.push({linha:i+1,registro:r});else{vistos.add(k);importar.push(r)}});
    return{importar,duplicados,invalidos,resumo:{novos:(novos||[]).length,importar:importar.length,duplicados:duplicados.length,invalidos:invalidos.length}};
  }
  const api={separaDuplicados,chaveRendimento:chave};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')window.separaDuplicados=separaDuplicados;
})();
