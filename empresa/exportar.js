/* EXPORTAR para o sistema contábil do escritório (21/11/2026). Formato NEUTRO em CSV (ponto e vírgula, UTF-8 com BOM, vírgula decimal), porque ainda não sabemos qual
   sistema o Daniel usa (Domínio, Alterdata, Questor, Contmatic...). Cada sistema tem o seu leiaute de importação; quando soubermos qual é, o leiaute dele entra como um
   formato a mais sem mexer no resto. O de-para de contas é editável: {codigoDoPlanoDaPlataforma: codigoNoSistemaDoEscritorio}. Funções puras, sem rede. */
const csvCel=(v,sep)=>{const s=String(v==null?'':v);return new RegExp('[\\n\\r"'+sep+']').test(s)?'"'+s.replace(/"/g,'""')+'"':s};
const vBR=c=>(c/100).toFixed(2).replace('.',',');   // c em centavos inteiros
const dBRx=iso=>iso.slice(8,10)+'/'+iso.slice(5,7)+'/'+iso.slice(0,4);
const BOM='﻿';
// lancamentos: de criaLivro().lancamentos() ({id,data,historico,origem,ref,partidas:[{conta,d,c}]} com valores em centavos); plano: PLANO como objeto CONTA {codigo:{nome,natureza,...}}
// formato 'partida': uma linha por partida (lote;data;conta;nome;débito;crédito;histórico;origem). 'duplo': uma linha por lançamento quando é 1 débito x 1 crédito (conta débito;conta crédito;valor); lançamentos com mais de 2 partidas saem como 'partida' e vão em "avisos".
function csvLancamentos(lancamentos,plano,o){
  o=o||{};const sep=o.sep||';',dp=o.dePara||{},f=o.formato||'partida',de=o.de||'',ate=o.ate||'',avisos=[],linhas=[];
  const conta=k=>dp[k]||k,nome=k=>(plano&&plano[k]&&plano[k].nome)||'';
  const L=(lancamentos||[]).filter(l=>(!de||l.data>=de)&&(!ate||l.data<=ate)).sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:a.id-b.id);
  for(const k of new Set(L.flatMap(l=>l.partidas.map(p=>p.conta))))if(plano&&!plano[k])avisos.push(`conta ${k} fora do plano`);
  const semDePara=[...new Set(L.flatMap(l=>l.partidas.map(p=>p.conta)))].filter(k=>Object.keys(dp).length&&!dp[k]);
  if(semDePara.length)avisos.push('sem de-para (saiu o código da plataforma): '+semDePara.join(', '));
  if(f==='duplo')linhas.push(['lote','data','conta_debito','conta_credito','valor','historico','origem']);else linhas.push(['lote','data','conta','nome_da_conta','debito','credito','historico','origem']);
  for(const l of L){
    if(f==='duplo'&&l.partidas.length===2&&l.partidas.some(p=>p.d>0)&&l.partidas.some(p=>p.c>0)){const d=l.partidas.find(p=>p.d>0),c=l.partidas.find(p=>p.c>0);linhas.push([l.id,dBRx(l.data),conta(d.conta),conta(c.conta),vBR(d.d),l.historico,l.origem||'']);continue}
    if(f==='duplo')avisos.push(`lançamento ${l.id} tem ${l.partidas.length} partidas: saiu em linhas por partida`);
    for(const p of l.partidas){if(f==='duplo')linhas.push([l.id,dBRx(l.data),p.d>0?conta(p.conta):'',p.c>0?conta(p.conta):'',vBR(p.d||p.c),l.historico+' (partida)',l.origem||'']);
      else linhas.push([l.id,dBRx(l.data),conta(p.conta),nome(p.conta),p.d?vBR(p.d):'',p.c?vBR(p.c):'',l.historico,l.origem||''])}}
  // conferência: débitos = créditos no arquivo
  let td=0,tc=0;for(const l of L)for(const p of l.partidas){td+=p.d;tc+=p.c}
  return {csv:BOM+linhas.map(r=>r.map(c=>csvCel(c,sep)).join(sep)).join('\r\n')+'\r\n',linhas:linhas.length-1,lancamentos:L.length,totalDebitos:td/100,totalCreditos:tc/100,fecha:td===tc,avisos}}
function csvPlano(plano,o){o=o||{};const sep=o.sep||';',dp=o.dePara||{};
  const L=[['codigo_plataforma','codigo_no_seu_sistema','nome','grupo','natureza']];
  for(const k of Object.keys(plano||{}).sort())L.push([k,dp[k]||'',plano[k].nome,plano[k].grupo||'',plano[k].natureza||'']);
  return BOM+L.map(r=>r.map(c=>csvCel(c,sep)).join(sep)).join('\r\n')+'\r\n'}
// Lê o de-para que o contador preencheu (a mesma planilha de csvPlano devolvida): {codigo_plataforma: codigo_no_seu_sistema}
function lerDePara(txt){const out={},L=String(txt||'').replace(/^﻿/,'').split(/\r?\n/).filter(x=>x.trim()),sep=(L[0]||'').includes(';')?';':',';
  for(const l of L.slice(1)){const c=l.split(sep).map(x=>x.trim());if(c[0]&&c[1])out[c[0]]=c[1]}return out}
if(typeof module!=='undefined')module.exports={csvLancamentos,csvPlano,lerDePara};
