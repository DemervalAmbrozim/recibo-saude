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
  // o DARF pequeno de dezembro passa para janeiro (a sobra de despesa, não)
  let darf=ats.some(a=>a.data.startsWith(ano-1))?(p=>p.adia?p.total:0)(apura(ats,ds,`${ano-1}-12`).darf):0;
  for(let m=1;m<=+mes.slice(5,7);m++){const k=`${ano}-${String(m).padStart(2,'0')}`, dm=ds.filter(d=>d.data.startsWith(k));
    const rec=soma(ats.filter(a=>a.data.startsWith(k))), lc=soma(dm.filter(d=>d.codigo!==INSS)), inss=soma(dm.filter(d=>d.codigo===INSS));
    const anterior=sobra, usado=Math.min(lc+anterior,rec); sobra=Math.round((lc+anterior-usado)*100)/100;
    const cl=carneLeao(rec,usado+inss), total=Math.round((cl.devido+darf)*100)/100;
    // A Receita não gera DARF abaixo de R$ 10: o valor soma ao imposto do mês seguinte (auditoria F6, Carnê-Leão "Como pagar", código 0190)
    r={rec,lc,inss,anterior,usado,sobra,cl,darf:{vem:darf,total,pagar:total>=10?total:0,adia:total>0&&total<10}}; darf=total<10?total:0;}
  return r;
}
// Feriados nacionais e dias sem banco (auditoria F7). Contar Carnaval, Corpus Christi e 31/12 como não úteis é de propósito:
// no pior caso o vencimento mostrado é um dia antes, e pagar antes nunca gera multa.
function feriados(a){
  const f=['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25','12-31'].map(x=>`${a}-${x}`);
  const g=a%19,c=Math.floor(a/100),h=(c-Math.floor(c/4)-Math.floor((8*c+13)/25)+19*g+15)%30,i=h-Math.floor(h/28)*(1-Math.floor(29/(h+1))*Math.floor((21-g)/11)),
    j=(a+Math.floor(a/4)+i+2-c+Math.floor(c/4))%7,l=i-j,mp=3+Math.floor((l+40)/44),dp=l+28-31*Math.floor(mp/4); // Páscoa (Meeus)
  [-48,-47,-2,60].forEach(k=>{const d=new Date(a,mp-1,dp+k);f.push(dISO(d))}); // Carnaval (seg e ter), Sexta-feira Santa, Corpus Christi
  return f;
}
const dISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const diaUtil=d=>![0,6].includes(d.getDay())&&!feriados(d.getFullYear()).includes(dISO(d));
function ultimoDiaUtil(a,m){const d=new Date(a,m+1,0);while(!diaUtil(d))d.setDate(d.getDate()-1);return d} // m: 0-11

// Reforma tributária (LC 214/2025): abaixo de 50% do limite do MEI a pessoa física é "nanoempreendedor" e não paga CBS/IBS (art. 26, IV).
// Acima disso vira contribuinte, com nota fiscal e cadastro pelo CPF (art. 59); fisioterapia tem 60% de redução (art. 130, Anexo III).
// A LC 238/2026 (DOU 21/10/2026) sobe o MEI para R$ 110 mil em 2027 e R$ 140 mil em 2028 (esta condicionada ao orçamento, art. 3º),
// então a linha vai a R$ 55 mil e R$ 70 mil (auditoria F2). A receita do ano é comparada com a linha do ano seguinte, quando a regra
// passa a valer: a confirmar com o contador.
const NANO={2027:55000,2028:70000};
const nano=ano=>NANO[Math.min(Math.max(+ano+1,2027),2028)];
function reforma(recAno,ano){const lim=nano(ano),p=recAno/lim,a1=Math.max(+ano+1,2027),L=lim.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return {p,lim,txt:(p<0.8?`Recebido no ano: abaixo do limite de ${L} da reforma tributária para ${a1}. Por esse ritmo, segue sem nota fiscal.`
    :p<1?`Atenção: perto do limite de ${L} por ano. Acima dele, em ${a1} será preciso emitir nota fiscal e pagar CBS/IBS (com 60% de desconto para fisioterapia).`
    :`Acima de ${L} no ano: pela reforma tributária, em ${a1} será preciso emitir nota fiscal e pagar CBS/IBS (com 60% de desconto para fisioterapia). A Assessoria vai orientar.`)
    +' Limite novo (LC 238/2026), a confirmar com o contador.'};
}

// Pessoa física × CNPJ (comparativo de 28/10/2026, projeto/pf-x-cnpj-e-nfse.html e ferramentas/comparativo-pf-cnpj.py).
// Usa a média dos 3 meses fechados antes de `mes` (os 3 precisam ter receita). PF: INSS de autônoma (20% da receita, do mínimo
// ao teto) + Carnê-Leão. CNPJ: Simples Anexo III com pró-labore de 28% (Fator R, LC 123 art. 18 §§ 5º-J, 5º-M e 24), INSS de 11%
// e IR do pró-labore, mais o contador. Fica de fora o ISS (a PF paga à parte; no Simples vem no DAS), então a conta favorece a PF.
// Só sugere conversar com o contador quando a economia passa de R$ 300 por mês.
const SM=1621, TETO=8475.55, CONTADOR=400; // salário mínimo e teto do INSS 2026 (Decreto 12.797/2025, Portaria MPS/MF 13/2026)
const A3=[[180e3,.06,0],[360e3,.112,9360],[720e3,.135,17640],[1.8e6,.16,35640]];
function cnpjAviso(ats,ds,mes){
  const [a,m]=mes.split('-').map(Number), ms=[1,2,3].map(k=>dISO(new Date(a,m-1-k,1)).slice(0,7));
  const rs=ms.map(k=>({rec:soma(ats.filter(x=>x.data.startsWith(k))),lc:soma(ds.filter(x=>x.data.startsWith(k)&&x.codigo!==INSS))}));
  if(rs.some(r=>!r.rec))return null;
  const R=rs.reduce((s,r)=>s+r.rec,0)/3, lc=Math.min(R,rs.reduce((s,r)=>s+r.lc,0)/3);
  const inss=.2*Math.min(Math.max(R,SM),TETO), pf=inss+carneLeao(R,lc+inss).devido;
  const P=Math.max(SM,.28*R), ip=.11*Math.min(P,TETO), rbt=12*R, [,al,pd]=A3.find(f=>rbt<=f[0])||A3[A3.length-1];
  const cnpj=(rbt*al-pd)/rbt*R+ip+carneLeao(P,ip).devido+CONTADOR, eco=Math.round(pf-cnpj);
  const B=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  return {R,pf,cnpj,eco,mostra:eco>=300,
    txt:`Pela média de ${B(R)} por mês nos últimos 3 meses, você paga cerca de ${B(pf)} de INSS e Carnê-Leão. Com um CNPJ no Simples seriam cerca de ${B(cnpj)}, já com contador: ${B(eco)} a menos por mês. Com CNPJ o INSS é menor, e a aposentadoria também. Converse com a Assessoria e o contador antes de decidir.`};
}
