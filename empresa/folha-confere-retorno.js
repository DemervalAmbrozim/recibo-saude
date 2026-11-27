// Folha: conferência do que CALCULAMOS contra o que o GOVERNO devolveu (27/11/2026; matriz da folha, linha 29: outros sistemas têm; nós não tínhamos).
// Carregar DEPOIS de folha.js. Só COMPARA números: não transmite, não paga, não decide quem está certo.
// Retorno do governo (digitado ou importado pelo contador): por empregado {id, inss, irrf, fgts}. Origem usual: retornos do eSocial por trabalhador
// (S-5001 contribuições, S-5002 IRRF, S-5003 FGTS) [CONFERIR COM O DANIEL o campo exato de cada leiaute antes de importar automático].
// Diferença só vira "possível causa" quando a conta fecha com dado NOSSO; o resto fica "a investigar". Nada de causa inventada.
(function(){
const r2cr=x=>Math.round((+x+Number.EPSILON)*100)/100;
const TRIB=[['inss','INSS do empregado'],['irrf','IRRF'],['fgts','FGTS']];
function confereRetornoGoverno(folhas,retorno,o={}){
  if(!Array.isArray(folhas)||!folhas.length)return{ok:false,erros:['informe a folha calculada (lista de {id,nome,inss,irrf,fgts})']};
  if(!Array.isArray(retorno)||!retorno.length)return{ok:false,erros:['informe o retorno do governo (lista de {id,inss,irrf,fgts})']};
  const tol=o.tolerancia>=0?+o.tolerancia:0.05,porId=new Map(),alertas=[];
  for(const f of folhas){if(!f||f.id==null)return{ok:false,erros:['toda folha precisa de id']};porId.set(String(f.id),{f,g:null})}
  for(const g of retorno){if(!g||g.id==null)return{ok:false,erros:['todo retorno precisa de id']};const k=String(g.id);const e=porId.get(k);if(e){if(e.g)return{ok:false,erros:['retorno repetido para o id '+k]};e.g=g}else porId.set(k,{f:null,g})}
  const linhas=[],tot={};for(const [t] of TRIB)tot[t]={nos:0,gov:0};
  for(const [id,{f,g}] of porId){
    const L={id,nome:f&&f.nome||(g&&g.nome)||id,status:'ok',difs:{}};
    if(!f){L.status='só no governo';alertas.push('Empregado '+id+' consta no retorno do governo e não na nossa folha: conferir se está no cadastro e na competência.');}
    else if(!g){L.status='sem retorno';alertas.push('Empregado '+f.nome+' está na nossa folha e não voltou do governo: o evento pode não ter sido aceito ou processado.');}
    for(const [t] of TRIB){
      const a=f?+f[t]||0:0,b=g?+g[t]||0:0;tot[t].nos+=a;tot[t].gov+=b;
      const d=r2cr(b-a);if(f&&g&&Math.abs(d)>tol){L.difs[t]={nos:r2cr(a),governo:r2cr(b),dif:d};L.status='diferente'}
    }
    linhas.push(L)}
  const resumo={},causas=[];
  for(const [t,rot] of TRIB){
    const nos=r2cr(tot[t].nos),gov=r2cr(tot[t].gov),dif=r2cr(gov-nos);
    resumo[t]={rotulo:rot,nos,governo:gov,dif,ok:Math.abs(dif)<=tol};
    if(Math.abs(dif)>tol){
      const ex=linhas.filter(l=>l.status==='só no governo'&&Math.abs((retorno.find(g=>String(g.id)===l.id)||{})[t]-dif)<=tol);
      const ne=linhas.filter(l=>l.status==='sem retorno'&&Math.abs((folhas.find(f=>String(f.id)===l.id)||{})[t]+dif)<=tol);
      if(ex.length===1)causas.push(rot+': a diferença de '+dif+' é exatamente o valor de '+ex[0].nome+', que só consta no governo.');
      else if(ne.length===1)causas.push(rot+': a diferença de '+dif+' é exatamente o valor de '+ne[0].nome+', que não voltou do governo.');
      else{const un=linhas.filter(l=>l.difs[t]);if(un.length===1&&Math.abs(un[0].difs[t].dif-dif)<=tol)causas.push(rot+': toda a diferença ('+dif+') está em '+un[0].nome+'; conferir base e rubricas dele.');else causas.push(rot+': diferença de '+dif+' a investigar (não fecha com um único empregado).')}
    }}
  const ok=Object.values(resumo).every(x=>x.ok)&&linhas.every(l=>l.status==='ok');
  return{ok:true,conferido:ok,tolerancia:tol,resumo,linhas,causas,alertas,
    aviso:'Comparação de números. Quem decide qual lado está certo é o contador, olhando a rubrica e o evento. Não retransmita nem pague guia antes de fechar a diferença.'}}
if(typeof window!=='undefined')window.confereRetornoGoverno=confereRetornoGoverno;
if(typeof module!=='undefined')module.exports={confereRetornoGoverno};
})();
