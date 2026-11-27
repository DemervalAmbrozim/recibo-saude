// Prévia do evento S-1200 (remuneração do trabalhador no RGPS) de empregado CLT, conforme o LEIAUTE S-1.3 (NT 07/2026) lido em 27/11/2026.
// Só MONTA e CONFERE: o XML sai SEM assinatura e NÃO é enviado. Cobre o caso mensal ou 13º do empregado com vínculo e do autônomo em geral (categoria 701, sem S-2300), no grupo infoPerApur. NÃO cobre: períodos anteriores (infoPerAnt),
// RRA, múltiplos vínculos, sucessão, processo judicial, desconto de empréstimo (descFolha) e trabalhador intermitente (infoInterm, obrigatório para categoria 111). Quem usar esses casos precisa do contador.
// O código de cada rubrica (codRubr) e o ideTabRubr têm de existir na tabela S-1010 da empresa: este arquivo não cria a tabela. [CONFERIR COM O DANIEL]
(function(){
  const dig=s=>String(s==null?'':s).replace(/\D/g,'');
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tag=(n,v)=>'<'+n+'>'+esc(v)+'</'+n+'>';
  const dataOk=x=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(x||'')))return false;const [a,m,d]=String(x).split('-').map(Number),u=new Date(Date.UTC(a,m-1,d));return u.getUTCFullYear()===a&&u.getUTCMonth()===m-1&&u.getUTCDate()===d};
  const dec=(v,casas)=>(Math.round((+v+Number.EPSILON)*100)/100).toFixed(casas);
  // r: resultado de calculaFolha (proventos e descontos com cod/desc/valor). Devolve as rubricas na forma do evento e a lista de códigos que precisam estar no S-1010.
  function rubricasDaFolha(r,o={}){
    if(!r||!r.ok)return{ok:false,erros:['informe uma folha calculada']};
    const tab=String(o.ideTabRubr||'1'),it=[];
    [...(r.proventos||[]),...(r.descontos||[])].forEach(x=>{if(+x.valor>0)it.push({codRubr:String(x.cod),ideTabRubr:tab,vrRubr:+x.valor,indApurIR:0,descricao:x.desc})});
    return{ok:true,rubricas:it,codigosNoS1010:it.map(x=>x.codRubr+' - '+x.descricao)};
  }
  // d: {tpAmb, empregador:{tpInsc,nrInsc}, cpfTrab, matricula, codCateg:'101', indApuracao:1|2, perApur:'aaaa-mm'|'aaaa', ideDmDev, estab:{tpInsc:1|4, nrInsc, codLotacao},
  //     indSimples?:1|2|3, grauExp:1..4, rubricas:[{codRubr,ideTabRubr,qtdRubr?,fatorRubr?,vrRubr,indApurIR:0|1}], retif?:{nrRecibo}}
  function montaS1200(d={}){
    const erros=[],e=d.empregador||{},es=d.estab||{},R=d.rubricas;
    if(![1,2].includes(+d.tpAmb))erros.push('tpAmb: 1 (produção) ou 2 (produção restrita)');
    if(![1,2].includes(+e.tpInsc))erros.push('empregador: tpInsc 1 (CNPJ) ou 2 (CPF)');
    const ni=dig(e.nrInsc);if(!(+e.tpInsc===1?(ni.length===8||ni.length===14):ni.length===11))erros.push('empregador: nrInsc inválido para o tipo de inscrição');
    if(dig(d.cpfTrab).length!==11)erros.push('cpfTrab deve ter 11 dígitos');
    const aut=d.autonomo===true,mat=String(d.matricula||'');
    if(aut){if(String(d.codCateg||'')!=='701')erros.push('autônomo em geral é a categoria 701 (outras categorias de contribuinte individual não são montadas aqui)');
      const nm=String(d.nmTrab||'').trim();if(nm.length<2||nm.length>70)erros.push('nmTrab: nome do trabalhador, de 2 a 70 caracteres (sem S-2300, o nome vai no S-1200)');
      const dn=String(d.dtNascto||'');if(!dataOk(dn)||dn<'1890-01-01'||(/^\d{4}-\d{2}-\d{2}$/.test(String(d.hoje||''))&&dn>d.hoje))erros.push('dtNascto: data de nascimento (aaaa-mm-dd), entre 01/01/1890 e hoje (informe "hoje")');
      if(!/^\d{6}$/.test(String(d.codCBO||'')))erros.push('codCBO: 6 dígitos (a ocupação do autônomo)');
      if(mat)erros.push('autônomo sem S-2300 não tem matrícula: deixe em branco')}
    else{if(!mat||mat.length>30)erros.push('matricula: de 1 a 30 caracteres (a mesma do S-2200)');
      if(!/^[1]\d{2}$/.test(String(d.codCateg||'')))erros.push('codCateg deve ser de empregado (1XX, 3 dígitos); para autônomo use autonomo:true e categoria 701')}
    if(![1,2].includes(+d.indApuracao))erros.push('indApuracao: 1 (mensal) ou 2 (13º salário)');
    else if(+d.indApuracao===1&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(d.perApur||'')))erros.push('perApur mensal no formato aaaa-mm');
    else if(+d.indApuracao===2&&!/^\d{4}$/.test(String(d.perApur||'')))erros.push('perApur do 13º salário só com o ano (aaaa)');
    const id=String(d.ideDmDev||'');if(!id||id.length>30)erros.push('ideDmDev: de 1 a 30 caracteres, único dentro do perApur para cada demonstrativo do trabalhador');
    if(![1,4].includes(+es.tpInsc))erros.push('estabelecimento: tpInsc 1 (CNPJ) ou 4 (CNO)');
    const en=dig(es.nrInsc);if(!(en.length===14||(+es.tpInsc===4&&en.length===12)))erros.push('estabelecimento: nrInsc deve ter 14 dígitos (CNPJ) ou 12 (CNO)');
    const lot=String(es.codLotacao||'');if(!lot||lot.length>30)erros.push('codLotacao: de 1 a 30 caracteres (a lotação tributária da empresa)');
    if(d.indSimples!=null&&d.indSimples!==''&&![1,2,3].includes(+d.indSimples))erros.push('indSimples: 1, 2 ou 3');
    if(!aut&&![1,2,3,4].includes(+d.grauExp))erros.push('grauExp (grau de exposição a agentes nocivos) é obrigatório para empregado (1XX): 1 a 4; use 1 se não há exposição');
    if(!Array.isArray(R)||!R.length)erros.push('informe ao menos 1 rubrica');
    else{if(R.length>200)erros.push('no máximo 200 rubricas por trabalhador e lotação');
      R.forEach((x,i)=>{const p='rubrica '+(i+1)+': ';
        if(!x.codRubr||String(x.codRubr).length>30)erros.push(p+'codRubr de 1 a 30 caracteres');
        if(!x.ideTabRubr||String(x.ideTabRubr).length>8)erros.push(p+'ideTabRubr de 1 a 8 caracteres');
        if(!(+x.vrRubr>0))erros.push(p+'vrRubr deve ser maior que zero');else if(dec(x.vrRubr,2).replace('.','').length>14)erros.push(p+'vrRubr com mais de 14 posições');
        if(x.qtdRubr!=null&&x.qtdRubr!==''&&!(+x.qtdRubr>0))erros.push(p+'qtdRubr, se informada, deve ser maior que zero');
        if(x.fatorRubr!=null&&x.fatorRubr!==''&&!(+x.fatorRubr>0))erros.push(p+'fatorRubr, se informado, deve ser maior que zero');
        if(![0,1].includes(+x.indApurIR))erros.push(p+'indApurIR é obrigatório desde 2021-07: 0 (normal) ou 1 (situação especial)')})}
    if(d.retif&&d.retif.nrRecibo&&String(d.retif.nrRecibo).length!==23)erros.push('nrRecibo da retificação deve ter 23 caracteres');
    if(erros.length)return{ok:false,erros};
    const ev={ideEvento:{indRetif:d.retif&&d.retif.nrRecibo?2:1,...(d.retif&&d.retif.nrRecibo?{nrRecibo:String(d.retif.nrRecibo)}:{}),indApuracao:+d.indApuracao,perApur:String(d.perApur),tpAmb:+d.tpAmb,procEmi:1,verProc:'lado-a-lado-previa'},
      ideEmpregador:{tpInsc:+e.tpInsc,nrInsc:ni},ideTrabalhador:{cpfTrab:dig(d.cpfTrab),...(aut?{infoComplem:{nmTrab:String(d.nmTrab).trim(),dtNascto:String(d.dtNascto)}}:{})},
      dmDev:{ideDmDev:id,codCateg:String(d.codCateg),infoPerApur:{ideEstabLot:{tpInsc:+es.tpInsc,nrInsc:en,codLotacao:lot,remunPerApur:{...(aut?{}:{matricula:mat}),...(d.indSimples?{indSimples:+d.indSimples}:{}),
        itensRemun:R.map(x=>({codRubr:String(x.codRubr),ideTabRubr:String(x.ideTabRubr),...(x.qtdRubr?{qtdRubr:+x.qtdRubr}:{}),...(x.fatorRubr?{fatorRubr:+x.fatorRubr}:{}),vrRubr:+(+x.vrRubr).toFixed(2),indApurIR:+x.indApurIR})),
        ...(aut?{}:{infoAgNocivo:{grauExp:+d.grauExp}})}}},...(aut?{infoComplCont:{codCBO:String(d.codCBO)}}:{})}};
    const I=ev.dmDev.infoPerApur.ideEstabLot,Rm=I.remunPerApur;
    const xml='<eSocial><evtRemun><ideEvento>'+Object.entries(ev.ideEvento).map(([k,v])=>tag(k,v)).join('')+'</ideEvento>'
      +'<ideEmpregador>'+tag('tpInsc',ev.ideEmpregador.tpInsc)+tag('nrInsc',ev.ideEmpregador.nrInsc)+'</ideEmpregador><ideTrabalhador>'+tag('cpfTrab',ev.ideTrabalhador.cpfTrab)+(ev.ideTrabalhador.infoComplem?'<infoComplem>'+tag('nmTrab',ev.ideTrabalhador.infoComplem.nmTrab)+tag('dtNascto',ev.ideTrabalhador.infoComplem.dtNascto)+'</infoComplem>':'')+'</ideTrabalhador>'
      +'<dmDev>'+tag('ideDmDev',ev.dmDev.ideDmDev)+tag('codCateg',ev.dmDev.codCateg)+'<infoPerApur><ideEstabLot>'+tag('tpInsc',I.tpInsc)+tag('nrInsc',I.nrInsc)+tag('codLotacao',I.codLotacao)
      +'<remunPerApur>'+(Rm.matricula?tag('matricula',Rm.matricula):'')+(Rm.indSimples?tag('indSimples',Rm.indSimples):'')
      +Rm.itensRemun.map(x=>'<itensRemun>'+tag('codRubr',x.codRubr)+tag('ideTabRubr',x.ideTabRubr)+(x.qtdRubr?tag('qtdRubr',dec(x.qtdRubr,2)):'')+(x.fatorRubr?tag('fatorRubr',dec(x.fatorRubr,2)):'')+tag('vrRubr',dec(x.vrRubr,2))+tag('indApurIR',x.indApurIR)+'</itensRemun>').join('')
      +(Rm.infoAgNocivo?'<infoAgNocivo>'+tag('grauExp',Rm.infoAgNocivo.grauExp)+'</infoAgNocivo>':'')+'</remunPerApur></ideEstabLot></infoPerApur>'+(ev.dmDev.infoComplCont?'<infoComplCont>'+tag('codCBO',ev.dmDev.infoComplCont.codCBO)+'</infoComplCont>':'')+'</dmDev></evtRemun></eSocial>';
    const alertas=['Prévia SEM assinatura e SEM envio. Assinar com certificado digital e transmitir é do contador (procuração).','Os códigos de rubrica (codRubr/ideTabRubr) precisam existir na tabela S-1010 da empresa; sem isso o eSocial recusa. [CONFERIR COM O DANIEL]',
      'Esta prévia cobre só o empregado com vínculo, mensal ou 13º. Intermitente (categoria 111) exige o grupo infoInterm, que não é montado aqui.'];
    if(aut)alertas.push('Autônomo em geral (categoria 701): o S-2300 é facultativo; sem ele, o nome, a data de nascimento e o CBO vão neste S-1200 (infoComplem e infoComplCont). INSS e IRRF retidos entram como rubricas cadastradas na S-1010. [CONFERIR COM O DANIEL]');
    if(+d.indApuracao===1&&String(d.codCateg)==='111')alertas.push('Categoria 111 (intermitente): o grupo infoInterm é obrigatório e NÃO está nesta prévia.');
    const tot=R.reduce((s,x)=>s+ +x.vrRubr,0);alertas.push('Soma das rubricas informadas: '+dec(tot,2).replace('.',',')+' (proventos e descontos juntos: o tipo vem da S-1010; confira o líquido na folha).');
    return{ok:true,evento:ev,xml,alertas,aviso:'Prévia do evento, sem assinatura e sem envio.'};
  }
  const api={montaS1200,rubricasDaFolha};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')Object.assign(window,api);
})();
