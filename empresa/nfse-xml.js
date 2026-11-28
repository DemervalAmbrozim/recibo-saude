// Leitura do XML da NFS-e Nacional (28/11/2026). Leiaute oficial: Anexo I SEFIN/ADN DPS e NFS-e, v1.01 de 09/02/2026 (portal gov.br/nfse, documentação atual), aba "LEIAUTE DPS_NFS-e".
// Caminhos lidos: NFSe/infNFSe (Id, nNFSe, cStat, dhProc, IBSCBS/totCIBS) e NFSe/infNFSe/DPS/infDPS (serie, nDPS, dhEmi, dCompet, cLocEmi, prest/regTrib/opSimpNac, toma/CNPJ|CPF,
// serv/cServ/cTribNac, valores/vServPrest/vServ, valores/trib/tribMun/tpRetISSQN e pAliq).
// SEGURANÇA: o XML vem de fora. O leitor recusa DOCTYPE e ENTITY, não executa nada e não acessa a rede. Só os campos acima são usados; o nome do tomador NÃO é lido (LGPD).
// O anexo do Simples (III ou V pelo Fator R) NÃO vem no XML: quem importa informa. Cancelamento não vem na NFS-e: é um evento à parte [CONFERIR COM O CONTADOR].
(function(g){
  'use strict';
  function parse(xml){
    var s=String(xml==null?'':xml);
    if(s.length>2000000)return {erro:'arquivo grande demais'};
    if(/<!DOCTYPE|<!ENTITY/i.test(s))return {erro:'XML recusado: contém DOCTYPE ou ENTITY'};
    s=s.replace(/^\uFEFF/,'').replace(/<\?xml[^>]*\?>/i,'').replace(/<!--[\s\S]*?-->/g,'');
    var raiz={nome:'#raiz',filhos:[],texto:''},pilha=[raiz],re=/<(\/)?([A-Za-z_][\w.\-:]*)([^>]*?)(\/)?>|([^<]+)/g,m;
    while((m=re.exec(s))){
      if(m[5]!==undefined){pilha[pilha.length-1].texto+=m[5];continue}
      var nome=m[2].replace(/^.*:/,'');
      if(m[1]){if(pilha.length<2||pilha[pilha.length-1].nome!==nome)return {erro:'XML mal formado perto de </'+nome+'>'};pilha.pop();continue}
      var no={nome:nome,filhos:[],texto:'',atr:{}},ar=/([\w:\-]+)\s*=\s*("([^"]*)"|'([^']*)')/g,a;
      while((a=ar.exec(m[3]||'')))no.atr[a[1].replace(/^.*:/,'')]=a[3]!==undefined?a[3]:a[4];
      pilha[pilha.length-1].filhos.push(no);
      if(!m[4])pilha.push(no);
      if(pilha.length>60)return {erro:'XML fundo demais'};
    }
    if(pilha.length!==1)return {erro:'XML mal formado: tag sem fechamento'};
    return {raiz:raiz.filhos[0]||null};
  }
  function f(no,caminho){var p=String(caminho).split('/'),x=no;for(var i=0;i<p.length&&x;i++){x=x.filhos.filter(function(c){return c.nome===p[i]})[0]}return x||null}
  function t(no,caminho){var x=f(no,caminho);return x?x.texto.trim():''}
  var num=function(v){var n=+v;return v===''||isNaN(n)?null:n};
  var r2=function(n){return Math.round(n*100)/100};
  function lerNFSe(xml){
    var p=parse(xml);if(p.erro)return {ok:false,erros:[p.erro]};
    var nf=p.raiz;if(!nf||nf.nome!=='NFSe')return {ok:false,erros:['não é uma NFS-e (raiz NFSe não encontrada)']};
    var inf=f(nf,'infNFSe');if(!inf)return {ok:false,erros:['infNFSe ausente']};
    var d=f(inf,'DPS/infDPS');if(!d)return {ok:false,erros:['DPS/infDPS ausente']};
    var erros=[],alertas=[];
    var id=(inf.atr&&(inf.atr.Id||inf.atr.id))||'',chave=id.replace(/^\D+/,'');
    var serie=t(d,'serie'),nNFSe=t(inf,'nNFSe'),vServ=num(t(d,'valores/vServPrest/vServ')),emi=t(d,'dhEmi').slice(0,10),comp=t(d,'dCompet').slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(emi))erros.push('data de emissão (dhEmi) ilegível');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(comp))erros.push('data de competência (dCompet) ilegível');
    if(!(vServ>0))erros.push('valor do serviço (vServ) ilegível');
    if(!nNFSe)erros.push('número da NFS-e (nNFSe) ausente');
    if(!/^\d{44,50}$/.test(chave))alertas.push('identificador da NFS-e fora do padrão de 50 dígitos: a nota entra sem chave de acesso');
    var cnpjT=t(d,'toma/CNPJ'),cpfT=t(d,'toma/CPF');
    var op=t(d,'prest/regTrib/opSimpNac'),ret=t(d,'valores/trib/tribMun/tpRetISSQN'),cstat=t(inf,'cStat');
    if(op==='1')alertas.push('o prestador consta como NÃO optante pelo Simples Nacional nesta nota');
    if(cstat&&['100','102','103','107'].indexOf(cstat)<0)alertas.push('situação da NFS-e '+cstat+': confira se a nota vale');
    if(erros.length)return {ok:false,erros:erros};
    var nota={tipo_operacao:'servico',incide_simples:op!=='1',serie:serie||'1',numero:nNFSe.replace(/^0+(?=\d)/,''),chave_acesso:/^\d{44,50}$/.test(chave)?chave:null,data_emissao:emi,data_competencia:comp,valor_total:r2(vServ),
      tomador_tipo:cnpjT?'pj':'pf',tomador_cnpj:/^\d{14}$/.test(cnpjT)?cnpjT:null,municipio_ibge:/^\d{7}$/.test(t(d,'cLocEmi'))?t(d,'cLocEmi'):null};
    void cpfT;
    return {ok:true,nota:nota,issRetido:ret==='2'||ret==='3',aliquotaISS:num(t(d,'valores/trib/tribMun/pAliq')),codigoServico:t(d,'serv/cServ/cTribNac'),
      ibs:num(t(inf,'IBSCBS/totCIBS/gIBS/vIBSTot')),cbs:num(t(inf,'IBSCBS/totCIBS/gCBS/vCBS')),situacao:cstat||null,alertas:alertas};
  }
  // monta os argumentos de pj_registrar_nota: o anexo e o Fator R são decisão do contador, não vêm no XML
  function paraRegistro(lida,opcoes){
    if(!lida||!lida.ok)return {ok:false,erros:['nota ilegível']};
    var o=opcoes||{};if(['I','II','III','IV','V'].indexOf(o.anexo)<0)return {ok:false,erros:['informe o anexo do Simples desta nota (III ou V para saúde, conforme o Fator R)']};
    return {ok:true,nota:lida.nota,itens:[{anexo:o.anexo,sujeito_fator_r:!!o.sujeitoFatorR,iss_retido:!!lida.issRetido,iss_fixo:!!o.issFixo,valor:lida.nota.valor_total}]};
  }
  var api={lerNFSe:lerNFSe,paraRegistro:paraRegistro,parse:parse};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else g.NfseXml=api;
})(typeof window!=='undefined'?window:globalThis);
