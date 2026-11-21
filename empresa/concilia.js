// Conciliação bancária (módulo C13, 17/11/2026): lê extrato OFX ou CSV, classifica cada lançamento por regras (as padrão + as aprendidas com o contador),
// casa recebimentos com notas fiscais abertas (inclusive liquidação de cartão que paga várias notas), detecta duplicidade e gera lançamentos em contabil.js.
// Nunca descarta linha em silêncio: linha ilegível vai para `erros`; o que o sistema não entende vai para a fila de revisão. ESTIMATIVA: o contador revisa e aprova.

const semAcento=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'');
const norm=s=>semAcento(s).toUpperCase().replace(/\s+/g,' ').trim();
const r2k=x=>Math.round((x+Number.EPSILON)*100)/100;

// Valor em formato brasileiro ou internacional: "1.234,56", "-1.234,56", "1234.56", "1.234" (milhar), "(100,00)", "100,00 D" / "100,00 C"
function numeroBR(txt){let t=String(txt==null?'':txt).trim();if(!t)return NaN;let neg=false;
  if(/^\(.*\)$/.test(t)){neg=true;t=t.slice(1,-1)}
  if(/\bD$/i.test(t)){neg=true;t=t.replace(/\s*D$/i,'')}else if(/\bC$/i.test(t))t=t.replace(/\s*C$/i,'');
  t=t.replace(/R\$\s*/i,'').replace(/\s/g,'');
  if(t.startsWith('-')){neg=!neg;t=t.slice(1)}else if(t.startsWith('+'))t=t.slice(1);
  if(t.endsWith('-')&&!t.startsWith('-')){neg=!neg;t=t.slice(0,-1)}   // auditoria 21/11: alguns bancos exportam o sinal no fim (100,00-)
  let v;
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t))v=+t.replace(/\./g,'').replace(',','.');
  else if(/^\d+,\d{1,2}$/.test(t))v=+t.replace(',','.');
  else if(/^\d+,\d{3,}$/.test(t)&&!/^\d{1,3}(,\d{3})+$/.test(t))return NaN;   // 3+ casas decimais não é dinheiro: recusa em vez de arredondar calado
  else if(/^\d{1,3},\d{3}$/.test(t))return NaN;   // '12,345' é ambíguo (12,345 ou 12 345): a linha vai para conferência
  else if(/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t))v=+t.replace(/,/g,'');
  else if(/^\d+(\.\d+)?$/.test(t))v=+t;
  else return NaN;
  return neg?-v:v}
function dataISO(txt){const t=String(txt||'').trim();let m;
  if((m=t.match(/^(\d{4})(\d{2})(\d{2})/)))return `${m[1]}-${m[2]}-${m[3]}`;               // OFX 20270105...
  if((m=t.match(/^(\d{4})-(\d{2})-(\d{2})/)))return `${m[1]}-${m[2]}-${m[3]}`;
  if((m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)))return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if((m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/)))return `20${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return null}
const dataValida=s=>{if(!s)return false;const d=new Date(s+'T12:00:00');return !isNaN(d)&&d.toISOString().slice(0,10)===s};

// OFX 1.x (SGML) e 2.x (XML): lê <STMTTRN>, <LEDGERBAL>. Retorna {transacoes, saldoFinal, dataSaldo, erros}
function parseOFX(txt){const erros=[],T=[];const tag=(b,n)=>{const m=b.match(new RegExp('<'+n+'>\\s*([^<\\r\\n]*)','i'));return m?m[1].trim():''};
  const blocos=String(txt).match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>|$)/gi)||[];
  blocos.forEach((b,i)=>{const data=dataISO(tag(b,'DTPOSTED')),valor=numeroBR(tag(b,'TRNAMT')),fit=tag(b,'FITID'),desc=(tag(b,'MEMO')||tag(b,'NAME')).replace(/\s+/g,' ');
    if(!dataValida(data)||isNaN(valor)||valor===0){erros.push({linha:i+1,motivo:'transação ilegível (data ou valor inválido)',trecho:b.slice(0,80)});return}
    T.push({id:fit||('sem-id-'+data+'-'+valor+'-'+i),data,valor:r2k(valor),descricao:desc,origem:'ofx'})});
  const lb=String(txt).match(/<LEDGERBAL>[\s\S]*?(?=<\/LEDGERBAL>|$)/i),saldo=lb?numeroBR(tag(lb[0],'BALAMT')):NaN,ds=lb?dataISO(tag(lb[0],'DTASOF')):null;
  if(!blocos.length)erros.push({linha:0,motivo:'nenhuma transação encontrada no OFX'});
  return {transacoes:T,saldoFinal:isNaN(saldo)?null:r2k(saldo),dataSaldo:ds,erros}}

// CSV de banco: separador ; ou , detectado; cabeçalho com data, descrição/histórico, valor (ou crédito e débito em colunas separadas), saldo opcional
function parseCSV(txt){const linhas=String(txt).replace(/^\uFEFF/,'').split(/\r?\n/).filter(l=>l.trim()),erros=[],T=[];
  if(!linhas.length)return {transacoes:[],saldoFinal:null,dataSaldo:null,erros:[{linha:0,motivo:'arquivo vazio'}]};
  const sep=(linhas[0].match(/;/g)||[]).length>=(linhas[0].match(/,/g)||[]).length&&linhas[0].includes(';')?';':',';
  const split=l=>{const o=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===sep&&!q){o.push(c);c=''}else c+=ch}o.push(c);return o.map(x=>x.trim())};
  const cab=split(linhas[0]).map(norm),ix=n=>cab.findIndex(c=>n.some(k=>c.includes(k)));
  const iD=ix(['DATA','DATE']),iH=ix(['DESCRI','HISTORICO','MEMO','LANCAMENTO']),iV=ix(['VALOR','AMOUNT']),iC=ix(['CREDITO']),iDb=ix(['DEBITO']),iS=ix(['SALDO','BALANCE']);
  if(iD<0||iH<0||(iV<0&&(iC<0||iDb<0)))return {transacoes:[],saldoFinal:null,dataSaldo:null,erros:[{linha:1,motivo:'cabeçalho não reconhecido: precisa de data, descrição e valor (ou crédito e débito)'}]};
  let ultimoSaldo=null,ultimaData=null;
  linhas.slice(1).forEach((l,i)=>{const c=split(l),data=dataISO(c[iD]);let v;
    if(iV>=0)v=numeroBR(c[iV]);else{const cr=numeroBR(c[iC]||'0'),db=numeroBR(c[iDb]||'0');v=(isNaN(cr)?0:cr)-Math.abs(isNaN(db)?0:db)}
    if(!dataValida(data)||isNaN(v)||v===0){erros.push({linha:i+2,motivo:'linha ilegível (data ou valor inválido)',trecho:l.slice(0,80)});return}
    T.push({id:'csv-'+data+'-'+v+'-'+norm(c[iH]).slice(0,20)+'-'+i,data,valor:r2k(v),descricao:c[iH].replace(/\s+/g,' '),origem:'csv'});
    if(iS>=0){const s=numeroBR(c[iS]);if(!isNaN(s)){ultimoSaldo=s;ultimaData=data}}});
  return {transacoes:T,saldoFinal:ultimoSaldo==null?null:r2k(ultimoSaldo),dataSaldo:ultimaData,erros}}

// Regras padrão. tipo: acao do lançamento. sinal: 'E' entrada, 'S' saída. conta: conta do plano (contabil.js) quando for despesa direta.
const REGRAS=[
  {id:'das',p:/\bDAS\b|SIMPLES NACIONAL|DARF.*SIMPLES|PGDAS/,s:'S',tipo:'das',conf:.92},
  {id:'fgts',p:/FGTS|FUNDO DE GARANTIA/,s:'S',tipo:'fgts',conf:.93},
  {id:'inss',p:/\bGPS\b|\bINSS\b|PREVIDENCIA SOCIAL/,s:'S',tipo:'inss',conf:.9},
  {id:'irrf',p:/\bIRRF\b|DARF.*0561|DARF.*1708/,s:'S',tipo:'irrf',conf:.88},
  {id:'prolabore',p:/PRO[- ]?LABORE/,s:'S',tipo:'pagamento-prolabore',conf:.93},
  {id:'folha',p:/SALARIO|FOLHA DE PAGAMENTO|ADIANTAMENTO SALARIAL/,s:'S',tipo:'pagamento-folha',conf:.85},
  {id:'lucros',p:/DISTRIBUICAO DE LUCRO|LUCROS?\b/,s:'S',tipo:'lucros',conf:.8},
  {id:'tarifa',p:/TARIFA|TAR\.? |MANUTENCAO DE CONTA|PACOTE DE SERVICOS|CESTA/,s:'S',tipo:'despesa',conta:'3.2.2.04.001',conf:.95},
  {id:'juros',p:/\bJUROS\b|\bMULTA\b|\bIOF\b/,s:'S',tipo:'despesa',conta:'3.2.2.04.002',conf:.9},
  {id:'aluguel',p:/ALUGUEL|LOCACAO/,s:'S',tipo:'despesa',conta:'3.2.2.01.001',conf:.9},
  {id:'condominio',p:/CONDOMINIO/,s:'S',tipo:'despesa',conta:'3.2.2.01.002',conf:.9},
  {id:'agua',p:/CESAN|SANEAMENTO|\bAGUA\b/,s:'S',tipo:'despesa',conta:'3.2.2.01.003',conf:.85},
  {id:'energia',p:/ESCELSA|EDP|ENEL|ENERGIA/,s:'S',tipo:'despesa',conta:'3.2.2.01.004',conf:.88},
  {id:'telefone',p:/\bVIVO\b|\bCLARO\b|\bTIM\b|\bOI\b|TELEFON/,s:'S',tipo:'despesa',conta:'3.2.2.01.005',conf:.8},
  {id:'internet',p:/INTERNET|BANDA LARGA|FIBRA/,s:'S',tipo:'despesa',conta:'3.2.2.01.013',conf:.85},
  {id:'conselho',p:/CREFITO|\bCRP\b|\bCRM\b|\bCRO\b|CREFONO|\bCRN\b|ANUIDADE/,s:'S',tipo:'despesa',conta:'3.2.2.01.011',conf:.9},
  {id:'contabil',p:/HONORARIO|CONTABIL|CONTADOR/,s:'S',tipo:'despesa',conta:'3.2.2.05.002',conf:.85},
  {id:'software',p:/GOOGLE WORKSPACE|MICROSOFT|ADOBE|CANVA|NOTION|SOFTWARE|ASSINATURA|ZOOM/,s:'S',tipo:'despesa',conta:'3.2.2.05.001',conf:.8},
  {id:'marketing',p:/META ADS|FACEBOOK ADS|GOOGLE ADS|INSTAGRAM|ANUNCIO/,s:'S',tipo:'despesa',conta:'3.2.2.05.004',conf:.82},
  {id:'seguro',p:/SEGURO/,s:'S',tipo:'despesa',conta:'3.2.2.05.007',conf:.8},
  {id:'material-clinico',p:/MATERIAL (HOSPITALAR|CLINICO)|DESCARTAVEIS|LUVAS/,s:'S',tipo:'despesa',conta:'3.2.2.05.005',conf:.8},
  {id:'cartao',p:/CIELO|REDE\b|STONE|PAGSEGURO|PAGBANK|GETNET|MERCADO PAGO|SUMUP|ADQUIRENTE|VENDA CARTAO/,s:'E',tipo:'recebimento-cartao',conf:.85},
  {id:'recebimento',p:/PIX RECEB|PIX CRED|TED RECEB|DOC RECEB|DEPOSITO|TRANSF.*RECEB|RECEBIMENTO/,s:'E',tipo:'recebimento',conf:.7},
  {id:'entre-contas',p:/APLICACAO|RESGATE|TRANSFERENCIA ENTRE CONTAS|MESMA TITULARIDADE/,s:'*',tipo:'transferencia',conf:.6}
];
// Regras aprendidas: [{padrao: 'TEXTO NORMALIZADO que a descrição contém', conta|tipo, conf}]. O contador confirma uma vez, o sistema repete.
const aprende=(regras,descricao,decisao)=>{const k=norm(descricao).replace(/\d{2}\/\d{2}|\d{4,}/g,'').replace(/\s+/g,' ').trim().slice(0,30);
  if(!k||k.length<4)return regras;return [...regras.filter(r=>r.padrao!==k),{padrao:k,...decisao,conf:.97,aprendida:true}]};

// Combinação de notas abertas cuja soma fecha o valor (liquidação de cartão que paga várias notas). Até 4 notas entre as 14 mais antigas.
function combinaNotas(notas,valor,max=4){const N=notas.slice(0,14),alvo=Math.round(valor*100),achados=[];
  const rec=(ini,esc,soma)=>{if(soma===alvo&&esc.length>1){achados.push(esc.slice());return}if(soma>=alvo||esc.length>=max||achados.length>1)return;
    for(let i=ini;i<N.length;i++){esc.push(N[i]);rec(i+1,esc,soma+Math.round(N[i].valor*100));esc.pop()}};
  rec(0,[],0);return achados}

const simNome=(a,b)=>{const A=new Set(norm(a).split(' ').filter(x=>x.length>2)),B=norm(b).split(' ').filter(x=>x.length>2);if(!A.size||!B.length)return 0;return B.filter(x=>A.has(x)).length/B.length};

// Classifica as transações. notasAbertas: [{ref,valor,data,tomador,cpf}] ordenadas por data. importados: Set de chaves já vistas (dedupe entre arquivos).
// status: conciliado (alta confiança e sem ambiguidade) · sugerido (confirmar) · pendente (revisão) · duplicado · ignorado
function classifica(transacoes,{regras=[],notasAbertas=[],importados=new Set(),limiteAuto=0.9}={}){
  const vistos=new Set(importados),notas=notasAbertas.map(n=>({...n,usada:false})),itens=[];
  const ord=transacoes.slice().sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:0);
  for(const t of ord){
    const chave=t.id+'|'+t.data+'|'+t.valor+'|'+norm(t.descricao);const k2=t.data+'|'+t.valor+'|'+norm(t.descricao);
    if(vistos.has(chave)||(t.origem==='csv'&&vistos.has(k2)&&importados.has(k2))){itens.push({...t,status:'duplicado',motivo:'já importado antes'});continue}
    vistos.add(chave);const d=norm(t.descricao),sinal=t.valor>0?'E':'S',abs=Math.abs(t.valor);
    // 1) regras aprendidas (vencem as padrão)
    const ap=regras.find(r=>d.includes(r.padrao));
    if(ap){const it={...t,regra:'aprendida:'+ap.padrao,tipo:ap.tipo||'despesa',conta:ap.conta,confianca:ap.conf};it.status=it.confianca>=limiteAuto?'conciliado':'sugerido';itens.push(it);continue}
    // 2) regras padrão
    const rp=REGRAS.find(r=>r.p.test(d)&&(r.s==='*'||r.s===sinal));
    let it={...t,regra:rp?rp.id:null,tipo:rp?rp.tipo:null,conta:rp?rp.conta:null,confianca:rp?rp.conf:0};
    // 3) recebimentos: casar com notas abertas
    if(sinal==='E'&&(!rp||rp.tipo==='recebimento'||rp.tipo==='recebimento-cartao')){
      const ex=notas.filter(n=>!n.usada&&Math.abs(n.valor-abs)<0.005&&n.data<=t.data);
      if(ex.length===1){ex[0].usada=true;it={...it,tipo:'recebimento',nota:ex[0].ref,confianca:rp&&rp.tipo==='recebimento-cartao'?.9:.95,regra:'valor da nota'}}
      else if(ex.length>1){const sc=ex.map(n=>({n,s:simNome(d,n.tomador||'')})).sort((a,b)=>b.s-a.s||(a.n.data<b.n.data?-1:1));
        if(sc[0].s>0&&sc[0].s>sc[1].s){sc[0].n.usada=true;it={...it,tipo:'recebimento',nota:sc[0].n.ref,confianca:.9,regra:'valor e nome'}}
        else it={...it,tipo:'recebimento',candidatos:ex.map(n=>n.ref),confianca:.6,regra:'mais de uma nota com o mesmo valor'}}
      else{const abertas=notas.filter(n=>!n.usada&&n.data<=t.data),cb=combinaNotas(abertas,abs);
        if(cb.length===1){cb[0].forEach(n=>{const o=notas.find(x=>x.ref===n.ref);o.usada=true});it={...it,tipo:'recebimento',notas:cb[0].map(n=>n.ref),confianca:.88,regra:'soma de notas (liquidação)'}}
        else if(cb.length>1)it={...it,tipo:'recebimento',candidatos:cb.map(c=>c.map(n=>n.ref).join('+')),confianca:.55,regra:'mais de uma combinação de notas'}
        else it={...it,tipo:rp?it.tipo:'recebimento-sem-nota',confianca:Math.min(it.confianca||.5,.6),aviso:'entrou dinheiro sem nota fiscal correspondente: emitir a nota ou classificar'}}}
    it.status=!it.tipo?'pendente':it.confianca>=limiteAuto&&!it.candidatos&&!it.aviso?'conciliado':'sugerido';
    if(it.tipo==='transferencia')it.status='sugerido';
    itens.push(it)}
  return {itens,notasSemBaixa:notas.filter(n=>!n.usada).map(n=>n.ref),chavesNovas:[...vistos]}}

// Gera os lançamentos de itens conciliados (ou confirmados pelo contador). livro: criaLivro() de contabil.js.
function geraLancamentos(livro,itens,{competenciaDAS=null,notasAbertas=[]}={}){const ok=[],falhas=[],g=livro.gera;
  for(const it of itens){if(!['conciliado','confirmado'].includes(it.status))continue;const v=Math.abs(it.valor);
    try{
      if(it.tipo==='recebimento'&&(it.nota||it.notas)){const refs=it.notas||[it.nota];if(refs.length===1)ok.push(g.recebimento(it.data,v,refs[0]));else ok.push(...geraLiquidacao(livro,it,notasAbertas))}
      else if(it.tipo==='despesa'&&it.conta)ok.push(g.despesaPaga(it.data,v,it.conta,it.descricao));
      else if(it.tipo==='das'){const [a,m]=it.data.split('-').map(Number),comp=competenciaDAS||(m===1?`${a-1}-12`:`${a}-${String(m-1).padStart(2,'0')}`);ok.push(g.dasPago(it.data,v,comp))}
      else if(it.tipo==='fgts')ok.push(g.recolheFGTS(it.data,v));
      else if(it.tipo==='inss')ok.push(g.recolheINSS(it.data,v));
      else if(it.tipo==='irrf')ok.push(g.recolheIRRF(it.data,v));
      else if(it.tipo==='pagamento-prolabore')ok.push(g.pagamentoProLabore(it.data,v));
      else if(it.tipo==='pagamento-folha')ok.push(g.pagamentoFolha(it.data,v));
      else if(it.tipo==='lucros')ok.push(g.distribuiLucros(it.data,v));
      else falhas.push({item:it,motivo:'tipo sem lançamento automático: '+it.tipo})
    }catch(e){falhas.push({item:it,motivo:e.message})}}
  return {lancamentos:ok.filter(Boolean),falhas}}
// Liquidação que paga várias notas: um lançamento por nota, com o valor de cada uma
function geraLiquidacao(livro,item,notasAbertas){const refs=item.notas||[],ls=[];let soma=0;
  for(const r of refs){const n=notasAbertas.find(x=>x.ref===r);if(!n)throw new Error('nota não encontrada: '+r);ls.push(livro.gera.recebimento(item.data,n.valor,r));soma+=Math.round(n.valor*100)}
  if(soma!==Math.round(Math.abs(item.valor)*100))throw new Error('as notas não fecham o valor recebido');return ls}

// Confere o saldo do extrato com o saldo contábil do banco em uma data: diferença zero = conciliado
function confereSaldo(livro,saldoExtrato,ate){const contabil=livro.saldoConta('1.1.1.02',ate),dif=Math.round((saldoExtrato-contabil)*100)/100;return {saldoExtrato,saldoContabil:contabil,diferenca:dif,conciliado:dif===0}}
function resumo(r){const c={conciliado:0,sugerido:0,pendente:0,duplicado:0,ignorado:0};r.itens.forEach(i=>c[i.status]++);
  const tot=r.itens.length-c.duplicado;return {...c,total:r.itens.length,automatico:tot?Math.round(c.conciliado/tot*1000)/10:0,notasSemBaixa:r.notasSemBaixa.length}}

if(typeof module!=='undefined')module.exports={numeroBR,dataISO,parseOFX,parseCSV,REGRAS,aprende,combinaNotas,classifica,geraLancamentos,geraLiquidacao,confereSaldo,resumo,norm};
