// Escrituração contábil da ME de saúde no Simples (módulo C3, 17/11/2026): plano de contas, lançamentos em partidas dobradas, geradores automáticos
// (nota, recebimento, despesa, DAS, pró-labore, folha, provisões, lucros), razão, balancete, DRE, balanço e encerramento do exercício.
// Base: ITG 1000 (contabilidade da microempresa; plano simplificado, numeração de resultado 3.x como em regras.js) [conferir a vigência atual da ITG 1000 e da NBC TG 1000].
// Valores em centavos por dentro (nunca soma de decimais). ESTIMATIVA/RASCUNHO contábil: o contador responsável revisa, assina e transmite.
// Fora do escopo: ECD/ECF (dispensadas no Simples [conferir]), estoque industrial, câmbio, investimentos, empréstimos com juros complexos.

// [código, nome, grupo, natureza] natureza: D = saldo normal devedor, C = credor
const PLANO=[
  ['1.1.1.01','Caixa','ativo','D'],['1.1.1.02','Banco conta movimento','ativo','D'],['1.1.2.01','Clientes a receber','ativo','D'],
  ['1.1.3.01','Tributos a recuperar (salário-família e compensações)','ativo','D'],['1.1.4.01','Adiantamentos a empregados','ativo','D'],['1.2.1.01','Equipamentos e móveis','ativo','D'],['1.2.1.99','(-) Depreciação acumulada','ativo','C'],
  ['2.1.1.01','Fornecedores','passivo','C'],['2.1.2.01','Simples Nacional a recolher','passivo','C'],['2.1.2.02','INSS a recolher','passivo','C'],['2.1.2.03','IRRF a recolher','passivo','C'],
  ['2.1.2.04','FGTS a recolher','passivo','C'],['2.1.2.05','ISS retido a recolher','passivo','C'],['2.1.3.01','Salários a pagar','passivo','C'],['2.1.3.02','Pró-labore a pagar','passivo','C'],
  ['2.1.3.03','Provisão de férias','passivo','C'],['2.1.3.04','Provisão de 13º salário','passivo','C'],['2.1.3.05','Provisão de FGTS sobre férias e 13º','passivo','C'],['2.1.3.06','Pensão alimentícia a pagar (retida em folha)','passivo','C'],['2.1.3.07','Consignado a repassar (retido em folha)','passivo','C'],['2.1.3.08','Outros descontos de empregados a repassar','passivo','C'],['2.1.4.01','Lucros a distribuir','passivo','C'],
  ['2.3.1.01','Capital social','pl','C'],['2.3.2.01','Lucros ou prejuízos acumulados','pl','C'],['2.3.3.01','Lucros distribuídos','pl','D'],
  ['3.1.1.03','Venda de serviços','receita','C'],['3.1.2.01','(-) Simples Nacional sobre a receita','deducao','D'],['3.1.2.02','(-) Cancelamentos e devoluções','deducao','D'],
  ['3.2.1.01.001','Pró-labore','despesa','D'],['3.2.1.01.002','Salários e ordenados','despesa','D'],['3.2.1.01.003','FGTS','despesa','D'],['3.2.1.01.004','Férias e 13º salário (provisão)','despesa','D'],
  ['3.2.1.01.005','Vale-transporte (desconto do empregado)','despesa','C'],
  ['3.2.2.01.001','Aluguel','despesa','D'],['3.2.2.01.002','Condomínio','despesa','D'],['3.2.2.01.003','Água','despesa','D'],['3.2.2.01.004','Energia elétrica','despesa','D'],['3.2.2.01.005','Telefone','despesa','D'],
  ['3.2.2.01.006','Gás','despesa','D'],['3.2.2.01.007','Material de limpeza','despesa','D'],['3.2.2.01.008','Material de escritório','despesa','D'],['3.2.2.01.009','Cópias e autenticações','despesa','D'],
  ['3.2.2.01.010','Emolumentos','despesa','D'],['3.2.2.01.011','Anuidade do conselho','despesa','D'],['3.2.2.01.012','Salários e encargos (outros)','despesa','D'],['3.2.2.01.013','Internet','despesa','D'],
  ['3.2.2.03.001','IPTU','despesa','D'],['3.2.2.03.002','ISS','despesa','D'],
  ['3.2.2.04.001','Tarifas bancárias','despesa','D'],['3.2.2.04.002','Juros e multas','despesa','D'],
  ['3.2.2.05.001','Software e assinaturas','despesa','D'],['3.2.2.05.002','Honorários contábeis','despesa','D'],['3.2.2.05.003','Depreciação','despesa','D'],['3.2.2.05.004','Marketing e publicidade','despesa','D'],
  ['3.2.2.05.005','Material de consumo clínico','despesa','D'],['3.2.2.05.006','Cursos e capacitação','despesa','D'],['3.2.2.05.007','Seguros','despesa','D'],['3.2.2.05.008','Transporte e viagens','despesa','D']
];
const CONTA=Object.fromEntries(PLANO.map(([c,n,g,nat])=>[c,{codigo:c,nome:n,grupo:g,natureza:nat}]));
// Despesas do app (P10 do Carnê-Leão, regras.js) → conta da escrituração
const DE_PARA_P10={'P10.01.00002':'3.2.2.01.001','P10.01.00003':'3.2.2.01.002','P10.01.00001':'3.2.2.01.003','P10.01.00007':'3.2.2.01.004','P10.01.00014':'3.2.2.01.005','P10.01.00015':'3.2.2.01.013',
  'P10.01.00008':'3.2.2.01.006','P10.01.00011':'3.2.2.01.007','P10.01.00012':'3.2.2.01.008','P10.01.00005':'3.2.2.01.009','P10.01.00006':'3.2.2.01.010','P10.01.00004':'3.2.2.01.011',
  'P10.01.00013':'3.2.2.01.012','P10.01.00009':'3.2.2.03.001','P10.01.00010':'3.2.2.03.002'};
const contaDeP10=cod=>DE_PARA_P10[cod]||null;

// Auditoria 21/11/2026: o EPSILON não corrigia o erro de ponto flutuante (10,075 virava 10,07). Meia-unidade sobe; valor não finito ou absurdo (> 1 trilhão) é recusado em lanca().
const cent=v=>{const x=+v;return Math.round(x*100+(x<0?-1e-7:1e-7))};
const reais=c=>c/100;
// Auditoria 21/11/2026: 31/02, 29/02 de ano comum e 31/04 passavam. Agora confere ida e volta (a data não pode "rolar" para outro dia).
const dataOk=s=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s};

function criaLivro(){
  const L=[];let seq=0;
  // partidas: [{conta, d: valor} | {conta, c: valor}]. Recusa lançamento desequilibrado, conta fora do plano, valor não positivo e data inválida.
  function lanca({data,historico,partidas,origem='manual',ref=null}){
    if(!dataOk(data))throw new Error('data inválida: '+data);
    if(!historico||!String(historico).trim())throw new Error('lançamento sem histórico');
    if(!Array.isArray(partidas)||partidas.length<2)throw new Error('lançamento precisa de ao menos duas partidas');
    let d=0,c=0;const ps=partidas.map(p=>{
      if(!CONTA[p.conta])throw new Error('conta fora do plano: '+p.conta);
      if([p.d,p.c].some(x=>x!=null&&(!Number.isFinite(+x)||Math.abs(+x)>1e12)))throw new Error('valor inválido na conta '+p.conta);
      const vd=p.d!=null?cent(p.d):0,vc=p.c!=null?cent(p.c):0;
      if((vd>0)===(vc>0)||vd<0||vc<0)throw new Error('cada partida é débito OU crédito, com valor positivo: '+p.conta);
      d+=vd;c+=vc;return {conta:p.conta,d:vd,c:vc}});
    if(d!==c)throw new Error('lançamento desequilibrado: débitos '+reais(d)+' e créditos '+reais(c));
    const l={id:++seq,data,historico:String(historico).trim(),origem,ref,partidas:ps};L.push(l);return l}
  const entre=(de,ate)=>L.filter(l=>(!de||l.data>=de)&&(!ate||l.data<=ate));
  function saldos(de,ate){const s={};for(const l of entre(de,ate))for(const p of l.partidas){s[p.conta]=s[p.conta]||{d:0,c:0};s[p.conta].d+=p.d;s[p.conta].c+=p.c}return s}
  // saldo com sinal da natureza da conta (positivo = saldo normal)
  const saldoConta=(conta,ate,de=null)=>{const s=saldos(de,ate)[conta]||{d:0,c:0};return reais(CONTA[conta].natureza==='D'?s.d-s.c:s.c-s.d)};
  function balancete(de,ate){
    const ant=saldos(null,de?dia(de,-1):'0000-01-01'),per=saldos(de,ate),contas=new Set([...Object.keys(ant),...Object.keys(per)]);let td=0,tc=0;
    const linhas=[...contas].sort().map(k=>{const a=ant[k]||{d:0,c:0},p=per[k]||{d:0,c:0},nat=CONTA[k].natureza,sa=nat==='D'?a.d-a.c:a.c-a.d,sf=sa+(nat==='D'?p.d-p.c:p.c-p.d);td+=p.d;tc+=p.c;
      return {conta:k,nome:CONTA[k].nome,saldoAnterior:reais(sa),debitos:reais(p.d),creditos:reais(p.c),saldoFinal:reais(sf),natureza:nat}});
    return {linhas,totalDebitos:reais(td),totalCreditos:reais(tc),fecha:td===tc}}
  function dia(iso,n){const x=new Date(iso+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)}
  // soma de um grupo no sentido normal do GRUPO (ativo, dedução e despesa = devedor; passivo, PL e receita = credor): conta redutora (depreciação, lucros distribuídos, desconto de VT) entra negativa
  const NORMAL={ativo:'D',deducao:'D',despesa:'D',passivo:'C',pl:'C',receita:'C'};
  function soma(grupo,de,ate,filtro){const s=saldos(de,ate);let t=0;for(const [k,v] of Object.entries(s)){const c=CONTA[k];if(c.grupo!==grupo||(filtro&&!filtro(k)))continue;t+=NORMAL[grupo]==='D'?v.d-v.c:v.c-v.d}return t}
  // DRE: receita bruta, deduções (Simples), receita líquida, despesas (pessoal, administrativas, tributárias, financeiras, outras), resultado
  function dre(de,ate){
    const g=(grupo,f)=>soma(grupo,de,ate,f);
    const rb=g('receita'),ded=g('deducao'),rl=rb-ded;
    const pessoal=g('despesa',k=>k.startsWith('3.2.1.')),adm=g('despesa',k=>k.startsWith('3.2.2.01.')),trib=g('despesa',k=>k.startsWith('3.2.2.03.')),fin=g('despesa',k=>k.startsWith('3.2.2.04.')),out=g('despesa',k=>k.startsWith('3.2.2.05.'));
    const res=rl-pessoal-adm-trib-fin-out;
    return {receitaBruta:reais(rb),deducoes:reais(ded),receitaLiquida:reais(rl),despesasPessoal:reais(pessoal),despesasAdministrativas:reais(adm),despesasTributarias:reais(trib),despesasFinanceiras:reais(fin),outrasDespesas:reais(out),resultado:reais(res),
      margem:rb>0?Math.round(res/rb*10000)/10000:null}}
  // Balanço em uma data: ativo, passivo e patrimônio líquido (com o resultado ainda não encerrado). Sempre fecha em partidas dobradas.
  function balanco(ate){
    const ativo=soma('ativo',null,ate),passivo=soma('passivo',null,ate),pl=soma('pl',null,ate),res=soma('receita',null,ate)-soma('deducao',null,ate)-soma('despesa',null,ate);
    return {ativo:reais(ativo),passivo:reais(passivo),patrimonioLiquido:reais(pl),resultadoNaoEncerrado:reais(res),totalPassivoPL:reais(passivo+pl+res),fecha:ativo===passivo+pl+res}}
  // Encerramento do exercício: zera receitas, deduções e despesas contra lucros ou prejuízos acumulados
  function encerra(ano){const f=`${ano}-12-31`,s=saldos(`${ano}-01-01`,f),ps=[];let res=0;
    for(const [k,v] of Object.entries(s)){const c=CONTA[k];if(!['receita','deducao','despesa'].includes(c.grupo))continue;const sal=v.d-v.c;if(!sal)continue;
      ps.push(sal>0?{conta:k,c:reais(sal)}:{conta:k,d:reais(-sal)});res+=-sal}
    if(!ps.length)return null;ps.push(res>=0?{conta:'2.3.2.01',c:reais(res)}:{conta:'2.3.2.01',d:reais(-res)});
    return lanca({data:f,historico:'Encerramento do exercício '+ano,partidas:ps,origem:'encerramento'})}
  // Lucro contábil disponível para distribuição: lucros acumulados + resultado do exercício − distribuídos
  function lucroDisponivel(ate){return Math.round((saldoConta('2.3.2.01',ate)+reais(soma('receita',null,ate)-soma('deducao',null,ate)-soma('despesa',null,ate))-saldoConta('2.3.3.01',ate))*100)/100}

  // ===== geradores automáticos (cada um devolve o(s) lançamento(s) criado(s))
  const g={
    capital:(data,v)=>lanca({data,historico:'Integralização de capital social',origem:'capital',partidas:[{conta:'1.1.1.02',d:v},{conta:'2.3.1.01',c:v}]}),
    notaEmitida:(data,v,ref)=>lanca({data,historico:'Nota fiscal de serviço '+(ref||''),origem:'nota',ref,partidas:[{conta:'1.1.2.01',d:v},{conta:'3.1.1.03',c:v}]}),
    recebimento:(data,v,ref)=>lanca({data,historico:'Recebimento de cliente '+(ref||''),origem:'banco',ref,partidas:[{conta:'1.1.1.02',d:v},{conta:'1.1.2.01',c:v}]}),
    // despesa paga na hora: código P10 do app ou conta direta
    despesaPaga:(data,v,contaOuP10,hist)=>{const conta=CONTA[contaOuP10]?contaOuP10:contaDeP10(contaOuP10);if(!conta)throw new Error('despesa sem conta no plano: '+contaOuP10);
      return lanca({data,historico:hist||CONTA[conta].nome,origem:'despesa',partidas:[{conta,d:v},{conta:'1.1.1.02',c:v}]})},
    // DAS: apuração na competência (dedução da receita) e pagamento
    dasApurado:(data,v,comp)=>lanca({data,historico:'Simples Nacional da competência '+comp,origem:'das',ref:comp,partidas:[{conta:'3.1.2.01',d:v},{conta:'2.1.2.01',c:v}]}),
    dasPago:(data,v,comp)=>lanca({data,historico:'Pagamento do DAS '+comp,origem:'das',ref:comp,partidas:[{conta:'2.1.2.01',d:v},{conta:'1.1.1.02',c:v}]}),
    // pró-labore: bruto, INSS retido (11%) e IRRF; o líquido fica a pagar
    proLabore:(data,bruto,inss,irrf,comp)=>{const liq=Math.round((bruto-inss-irrf)*100)/100,ps=[{conta:'3.2.1.01.001',d:bruto},{conta:'2.1.3.02',c:liq}];if(inss>0)ps.push({conta:'2.1.2.02',c:inss});if(irrf>0)ps.push({conta:'2.1.2.03',c:irrf});
      return lanca({data,historico:'Pró-labore '+comp,origem:'prolabore',ref:comp,partidas:ps})},
    pagamentoProLabore:(data,v)=>lanca({data,historico:'Pagamento de pró-labore',origem:'banco',partidas:[{conta:'2.1.3.02',d:v},{conta:'1.1.1.02',c:v}]}),
    recolheINSS:(data,v)=>lanca({data,historico:'Recolhimento de INSS',origem:'guia',partidas:[{conta:'2.1.2.02',d:v},{conta:'1.1.1.02',c:v}]}),
    recolheIRRF:(data,v)=>lanca({data,historico:'Recolhimento de IRRF',origem:'guia',partidas:[{conta:'2.1.2.03',d:v},{conta:'1.1.1.02',c:v}]}),
    // folha de um empregado a partir do resultado de calculaFolha (folha.js)
    folha:(data,r,comp)=>{if(!r||!r.ok)throw new Error('folha inválida: não lança');
      // 26/11/2026: fecha as contas com TODOS os descontos da folha (faltas reduzem a despesa; pensão, consignado, adiantamento e outros vão para o passivo/ativo certo). Antes, faltas e outros descontos deixavam o lançamento desequilibrado.
      const R=x=>Math.round((+x+Number.EPSILON)*100)/100,Ds=r.descontos||[],som=f=>R(Ds.filter(f).reduce((s,x)=>s+x.valor,0));
      const faltas=som(x=>['101','102','103','104'].includes(x.cod)),pen=som(x=>x.cod==='140'),con=som(x=>x.cod==='141'),adi=som(x=>x.cod==='150'),adIR=-som(x=>x.cod==='151');
      const inssRetro=som(x=>x.cod==='112'),irRRA=som(x=>x.cod==='122'),outros=som(x=>!['101','102','103','104','110','112','120','122','130','140','141','150','151'].includes(x.cod));
      const sal=R(r.totalProventos-r.salarioFamilia-faltas),ps=[{conta:'3.2.1.01.002',d:sal},{conta:'2.1.3.01',c:r.liquido}];
      if(r.salarioFamilia>0)ps.push({conta:'1.1.3.01',d:r.salarioFamilia});if(r.inss+inssRetro>0)ps.push({conta:'2.1.2.02',c:R(r.inss+inssRetro)});const irr=R(r.irrf+irRRA-adIR);if(irr>0)ps.push({conta:'2.1.2.03',c:irr});if(r.vt>0)ps.push({conta:'3.2.1.01.005',c:r.vt});
      if(pen>0)ps.push({conta:'2.1.3.06',c:pen});if(con>0)ps.push({conta:'2.1.3.07',c:con});if(adi>0)ps.push({conta:'1.1.4.01',c:adi});if(outros>0)ps.push({conta:'2.1.3.08',c:outros});
      const a=lanca({data,historico:'Folha '+comp,origem:'folha',ref:comp,partidas:ps});
      const b=r.fgts>0?lanca({data,historico:'FGTS da folha '+comp,origem:'folha',ref:comp,partidas:[{conta:'3.2.1.01.003',d:r.fgts},{conta:'2.1.2.04',c:r.fgts}]}):null;return [a,b].filter(Boolean)},
    // adiantamento salarial pago no meio do mês (bruto v; irRetido só no avulso com IR): D adiantamentos a empregados, C banco e IRRF a recolher
    adiantamentoPago:(data,v,irRetido=0)=>lanca({data,historico:'Adiantamento salarial',origem:'banco',partidas:[{conta:'1.1.4.01',d:v},{conta:'1.1.1.02',c:Math.round((v-irRetido)*100)/100}].concat(irRetido>0?[{conta:'2.1.2.03',c:irRetido}]:[])}),
    repassePensao:(data,v)=>lanca({data,historico:'Repasse de pensão alimentícia',origem:'banco',partidas:[{conta:'2.1.3.06',d:v},{conta:'1.1.1.02',c:v}]}),
    repasseConsignado:(data,v)=>lanca({data,historico:'Repasse de consignado ao banco',origem:'banco',partidas:[{conta:'2.1.3.07',d:v},{conta:'1.1.1.02',c:v}]}),
    pagamentoFolha:(data,v)=>lanca({data,historico:'Pagamento de salários',origem:'banco',partidas:[{conta:'2.1.3.01',d:v},{conta:'1.1.1.02',c:v}]}),
    recolheFGTS:(data,v)=>lanca({data,historico:'FGTS Digital',origem:'guia',partidas:[{conta:'2.1.2.04',d:v},{conta:'1.1.1.02',c:v}]}),
    // provisão mensal de férias (1/12 + 1/3) e 13º (1/12) sobre a base, com FGTS sobre elas
    provisoes:(data,baseFGTS,fgtsPct,comp)=>{const fer=Math.round(baseFGTS/12*4/3*100)/100,d13=Math.round(baseFGTS/12*100)/100,fg=Math.round((fer+d13)*fgtsPct*100)/100;
      return lanca({data,historico:'Provisão de férias, 13º e FGTS '+comp,origem:'provisao',ref:comp,partidas:[{conta:'3.2.1.01.004',d:Math.round((fer+d13+fg)*100)/100},{conta:'2.1.3.03',c:fer},{conta:'2.1.3.04',c:d13},{conta:'2.1.3.05',c:fg}]})},
    distribuiLucros:(data,v)=>{const disp=lucroDisponivel(data);if(v>disp+0.005)throw new Error('distribuição de R$ '+v+' acima do lucro contábil disponível (R$ '+disp+'): o excedente não é isento sem lucro escriturado');
      return lanca({data,historico:'Distribuição de lucros',origem:'lucros',partidas:[{conta:'2.3.3.01',d:v},{conta:'1.1.1.02',c:v}]})},
    imobilizado:(data,v,desc)=>lanca({data,historico:'Aquisição: '+(desc||'equipamento'),origem:'imobilizado',partidas:[{conta:'1.2.1.01',d:v},{conta:'1.1.1.02',c:v}]}),
    depreciacao:(data,v,comp)=>lanca({data,historico:'Depreciação '+comp,origem:'depreciacao',ref:comp,partidas:[{conta:'3.2.2.05.003',d:v},{conta:'1.2.1.99',c:v}]})
  };
  return {lanca,lancamentos:()=>L.slice(),saldos,saldoConta,balancete,dre,balanco,encerra,lucroDisponivel,gera:g,razao:(conta,de,ate)=>{let s=0;const nat=CONTA[conta].natureza;
    return entre(de,ate).flatMap(l=>l.partidas.filter(p=>p.conta===conta).map(p=>{s+=nat==='D'?p.d-p.c:p.c-p.d;return {data:l.data,historico:l.historico,debito:reais(p.d),credito:reais(p.c),saldo:reais(s)}}))}}}

if(typeof module!=='undefined')module.exports={PLANO,CONTA,criaLivro,contaDeP10,DE_PARA_P10};
