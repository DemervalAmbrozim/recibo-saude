// Regras fiscais comuns ao painel (app.js) e ao app da profissional (lancar.js): um lugar só para o cálculo nunca divergir.

// Plano de contas padrão do Carnê-Leão (P10 = despesa dedutível do livro-caixa) e INSS (P20.01.00001 = Previdência Oficial)
const P10=[['00002','Aluguel do consultório'],['00003','Condomínio do consultório'],['00001','Água do consultório'],['00007','Energia do consultório'],
  ['00014','Telefone e internet do consultório'],['00008','Gás do consultório'],['00009','IPTU do consultório'],['00004','Anuidade do conselho (CREFITO etc.)'],
  ['00011','Material de limpeza do consultório'],['00012','Material de escritório'],['00013','Funcionário: salário, INSS e FGTS'],['00010','ISS'],
  ['00005','Cópias e autenticações'],['00006','Emolumentos pagos a terceiros']].map(([c,n])=>['P10.01.'+c,n]);
const INSS='P20.01.00001';
const CONTAS=[...P10,[INSS,'Seu INSS (carnê ou GPS)']];
const IMOVEL=['00001','00002','00003','00007','00008','00009','00014'].map(c=>'P10.01.'+c); // contas que dependem do local
const nomeCod=c=>(CONTAS.find(x=>x[0]===c)||[c,c])[1];

// Locais: a casa que também é consultório abate 1/5 das contas (página oficial do Carnê-Leão, Deduções, conferida em 19/10/2026)
const TIPOS={consultorio:['Consultório',1,'Abate 100% das contas deste local.'],sala:['Sala dividida',1,'Abate 100% da parte que você paga.'],
  casa:['Casa e consultório',0.2,'Abate 1/5 (20%) das contas da casa, porque a casa também é moradia.'],
  domicilio:['Domiciliar',0,'Sem conta de imóvel para abater. Combustível e carro não abatem no Carnê-Leão.']};

// Carnê-Leão 2026: tabela mensal + desconto simplificado + redução da Lei 15.270/2025 (conferido na Receita em 18/10/2026)
const LIM=5000, LIM2=7350, SIMPL=607.20;
const TAB=[[2428.80,0,0],[2826.65,.075,182.16],[3751.05,.15,394.16],[4664.68,.225,675.49],[Infinity,.275,908.73]];
function carneLeao(rend,ded){
  const deducao=Math.max(ded,SIMPL), base=Math.max(0,rend-deducao);
  const [,al,pd]=TAB.find(f=>base<=f[0]); const bruto=Math.max(0,base*al-pd);
  const red=rend<=LIM?Math.min(bruto,312.89):rend<=LIM2?Math.max(0,978.62-0.133145*rend):0;
  return {deducao,usaSimpl:ded<SIMPL,base,bruto,red,devido:Math.max(0,Math.round((bruto-red)*100)/100)};
}
const soma=xs=>xs.reduce((s,x)=>s+ +x.valor,0);
// Apura o mês: o livro-caixa vale até a receita do mês e a sobra passa para os meses seguintes, até dezembro (não vira o ano).
// O INSS pago no mês entra como dedução à parte.
function apura(ats,ds,mes){
  const ano=mes.slice(0,4); let sobra=0, r=null;
  for(let m=1;m<=+mes.slice(5,7);m++){const k=`${ano}-${String(m).padStart(2,'0')}`, dm=ds.filter(d=>d.data.startsWith(k));
    const rec=soma(ats.filter(a=>a.data.startsWith(k))), lc=soma(dm.filter(d=>d.codigo!==INSS)), inss=soma(dm.filter(d=>d.codigo===INSS));
    const anterior=sobra, usado=Math.min(lc+anterior,rec); sobra=Math.round((lc+anterior-usado)*100)/100;
    r={rec,lc,inss,anterior,usado,sobra,cl:carneLeao(rec,usado+inss)};}
  return r;
}
function ultimoDiaUtil(a,m){const d=new Date(a,m+1,0);while([0,6].includes(d.getDay()))d.setDate(d.getDate()-1);return d} // m: 0-11

// Reforma tributária (LC 214/2025): abaixo de 50% do limite do MEI (R$ 81 mil) a pessoa física é "nanoempreendedor" e não paga CBS/IBS (art. 26, IV).
// Acima disso, a partir de 2027 vira contribuinte, com nota fiscal; fisioterapia tem 60% de redução (art. 130, Anexo III).
const NANO=40500;
function reforma(recAno){const p=recAno/NANO;
  return {p,txt:p<0.8?`Recebido no ano: abaixo do limite de ${NANO.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} da reforma tributária. Por esse ritmo, segue sem nota fiscal em 2027.`
    :p<1?`Atenção: perto do limite de ${NANO.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} por ano. Acima dele, a partir de 2027 será preciso emitir nota fiscal e pagar CBS/IBS (com 60% de desconto para fisioterapia).`
    :`Acima de ${NANO.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} no ano: pela reforma tributária, a partir de 2027 será preciso emitir nota fiscal e pagar CBS/IBS (com 60% de desconto para fisioterapia). A Assessoria vai orientar.`};
}
