// Livro Diário e Razão para imprimir ou salvar em PDF (itens G30 e N6 do relatório). Funções puras: recebem os dados que o banco já devolveu e montam o HTML.
// Termo de abertura e de encerramento e o selo de cada mês fechado vão na impressão, porque é o selo que prova que o mês não foi mexido.
// Dinheiro em reais (numeric 15,2). Exigências formais do livro (ITG 2000, registro) ficam [CONFERIR COM O CONTADOR].
(function(g){
  'use strict';
  var esc=function(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  var R=function(n){return (Math.round((+n||0)*100)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})};
  var DT=function(s){return s?String(s).slice(0,10).split('-').reverse().join('/'):''};
  var CSS='body{font:12px/1.4 Arial,sans-serif;color:#000;margin:18px}h1{font-size:16px;margin:0 0 4px}h2{font-size:13px;margin:14px 0 4px}table{border-collapse:collapse;width:100%;margin:4px 0}th,td{border:1px solid #666;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eee}td.n,th.n{text-align:right;white-space:nowrap}.termo{border:1px solid #666;padding:8px;margin:8px 0}.sub{color:#444;font-size:11px}code{font-size:10px}@media print{.pg{page-break-before:always}}';
  function cab(titulo,emp,de,ate){return '<h1>'+esc(titulo)+'</h1><p class="sub">'+esc(emp&&emp.razao_social||'')+(emp&&emp.cnpj?' · CNPJ '+esc(emp.cnpj):'')+' · período de '+DT(de)+' a '+DT(ate)+'</p>'}
  function diarioHTML(emp,lancamentos,nomes,periodos,de,ate){
    var erros=[];if(!Array.isArray(lancamentos))erros.push('lançamentos inválidos');if(!de||!ate)erros.push('informe o período');if(erros.length)return {ok:false,erros:erros};
    nomes=nomes||{};periodos=periodos||[];
    var L=lancamentos.slice().sort(function(a,b){return (a.exercicio-b.exercicio)||(a.numero-b.numero)});
    var tD=0,tC=0,corpo=L.map(function(l){var P=l.pj_partida||l.partidas||[];
      return '<h2>Lançamento '+esc(l.exercicio)+'/'+esc(l.numero)+' · '+DT(l.data)+(l.data_caixa&&l.data_caixa!==l.data?' (caixa '+DT(l.data_caixa)+')':'')+(l.estorna_id?' · ESTORNO':'')+'</h2><p class="sub">'+esc(l.historico)+'</p><table><tr><th>Conta</th><th>Nome</th><th class="n">Débito</th><th class="n">Crédito</th></tr>'
        +P.map(function(p){tD+=+p.debito||0;tC+=+p.credito||0;return '<tr><td>'+esc(p.conta)+'</td><td>'+esc(nomes[p.conta]||'')+'</td><td class="n">'+(+p.debito?R(p.debito):'')+'</td><td class="n">'+(+p.credito?R(p.credito):'')+'</td></tr>'}).join('')+'</table>'}).join('');
    var selos=periodos.filter(function(p){var m=String(p.periodo).slice(0,10);return m>=de.slice(0,7)+'-01'&&m<=ate}).map(function(p){return '<tr><td>'+esc(String(p.periodo).slice(0,7))+'</td><td class="n">'+esc(p.qtd_lancamentos)+'</td><td><code>'+esc(p.selo)+'</code></td></tr>'}).join('');
    var corpoHtml=cab('Livro Diário',emp,de,ate)
      +'<div class="termo"><b>Termo de abertura.</b> Este livro contém os lançamentos do período acima, numerados em sequência por exercício, de '+esc(emp&&emp.razao_social||'')+'. [CONFERIR COM O CONTADOR: exigências de escrituração e registro]</div>'
      +(corpo||'<p>Nenhum lançamento no período.</p>')
      +'<h2 class="pg">Totais do período</h2><table><tr><th class="n">Total de débitos</th><th class="n">Total de créditos</th><th>Situação</th></tr><tr><td class="n">'+R(tD)+'</td><td class="n">'+R(tC)+'</td><td>'+(Math.round((tD-tC)*100)===0?'débitos = créditos':'DIFERENÇA: não imprima, confira o livro')+'</td></tr></table>'
      +(selos?'<h2>Meses fechados e selo de integridade</h2><table><tr><th>Mês</th><th class="n">Lançamentos</th><th>Selo (sha-256 encadeado)</th></tr>'+selos+'</table>':'<p class="sub">Nenhum mês do período está fechado: sem selo.</p>')
      +'<div class="termo"><b>Termo de encerramento.</b> '+L.length+' lançamento(s) neste período. Assinatura do contador responsável: ______________________________ CRC: ____________</div>';
    var html='<!doctype html><meta charset="utf-8"><title>Livro Diário</title><style>'+CSS+'</style>'+corpoHtml;
    return {ok:true,html:html,corpo:corpoHtml,totalDebito:Math.round(tD*100)/100,totalCredito:Math.round(tC*100)/100,qtd:L.length,fecha:Math.round((tD-tC)*100)===0};
  }
  function razaoHTML(emp,conta,nomeConta,linhas,de,ate){
    if(!conta||!Array.isArray(linhas))return {ok:false,erros:['informe a conta e as linhas do razão']};
    var tD=0,tC=0,sf=0,corpo=linhas.map(function(l){var ant=l.historico==='Saldo anterior';if(!ant){tD+=+l.debito||0;tC+=+l.credito||0}sf=+l.saldo;
      return '<tr><td>'+DT(l.data)+'</td><td>'+(ant?'':esc(l.exercicio)+'/'+esc(l.numero))+'</td><td>'+esc(l.historico)+'</td><td class="n">'+(+l.debito?R(l.debito):'')+'</td><td class="n">'+(+l.credito?R(l.credito):'')+'</td><td class="n">'+R(l.saldo)+'</td></tr>'}).join('');
    var html='<!doctype html><meta charset="utf-8"><title>Razão</title><style>'+CSS+'</style>'+cab('Razão: '+conta+' '+(nomeConta||''),emp,de,ate)
      +'<table><tr><th>Data</th><th>Lançamento</th><th>Histórico</th><th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo (devedor positivo)</th></tr>'+corpo+'<tr><th colspan="3">Totais e saldo final</th><th class="n">'+R(tD)+'</th><th class="n">'+R(tC)+'</th><th class="n">'+R(sf)+'</th></tr></table>';
    return {ok:true,html:html,totalDebito:Math.round(tD*100)/100,totalCredito:Math.round(tC*100)/100,saldoFinal:Math.round(sf*100)/100};
  }
  // W12: pacote do contador para fiscalização: capa e índice, balancete, DRE, notas fiscais, Diário e selos, num arquivo só para imprimir ou salvar em PDF.
  function pacoteHTML(emp,d){
    if(!d||!d.de||!d.ate)return {ok:false,erros:['informe o período']};
    var dia=diarioHTML(emp,d.lancamentos||[],d.nomes||{},d.periodos||[],d.de,d.ate);if(!dia.ok)return dia;
    var bal=(d.balancete||[]),dre=d.dre||[],nt=d.notas||[],g=function(x){var r=dre.filter(function(y){return y.grupo===x})[0];return r?+r.valor:0};
    var tb='<h2 class="pg">1. Balancete</h2><table><tr><th>Conta</th><th>Nome</th><th class="n">Saldo anterior</th><th class="n">Débitos</th><th class="n">Créditos</th><th class="n">Saldo final</th></tr>'
      +bal.map(function(x){return '<tr><td>'+esc(x.codigo)+'</td><td>'+esc(x.nome)+'</td><td class="n">'+R(x.saldo_anterior)+'</td><td class="n">'+R(x.debitos)+'</td><td class="n">'+R(x.creditos)+'</td><td class="n">'+R(x.saldo_final)+'</td></tr>'}).join('')+'</table>';
    var td='<h2>2. DRE por competência</h2><table><tr><th>Grupo</th><th class="n">Valor</th></tr><tr><td>Receita</td><td class="n">'+R(g('receita'))+'</td></tr><tr><td>(-) Deduções</td><td class="n">'+R(g('deducao'))+'</td></tr><tr><td>(-) Despesas</td><td class="n">'+R(g('despesa'))+'</td></tr><tr><th>Resultado</th><th class="n">'+R(g('receita')-g('deducao')-g('despesa'))+'</th></tr></table>';
    var tn='<h2 class="pg">3. Notas fiscais do período</h2>'+(nt.length?'<table><tr><th>Série/número</th><th>Emissão</th><th>Competência</th><th>Situação</th><th class="n">Valor</th></tr>'+nt.map(function(n){return '<tr><td>'+esc(n.serie)+'/'+esc(n.numero)+'</td><td>'+DT(n.data_emissao)+'</td><td>'+DT(n.data_competencia)+'</td><td>'+esc(n.status)+'</td><td class="n">'+R(n.valor_total)+'</td></tr>'}).join('')+'</table>':'<p>Nenhuma nota no período.</p>');
    var indice='<h2>Índice</h2><ol><li>Balancete</li><li>DRE por competência</li><li>Notas fiscais</li><li>Livro Diário, totais e selos de integridade</li></ol><p class="sub">Gerado pelo sistema a partir do livro, com selo de integridade encadeado por mês fechado. Guias e comprovantes de pagamento anexados à parte pelo contador. [CONFERIR COM O CONTADOR]</p>';
    var html='<!doctype html><meta charset="utf-8"><title>Pacote para fiscalização</title><style>'+CSS+'</style>'+cab('Pacote do contador para fiscalização',emp,d.de,d.ate)+indice+tb+td+tn+'<div class="pg">'+dia.corpo+'</div>';
    return {ok:true,html:html,qtdLancamentos:dia.qtd,fecha:dia.fecha};
  }
  var api={diarioHTML:diarioHTML,razaoHTML:razaoHTML,pacoteHTML:pacoteHTML};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else g.LivroImpressao=api;
})(typeof window!=='undefined'?window:globalThis);
