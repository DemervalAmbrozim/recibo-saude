// Folha: recibos imprimíveis de férias, rescisão e RPA (27/11/2026). Reaproveitam o resultado de calculaFerias, calculaRescisao e calculaRPA, sem recalcular nada.
// O recibo de rescisão NÃO é o TRCT oficial (o modelo vigente do TRCT não foi confirmado): é a memória das verbas com o aviso na própria folha impressa. ESTIMATIVA até o contador conferir.
(function(){
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const brl=v=>'R$ '+(Math.round((+v||0)*100)/100).toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  const dt=iso=>/^\d{4}-\d{2}-\d{2}$/.test(iso||'')?iso.split('-').reverse().join('/'):esc(iso||'');
  const CSS='body{font:14px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #999;padding:4px 6px;text-align:left}td.n,th.n{text-align:right}.cab{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}.peq{font-size:12px;color:#444}@media print{body{margin:8mm}}';
  function moldura(titulo,empresa,emp,sub,corpo,fim){
    return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(titulo)+' '+esc(emp.nome)+'</title><style>'+CSS+'</style>'
      +'<div class="cab"><div><h1>'+esc(titulo)+'</h1><div>'+esc(empresa.nome)+' · CNPJ '+esc(empresa.cnpj||'')+'</div></div><div>'+sub+'</div></div>'
      +'<p>Nome: <b>'+esc(emp.nome)+'</b> · CPF '+esc(emp.cpf||'')+(emp.cargo?' · '+esc(emp.cargo):'')+'</p>'+corpo
      +'<p class="peq">Documento gerado pelo sistema como estimativa até a conferência do contador responsável. '+esc(fim||'')+'</p>'
      +'<p class="peq">Recebi o valor líquido acima. Data: ____/____/______ Assinatura: ______________________________</p></html>';
  }
  const tab=(linhas,tp,td)=>'<table><tr><th>Cód.</th><th>Descrição</th><th>Ref.</th><th class="n">Proventos</th><th class="n">Descontos</th></tr>'
    +linhas.map(l=>'<tr><td>'+esc(l[0])+'</td><td>'+esc(l[1])+'</td><td>'+esc(l[2])+'</td><td class="n">'+(l[3]===''?'':brl(l[3]))+'</td><td class="n">'+(l[4]===''?'':brl(l[4]))+'</td></tr>').join('')
    +'<tr><th colspan="3">Totais</th><th class="n">'+brl(tp)+'</th><th class="n">'+brl(td)+'</th></tr></table>';
  const erro=r=>({ok:false,erros:(r&&r.erros)||['cálculo inválido: não há o que imprimir']});
  // Férias: r = resultado de calculaFerias; o: {inicio:'aaaa-mm-dd', fim, avisoAte, pagarAte}
  function reciboFeriasHTML(r,empresa,emp,o={}){
    if(!r||!r.ok)return erro(r);
    const linhas=[...r.proventos.map(x=>[x.cod,x.desc,x.ref,x.valor,'']),['D01','INSS sobre férias','',  '',r.inss],['D02','IRRF sobre férias','','',r.irrf]];
    const per=o.inicio?'Gozo de '+dt(o.inicio)+(o.fim?' a '+dt(o.fim):''):'Recibo de férias';
    const corpo=tab(linhas,r.bruto,r.inss+r.irrf)+'<p><b>Líquido a receber: '+brl(r.liquido)+'</b></p><p class="peq">Dias de direito '+esc(r.diasDireito)+' · FGTS do mês (depósito do empregador) '+brl(r.fgts)+'</p>'
      +(o.avisoAte||o.pagarAte?'<p class="peq">Aviso das férias até '+dt(o.avisoAte)+' · pagamento até '+dt(o.pagarAte)+' (CLT arts. 135 e 145)</p>':'');
    return {ok:true,html:moldura('Recibo de férias',empresa,emp,esc(per),corpo,r.aviso)};
  }
  // Rescisão: r = resultado de calculaRescisao
  function reciboRescisaoHTML(r,empresa,emp,o={}){
    if(!r||!r.ok)return erro(r);
    const linhas=[...r.proventos.map(x=>[x.cod,x.desc,x.ref,x.valor,'']),...r.descontos.map(x=>[x.cod,x.desc,x.ref,'',x.valor])];
    const f=r.fgts||{},corpo='<p>Motivo: <b>'+esc(String(r.tipo).replace(/_/g,' '))+'</b>'+(o.saida?' · saída em '+dt(o.saida):'')+(r.vencimento?' · pagamento das verbas até '+dt(r.vencimento):'')+'</p>'
      +tab(linhas,r.totalProventos,r.totalDescontos)+'<p><b>Líquido da rescisão: '+brl(r.liquido)+'</b></p>'
      +'<p class="peq">FGTS: depósito rescisório '+brl(f.deposito)+' · multa '+brl(f.multa)+(f.multaPct?' ('+Math.round(f.multaPct*100)+'%)':'')+'. A guia é gerada no FGTS Digital; este recibo não a substitui.</p>'
      +'<p class="peq"><b>Este documento NÃO é o Termo de Rescisão (TRCT) oficial.</b> O modelo vigente do TRCT ainda precisa ser confirmado com o contador. [CONFERIR COM O CONTADOR]</p>'
      +(r.alertas&&r.alertas.length?'<ul class="peq">'+r.alertas.map(a=>'<li>'+esc(a)+'</li>').join('')+'</ul>':'');
    return {ok:true,html:moldura('Recibo de verbas rescisórias',empresa,emp,'Rescisão',corpo,r.aviso)};
  }
  // Intermitente: r = resultado de calculaIntermitente; o: {inicio, fim} do período da convocação
  function reciboIntermitenteHTML(r,empresa,emp,o={}){
    if(!r||!r.ok)return erro(r);
    const linhas=[...r.proventos.map(x=>[x.cod,x.desc,x.ref,x.valor,'']),...r.descontos.map(x=>[x.cod,x.desc,x.ref||'','',x.valor])];
    const per=o.inicio?'Convocação de '+dt(o.inicio)+(o.fim?' a '+dt(o.fim):''):'Trabalho intermitente';
    const corpo=tab(linhas,r.totalProventos,r.totalDescontos)+'<p><b>Líquido a receber ao fim da convocação: '+brl(r.liquido)+'</b></p>'
      +'<p class="peq">FGTS do mês (depósito do empregador) '+brl(r.fgts)+'. Pagamento ao fim de cada período de convocação, com RSR, férias com 1/3 e 13º proporcionais discriminados (CLT art. 452-A, §6º).</p>'
      +(r.alertas&&r.alertas.length?'<ul class="peq">'+r.alertas.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'');
    return {ok:true,html:moldura('Recibo de trabalho intermitente',empresa,emp,esc(per),corpo,r.aviso)};
  }
  // RPA: a = autônomo {nome,cpf,descricao?}; r = resultado de calculaRPA; o: {numero, data}
  function reciboRPAHTML(r,empresa,a,o={}){
    if(!r||!r.ok)return erro(r);
    if(!(+o.numero>0))return {ok:false,erros:['informe o número do recibo (sequência numerada do RPA)']};
    const linhas=[['1',a.descricao||'Prestação de serviço autônomo','',r.valor,''],['D01','INSS retido','','',r.inss],['D02','IRRF retido','','',r.irrf],['D03','ISS retido','','',r.iss]];
    const corpo=tab(linhas,r.valor,r.inss+r.irrf+r.iss)+'<p><b>Líquido a pagar ao autônomo: '+brl(r.liquido)+'</b></p>'
      +'<p class="peq">A contribuição patronal ('+brl(r.patronal)+') é encargo da empresa e não é descontada do autônomo.</p>'+(r.alertas&&r.alertas.length?'<ul class="peq">'+r.alertas.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'');
    return {ok:true,html:moldura('Recibo de pagamento a autônomo (RPA) nº '+String(Math.trunc(+o.numero)).padStart(6,'0'),empresa,a,o.data?'Data '+dt(o.data):'',corpo,r.aviso)};
  }
  const api={reciboFeriasHTML,reciboRescisaoHTML,reciboRPAHTML,reciboIntermitenteHTML};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')Object.assign(window,api);
})();
