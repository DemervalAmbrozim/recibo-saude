// Telas extras do livro do contador (28/11/2026): Notas (XML da NFS-e Nacional), Simples e reforma (regime, caixa de dezembro de 2026, IBS e CBS), Rubricas (eSocial) e Pessoas (empregados, dependentes, salário, INSS de outro vínculo).
// Nada de cálculo contábil aqui: o banco confere, numera e recusa. As telas só juntam os dados e chamam as funções de pj-dados.js.
(function(){
'use strict';
if(!window.LivroApi)return;
var A=window.LivroApi,L=function(){return A.ctx()};
var BADGE=function(ok,t){return '<span style="color:var(--'+(ok?'ok':'bad')+',#a00)">'+t+'</span>'};

// ===== Notas: importar o XML da NFS-e Nacional (leiaute oficial Anexo I SEFIN/ADN v1.01)
A.registra('notas','Notas',async function(){var c=L(),$=c.$,esc=c.esc,R=c.R,lidas=[];
  var ano=c.hoje().slice(0,4),nt=await c.tenta(function(){return c.DB.notas(c.EMP,ano+'-01-01',ano+'-12-31')},[]);
  $('tela').innerHTML='<h2>Notas fiscais</h2><p class="sub">Importe o XML da NFS-e Nacional (um ou vários arquivos). O nome do tomador não é lido nem guardado. O anexo do Simples não vem no XML: escolha abaixo. Só o contador registra.</p>'
   +'<div class="grid"><label>Arquivos XML<input type="file" id="n-arq" accept=".xml,text/xml,application/xml" multiple></label><label>Anexo do Simples<select id="n-anexo"><option value="III">III (saúde, Fator R de 28% ou mais)</option><option value="V">V (saúde, Fator R abaixo de 28%)</option><option value="I">I</option><option value="II">II</option><option value="IV">IV</option></select></label></div>'
   +'<p style="margin-top:8px"><label><input type="checkbox" id="n-fr" checked> Receita sujeita ao Fator R</label></p><div id="n-prev" style="margin-top:10px"></div><p style="margin-top:10px"><button class="bt pri" id="n-reg" disabled>Registrar as notas lidas</button></p>'
   +'<h3 style="margin-top:14px">Notas de '+esc(ano)+'</h3>'+c.tabela(['Número','Emissão','Competência','Situação','Valor'],nt.map(function(n){return [esc(n.serie+'/'+n.numero),esc(String(n.data_emissao).slice(0,10)),esc(String(n.data_competencia).slice(0,10)),esc(n.status),R(n.valor_total)]}),[4]);
  $('n-arq').onchange=async function(){lidas=[];var fs=Array.prototype.slice.call($('n-arq').files||[]),h='';
    for(var i=0;i<fs.length;i++){var t=await fs[i].text(),r=window.NfseXml.lerNFSe(t);lidas.push(r);
      h+='<tr><td>'+esc(fs[i].name)+'</td><td>'+(r.ok?esc(r.nota.serie+'/'+r.nota.numero):'—')+'</td><td>'+(r.ok?esc(r.nota.data_emissao):'')+'</td><td class="n">'+(r.ok?R(r.nota.valor_total):'')+'</td><td>'+(r.ok?BADGE(true,'lida')+(r.alertas.length?' · '+esc(r.alertas.join('; ')):''):BADGE(false,esc(r.erros.join('; '))))+'</td></tr>'}
    $('n-prev').innerHTML=fs.length?'<div class="tw"><table><thead><tr><th>Arquivo</th><th>Nota</th><th>Emissão</th><th class="n">Valor</th><th>Situação</th></tr></thead><tbody>'+h+'</tbody></table></div>':'';
    $('n-reg').disabled=!lidas.some(function(r){return r.ok})};
  $('n-reg').onclick=function(){c.ok(async function(){var ok=0,rep=0,err=[];
    for(var i=0;i<lidas.length;i++){if(!lidas[i].ok)continue;var reg=window.NfseXml.paraRegistro(lidas[i],{anexo:$('n-anexo').value,sujeitoFatorR:$('n-fr').checked});
      try{await c.DB.registrarNota(c.EMP,reg.nota,reg.itens);ok++}catch(e){var m=window.traduzErroPj?window.traduzErroPj(e):String(e.message||e);if(/já está registrada/.test(m))rep++;else err.push(m)}}
    c.aviso(ok+' nota(s) registrada(s)'+(rep?', '+rep+' já estava(m) registrada(s)':'')+(err.length?'. Erros: '+err.join('; '):'')+'.',err.length>0);c.desenha()})};
});

// ===== Simples e reforma
A.registra('simples','Simples e reforma',async function(){var c=L(),$=c.$,esc=c.esc,R=c.R,ano=+c.hoje().slice(0,4),
  reg=await c.tenta(function(){return c.DB.regimeSimples(c.EMP,ano)},'competencia'),
  dez=await c.tenta(function(){return c.DB.caixaAIntegrarDez2026(c.EMP)},[]),
  ibs=await c.tenta(function(){return c.DB.regimeIbsCbs(c.EMP,c.hoje())},'unico'),total=dez.reduce(function(s,x){return s+(+x.a_integrar||0)},0);
  var prox=ano+(+c.hoje().slice(5,7)>=7?1:0),sem=[prox+'-01-01',(+c.hoje().slice(5,7)<7?ano:prox)+'-07-01'];
  $('tela').innerHTML='<h2>Simples Nacional e reforma tributária</h2><p class="sub">Res. CGSN 140, como alterada pelas 190 e 196/2026. [CONFERIR COM O CONTADOR]</p>'
   +'<h3>Regime de apuração em '+ano+': <b>'+esc(reg==='caixa'?'caixa':'competência')+'</b></h3><div class="grid"><label>Ano<input id="s-ano" value="'+ano+'" inputmode="numeric"></label><label>Regime<select id="s-reg"><option value="competencia">Competência (faturamento pela emissão da nota)</option><option value="caixa">Caixa (só até 2026)</option></select></label></div><p style="margin-top:8px"><button class="bt" id="s-def">Definir o regime do ano (não muda depois)</button></p>'
   +'<h3 style="margin-top:14px">Caixa de 2026: o que integrar em dezembro</h3><p class="sub">Quem está em regime de caixa em 2026 integra na base de dezembro de 2026 o que ainda não recebeu (art. 144-C, Res. 196/2026). O recebimento depois não conta de novo.</p>'
   +(dez.length?c.tabela(['Nota','Emissão','Valor','Recebido até 31/12','A integrar'],dez.map(function(x){return [esc(x.serie+'/'+x.numero),esc(String(x.data_emissao).slice(0,10)),R(x.valor_total),R(x.recebido_ate_2026),'<b>'+R(x.a_integrar)+'</b>']}),[2,3,4])+'<p class="msg" style="margin-top:6px">Total a integrar: <b>'+R(total)+'</b></p>':'<p class="sub">Nada a integrar (a empresa não está em caixa em 2026 ou não há valor em aberto).</p>')
   +'<h3 style="margin-top:14px">IBS e CBS: regime em vigor hoje: <b>'+esc(ibs==='regular'?'regular (fora do DAS)':'único (dentro do DAS)')+'</b></h3><p class="sub">Opção ou renúncia semestral e irretratável. Semestre de janeiro: de 1 a 30/09 do ano anterior. Semestre de julho: de 1 a 31/03. Cancelar: de 1 a 30/11 (janeiro) e de 1 a 31/05 (julho). O banco confere o prazo pela data dele.</p>'
   +'<div class="grid"><label>Semestre<select id="i-sem">'+sem.map(function(d){return '<option value="'+d+'">'+d.split('-').reverse().join('/')+'</option>'}).join('')+'</select></label><label>Regime<select id="i-reg"><option value="regular">Regular (IBS e CBS fora do DAS)</option><option value="unico">Único (dentro do DAS)</option></select></label></div><p style="margin-top:8px"><button class="bt pri" id="i-ok">Fazer a opção</button> <button class="bt" id="i-cancel">Cancelar a opção deste semestre</button></p>';
  $('s-def').onclick=function(){c.ok(async function(){await c.DB.definirRegimeSimples(c.EMP,$('s-ano').value,$('s-reg').value);c.aviso('Regime definido.');c.desenha()})};
  $('i-ok').onclick=function(){c.ok(async function(){await c.DB.opcaoIbsCbs(c.EMP,$('i-sem').value,$('i-reg').value);c.aviso('Opção registrada.');c.desenha()})};
  $('i-cancel').onclick=function(){c.ok(async function(){await c.DB.cancelarOpcaoIbsCbs(c.EMP,$('i-sem').value);c.aviso('Opção cancelada.');c.desenha()})};
});

// ===== Rubricas do eSocial
A.registra('rubricas','Rubricas',async function(){var c=L(),$=c.$,esc=c.esc,rb=await c.tenta(function(){return c.DB.rubricas(c.EMP)},[]);
  $('tela').innerHTML='<h2>Rubricas da folha (tabela S-1010 do eSocial)</h2><p class="sub">Natureza (Tabela 3) e códigos de incidência de INSS (CP), IRRF e FGTS lidos do leiaute oficial. O que o texto oficial não traz fica "a conferir" até o contador confirmar.</p>'
   +(rb.length?'<div class="tw"><table><thead><tr><th>Código</th><th>Descrição</th><th>Natureza</th><th>CP</th><th>IRRF</th><th>FGTS</th><th>Fator R</th><th></th></tr></thead><tbody>'+rb.map(function(x){var k=esc(x.codigo);
     return '<tr><td>'+k+'</td><td>'+esc(x.descricao)+'</td><td>'+esc(x.nat_rubr)+'</td>'+(x.a_conferir?'<td><input data-f="cp" data-k="'+k+'" value="'+esc(x.cod_inc_cp||'')+'" size="3"></td><td><input data-f="irrf" data-k="'+k+'" value="'+esc(x.cod_inc_irrf||'')+'" size="3"></td><td><input data-f="fgts" data-k="'+k+'" value="'+esc(x.cod_inc_fgts||'')+'" size="3"></td><td><input type="checkbox" data-f="fr" data-k="'+k+'"'+(x.compoe_fator_r?' checked':'')+'></td><td><button class="bt" data-c="'+k+'">Confirmar</button> <b style="color:var(--bad,#a00)">a conferir</b></td>':'<td>'+esc(x.cod_inc_cp||'')+'</td><td>'+esc(x.cod_inc_irrf||'')+'</td><td>'+esc(x.cod_inc_fgts||'')+'</td><td>'+(x.compoe_fator_r?'sim':'não')+'</td><td>confirmada</td>')+'</tr>'}).join('')+'</tbody></table></div>':'<p class="msg">Nenhuma rubrica cadastrada nesta empresa.</p>')
   +'<p style="margin-top:10px"><button class="bt pri" id="r-sem">Cadastrar as rubricas do catálogo</button></p>';
  $('r-sem').onclick=function(){c.ok(async function(){var n=await c.DB.semearRubricas(c.EMP);c.aviso(n+' rubrica(s) cadastrada(s).');c.desenha()})};
  $('tela').querySelectorAll('button[data-c]').forEach(function(b){b.onclick=function(){c.ok(async function(){var k=b.getAttribute('data-c'),g=function(f){return $('tela').querySelector('[data-f="'+f+'"][data-k="'+k+'"]')};
    await c.DB.ajustarRubrica(c.EMP,k,g('cp').value.trim()||null,g('irrf').value.trim()||null,g('fgts').value.trim()||null,g('fr').checked);c.aviso('Rubrica '+k+' confirmada.');c.desenha()})}});
});

// ===== Pessoas: empregados, dependentes, salário e INSS de outro vínculo
A.registra('pessoas','Pessoas',async function(){var c=L(),$=c.$,esc=c.esc,R=c.R,N=c.N,em=await c.tenta(function(){return c.DB.empregadosFolha(c.EMP)},[]);
  var CATS=[['101','101 Empregado'],['103','103 Aprendiz'],['111','111 Intermitente'],['901','901 Estagiário']],TIPOS=[['clt','CLT'],['aprendiz','Aprendiz'],['intermitente','Intermitente'],['estagiario','Estagiário']];
  $('tela').innerHTML='<h2>Pessoas da folha</h2><p class="sub">Até 3 empregados por empresa. CPF, dependentes e salário com as regras do eSocial.</p>'
   +(em.length?c.tabela(['Nome','Cargo','Salário','Admissão'],em.map(function(x){return [esc(x.nome),esc(x.cargo||''),R(x.salario),esc(String(x.admissao).slice(0,10))]}),[2]):'<p class="msg">Nenhum empregado cadastrado.</p>')
   +'<h3 style="margin-top:12px">Novo empregado</h3><div class="grid"><label>Nome<input id="e-nome" maxlength="100"></label><label>CPF<input id="e-cpf" inputmode="numeric"></label><label>Cargo<input id="e-cargo" maxlength="60"></label><label>Salário (R$)<input id="e-sal" inputmode="numeric"></label><label>Admissão<input type="date" id="e-adm"></label><label>Categoria do eSocial<select id="e-cat">'+c.opt(CATS.map(function(x){return {v:x[0],t:x[1]}}),'v','t')+'</select></label><label>Tipo de vínculo<select id="e-tv">'+c.opt(TIPOS.map(function(x){return {v:x[0],t:x[1]}}),'v','t')+'</select></label></div><p style="margin-top:8px"><button class="bt pri" id="e-ok">Cadastrar empregado</button></p>'
   +(em.length?'<h3 style="margin-top:14px">Detalhes de um empregado</h3><label>Empregado<select id="d-emp">'+c.opt(em.map(function(x){return {v:x.id,t:x.nome}}),'v','t')+'</select></label><div id="d-out"></div>':'');
  $('e-ok').onclick=function(){c.ok(async function(){await c.DB.salvarEmpregado(c.EMP,{nome:$('e-nome').value,cpf:$('e-cpf').value,cargo:$('e-cargo').value,salario:N('e-sal'),admissao:$('e-adm').value,categoria_esocial:$('e-cat').value,tipo_vinculo:$('e-tv').value});c.aviso('Empregado cadastrado.');c.desenha()})};
  async function detalhe(){var id=$('d-emp').value,dp=await c.tenta(function(){return c.DB.dependentes(c.EMP,id)},[]),hs=await c.tenta(function(){return c.DB.historicoSalario(c.EMP,id)},[]),io=await c.tenta(function(){return c.DB.inssOutroVinculo(c.EMP,id)},[]);
    $('d-out').innerHTML='<h3 style="margin-top:10px">Dependentes</h3>'+c.tabela(['Nome','Nascimento','Tipo','Deduz IRRF','Salário-família',''],dp.map(function(x){return [esc(x.nome),esc(String(x.nascimento).slice(0,10)),esc(x.tipo),x.deduz_irrf?'sim':'não',x.salario_familia?'sim':'não','<button class="bt" data-dd="'+esc(x.id)+'">Apagar</button>']}))
     +'<div class="grid"><label>Nome<input id="dp-nome"></label><label>CPF<input id="dp-cpf" inputmode="numeric"></label><label>Nascimento<input type="date" id="dp-nasc"></label><label>Tipo<select id="dp-tipo">'+['conjuge','companheiro','filho','enteado','menor_sob_guarda','pais','incapaz','outro'].map(function(t){return '<option>'+t+'</option>'}).join('')+'</select></label></div><p style="margin-top:6px"><label><input type="checkbox" id="dp-irrf" checked> Deduz IRRF</label> <label><input type="checkbox" id="dp-sf"> Salário-família</label> <button class="bt pri" id="dp-ok">Adicionar dependente</button></p>'
     +'<h3 style="margin-top:12px">Histórico de salário</h3>'+c.tabela(['Vigência','Valor','Motivo'],hs.map(function(x){return [esc(String(x.vigencia_inicio).slice(0,10)),R(x.valor),esc(x.motivo)]}),[1])
     +'<div class="grid"><label>Vigência<input type="date" id="hs-v"></label><label>Novo salário (R$)<input id="hs-val" inputmode="numeric"></label><label>Motivo<input id="hs-mot" value="reajuste"></label></div><p style="margin-top:6px"><button class="bt pri" id="hs-ok">Registrar novo salário</button></p>'
     +'<h3 style="margin-top:12px">INSS recolhido em outro vínculo</h3>'+c.tabela(['Competência','Remuneração no outro vínculo','INSS no outro vínculo'],io.map(function(x){return [esc(String(x.competencia).slice(0,7)),R(x.remuneracao_outro),R(x.inss_outro)]}),[1,2])
     +'<div class="grid"><label>Mês<input type="month" id="io-mes"></label><label>Remuneração no outro vínculo (R$)<input id="io-rem" inputmode="numeric"></label><label>INSS já descontado lá (R$)<input id="io-inss" inputmode="numeric"></label></div><p style="margin-top:6px"><button class="bt pri" id="io-ok">Registrar</button></p>';
    $('d-out').querySelectorAll('button[data-dd]').forEach(function(b){b.onclick=function(){c.ok(async function(){await c.DB.apagarDependente(b.getAttribute('data-dd'));detalhe()})}});
    $('dp-ok').onclick=function(){c.ok(async function(){await c.DB.salvarDependente(c.EMP,id,{nome:$('dp-nome').value,cpf:$('dp-cpf').value,nascimento:$('dp-nasc').value,tipo:$('dp-tipo').value,deduzIrrf:$('dp-irrf').checked,salarioFamilia:$('dp-sf').checked});c.aviso('Dependente adicionado.');detalhe()})};
    $('hs-ok').onclick=function(){c.ok(async function(){await c.DB.novoSalario(c.EMP,id,{vigencia:$('hs-v').value,valor:N('hs-val'),motivo:$('hs-mot').value});c.aviso('Salário registrado.');detalhe()})};
    $('io-ok').onclick=function(){c.ok(async function(){await c.DB.salvarInssOutroVinculo(c.EMP,id,{competencia:$('io-mes').value,remuneracao:N('io-rem'),inss:N('io-inss')});c.aviso('Registrado.');detalhe()})}}
  if($('d-emp')){$('d-emp').onchange=detalhe;detalhe()}
});
})();
