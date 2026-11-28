// Prévia do evento S-2230 (afastamento temporário) conforme o LEIAUTE S-1.3 (NT 07/2026), lido em 27/11/2026 em gov.br/esocial/.../leiautes-esocial-versao-s-1-3-nt-07-2026.
// Só MONTA e CONFERE os campos: o XML sai SEM assinatura e NÃO é enviado. Assinar com certificado digital e transmitir é do contador/procuração. A Tabela 18 (códigos de motivo) não foi lida: o código é aceito
// como 2 dígitos e só as regras que o leiaute escreve com o número do código são validadas (01, 03, 14, 15, 18, 21, 22, 24). [CONFERIR COM O CONTADOR] o código e a compatibilidade com a categoria.
(function(){
  const MOT=(typeof window!=='undefined'&&window.motivoAfastamento)||(typeof require!=='undefined'?(()=>{try{return require('./esocial-tabela18.js').motivoAfastamento}catch(e){return null}})():null);
  const dig=s=>String(s==null?'':s).replace(/\D/g,'');
  const parse=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const [a,m,d]=s.split('-').map(Number),x=new Date(Date.UTC(a,m-1,d));return(x.getUTCFullYear()===a&&x.getUTCMonth()===m-1&&x.getUTCDate()===d)?x:null};
  const dias=(a,b)=>Math.round((parse(b)-parse(a))/86400000);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const tag=(n,v)=>'<'+n+'>'+esc(v)+'</'+n+'>';
  // d: {tpAmb:1|2, empregador:{tpInsc:1|2, nrInsc}, cpfTrab, matricula?, codCateg?, hoje:'aaaa-mm-dd',
  //     inicio?:{dtIniAfast, codMotAfast, infoMesmoMtv?, tpAcidTransito?, observacao?, perAquis?:{dtInicio,dtFim?}, existeAfastamentoAnterior60d?:bool}, fim?:{dtTermAfast}, retif?:{nrRecibo}}
  function montaS2230(d={}){
    const erros=[],ini=d.inicio,fim=d.fim;
    if(![1,2].includes(+d.tpAmb))erros.push('tpAmb: 1 (produção) ou 2 (produção restrita)');
    const e=d.empregador||{};if(![1,2].includes(+e.tpInsc))erros.push('empregador: tpInsc 1 (CNPJ) ou 2 (CPF)');
    const ni=dig(e.nrInsc);if(!(+e.tpInsc===1?(ni.length===8||ni.length===14):ni.length===11))erros.push('empregador: nrInsc inválido para o tipo de inscrição');
    if(dig(d.cpfTrab).length!==11)erros.push('cpfTrab deve ter 11 dígitos');
    if(!parse(d.hoje))erros.push('informe a data de hoje (aaaa-mm-dd) para conferir a data do afastamento');
    const mat=d.matricula?String(d.matricula):'';
    if(mat&&(mat.length<1||mat.length>30))erros.push('matricula: de 1 a 30 caracteres');
    if(!mat&&!/^\d{3}$/.test(String(d.codCateg||'')))erros.push('sem matrícula, informe codCateg (3 dígitos); matrícula e codCateg são exclusivos (leiaute)');
    if(mat&&d.codCateg)erros.push('codCateg só deve ser informado quando NÃO há matrícula');
    if(!ini&&!fim)erros.push('informe o início (iniAfastamento) ou o término (fimAfastamento)');
    if(ini&&fim)erros.push('um evento tem início OU término; envie dois eventos (o leiaute marca o outro grupo como obrigatório só na ausência de um deles)');
    if(erros.length)return{ok:false,erros};
    const x={ideEvento:{indRetif:d.retif&&d.retif.nrRecibo?2:1,tpAmb:+d.tpAmb,procEmi:1,verProc:'lado-a-lado-previa'},ideEmpregador:{tpInsc:+e.tpInsc,nrInsc:ni},ideVinculo:{cpfTrab:dig(d.cpfTrab)}};
    if(mat)x.ideVinculo.matricula=mat;else x.ideVinculo.codCateg=String(d.codCateg);
    if(d.retif&&d.retif.nrRecibo){if(String(d.retif.nrRecibo).length!==23)erros.push('nrRecibo da retificação deve ter 23 caracteres');x.ideEvento.nrRecibo=String(d.retif.nrRecibo)}
    const alertas=['Prévia SEM assinatura e SEM envio. Assinar com certificado digital e transmitir é do contador (procuração).'];
    if(ini){
      const cod=String(ini.codMotAfast||'');if(!/^\d{2}$/.test(cod))erros.push('codMotAfast deve ter 2 dígitos (Tabela 18)');
      if(!parse(ini.dtIniAfast))erros.push('dtIniAfast inválida (aaaa-mm-dd)');
      if(!erros.length){
        const adiante=dias(d.hoje,ini.dtIniAfast),limite=cod==='15'?60:cod==='18'?120:0;
        if(adiante>limite)erros.push('dtIniAfast não pode ser posterior a hoje'+(limite?' por mais de '+limite+' dias (código '+cod+')':'')+' (leiaute)');
        if(cod==='21'&&!(ini.observacao&&String(ini.observacao).trim()))erros.push('observacao é obrigatória quando codMotAfast = 21');
        if(ini.observacao&&String(ini.observacao).length>255)erros.push('observacao: no máximo 255 caracteres');
        if(ini.tpAcidTransito!=null&&ini.tpAcidTransito!==''){if(!['01','03'].includes(cod))erros.push('tpAcidTransito só vale para codMotAfast 01 ou 03');else if(![1,2,3].includes(+ini.tpAcidTransito))erros.push('tpAcidTransito: 1 atropelamento, 2 colisão, 3 outros')}
        if(ini.infoMesmoMtv!=null&&ini.infoMesmoMtv!==''){if(!['01','03'].includes(cod))erros.push('infoMesmoMtv só vale para codMotAfast 01 ou 03');else if(!['S','N','I'].includes(ini.infoMesmoMtv))erros.push('infoMesmoMtv: S, N ou I');else if(cod==='01'&&ini.infoMesmoMtv==='I')erros.push('para codMotAfast 01, infoMesmoMtv só aceita S ou N')}
        if((cod==='01'||cod==='03')&&ini.dtIniAfast>='2026-10-26'&&ini.existeAfastamentoAnterior60d&&!ini.infoMesmoMtv)erros.push('desde 26/10/2026, com outro afastamento anterior em até 60 dias pelo mesmo motivo, infoMesmoMtv é obrigatório (leiaute)');
        if(MOT){const mv=MOT(cod);if(!mv.conhecido)alertas.push(mv.aviso);else{alertas.push('Motivo '+mv.cod+': '+mv.descricao+'. '+mv.rotulo+(mv.nota?' ('+mv.nota+')':'')+'. [CONFERIR COM O CONTADOR] a categoria do trabalhador.');if(mv.obrigatoriedade==='nao_enviar')alertas.push('ATENÇÃO: este motivo não deve ser enviado por empresa privada com empregado CLT (MOS S-2230, item 2.1).')}}
        if(cod==='15'&&!ini.perAquis)alertas.push('Férias (15): o período aquisitivo (perAquis) é obrigatório para empregado CLT com início a partir de 19/07/2021 (leiaute). Informe dtInicio. [CONFERIR COM O CONTADOR] a categoria.');
        if(ini.perAquis){if(!parse(ini.perAquis.dtInicio))erros.push('perAquis.dtInicio inválida');if(ini.perAquis.dtFim&&(!parse(ini.perAquis.dtFim)||ini.perAquis.dtFim<=ini.perAquis.dtInicio))erros.push('perAquis.dtFim deve ser posterior ao início (e só se o período não for de 1 ano)')}
        if(['14','22','24'].includes(cod))erros.push('código '+cod+' (cessão, mandato eletivo ou sindical) exige grupo complementar que esta prévia não monta');
      }
      if(erros.length)return{ok:false,erros};
      x.infoAfastamento={iniAfastamento:{dtIniAfast:ini.dtIniAfast,codMotAfast:cod}};const I=x.infoAfastamento.iniAfastamento;
      if(ini.infoMesmoMtv)I.infoMesmoMtv=ini.infoMesmoMtv;if(ini.tpAcidTransito)I.tpAcidTransito=+ini.tpAcidTransito;if(ini.observacao)I.observacao=String(ini.observacao).trim();if(ini.perAquis)I.perAquis=ini.perAquis;
    }else{
      if(!parse(fim.dtTermAfast))erros.push('dtTermAfast inválida (aaaa-mm-dd)');
      if(erros.length)return{ok:false,erros};
      x.infoAfastamento={fimAfastamento:{dtTermAfast:fim.dtTermAfast}};
    }
    if(erros.length)return{ok:false,erros};
    const xml='<eSocial><evtAfastTemp>'+'<ideEvento>'+Object.entries(x.ideEvento).map(([k,v])=>tag(k,v)).join('')+'</ideEvento>'
      +'<ideEmpregador>'+tag('tpInsc',x.ideEmpregador.tpInsc)+tag('nrInsc',x.ideEmpregador.nrInsc)+'</ideEmpregador>'
      +'<ideVinculo>'+Object.entries(x.ideVinculo).map(([k,v])=>tag(k,v)).join('')+'</ideVinculo>'
      +'<infoAfastamento>'+(x.infoAfastamento.iniAfastamento?'<iniAfastamento>'+Object.entries(x.infoAfastamento.iniAfastamento).map(([k,v])=>k==='perAquis'?'<perAquis>'+Object.entries(v).map(([a,b])=>tag(a,b)).join('')+'</perAquis>':tag(k,v)).join('')+'</iniAfastamento>':'<fimAfastamento>'+tag('dtTermAfast',x.infoAfastamento.fimAfastamento.dtTermAfast)+'</fimAfastamento>')+'</infoAfastamento></evtAfastTemp></eSocial>';
    return{ok:true,evento:x,xml,alertas,aviso:'Prévia do evento, sem assinatura e sem envio.'};
  }
  if(typeof module!=='undefined')module.exports={montaS2230};
  if(typeof window!=='undefined')window.montaS2230=montaS2230;
})();
