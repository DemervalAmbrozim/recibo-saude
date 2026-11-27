// Folha: PLR, participação nos lucros ou resultados (27/11/2026). Fonte lida na r9b: Lei 10.101/2000 (Planalto, texto lido) e Lei 15.270/2025 (não altera a PLR).
// ESTIMATIVA até o contador conferir. Tributação: exclusiva na fonte, SEPARADA da folha mensal, sobre o TOTAL pago no ano, com dedução do imposto já retido (Lei 10.101, art. 3º §§5º a 9º).
// A TABELA abaixo é a do ANEXO da Lei 10.101 como está no texto lido; o §11 manda reajustar no mesmo percentual da tabela mensal e os VALORES 2026 NÃO foram achados
// (r9b: "NÃO ENCONTRADO"). Por isso o 2º argumento aceita a tabela vigente e o resultado leva a marca [CONFERIR COM O DANIEL] enquanto a tabela for a do texto original.
(function(){
  const r2l=x=>Math.round((+x+Number.EPSILON)*100)/100;
  const TABELA_LEI_10101=[{ate:6000,aliq:0,ded:0},{ate:9000,aliq:.075,ded:450},{ate:12000,aliq:.15,ded:1125},{ate:15000,aliq:.225,ded:2025},{ate:Infinity,aliq:.275,ded:2775}];
  // Tabela da Receita Federal, 'a partir de maio de 2025' (página gov.br/receitafederal ... /tabelas/2026, lida 27/11/2026; não achei norma de 2026 que a altere).
  const TABELA_RFB_2025_05=[{ate:8214.40,aliq:0,ded:0},{ate:9922.28,aliq:.075,ded:616.08},{ate:13167.00,aliq:.15,ded:1360.25},{ate:16380.38,aliq:.225,ded:2347.78},{ate:Infinity,aliq:.275,ded:3166.80}];
  function impostoPLRAcumulado(total,tabela){const t=(tabela||TABELA_RFB_2025_05).find(f=>total<=f.ate);return Math.max(0,r2l(total*t.aliq-t.ded))}
  // pagamentos: [{valor, data:'aaaa-mm-dd'}] do ano civil, em ordem. Devolve o imposto de cada parcela (IR do total até ali menos o já retido nas anteriores).
  function calculaPLR(pagamentos,o={}){
    if(!Array.isArray(pagamentos)||!pagamentos.length)return{ok:false,erros:['informe ao menos um pagamento de PLR']};
    const tabela=o.tabela||TABELA_RFB_2025_05,usaOriginal=tabela===TABELA_LEI_10101,usaRFB=tabela===TABELA_RFB_2025_05,erros=[],alertas=[];
    for(const p of pagamentos){if(!(+p.valor>0))erros.push('valor de PLR inválido');if(!/^\d{4}-\d{2}-\d{2}$/.test(p.data||''))erros.push('data inválida (aaaa-mm-dd)')}
    if(erros.length)return{ok:false,erros};
    const anos=new Set(pagamentos.map(p=>p.data.slice(0,4)));if(anos.size>1)return{ok:false,erros:['os pagamentos têm de ser do mesmo ano civil']};
    const ord=pagamentos.slice().sort((a,b)=>a.data<b.data?-1:1);
    let acum=0,retido=0;const linhas=[];
    ord.forEach((p,i)=>{
      acum=r2l(acum+ +p.valor);const devidoAcum=impostoPLRAcumulado(acum,tabela),ir=r2l(Math.max(0,devidoAcum-retido));retido=r2l(retido+ir);
      const exc=i>=2;
      linhas.push({data:p.data,valor:r2l(p.valor),acumulado:acum,irEstaParcela:ir,irRetidoAcumulado:retido,liquido:r2l(+p.valor-ir),excedente:exc});
      if(exc)alertas.push('O pagamento de '+p.data+' é o '+(i+1)+'º do ano: o §2º do art. 3º permite no máximo 2 pagamentos por ano civil; o excedente perde a natureza de PLR (§8º, Lei 14.020/2020) e vira remuneração com encargos. [CONFERIR COM O DANIEL]');
    });
    if(ord.length>=2){const d=(a,b)=>(new Date(b)-new Date(a))/86400000;for(let i=1;i<ord.length;i++)if(d(ord[i-1].data,ord[i].data)<90)alertas.push('Intervalo menor que ~3 meses entre '+ord[i-1].data+' e '+ord[i].data+': o §2º exige intervalo mínimo de um trimestre civil; o pagamento fora do intervalo não vale como PLR (§9º). [CONFERIR COM O DANIEL se o trimestre civil se cumpre]')}
    if(usaRFB)alertas.push('Tabela usada: a da Receita Federal "a partir de maio de 2025" (página de tabelas 2026 do gov.br, lida em 27/11/2026). Não achei norma de 2026 que a altere; se sair reajuste, informe a tabela vigente. [CONFERIR COM O DANIEL]');
    if(usaOriginal)alertas.push('Tabela usada: a do anexo da Lei 10.101 como no texto original. A Receita reajusta essa tabela (§11) e os valores de 2026 não foram confirmados: informe a tabela vigente ou confira antes de pagar. [CONFERIR COM O DANIEL]');
    alertas.push('eSocial (MOS S-1.3, lido 27/11): informar a PLR em demonstrativo próprio no S-1200 (ideDmDev separado), com IRRF em separado; no rendimento, tipo 14 (PLR). Se o empregado já foi desligado no período, a PLR ainda é enviada no S-1200 (exceção REGRA_REMUN_JA_EXISTE_DESLIGAMENTO).');
    alertas.push('PLR não substitui nem complementa a remuneração e não é base de INSS, FGTS ou 13º (art. 3º, caput), desde que cumpridos os requisitos: instrumento com regras claras e objetivas, arquivado no sindicato (art. 2º). A Lei 15.270/2025 não altera a PLR; a redução mensal do IRRF não se aplica a ela por ser tributação exclusiva na fonte (leitura do Hexa, não está expressa no texto) e ela entra na conta da tributação mínima anual (art. 16-A).');
    return{ok:true,ano:[...anos][0],linhas,total:acum,irTotal:retido,liquidoTotal:r2l(acum-retido),alertas,
      eSocial:'[CONFERIR] a rubrica de PLR no S-1200 (tabela de rubricas do eSocial): ainda não lida.',
      aviso:'Estimativa. O contador confere a tabela vigente, o instrumento e o sindicato antes de pagar.'}}
  if(typeof window!=='undefined'){window.calculaPLR=calculaPLR}
  if(typeof module!=='undefined')module.exports={calculaPLR,impostoPLRAcumulado,TABELA_LEI_10101,TABELA_RFB_2025_05};
})();
