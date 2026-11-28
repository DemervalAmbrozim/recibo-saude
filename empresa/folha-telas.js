// Tela "17 Verbas e vínculos" do contador (26/11/2026): usa folha-extras.js e folha.js sem mudar a lógica deles. Só leitura e cálculo: nada é gravado nem enviado.
// Tudo dentro de uma função para não criar nomes globais (a página já tem os seus; ver testes/globais-duplicados.test.js).
(function(){
  'use strict';
  var Q=function(i){return document.getElementById(i)};
  var BR=function(v){return v==null||isNaN(v)?'-':v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})};
  var ESC=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})};
  var NUM=function(id){var e=Q(id);if(!e)return 0;var v=String(e.value||'').replace(/\./g,'').replace(',','.');return v===''||isNaN(+v)?0:+v};
  var TXT=function(id){var e=Q(id);return e?String(e.value||'').trim():''};
  var CHK=function(id){var e=Q(id);return !!(e&&e.checked)};
  var DT=function(s){return s?s.split('-').reverse().join('/'):''};
  var TAB=function(h,rows,num){return '<div class="tbl"><table>'+(h?'<tr>'+h.map(function(x,i){return '<th'+(num&&num[i]?' class="n"':'')+'>'+ESC(x)+'</th>'}).join('')+'</tr>':'')+rows.map(function(r){return '<tr>'+r.map(function(x,i){return '<td'+(num&&num[i]?' class="n"':'')+'>'+x+'</td>'}).join('')+'</tr>'}).join('')+'</table></div>'};
  var ERROS=function(e){return (e||[]).map(function(x){return '<div class="alerta crit" role="alert">'+ESC(x)+'</div>'}).join('')};
  var AVISOS=function(a){return (a||[]).map(function(x){return '<div class="alerta">'+ESC(x)+(/CONFERIR COM O CONTADOR/i.test(x)?'':'')+'</div>'}).join('')};
  var LISTA=function(r){var P=r.proventos||[],D=r.descontos||[];
    return TAB(['Cód.','Descrição','Ref.','Proventos','Descontos'],P.map(function(x){return [ESC(x.cod),ESC(x.desc),ESC(x.ref||''),BR(x.valor),'']}).concat(D.map(function(x){return [ESC(x.cod),ESC(x.desc),ESC(x.ref||''),'',BR(x.valor)]})),[0,0,0,1,1])};
  var TOTAL=function(r){return '<p>Líquido <span class="big">'+BR(r.liquido)+'</span>'+(r.fgts!=null?' · FGTS do mês '+BR(typeof r.fgts==='object'?r.fgts.deposito:r.fgts):'')+'</p>'};
  var F=function(){return window};

  // campo: [id, rótulo, padrão, tipo, opções]. tipo: n número, d data, m mês, t texto, s lista, c caixa, a área de texto
  var SEL_ADIC=[['','Sem adicional'],['minimo','Insalubridade mínima (10%)'],['medio','Insalubridade média (20%)'],['maximo','Insalubridade máxima (40%)'],['peri','Periculosidade (30%)']];
  var SEL_PENS=[['','Sem pensão'],['valor_fixo','Valor fixo (R$)'],['percentual_bruto','% do bruto'],['percentual_liquido','% do líquido (após INSS e IRRF)'],['percentual_sm','% do salário mínimo']];
  var TELAS={
    mensal:{nome:'Folha do mês com verbas especiais',campos:[
      ['x-s','Salário (R$)','3.000','n'],['x-dep','Dependentes','0','n'],['x-vt','Custo do vale-transporte (R$)','0','n'],['x-he','Horas extras 50%','0','n'],['x-fa','Faltas (dias)','0','n'],
      ['x-ad','Adicional do laudo','','s',SEL_ADIC],['x-pt','Pensão alimentícia (ofício)','','s',SEL_PENS],['x-pv','Pensão: valor (R$) ou percentual (ex.: 30)','0','n'],
      ['x-cs','Parcela do consignado (R$)','0','n'],['x-ap','Adiantamento: % do salário (ex.: 40)','0','n'],['x-ar','IRRF já retido no adiantamento (R$)','0','n']],
      calc:function(){
        var X=F(),opc={};var ad=TXT('x-ad');if(ad==='peri')opc.adicional={periculosidade:true};else if(ad)opc.adicional={grau:ad};
        var pt=TXT('x-pt');if(pt){var pv=NUM('x-pv');opc.pensao=pt==='valor_fixo'?{tipo:pt,valor:pv}:{tipo:pt,percentual:pv/100}}
        if(NUM('x-cs')>0)opc.consignado={parcela:NUM('x-cs')};
        if(NUM('x-ap')>0)opc.adiantamento={percentual:NUM('x-ap')/100,irRetido:NUM('x-ar')};
        var r=X.calculaFolhaCompleta({salario:NUM('x-s'),dependentes:NUM('x-dep'),vtCusto:NUM('x-vt')},{heNormais:NUM('x-he'),faltasDias:NUM('x-fa')},2026,opc);
        if(!r.ok)return ERROS(r.erros);window.ULT_FX=r;
        var inf=(r.informativos||[]).map(function(i){return '<p class="sub">'+ESC(i.desc)+': '+BR(i.valor)+' (não descontado, só informativo)</p>'}).join('');
        var mc=X.memoriaDeCalculo(r,{salario:NUM('x-s'),dependentes:NUM('x-dep'),vtCusto:NUM('x-vt'),filhosSF:0,deducaoIRRFExtra:r.pensao?r.pensao.valor:0},{heNormais:NUM('x-he'),faltasDias:NUM('x-fa')},2026);
        var memo=mc.ok?'<details style="margin-top:10px"><summary><b>Como foi calculado</b> (conta e base legal de cada valor)</summary>'+TAB(['Item','Conta','Valor','Base'],mc.linhas.map(function(l){return [ESC(l.item),ESC(l.conta),l.valor==null?'':BR(l.valor),ESC(l.base)]}),[0,0,1,0])+'</details>':'';
        return LISTA(r)+TOTAL(r)+'<p class="sub">INSS '+BR(r.inss)+' · IRRF '+BR(r.irrf)+'</p>'+memo+inf+AVISOS(r.alertas)+AVISOS([r.aviso])}},
    estag:{nome:'Estagiário (Lei 11.788)',campos:[
      ['e-b','Bolsa-auxílio (R$)','1.500','n'],['e-n','Nível do estágio','superior','s',[['superior','Ensino superior'],['medio','Ensino médio'],['profissional','Educação profissional'],['fundamental_final','Fundamental (anos finais)'],['especial','Educação especial']]],
      ['e-jd','Jornada diária (h)','6','n'],['e-js','Jornada semanal (h)','30','n'],['e-ini','Início do estágio','2026-03-01','d'],['e-ref','Data de referência','2026-11-30','d'],
      ['e-aux','Auxílio-transporte (R$)','200','n'],['e-seg','Seguro de acidentes por mês (R$)','0','n'],['e-fa','Faltas (dias)','0','n'],['e-dep','Dependentes','0','n'],
      ['e-te','Empregados da empresa','3','n'],['e-ea','Estagiários ativos','1','n'],['e-pcd','Pessoa com deficiência','','c']],
      calc:function(){var r=F().calculaEstagiario({bolsa:NUM('e-b'),nivel:TXT('e-n'),jornadaDiariaH:NUM('e-jd'),jornadaSemanalH:NUM('e-js'),inicioContrato:TXT('e-ini'),auxTransporte:NUM('e-aux'),seguroMensal:NUM('e-seg'),dependentes:NUM('e-dep'),pcd:CHK('e-pcd')},{faltasDias:NUM('e-fa')},2026,{dataRef:TXT('e-ref'),totalEmpregados:NUM('e-te'),estagiariosAtivos:NUM('e-ea')});
        if(!r.ok)return ERROS(r.erros);
        return LISTA(r)+TOTAL(r)+TAB(null,[['Recesso a que tem direito até a data',r.recessoDiasDireito==null?'-':r.recessoDiasDireito+' dias'],['Cota máxima de estagiários',r.cotaMaxima==null?'-':String(r.cotaMaxima)],['Custo mensal para a empresa',BR(r.custoMensal)]])+AVISOS(r.alertas)}},
    aprend:{nome:'Aprendiz (CLT 428 a 433)',campos:[
      ['a-s','Salário (R$)','1.105,23','n'],['a-hs','Horas por semana','30','n'],['a-hd','Horas por dia','6','n'],['a-id','Idade','18','n'],['a-ad','Admissão','2026-02-01','d'],['a-fim','Fim do contrato','2027-12-31','d'],
      ['a-dep','Dependentes','0','n'],['a-fc','Fundamental concluído','','c'],['a-pcd','Pessoa com deficiência','','c']],
      calc:function(){var r=F().calculaAprendiz({salario:NUM('a-s'),horasSemanais:NUM('a-hs'),horasDia:NUM('a-hd'),idade:NUM('a-id'),admissao:TXT('a-ad'),fimContrato:TXT('a-fim'),dependentes:NUM('a-dep'),fundamentalConcluido:CHK('a-fc'),pcd:CHK('a-pcd')},{},2026);
        if(!r.ok)return ERROS(r.erros);return LISTA(r)+TOTAL(r)+'<p class="sub">Salário mínimo para esta jornada: '+BR(r.minimoSalario)+' · FGTS de 2%.</p>'+AVISOS(r.alertas)}},
    inter:{nome:'Trabalho intermitente (CLT 452-A)',campos:[
      ['i-vh','Valor da hora (R$)','20','n'],['i-h','Horas da convocação','100','n'],['i-du','Dias úteis do mês','25','n'],['i-dd','Dias de descanso','5','n'],['i-vp','Valor-hora dos demais empregados da função (R$)','0','n'],['i-dep','Dependentes','0','n'],['i-rsr','RSR já está dentro do valor-hora','','c']],
      calc:function(){var r=F().calculaIntermitente({valorHora:NUM('i-vh'),valorHoraPares:NUM('i-vp'),dependentes:NUM('i-dep'),rsrEmbutido:CHK('i-rsr')},{horas:NUM('i-h'),diasUteis:NUM('i-du'),diasDescanso:NUM('i-dd')},2026);
        if(!r.ok)return ERROS(r.erros);return LISTA(r)+'<p>Líquido a pagar ao fim da convocação <span class="big">'+BR(r.liquido)+'</span> · FGTS '+BR(r.fgts)+'</p>'+AVISOS(r.alertas)}},
    retro:{nome:'Retroativo e dissídio',campos:[
      ['r-sn','Salário novo (R$)','3.300','n'],['r-sp','Salário pago no período (R$)','3.000','n'],['r-ini','Primeira competência','2026-05','m'],['r-q','Quantidade de meses','3','n'],['r-var','Variáveis por mês (R$), para o teto do INSS','0','n'],
      ['r-mot','Motivo','acordo coletivo','t'],['r-jud','Veio de ação judicial','','c'],['r-pn','Nº do processo','','t'],['r-pv','Vara','','t'],['r-ph','Homologação','','d'],['r-rra','Calcular IRRF como rendimento acumulado (RRA, só ação judicial)','','c'],['r-nm','Meses do RRA (em branco = meses da tabela)','0','n'],['r-dc','Despesas da ação: custas e honorários (R$)','0','n']],
      calc:function(){var q=Math.max(0,Math.min(60,Math.floor(NUM('r-q')))),ini=TXT('r-ini'),meses=[];if(/^\d{4}-\d{2}$/.test(ini)){var a=+ini.slice(0,4),m=+ini.slice(5,7);for(var i=0;i<q;i++){var mm=m+i,aa=a+Math.floor((mm-1)/12),m2=((mm-1)%12)+1;meses.push({competencia:aa+'-'+(m2<10?'0':'')+m2,salarioPago:NUM('r-sp'),variaveis:NUM('r-var')})}}
        var r=F().calculaRetroativo({},{salarioNovo:NUM('r-sn'),motivo:TXT('r-mot'),meses:meses,judicial:CHK('r-jud'),usarRRA:CHK('r-rra'),mesesRRA:NUM('r-nm'),despesasAcao:NUM('r-dc'),processo:{numero:TXT('r-pn'),vara:TXT('r-pv'),homologacao:TXT('r-ph')}},2026);
        if(!r.ok)return ERROS(r.erros);
        return TAB(['Competência','Pago','Devido','Diferença','INSS'],r.linhas.map(function(l){return [l.competencia,BR(l.salarioPago),BR(l.salarioNovo),BR(l.diferenca),BR(l.inss)]}),[0,1,1,1,1])
          +TAB(null,[['Diferença dos meses',BR(r.diferenca)],['Reflexo no 13º (1/12)',BR(r.reflexo13)],['Reflexo nas férias + 1/3',BR(r.reflexoFerias)],['<b>Total bruto</b>','<b>'+BR(r.totalBruto)+'</b>'],['INSS por competência',BR(r.inssRetroativo)],['FGTS (8%)',BR(r.fgts)]].concat(r.rra?[['IRRF pelo cálculo de rendimentos acumulados (RRA, '+r.rra.meses+' meses)',BR(r.irrfRRA)],['Base mensal do RRA',BR(r.rra.baseMensal)]]:[]))+AVISOS(r.alertas)+AVISOS([r.aviso])}},
    medias:{nome:'Médias de férias e 13º',campos:[
      ['m-s','Salário (R$)','3.000','n'],['m-met','Como calcular a média','valor','s',[['valor','Por valor (comissão, prêmio habitual)'],['quantidade','Por quantidade × valor atual (hora extra)']]],['m-vat','Valor atual da hora (R$)','15','n'],['m-mes','Meses da média','12','s',[['12','12 meses (período aquisitivo)'],['6','6 meses'],['3','3 meses']]],
      ['m-gz','Dias de gozo das férias','30','n'],['m-h','Histórico (aaaa-mm;valor;quantidade, uma linha por mês)','2026-01;100;10\n2026-02;100;10\n2026-03;100;10\n2026-04;100;10\n2026-05;100;10\n2026-06;100;10\n2026-07;100;10\n2026-08;100;10\n2026-09;100;10\n2026-10;100;10\n2026-11;100;10\n2026-12;100;10','a']],
      calc:function(){var hist=[];TXT('m-h').split(/\n/).forEach(function(l){var p=l.split(';');if(p.length>=2&&/^\d{4}-\d{2}$/.test(p[0].trim()))hist.push({competencia:p[0].trim(),verbas:{variavel:{valor:+String(p[1]).replace(',','.')||0,qtd:+String(p[2]||0).replace(',','.')||0}}})});
        var op={meses:+TXT('m-mes')||12,metodoPorVerba:{variavel:TXT('m-met')},valorAtualPorVerba:{variavel:NUM('m-vat')}};
        var m=F().mediasVariaveis(hist,op);if(!m.ok)return ERROS(m.erros);
        var fe=F().calculaFeriasComHistorico({salario:NUM('m-s')},{diasGozo:NUM('m-gz')},hist,op,2026),d=F().calculaDecimoComHistorico({salario:NUM('m-s')},{avos:12},hist,op,2026);
        return TAB(['Verba','Meses com lançamento','Média por quantidade','Média por valor','Média usada'],m.linhas.map(function(l){return ['variável',String(l.mesesComLancamento),String(l.mediaQuantidade),BR(l.mediaValor),'<b>'+BR(l.media)+'</b>']}),[0,1,1,1,1])
          +'<p>Média usada: <span class="big">'+BR(m.media)+'</span> por mês ('+m.mesesLidos+' de '+m.meses+' meses lidos)</p>'
          +TAB(null,[['Férias ('+NUM('m-gz')+' dias) com a média',fe.ok?BR(fe.liquido)+' líquido':ESC((fe.erros||[]).join('; '))],['13º com a média (total)',d.ok?BR(d.total):ESC((d.erros||[]).join('; '))]])+AVISOS(m.alertas)}},
    rescest:{nome:'Fim do estágio (saldo e recesso)',campos:[
      ['z-b','Bolsa-auxílio (R$)','1.500','n'],['z-ini','Início do estágio','2026-03-01','d'],['z-sai','Data de saída','2026-09-10','d'],['z-rg','Dias de recesso já gozados','0','n'],['z-dep','Dependentes','0','n']],
      calc:function(){var sai=TXT('z-sai'),dia=+sai.slice(8,10)||0,ano=+sai.slice(0,4),mes=+sai.slice(5,7),dm=ano&&mes?new Date(ano,mes,0).getDate():30;
        var r=F().rescisaoEstagiario({bolsa:NUM('z-b'),inicioContrato:TXT('z-ini'),dependentes:NUM('z-dep')},{saidaDia:dia,diasMes:dm,diasRecessoGozados:NUM('z-rg')},2026,{dataSaida:sai});
        if(!r.ok)return ERROS(r.erros);return LISTA(r)+TOTAL(r)+TAB(null,[['Meses de estágio',String(r.mesesEstagio)],['Recesso a que tinha direito',r.recessoDireito+' dias'],['Recesso já gozado',r.recessoGozado+' dias'],['Recesso a pagar',r.recessoAGozar+' dias']])+AVISOS(r.alertas)}},
    ferpen:{nome:'Férias e 13º com pensão',campos:[
      ['q-s','Salário (R$)','6.000','n'],['q-gz','Dias de gozo','30','n'],['q-ab','Dias de abono','0','n'],['q-dep','Dependentes','0','n'],['q-pt','Pensão (ofício)','percentual_bruto','s',[['','Sem pensão'],['percentual_bruto','% do bruto'],['percentual_liquido','% do líquido (após INSS e IRRF)'],['valor_fixo','Valor fixo (não vale aqui)']]],['q-pp','Pensão: percentual (ex.: 20)','20','n'],['q-ap','Aprendiz (FGTS de 2%)','','c']],
      calc:function(){var X=F(),emp={salario:NUM('q-s'),dependentes:NUM('q-dep'),tipoVinculo:CHK('q-ap')?'aprendiz':'clt'},pt=TXT('q-pt'),pen=pt?{tipo:pt,percentual:NUM('q-pp')/100,valor:NUM('q-pp')}:null;
        var f=X.calculaFeriasCompleta(emp,{diasGozo:NUM('q-gz'),diasAbono:NUM('q-ab')},2026,{pensao:pen}),d=X.calculaDecimoCompleto(emp,{avos:12},2026,{pensao:pen});
        if(!f.ok)return ERROS(f.erros);if(!d.ok)return ERROS(d.erros);
        return '<h3>Férias</h3>'+LISTA(f)+'<p>INSS '+BR(f.inss)+' · IRRF '+BR(f.irrf)+' · FGTS '+BR(f.fgts)+(f.pensao?' · Pensão '+BR(f.pensao.valor):'')+'</p><p>Líquido '+BR(f.liquido)+(f.liquidoAposPensao!=null?' · <b>após a pensão '+BR(f.liquidoAposPensao)+'</b>':'')+'</p>'
          +'<h3>13º salário</h3>'+TAB(null,[['13º total',BR(d.total)],['1ª parcela (sem descontos)',BR(d.parcela1.liquido)],['2ª parcela (líquida)',BR(d.parcela2.liquido)],['FGTS do 13º',BR(d.fgtsTotal)]].concat(d.pensao?[['Pensão sobre o 13º',BR(d.pensao.valor)],['<b>Líquido do 13º após a pensão</b>','<b>'+BR(d.liquidoAposPensao)+'</b>']]:[]))+AVISOS((f.alertas||[]).concat(d.alertas||[]).filter(function(x,i,a){return a.indexOf(x)===i}))}},
    aviso:{nome:'Avisos de vencimento (férias, experiência, estágio, aprendiz)',campos:[
      ['v-ref','Data de referência','2026-11-26','d'],['v-adm','Admissão','2024-03-01','d'],['v-vin','Vínculo','clt','s',[['clt','CLT'],['estagiario','Estagiário'],['aprendiz','Aprendiz'],['intermitente','Intermitente']]],
      ['v-pg','Períodos de férias já gozados','0','n'],['v-exp','Contrato de experiência (dias, 0 = não tem)','0','n'],['v-ini','Início do estágio','','d'],['v-nas','Nascimento (aprendiz)','','d'],['v-fim','Fim do contrato (aprendiz)','','d'],['v-pcd','Pessoa com deficiência','','c']],
      calc:function(){var r=F().avisosVencimento({admissao:TXT('v-adm'),tipoVinculo:TXT('v-vin'),periodosGozados:NUM('v-pg'),experienciaDias:NUM('v-exp')||0,inicioContrato:TXT('v-ini')||undefined,nascimento:TXT('v-nas')||undefined,fimContrato:TXT('v-fim')||undefined,pcd:CHK('v-pcd')},TXT('v-ref'));
        if(!r.ok)return ERROS(r.erros);var cor={critico:'ruim',atencao:'at',info:'az'},nome={critico:'Urgente',atencao:'Atenção',info:'Informação'};
        return TAB(['Nível','Data','Dias','O que fazer'],r.avisos.map(function(a){return ['<span class="tag '+cor[a.nivel]+'">'+nome[a.nivel]+'</span>',DT(a.data),String(a.dias),ESC(a.texto)]}),[0,0,1,0])+AVISOS(r.alertas)}},
    esoc:{nome:'eSocial: painel de status (reagendar, retificar, excluir)',campos:[
      ['o-fila','Fila de eventos do eSocial (formato técnico do sistema; o exemplo já vem preenchido)','[{"id":1,"tipo":"S-1000","status":"aceito","recibo":"R1"},{"id":2,"tipo":"S-1005","status":"aceito","recibo":"R2"},{"id":3,"tipo":"S-2200","status":"enviado","empregado_id":"a","protocolo":"P3"},{"id":4,"tipo":"S-1200","status":"rejeitado","empregado_id":"a","competencia":"2026-11","erro":"CPF do trabalhador não confere"},{"id":5,"tipo":"S-2200","status":"rascunho","empregado_id":"b"},{"id":6,"tipo":"S-1210","status":"pronto","empregado_id":"a","competencia":"2026-11"}]','a'],['o-ac','Ação sobre um evento','','s',[['','Só ver o painel'],['reagendar','Reagendar (rejeitado)'],['retificar','Retificar (aceito)'],['excluir','Excluir com S-3000 (aceito)']]],['o-id','Número do evento','4','n'],['o-nota','O que foi corrigido (para reagendar)','corrigi o CPF no cadastro','t']],
      calc:function(){var fila;try{fila=JSON.parse(TXT('o-fila')||'[]')}catch(e){return ERROS(['A fila de eventos está fora do formato esperado: '+e.message])}
        if(!window.CAT_ESOCIAL&&!window.CAT_ESOCIAL_CARREGA&&typeof fetch==='function'){window.CAT_ESOCIAL_CARREGA=1;fetch('esocial-mensagens.json').then(function(r){return r.json()}).then(function(j){window.CAT_ESOCIAL=j;var e=Q('o-fila');if(e)e.dispatchEvent(new Event('input'))}).catch(function(){window.CAT_ESOCIAL_CARREGA=0})}
        var X=F(),p=X.painelStatus(fila,{catalogo:window.CAT_ESOCIAL,explica:X.explicaRejeicao}),h='<p>'+[['Em andamento',p.totais.andamento,'az'],['Pendentes',p.totais.pendentes,'at'],['Processados',p.totais.processados,''],['Rejeitados',p.totais.rejeitados,'ruim']].map(function(x){return '<span class="tag '+x[2]+'">'+x[0]+': '+x[1]+'</span>'}).join(' ')+'</p>';
        if(p.rejeitados.length)h+='<h3>Rejeitados</h3>'+TAB(['Nº','Evento','Competência','Motivo do eSocial'],p.rejeitados.map(function(e){return [String(e.id),ESC(e.tipo),ESC(e.competencia||''),ESC(e.motivo)+(e.oficial?'<br><span class="sub"><b>'+ESC(e.subtipo)+'</b> (texto oficial '+ESC(e.codigo)+'): '+ESC(e.oficial.mensagem)+(e.oficial.acao?' Ação sugerida: '+ESC(e.oficial.acao):'')+'</span>':'')]}));
        if(p.pendentes.length)h+='<h3>Pendentes</h3>'+TAB(['Nº','Evento','Por que ainda não segue'],p.pendentes.map(function(e){return [String(e.id),ESC(e.tipo),ESC(e.motivos.join('; '))]}));
        if(p.andamento.length)h+='<h3>Em andamento</h3>'+TAB(['Nº','Evento','Protocolo'],p.andamento.map(function(e){return [String(e.id),ESC(e.tipo),ESC(e.protocolo||'')]}));
        if(p.processados.length)h+='<h3>Processados</h3>'+TAB(['Nº','Evento','Recibo'],p.processados.map(function(e){return [String(e.id),ESC(e.tipo),ESC(e.recibo||'')]}));
        var ac=TXT('o-ac');if(ac){var ev=fila.filter(function(e){return String(e.id)===String(NUM('o-id'))})[0],r=ev?(ac==='reagendar'?X.reagendar(ev,TXT('o-nota')):ac==='retificar'?X.retificar(ev):X.excluir(ev)):{ok:false,erro:'não achei o evento '+NUM('o-id')+' na fila'};
          h+='<h3>Resultado da ação</h3>'+(r.ok?'<div class="alerta">Pronto. Quem grava na fila recebe isto (nada foi enviado):</div><pre style="white-space:pre-wrap;overflow-wrap:anywhere">'+ESC(JSON.stringify(r.campos||r.evento,null,1))+'</pre>':ERROS([r.erro]))}
        return h+AVISOS([p.aviso])}},
    conf:{nome:'Conferências antes de calcular a folha',campos:[
      ['k-s','Salário (R$)','3.000','n'],['k-v','Vínculo','clt','s',[['clt','CLT'],['estagiario','Estagiário'],['aprendiz','Aprendiz'],['intermitente','Intermitente']]],['k-he','Horas extras no mês','0','n'],['k-dt','Dias trabalhados no mês','22','n'],['k-fa','Faltas (dias)','0','n'],
      ['k-vt','Custo do vale-transporte (R$)','0','n'],['k-dep','Dependentes','0','n'],['k-sf','Filhos para salário-família','0','n'],['k-fg','FGTS cadastrado (%), em branco = padrão','','n'],['k-cc','Cargo de confiança (art. 62)','','c'],
      ['k-ad','Adicional cadastrado','','s',[['','Nenhum'],['insalubridade_medio','Insalubridade'],['periculosidade','Periculosidade']]],['k-lg','Referência do laudo','','t'],['k-pt','Pensão cadastrada','','s',[['','Nenhuma'],['percentual_bruto','Percentual'],['valor_fixo','Valor fixo']]],['k-pv','Pensão: valor ou percentual no cadastro','0','n']],
      calc:function(){var fg=TXT('k-fg'),r=F().conferenciasFolha({salario:NUM('k-s'),tipoVinculo:TXT('k-v'),vtCusto:NUM('k-vt'),dependentes:NUM('k-dep'),filhosSF:NUM('k-sf'),fgtsAliq:fg===''?undefined:NUM('k-fg')/100,cargoConfianca:CHK('k-cc'),adicionalTipo:TXT('k-ad')||undefined,adicionalLaudo:TXT('k-lg')||undefined,pensaoTipo:TXT('k-pt')||undefined,pensaoValor:NUM('k-pv'),pensaoPercentual:NUM('k-pv')},{heNormais:NUM('k-he'),diasTrabalhados:NUM('k-dt'),faltasDias:NUM('k-fa')},2026);
        var cor={critico:'ruim',atencao:'at',info:'az'},nome={critico:'Corrigir',atencao:'Conferir',info:'Informação'};
        if(!r.total)return '<div class="alerta" style="background:var(--soft);color:var(--accent)">Nada a conferir: o cadastro e o movimento passaram em todas as regras.</div>'+AVISOS(r.alertas);
        return '<p><b>'+r.total+'</b> aviso(s), <b>'+r.criticos+'</b> para corrigir antes de calcular.</p>'+TAB(['Nível','Regra','O que fazer'],r.avisos.map(function(a){return ['<span class="tag '+cor[a.nivel]+'">'+nome[a.nivel]+'</span>',ESC(a.regra),ESC(a.texto)]}))+AVISOS(r.alertas)}},
    ferlote:{nome:'Programação de férias da equipe (em lote)',campos:[
      ['l-ref','Data de referência','2026-11-26','d'],['l-max','No máximo quantas pessoas em férias ao mesmo tempo (0 = sem limite)','0','n'],['l-fer','Feriados (aaaa-mm-dd, um por linha)','2026-12-25\n2027-01-01','a'],
      ['l-emp','Equipe (nome;admissão;períodos já gozados;dias de gozo)','Ana;2024-03-01;0;30\nBia;2025-01-10;0;30\nCaio;2026-06-01;0;30','a']],
      calc:function(){var emp=TXT('l-emp').split(/\n/).map(function(l,i){var p=l.split(';');return p.length>=2&&p[0].trim()?{id:'e'+i,nome:p[0].trim(),admissao:p[1].trim(),periodosGozados:+(p[2]||0)||0,diasGozo:+(p[3]||30)||30}:null}).filter(Boolean);
        var fer=TXT('l-fer').split(/\s+/).filter(function(x){return /^\d{4}-\d{2}-\d{2}$/.test(x)});
        var r=F().programaFeriasLote(emp,TXT('l-ref'),{feriados:fer,maxSimultaneos:NUM('l-max')});if(!r.ok)return ERROS(r.erros);
        var cor={'programada':'','em aquisição':'az','fora do prazo: dobro':'ruim'};
        return TAB(['Empregado','Limite para começar','Situação','Início','Fim','Avisar até','Pagar até'],r.linhas.map(function(l){return [ESC(l.nome),DT(l.limiteConcessivo),'<span class="tag '+(cor[l.situacao]||'at')+'">'+ESC(l.situacao||l.erro)+'</span>',l.inicio?DT(l.inicio):'',l.fim?DT(l.fim):'',l.avisarAte?DT(l.avisarAte):'',l.pagarAte?DT(l.pagarAte):'']}))
          +r.linhas.filter(function(l){return l.alertas&&l.alertas.length}).map(function(l){return AVISOS(l.alertas.map(function(a){return l.nome+': '+a}))}).join('')+AVISOS(r.alertas)}},
    fercol:{nome:'Férias coletivas',campos:[
      ['y-ini','Início','2026-12-14','d'],['y-p1','1º período (dias)','15','n'],['y-p2','2º período (dias, 0 = não tem)','15','n'],['y-fer','Feriados (aaaa-mm-dd, um por linha)','2026-12-25','a']],
      calc:function(){var p=[NUM('y-p1')];if(NUM('y-p2')>0)p.push(NUM('y-p2'));var fer=TXT('y-fer').split(/\s+/).filter(function(x){return /^\d{4}-\d{2}-\d{2}$/.test(x)});
        var r=F().feriasColetivas({periodos:p,inicio:TXT('y-ini'),feriados:fer});if(!r.ok)return ERROS(r.erros);
        return TAB(null,[['Primeiro período termina em',DT(r.fimPrimeiroPeriodo)],['Avisar os empregados até',DT(r.avisarEmpregadosAte)],['Comunicar o Ministério do Trabalho e o sindicato até',DT(r.comunicarAte)],['Pagar as férias até',DT(r.pagarAte)],['Início permitido pela regra dos 2 dias',r.inicioValido?'sim':'<b>não</b>']])+AVISOS(r.alertas)}},
    rpa:{nome:'Autônomo (RPA)',campos:[
      ['p-v','Valor do serviço (R$)','3.000','n'],['p-n','Nome do autônomo','Autônomo Exemplo','t'],['p-c','CPF','000.000.000-00','t'],['p-dep','Dependentes','0','n'],['p-iss','ISS retido (%) do município','0','n'],['p-io','INSS já recolhido em outras fontes no mês, base (R$)','0','n'],
      ['p-an','Anexo do Simples da empresa','','s',[['','Não é Simples ou Anexo IV'],['III','Anexo III'],['I','Anexo I'],['II','Anexo II']]]],
      calc:function(){var r=F().calculaRPA({valor:NUM('p-v'),nome:TXT('p-n'),cpf:TXT('p-c'),dependentes:NUM('p-dep'),aliquotaISS:NUM('p-iss')/100,inssOutrasFontes:NUM('p-io'),anexoSimples:TXT('p-an')||null},2026);
        if(!r.ok)return ERROS(r.erros);
        return TAB(null,[['Valor do serviço',BR(r.valor)],['INSS do autônomo (11%)',BR(r.inss)],['IRRF',BR(r.irrf)],['ISS retido',BR(r.iss)],['<b>Líquido a pagar</b>','<b>'+BR(r.liquido)+'</b>'],['Parte da empresa (20%)',BR(r.patronal)],['Custo total para a empresa',BR(r.custoEmpresa)]])+AVISOS(r.alertas)+AVISOS([r.aviso])}},
    ret:{nome:'Conferir a folha contra o retorno do governo',campos:[
      ['q-f','Nossa folha (id;nome;INSS;IRRF;FGTS, uma linha por empregado)','1;Ana;501,51;0;400\n2;Bia;800;300;640','a'],
      ['q-g','Retorno do governo (id;INSS;IRRF;FGTS, copie do eSocial ou da DCTFWeb)','1;501,51;0;400\n2;800;250;640','a'],['q-t','Tolerância por valor (R$)','0,05','n']],
      calc:function(){var N=function(x){x=String(x||'0').trim().replace(/\./g,'').replace(',','.');return isNaN(+x)?0:+x};
        var L=function(id){return TXT(id).split(/\n/).map(function(l){return l.trim()}).filter(Boolean).map(function(l){return l.split(';')})};
        var fo=L('q-f').map(function(c){return {id:c[0],nome:c[1],inss:N(c[2]),irrf:N(c[3]),fgts:N(c[4])}});
        var go=L('q-g').map(function(c){return {id:c[0],inss:N(c[1]),irrf:N(c[2]),fgts:N(c[3])}});
        var r=F().confereRetornoGoverno(fo,go,{tolerancia:NUM('q-t')});if(!r.ok)return ERROS(r.erros);
        var rs=['inss','irrf','fgts'].map(function(t){var x=r.resumo[t];return [ESC(x.rotulo),BR(x.nos),BR(x.governo),BR(x.dif),x.ok?'confere':'<b>diferente</b>']});
        var ln=r.linhas.filter(function(l){return l.status!=='ok'}).map(function(l){return [ESC(l.nome),ESC(l.status),ESC(Object.keys(l.difs).map(function(t){return t.toUpperCase()+' '+BR(l.difs[t].dif)}).join(' · '))]});
        return '<p>'+(r.conferido?'<b>Tudo confere.</b>':'<b>Não confere:</b> não retransmita nem pague guia antes de fechar a diferença.')+'</p>'+TAB(['Tributo','Nosso','Governo','Diferença','Situação'],rs,[0,1,1,1,0])+(ln.length?'<p class="sub">Linhas com problema</p>'+TAB(['Empregado','Situação','Diferenças'],ln):'')+AVISOS(r.causas)+AVISOS(r.alertas)+AVISOS([r.aviso])}},
    ponto:{nome:'Importar o espelho de ponto (planilha)',campos:[
      ['n-t','Planilha (cabeçalho + uma linha por empregado; separador ; ou tabulação)','id;nome;he50;he100;noturnas;faltas;atraso;salario\n1;Ana;10,5;4;8;0;1:30;3.000,00\n2;Bia;0;0;0;2;0;4.500,00','a'],['n-du','Dias úteis do mês','25','n']],
      calc:function(){var r=F().importaPonto(TXT('n-t'),{diasUteis:NUM('n-du')});if(!r.ok)return ERROS(r.erros);
        var X=F(),h=function(v){return v==null?'-':String(v).replace('.',',')};
        var rows=r.linhas.map(function(l){var m=l.mov,liq='-';
          if(l.salario){var c=X.calculaFolha({salario:l.salario},Object.assign({diasUteis:NUM('n-du')||25,diasDescanso:30-(NUM('n-du')||25)},m),2026);liq=c.ok?BR(c.liquido):'erro'}
          return [ESC(l.nome),h(m.heNormais),h(m.heDescanso),h(m.horasNoturnas),h(m.faltasDias),h(m.atrasoHoras),liq]});
        return TAB(['Empregado','HE 50%','HE 100%','Noturnas','Faltas','Atraso (h)','Líquido (estimativa)'],rows,[0,1,1,1,1,1,1])+ERROS(r.erros)+AVISOS(r.alertas)+AVISOS([r.aviso])}},
    rej:{nome:'eSocial: o que significa o código da rejeição (texto oficial)',campos:[
      ['j-c','Código que o eSocial devolveu (ex.: MS0269 ou 269)','MS0269','t'],['j-p','Valores dos parâmetros {0}, {1}, {2} (um por linha, opcional)','9999\n1\n2026-11','a']],
      calc:function(){var X=F();
        if(!window.CAT_ESOCIAL){if(!window.CAT_ESOCIAL_CARREGA){window.CAT_ESOCIAL_CARREGA=1;fetch('esocial-mensagens.json').then(function(r){return r.json()}).then(function(j){window.CAT_ESOCIAL=j;var e=Q('j-c');if(e)e.dispatchEvent(new Event('input'))}).catch(function(){window.CAT_ESOCIAL_CARREGA=0;window.CAT_ESOCIAL_ERRO=1;var e=Q('j-c');if(e)e.dispatchEvent(new Event('input'))})}
          return window.CAT_ESOCIAL_ERRO?ERROS(['Não consegui carregar o catálogo oficial de mensagens do eSocial. Recarregue a página.']):'<p class="sub">Carregando o catálogo oficial de mensagens (1.099 códigos)...</p>'}
        var r=X.explicaRejeicao(TXT('j-c'),window.CAT_ESOCIAL,TXT('j-p').split(/\n/).map(function(x){return x.trim()}));
        if(!r.ok)return ERROS(r.erros);if(!r.achou)return AVISOS([r.aviso]);
        return '<p><b>'+ESC(r.codigo)+'</b> <span class="sub">('+ESC(r.tipo)+')</span></p><p>'+ESC(r.mensagem)+'</p>'+(r.acao?'<p><b>Ação sugerida pelo eSocial:</b> '+ESC(r.acao)+'</p>':'')
          +'<p class="sub">Fonte: '+ESC(r.fonte)+', página '+r.pagina+'. <a href="'+ESC(r.url)+'" rel="noopener" target="_blank">PDF oficial</a></p>'+AVISOS([r.aviso])}},
    rec:{nome:'Recibos para imprimir: férias, rescisão e RPA',campos:[
      ['r-t','Recibo','ferias','s',[['ferias','Férias'],['rescisao','Rescisão (verbas, não é o TRCT)'],['rpa','RPA (autônomo)'],['inter','Intermitente (convocação)']]],
      ['r-n','Nome','Ana Souza','t'],['r-c','CPF','123.456.789-09','t'],['r-s','Salário (R$), valor do serviço (RPA) ou valor da HORA (intermitente)','3.000','n'],
      ['r-ad','Admissão (rescisão)','2024-02-01','t'],['r-sa','Saída ou início das férias (aaaa-mm-dd)','2026-11-20','t'],
      ['r-ti','Motivo da rescisão','sem_justa_causa','s',[['sem_justa_causa','Sem justa causa'],['pedido_demissao','Pedido de demissão'],['justa_causa','Justa causa'],['acordo','Acordo (art. 484-A)'],['termino_contrato','Término de contrato']]],
      ['r-nr','Nº do recibo (RPA)','1','n'],['r-h','Horas da convocação (intermitente)','100','n']],
      calc:function(){var emp={nome:TXT('r-n'),cpf:TXT('r-c'),salario:NUM('r-s')},empresa={nome:'Empresa (exemplo)',cnpj:''},t=TXT('r-t'),r,out;
        if(t==='ferias'){r=window.reciboFeriasHTML(window.calculaFerias(emp,{diasGozo:30}),empresa,emp,{inicio:TXT('r-sa')})}
        else if(t==='rescisao'){r=window.reciboRescisaoHTML(window.calculaRescisao(emp,{tipo:TXT('r-ti'),admissao:TXT('r-ad'),saida:TXT('r-sa')}),empresa,emp,{saida:TXT('r-sa')})}
        else if(t==='inter'){r=window.reciboIntermitenteHTML(window.calculaIntermitente({valorHora:NUM('r-s'),dependentes:0},{horas:NUM('r-h'),diasUteis:25,diasDescanso:5},2026),empresa,emp,{})}
        else{r=window.reciboRPAHTML(window.calculaRPA({nome:emp.nome,cpf:emp.cpf,valor:NUM('r-s')}),empresa,emp,{numero:NUM('r-nr'),data:TXT('r-sa')})}
        if(!r.ok)return ERROS(r.erros);
        return '<iframe title="Recibo" style="width:100%;height:520px;border:1px solid #999;background:#fff" srcdoc="'+r.html.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'"></iframe><p class="sub">Para imprimir, abra o recibo e use Imprimir do navegador. Estimativa até o contador conferir.</p>'}},
    comp:{nome:'Folha complementar (pagamento adicional de um mês já calculado)',campos:[
      ['c-s','Salário do mês (R$)','3.000','n'],['c-dep','Dependentes','1','n'],
      ['c-d','Descrição do que será pago a mais','Diferença salarial','t'],['c-v','Valor (R$)','500','n'],
      ['c-i','Incide INSS, IRRF e FGTS','1','c'],['c-dd','Desconto a descontar nesta complementar (R$)','0','n']],
      calc:function(){var X=F(),emp={salario:NUM('c-s'),dependentes:NUM('c-dep')},o=X.calculaFolha(emp,{});if(!o.ok)return ERROS(o.erros);
        var inc=CHK('c-i'),dd=NUM('c-dd'),r=X.calculaComplementar(emp,o,{motivo:TXT('c-d'),proventos:[{desc:TXT('c-d'),valor:NUM('c-v'),inss:inc,irrf:inc,fgts:inc}],descontos:dd>0?[{desc:'Desconto',valor:dd}]:[]});
        if(!r.ok)return ERROS(r.erros);
        return TAB(['Item','Valor'],[['Folha original: INSS / IRRF / líquido',BR(o.inss)+' / '+BR(o.irrf)+' / '+BR(o.liquido)],['Complementar: bruto',BR(r.bruto)],['INSS da complementar',BR(r.inss)],['IRRF da complementar',BR(r.irrf)],['FGTS da complementar',BR(r.fgts)],['<b>Líquido da complementar</b>','<b>'+BR(r.liquido)+'</b>'],['Total do mês: INSS / IRRF / FGTS',BR(r.totalMes.inss)+' / '+BR(r.totalMes.irrf)+' / '+BR(r.totalMes.fgts)]],[0,1])+AVISOS(r.alertas.concat([r.aviso]))}},
    d13:{nome:'13º salário: 1ª parcela, 2ª parcela e FGTS (integral ou proporcional)',campos:[
      ['d-s','Salário (R$)','3.000','n'],['d-av','Avos trabalhados no ano (1 a 12)','12','n'],['d-dep','Dependentes','0','n']],
      calc:function(){var X=F(),emp={salario:NUM('d-s'),dependentes:NUM('d-dep')},d=X.calculaDecimoCompleto(emp,{avos:Math.floor(NUM('d-av'))},2026,{});if(!d.ok)return ERROS(d.erros);
        return TAB(['Item','Valor'],[['13º total ('+d.avos+'/12)',BR(d.total)],['1ª parcela (sem descontos), vence '+DT(d.parcela1.vence),BR(d.parcela1.liquido)],['2ª parcela: bruto',BR(d.parcela2.bruto)],['INSS da 2ª parcela',BR(d.parcela2.inss)],['IRRF da 2ª parcela (exclusivo na fonte)',BR(d.parcela2.irrf)],['<b>2ª parcela líquida, vence '+DT(d.parcela2.vence)+'</b>','<b>'+BR(d.parcela2.liquido)+'</b>'],['FGTS do 13º (1ª + 2ª)',BR(d.fgtsTotal)]],[0,1])
          +AVISOS([d.aviso,'Rescisão em dezembro ou janeiro: o FGTS do 13º vence junto com a rescisão (NO FGTS Digital 13/2026).'])}},
    s2230:{nome:'Afastamento: prazo do evento S-2230 (início e término)',campos:[
      ['a-t','Tipo','doenca','s',[['doenca','Doença (não do trabalho)'],['acidente_outro','Acidente fora do trabalho'],['doenca_trabalho','Doença do trabalho'],['acidente_trabalho','Acidente do trabalho'],['outro','Outro motivo']]],
      ['a-i','Início (aaaa-mm-dd)','2026-11-10','t'],['a-d','Duração em dias','10','n'],['a-r','Retorno (aaaa-mm-dd, se já voltou)','','t'],
      ['a-p','Dias de afastamento pela mesma doença nos últimos 60 dias','0','n'],['a-x','Mesma doença, em até 60 dias, com auxílio por incapacidade anterior','','c'],
      ['a-f','Feriados (aaaa-mm-dd, um por linha)','','a']],
      calc:function(){var fer=TXT('a-f').split(/\n/).map(function(l){return l.trim()}).filter(Boolean);
        var r=F().prazoS2230({tipo:TXT('a-t'),inicio:TXT('a-i'),duracaoDias:NUM('a-d'),retorno:TXT('a-r')||null,diasAnteriores60d:NUM('a-p'),mesmaDoencaAuxilio60d:CHK('a-x'),feriados:fer});
        if(!r.ok)return ERROS(r.erros);
        return '<p>Enviar o início até <span class="big">'+DT(r.inicioAte)+'</span></p><p class="sub">Regra '+ESC(r.regra)+'</p>'+(r.terminoAte?'<p>Enviar o término até <span class="big">'+DT(r.terminoAte)+'</span></p><p class="sub">Regra '+ESC(r.terminoRegra)+'</p>':'')+AVISOS(r.alertas.concat([r.aviso]))}},
    rpal:{nome:'RPA: lista numerada do mês, totais e próximo número',campos:[
      ['l-c','Competência (aaaa-mm)','2026-11','t'],
      ['l-r','Recibos (número;data aaaa-mm-dd;CPF;valor;INSS;IRRF;ISS, um por linha)','1;2026-11-03;529.982.247-25;2.000,00;220,00;0;0\n2;2026-11-10;111.444.777-35;1.000,00;110,00;0;0','a']],
      calc:function(){var N=function(x){x=String(x||'0').trim().replace(/\./g,'').replace(',','.');return isNaN(+x)?0:+x};
        var rc=TXT('l-r').split(/\n/).map(function(l){return l.trim()}).filter(Boolean).map(function(l){var c=l.split(';'),v=N(c[3]),i=N(c[4]),r=N(c[5]),z=N(c[6]);return {numero:N(c[0]),data:(c[1]||'').trim(),nome:'',cpf:(c[2]||'').trim(),valor:v,inss:i,irrf:r,iss:z,liquido:Math.round((v-i-r-z)*100)/100}});
        var r=F().listaRPA(rc,{competencia:TXT('l-c')||null});if(!r.ok)return ERROS(r.erros);
        return '<p><span class="tag">Recibos: '+r.quantidade+'</span> <span class="tag">De '+r.primeiro+' a '+r.ultimo+'</span> <span class="tag az">Próximo número: '+r.proximo+'</span></p>'
          +TAB(['Nº','Data','CPF','Valor','INSS','IRRF','ISS','Líquido'],r.recibos.map(function(x){return [x.numero,DT(x.data),ESC(x.cpf),BR(x.valor),BR(x.inss),BR(x.irrf),BR(x.iss),BR(x.liquido)]}).concat([['<b>Total</b>','','',BR(r.totais.valor),BR(r.totais.inss),BR(r.totais.irrf),BR(r.totais.iss),BR(r.totais.liquido)]]),[1,0,0,1,1,1,1,1])+AVISOS(r.alertas.concat([r.aviso]))}},
    fech:{nome:'Fechar o mês (simulação em lote): o que falta em cada empresa',campos:[
      ['f-j','Uma empresa por linha: nome; folhas aprovadas; folhas ainda em rascunho; conferências feitas (sim/não); recibos gerados (sim/não); S-1200; S-1210; S-1299 (aceito, enviado, pendente ou rejeitado)','Clínica A;1;0;sim;sim;aceito;aceito;aceito\nClínica B;0;1;não;não;pendente;pendente;pendente','a'],['f-h','Hoje (aaaa-mm-dd)','2026-11-30','t']],
      calc:function(){var N=function(x){x=parseInt(String(x||'0').trim(),10);return isNaN(x)||x<0?0:x},SN=function(x){var t=String(x||'').trim().toLowerCase();return t==='sim'||t==='s'?true:t==='não'||t==='nao'||t==='n'?false:null},ST=['aceito','enviado','pendente','rejeitado'];
        var linhas=TXT('f-j').split(/\n/).map(function(l){return l.trim()}).filter(Boolean),e=[],er=[],comp=(TXT('f-h')||new Date().toISOString().slice(0,10)).slice(0,7);
        linhas.forEach(function(l,i){var c=l.split(';').map(function(x){return x.trim()});
          if(c.length<8){er.push('Linha '+(i+1)+': informe os 8 campos separados por ponto e vírgula (nome; aprovadas; rascunho; conferências; recibos; S-1200; S-1210; S-1299).');return}
          var st=[c[5],c[6],c[7]].map(function(x){return x.toLowerCase()});if(st.some(function(x){return ST.indexOf(x)<0})){er.push('Linha '+(i+1)+': S-1200, S-1210 e S-1299 devem ser aceito, enviado, pendente ou rejeitado.');return}
          var f=[],ap=N(c[1]),ra=N(c[2]),k;for(k=0;k<ap;k++)f.push({empregado:'Empregado '+(f.length+1),status:'aprovada'});for(k=0;k<ra;k++)f.push({empregado:'Empregado '+(f.length+1),status:'rascunho'});
          e.push({id:i+1,nome:c[0],competencia:comp,folhas:f,conferenciaOk:SN(c[3]),recibosGerados:SN(c[4]),eventos:[{evento:'S-1200',status:st[0]},{evento:'S-1210',status:st[1]},{evento:'S-1299',status:st[2]}]})});
        if(er.length)return ERROS(er);
        var r=F().rotinaLote(e,TXT('f-h')||null);if(!r.ok)return ERROS(r.erros);var s=r.resumo;
        return '<p><span class="tag ruim">Bloqueadas: '+s.bloqueadas+'</span> <span class="tag at">Com pendência: '+s.comPendencia+'</span> <span class="tag">Prontas: '+s.prontas+'</span> <span class="tag az">Já fechadas: '+s.jaFechadas+'</span></p>'
          +TAB(['Empresa','Situação','Próxima ação'],r.itens.map(function(x){return [ESC(x.nome||'?'),x.jaFechada?'Fechada':!x.pode?'Bloqueada':x.pendencias.length?'Pode fechar, com pendência':'Pronta',ESC(x.proximaAcao)]}),[0,0,0])+AVISOS([r.aviso])}},
    s1200:{nome:'eSocial S-1200: prévia da remuneração do mês (sem assinar, sem enviar)',campos:[
      ['x-cnpj','CNPJ do empregador','11.222.333/0001-81','t'],['x-cpf','CPF do empregado','529.982.247-25','t'],['x-mat','Matrícula (a do S-2200)','0001','t'],['x-lot','Código da lotação tributária','LOT1','t'],
      ['x-per','Competência (aaaa-mm)','2026-11','t'],['x-s','Salário (R$)','3.000','n'],['x-he','Horas extras 50% no mês','10','n'],['x-tab','Identificador da tabela de rubricas (ideTabRubr)','1','t'],['x-aut','É autônomo (RPA, categoria 701): o salário vira o valor do serviço','','c'],['x-nm','Autônomo: nome','Bia Autônoma Souza','t'],['x-nasc','Autônomo: nascimento (aaaa-mm-dd)','1985-04-10','t'],['x-cbo','Autônomo: CBO (6 números)','322205','t']],
      calc:function(){var X=F(),tab=TXT('x-tab')||'1',aut=CHK('x-aut'),rb,f;
        if(aut){var rp=X.calculaRPA({nome:TXT('x-nm'),cpf:TXT('x-cpf'),valor:NUM('x-s')},2026);if(!rp.ok)return ERROS(rp.erros);
          rb={rubricas:[{codRubr:'RPA',ideTabRubr:tab,vrRubr:rp.valor,indApurIR:0,descricao:'Serviço de autônomo'}].concat(rp.inss>0?[{codRubr:'RPAINSS',ideTabRubr:tab,vrRubr:rp.inss,indApurIR:0,descricao:'INSS retido do autônomo'}]:[]).concat(rp.irrf>0?[{codRubr:'RPAIRRF',ideTabRubr:tab,vrRubr:rp.irrf,indApurIR:0,descricao:'IRRF retido do autônomo'}]:[])};rb.codigosNoS1010=rb.rubricas.map(function(x){return x.codRubr+' - '+x.descricao})}
        else{f=X.calculaFolha({salario:NUM('x-s')},{heNormais:NUM('x-he')},2026);if(!f.ok)return ERROS(f.erros);rb=X.rubricasDaFolha(f,{ideTabRubr:tab})}
        var r=X.montaS1200({tpAmb:2,empregador:{tpInsc:1,nrInsc:TXT('x-cnpj')},cpfTrab:TXT('x-cpf'),matricula:aut?'':TXT('x-mat'),codCateg:aut?'701':'101',autonomo:aut,nmTrab:TXT('x-nm'),dtNascto:TXT('x-nasc'),codCBO:TXT('x-cbo'),hoje:new Date().toISOString().slice(0,10),indApuracao:1,perApur:TXT('x-per'),ideDmDev:aut?'RPA1':'01',estab:{tpInsc:1,nrInsc:TXT('x-cnpj'),codLotacao:TXT('x-lot')},grauExp:1,rubricas:rb.rubricas});
        if(!r.ok)return ERROS(r.erros);
        return '<h3>Rubricas que precisam existir na tabela S-1010</h3><ul>'+rb.codigosNoS1010.map(function(x){return '<li>'+ESC(x)+'</li>'}).join('')+'</ul><h3>Prévia do evento (XML sem assinatura)</h3><pre style="white-space:pre-wrap;word-break:break-all;font-size:12px">'+ESC(r.xml)+'</pre>'+AVISOS(r.alertas.concat([r.aviso]))}},
    t18:{nome:'eSocial: motivo de afastamento (Tabela 18) e se a empresa precisa enviar',campos:[
      ['t-c','Código do motivo (1 a 51)','3','n']],
      calc:function(){var m=F().motivoAfastamento(Math.floor(NUM('t-c')));if(!m.conhecido)return AVISOS([m.aviso]);
        return '<p><b>'+ESC(m.cod)+' - '+ESC(m.descricao)+'</b></p><p><span class="tag '+(m.obrigatoriedade==='nao_enviar'?'ruim':m.obrigatoriedade==='obrigatoria'?'at':'az')+'">'+ESC(m.rotulo)+'</span></p>'+(m.nota?'<p>'+ESC(m.nota)+'</p>':'')+AVISOS(['Regra lida no MOS S-2230, item 2.1, para empregado CLT de empresa privada. [CONFERIR COM O CONTADOR] em caso de dúvida.'])}},
    vig:{nome:'Tabelas legais em uso: estão em dia?',campos:[['v-h','Hoje (aaaa-mm-dd)','','t'],['v-d','Avisar se conferida há mais de (dias)','90','n']],
      calc:function(){var hoje=TXT('v-h')||new Date().toISOString().slice(0,10),r=F().statusTabelas(hoje,{diasConferencia:NUM('v-d')||90});if(!r.ok)return ERROS(r.erros);var s=r.resumo;
        return '<p><span class="tag">Em dia: '+s.ok+'</span> <span class="tag at">Atenção: '+s.atencao+'</span> <span class="tag ruim">Crítico: '+s.critico+'</span></p>'
          +TAB(['Tabela','Situação','Conferida em','Fonte e reajuste'],r.itens.map(function(x){return [ESC(x.nome),x.situacao==='ok'?'Em dia':x.situacao==='atencao'?'Atenção: '+ESC(x.motivo):'CRÍTICO: '+ESC(x.motivo),DT(x.conferido),ESC(x.fonte)+' · Reajuste: '+ESC(x.reajuste)]}),[0,0,0,0])+AVISOS([r.aviso])}},
    fluxo:{nome:'Fluxo guiado do mês: onde estou e qual é o próximo passo',campos:[
      ['g-c','Competência (aaaa-mm)','2026-11','t'],['g-1','Recebi as variáveis do mês (ponto, faltas, comissões)','','c'],['g-2','Rodei as conferências','','c'],['g-3','Calculei a folha','','c'],['g-4','O contador aprovou','','c'],
      ['g-5','Gerei os recibos','','c'],['g-6','Preparei o S-1200','','c'],['g-7','Gerei as guias','','c'],['g-8','Fechei a competência','','c']],
      calc:function(){var r=F().fluxoDoMes({competencia:TXT('g-c'),variaveis:CHK('g-1'),conferencia:CHK('g-2'),calculada:CHK('g-3'),aprovada:CHK('g-4'),recibos:CHK('g-5'),esocial:CHK('g-6'),guias:CHK('g-7'),fechada:CHK('g-8')});if(!r.ok)return ERROS(r.erros);
        var h='<p><span class="tag az">'+r.obrigatoriosFeitos+' de '+r.obrigatoriosTotal+' passos obrigatórios</span> <b>'+ESC(r.resumo)+'</b></p>'
          +TAB(['#','Passo','Quem','Situação',''],r.passos.map(function(p){return [p.n,ESC(p.nome),p.quem,p.estado==='feito'?'Feito':p.estado==='atual'?'<b>AGORA</b>':p.estado==='opcional'?'Opcional':'Aguarda',(p.estado==='atual'||p.estado==='opcional')?'<button type="button" data-abre="'+p.tela+'">Abrir a tela</button>':'']}),[1,0,0,0,0]);
        if(r.incoerencias.length)h+=AVISOS(r.incoerencias);return h}},
    dup:{nome:'Importar rendimentos: barrar duplicados (Carnê-Leão soma, não sobrescreve)',campos:[
      ['d-e','Já lançados (data aaaa-mm-dd;CPF do pagador;valor, um por linha)','2026-05-10;123.456.789-09;1.500,00','a'],
      ['d-n','A importar (mesmo formato)','2026-05-10;12345678909;1.500,00\n2026-05-12;12345678909;800,00\n10/05/2026;123;5','a']],
      calc:function(){var L=function(t){return t.split(/\n/).map(function(l){return l.trim()}).filter(Boolean).map(function(l){var c=l.split(';');return {data:(c[0]||'').trim(),cpf:(c[1]||'').trim(),valor:(c[2]||'').trim()}})};
        var r=F().separaDuplicados(L(TXT('d-e')),L(TXT('d-n'))),M=function(x){return x.registro.data+' · '+x.registro.cpf+' · '+x.registro.valor};
        return '<p><span class="tag">Importar: '+r.resumo.importar+'</span> <span class="tag at">Duplicados: '+r.resumo.duplicados+'</span> <span class="tag ruim">Inválidos: '+r.resumo.invalidos+'</span></p>'
          +(r.duplicados.length?TAB(['Linha','Duplicado (já lançado ou repetido no lote)'],r.duplicados.map(function(x){return [x.linha,ESC(M(x))]}),[1,0]):'')
          +(r.invalidos.length?TAB(['Linha','Inválido (data aaaa-mm-dd, CPF com 11 dígitos, valor maior que zero)'],r.invalidos.map(function(x){return [x.linha,ESC(M(x))]}),[1,0]):'')
          +AVISOS(['A importação do Carnê-Leão da Receita soma os valores e não sobrescreve (levantamento r10c): conferir antes de importar. A chave é data + CPF + valor.'])}},
    plr:{nome:'PLR: participação nos lucros ou resultados (IRRF na fonte)',campos:[
      ['u-p','Pagamentos do ano (valor;data aaaa-mm-dd, um por linha)','9.000,00;2026-03-31\n3.000,00;2026-12-20','a']],
      calc:function(){var N=function(x){x=String(x||'0').trim().replace(/\./g,'').replace(',','.');return isNaN(+x)?0:+x};
        var pg=TXT('u-p').split(/\n/).map(function(l){return l.trim()}).filter(Boolean).map(function(l){var c=l.split(';');return {valor:N(c[0]),data:(c[1]||'').trim()}});
        var r=F().calculaPLR(pg);if(!r.ok)return ERROS(r.erros);
        return TAB(['Data','Valor','Acumulado no ano','IRRF desta parcela','Líquido'],r.linhas.map(function(l){return [DT(l.data)+(l.excedente?' (excedente)':''),BR(l.valor),BR(l.acumulado),BR(l.irEstaParcela),BR(l.liquido)]}),[0,1,1,1,1])
          +'<p>Total pago <b>'+BR(r.total)+'</b> · IRRF <b>'+BR(r.irTotal)+'</b> · líquido <b>'+BR(r.liquidoTotal)+'</b></p>'+AVISOS(r.alertas)+AVISOS([r.eSocial,r.aviso])}},
    pag:{nome:'Data de pagamento da folha',campos:[
      ['g-c','Competência','2026-10','m'],['g-r','Regra','quinto_dia_util','s',[['quinto_dia_util','5º dia útil do mês seguinte'],['ultimo_dia_util','Último dia útil do mês'],['dia_fixo','Dia fixo']]],['g-d','Dia fixo','5','n'],['g-sab','Sábado conta como dia útil','1','c'],['g-ant','Antecipar se cair em dia sem expediente','1','c'],
      ['g-f','Feriados (aaaa-mm-dd, um por linha: nacionais e do município)','2026-11-02\n2026-11-15','a']],
      calc:function(){var fer=TXT('g-f').split(/\s+/).filter(function(x){return /^\d{4}-\d{2}-\d{2}$/.test(x)});
        var r=F().dataDePagamento(TXT('g-c'),{pagamentoRegra:TXT('g-r'),diaFixoPagamento:NUM('g-d'),sabadoDiaUtil:CHK('g-sab'),antecipaNaoUtil:CHK('g-ant')},fer);
        if(!r.ok)return ERROS(r.erros);return '<p>Pagar até <span class="big">'+DT(r.data)+'</span></p>'+(r.limiteLegal?'<p class="sub">Prazo legal: '+DT(r.limiteLegal)+'.</p>':'')+AVISOS(r.alertas)}},
    ficha:{nome:'Ficha financeira e informe do empregado',campos:[
      ['h-s','Salário (R$)','3.000','n'],['h-ano','Ano','2026','n'],['h-m','Meses trabalhados','12','n'],['h-he','Horas extras por mês','5','n'],['h-d13','Incluir 13º','1','c'],['h-fer','Mês das férias (1 a 12, 0 = nenhum)','7','n']],
      calc:function(){var X=F(),ano=NUM('h-ano')||2026,n=Math.max(1,Math.min(12,Math.floor(NUM('h-m')))),it=[],S=NUM('h-s'),pad=function(i){return ano+'-'+(i<10?'0':'')+i};
        for(var i=1;i<=n;i++){var r=X.calculaFolha({salario:S},{heNormais:NUM('h-he')},ano);if(!r.ok)return ERROS(r.erros);it.push({comp:pad(i),tipo:'mensal',r:r})}
        var mf=Math.floor(NUM('h-fer'));if(mf>=1&&mf<=12){var fe=X.calculaFerias({salario:S},{diasGozo:30},ano);if(fe.ok)it.push({comp:pad(mf),tipo:'ferias',r:fe})}
        if(CHK('h-d13')){var d=X.calculaDecimoTerceiro({salario:S},{avos:n},ano);if(d.ok)it.push({comp:pad(12),tipo:'13o',r:d})}
        var f=X.fichaFinanceira(it),inf=X.informeRendimentos(it,ano);if(!f.ok)return ERROS(f.erros);
        return TAB(['Mês','Proventos','Descontos','INSS','IRRF','Líquido','FGTS'],f.meses.map(function(m){return [m.comp,BR(m.proventos),BR(m.descontos),BR(m.inss),BR(m.irrf),BR(m.liquido),BR(m.fgts)]}).concat([['<b>Total</b>','<b>'+BR(f.totais.proventos)+'</b>','<b>'+BR(f.totais.descontos)+'</b>','<b>'+BR(f.totais.inss)+'</b>','<b>'+BR(f.totais.irrf)+'</b>','<b>'+BR(f.totais.liquido)+'</b>','<b>'+BR(f.totais.fgts)+'</b>']]),[0,1,1,1,1,1,1])
          +'<h3>Informe de rendimentos '+ano+' (resumo)</h3>'+TAB(null,[['Rendimentos tributáveis',BR(inf.rendimentosTributaveis)],['Previdência oficial',BR(inf.previdenciaOficial)],['IRRF',BR(inf.irrf)],['13º salário (exclusivo na fonte)',BR(inf.decimoTerceiro)],['IRRF sobre o 13º',BR(inf.irrf13)],['Pensão alimentícia paga',BR(inf.pensaoAlimenticia)]])+AVISOS(inf.alertas)}}
  };

  function campo(c){var id=c[0],t=c[3],h;
    if(t==='s')h='<select id="'+id+'">'+(c[4]||[]).map(function(o){return '<option value="'+ESC(o[0])+'"'+(String(o[0])===String(c[2])?' selected':'')+'>'+ESC(o[1])+'</option>'}).join('')+'</select>';
    else if(t==='c')return '<label class="chk"><input type="checkbox" id="'+id+'"'+(c[2]?' checked':'')+'> '+ESC(c[1])+'</label>';
    else if(t==='a')h='<textarea id="'+id+'" rows="6">'+ESC(c[2])+'</textarea>';
    else h='<input id="'+id+'" value="'+ESC(c[2])+'"'+(t==='d'?' type="date"':t==='m'?' type="month"':t==='n'?' inputmode="decimal"':'')+'>';
    return '<label>'+ESC(c[1])+h+'</label>'}

  // ===== Parâmetros da empresa (vigência)
  var CFG={vigencias:[]};
  function carrega(){try{var s=localStorage.getItem('vx-param');if(s){var o=JSON.parse(s);if(o&&Array.isArray(o.vigencias))CFG=o}}catch(e){}}
  function guarda(){try{localStorage.setItem('vx-param',JSON.stringify(CFG))}catch(e){}}
  function telaParam(){
    var X=F(),cat=CATALOGO_PARAMETROS,chaves=Object.keys(cat); // const global de folha-extras.js: não é propriedade de window, mas é visível por nome
    var h='<p class="sub">Cada mudança entra como uma <b>nova vigência</b>: o que valia antes continua no histórico. Rascunho guardado só neste aparelho; a gravação por empresa vem depois da validação do Daniel.</p>'
     +'<div class="grid"><label>Parâmetro<select id="pa-k">'+chaves.map(function(k){return '<option value="'+k+'">'+ESC(cat[k].titulo)+'</option>'}).join('')+'</select></label>'
     +'<label>Novo valor<input id="pa-v" inputmode="decimal"></label><label>Vale a partir de<input id="pa-d" type="date" value="2027-01-01"></label><label>Motivo (obrigatório)<input id="pa-m" placeholder="ex.: nova convenção coletiva"></label></div>'
     +'<p id="pa-ex" class="sub"></p><p><button class="p" id="pa-add" type="button">Registrar nova vigência</button></p><div id="pa-msg"></div>'
     +'<label style="max-width:240px">Ver o que valia em<input id="pa-q" type="date" value="2026-12-01"></label><div id="pa-tab"></div><h3>Histórico</h3><div id="pa-his"></div>';
    Q('vx-out').innerHTML=h;
    function explica(){var c=cat[Q('pa-k').value];Q('pa-ex').innerHTML=ESC(c.explicacao)+' <b>Base:</b> '+ESC(c.base)+(c.conferir?' <span class="tag at">CONFERIR COM O CONTADOR</span>':'')+(c.opcoes?' <b>Opções:</b> '+ESC(c.opcoes.join(', ')):'');if(!Q('pa-v').value)Q('pa-v').placeholder=String(c.padrao)}
    function mostra(){var p=X.parametrosEm(CFG,Q('pa-q').value||'2026-12-01');
      Q('pa-tab').innerHTML=TAB(['Parâmetro','Valor na data','Explicação','Base legal'],chaves.map(function(k){var c=cat[k],v=p[k];return [ESC(c.titulo)+(c.conferir?' <span class="tag at">conferir</span>':''),'<b>'+ESC(typeof v==='number'&&v<1&&v>0&&k!=='fgtsAprendiz'?(v*100).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%':v===true?'sim':v===false?'não':String(v))+'</b>',ESC(c.explicacao),ESC(c.base)]}));
      Q('pa-his').innerHTML=CFG.vigencias.length?TAB(['Desde','Motivo','O que mudou'],CFG.vigencias.map(function(v){return [DT(v.desde),ESC(v.motivo),ESC(Object.keys(v.valores).map(function(k){return cat[k].titulo+' = '+v.valores[k]}).join('; '))]})):'<p class="sub">Nenhuma mudança registrada: valem os padrões.</p>'}
    Q('pa-k').onchange=explica;Q('pa-q').oninput=mostra;
    Q('pa-add').onclick=function(){var k=Q('pa-k').value,c=cat[k],raw=TXT('pa-v'),v;
      if(c.opcoes){v=c.opcoes.filter(function(o){return String(o)===raw})[0];if(v===undefined)v=raw}else{v=+raw.replace(',','.');if(raw===''||isNaN(v)){Q('pa-msg').innerHTML=ERROS(['Informe o novo valor.']);return}
        if(typeof c.padrao==='number'&&c.max<=1&&v>1)v=v/100}
      var o={};o[k]=v;var r=X.novaVigencia(CFG,TXT('pa-d'),o,TXT('pa-m'));
      if(!r.ok){Q('pa-msg').innerHTML=ERROS(r.erros);return}CFG={vigencias:r.vigencias};guarda();Q('pa-msg').innerHTML='<div class="alerta">Vigência registrada.</div>';Q('pa-v').value='';mostra()};
    explica();mostra();
    // 27/11: com a empresa conectada, o histórico vem do banco (pj_parametro_vigencia, supabase/069) e cada vigência nova é GRAVADA lá; sem conexão, segue só neste aparelho.
    var CTX=window.__bdCtx;if(CTX&&CTX.DB&&CTX.EMP){
      Q('pa-msg').innerHTML='<div class="alerta">Empresa conectada: as vigências são gravadas no banco e não mudam depois de gravadas.</div>';
      CTX.DB.parametrosVigencia(CTX.EMP).then(function(rows){var g={};rows.forEach(function(r){var k=String(r.desde).slice(0,10)+'|'+r.motivo;(g[k]=g[k]||{desde:String(r.desde).slice(0,10),motivo:r.motivo,valores:{}}).valores[r.chave]=r.valor});
        CFG={vigencias:Object.keys(g).map(function(k){return g[k]}).sort(function(x,y){return x.desde<y.desde?-1:x.desde>y.desde?1:0})};mostra()}).catch(function(e){Q('pa-msg').innerHTML=ERROS([window.traduzErroPj?window.traduzErroPj(e,'ler'):'Não consegui ler os parâmetros.'])});
      var add0=Q('pa-add').onclick;Q('pa-add').onclick=function(){var antes=CFG.vigencias.length;add0();if(CFG.vigencias.length<=antes)return;var n=CFG.vigencias[CFG.vigencias.length-1];
        Promise.all(Object.keys(n.valores).map(function(k){return CTX.DB.gravarParametro(CTX.EMP,k,n.valores[k],n.desde,n.motivo)})).then(function(){Q('pa-msg').innerHTML='<div class="alerta">Vigência gravada no banco.</div>'}).catch(function(e){CFG={vigencias:CFG.vigencias.slice(0,antes)};mostra();Q('pa-msg').innerHTML=ERROS([window.traduzErroPj?window.traduzErroPj(e):'Não consegui gravar.'])})}}}

  function monta(){
    var sel=Q('vx-tipo');if(!sel)return;
    function troca(){var t=sel.value;
      if(t==='param'){Q('vx-form').innerHTML='';telaParam();return}
      var T=TELAS[t];Q('vx-form').innerHTML=T.campos.map(campo).join('');
      Array.prototype.forEach.call(Q('vx-form').querySelectorAll('input,select,textarea'),function(e){e.oninput=saida;e.onchange=saida});saida()}
    function saida(){var t=sel.value;if(t==='param')return;var T=TELAS[t],h;try{h=T.calc()}catch(e){h=ERROS(['Não foi possível calcular: '+(e&&e.message||e)])}Q('vx-out').innerHTML=h}
    var TODAS=Object.keys(TELAS).map(function(k){return [k,TELAS[k].nome]}).concat([['param','Parâmetros da empresa (vigência)']]);
    var sem=function(x){return String(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')};
    function opcoes(filtro,atual){var q=sem(filtro).split(/\s+/).filter(Boolean),L=TODAS.filter(function(p){var t=sem(p[1]+' '+p[0]);return q.every(function(w){return t.indexOf(w)>=0})});
      sel.innerHTML=L.map(function(p){return '<option value="'+p[0]+'">'+ESC(p[1])+'</option>'}).join('')||'<option value="">Nenhuma tela com essa palavra</option>';
      if(atual&&L.some(function(p){return p[0]===atual}))sel.value=atual;return L.length}
    // 27/11: busca por palavra no seletor de telas (são mais de 30): digite "férias", "esocial", "recibo"...
    var busca=Q('vx-busca');if(!busca){var lb=document.createElement('label');lb.style.maxWidth='420px';lb.innerHTML='Buscar tela por palavra <input id="vx-busca" type="search" placeholder="ex.: férias, esocial, recibo" autocomplete="off">';sel.parentNode.parentNode.insertBefore(lb,sel.parentNode);busca=Q('vx-busca')}
    busca.oninput=function(){var antes=sel.value,n=opcoes(busca.value,antes);Q('vx-contagem')&&(Q('vx-contagem').textContent=n+' de '+TODAS.length+' telas');if(n&&sel.value!==antes)troca()};
    var ct=document.createElement('p');ct.id='vx-contagem';ct.className='sub';ct.textContent=TODAS.length+' de '+TODAS.length+' telas';sel.parentNode.parentNode.insertBefore(ct,sel.parentNode.nextSibling);
    opcoes('');
    Q('vx-out').addEventListener('click',function(e){var k=e.target&&e.target.getAttribute&&e.target.getAttribute('data-abre');if(!k)return;var b=Q('vx-busca');if(b&&b.value){b.value='';opcoes('')}sel.value=k;troca();sel.scrollIntoView({block:'center'})});
    sel.onchange=troca;carrega();troca()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',monta);else monta();
})();
