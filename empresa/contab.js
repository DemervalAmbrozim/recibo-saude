// Contabilidade PJ da saúde (protótipo, 17/11/2026): cálculos do onboarding, do Simples (Anexo III/V pelo Fator R), da folha de até 3 empregados,
// do calendário fiscal, da abertura do CNPJ e dos alertas ao contador. Depende de regras.js (carneLeao, A3, SM, TETO, ultimoDiaUtil, dISO).
// ESTIMATIVAS para a profissional se organizar; quem apura, assina e transmite é o contador responsável (CRC). Nada aqui é promessa de economia.
// Fontes lidas: LC 123/2006 art. 3º, 18 §5º-B XVI/XIX/XX/XXI e §5º-M (Anexo III; abaixo de 28% de folha, Anexo V), art. 26 §2º; CGSN art. 6º §5º I (opção
// pelo Simples: 30 dias do último deferimento, no máximo 60 dias da abertura do CNPJ). Ver projeto/contabilidade-pj-conferencia-oficial-2026-11-16.md.

// ATENÇÃO: tabelas dos Anexos III e V e base do Fator R VIGENTES EM 2026. A Res. CGSN 190/2026 reescreve os Anexos I a V e muda o Fator R a partir de 2027, e a DEFIS é substituída por informações dentro do PGDAS-D (art. 72 revogado em 01/01/2027): ATUALIZAR antes de 01/01/2027.
const A5=[[180e3,.155,0],[360e3,.18,4500],[720e3,.195,9900],[1.8e6,.205,17100],[3.6e6,.23,62100],[4.8e6,.305,540000]]; // Anexo V, LC 155/2016 (igual a ferramentas/das.py)
const LIM_ME=360e3, LIM_EPP=4.8e6;
// INSS do empregado 2026 (progressivo; teto = TETO de regras.js): faixas sobre o salário mínimo e o teto da Portaria MPS/MF 13/2026
const INSS_EMP=[[1621,.075],[2902.84,.09],[4354.27,.12],[8475.55,.14]];
const DEP_IR=189.59;           // dedução por dependente, IRRF mensal
const HONORARIO={0:299,1:349,2:399,3:449}; // faixa SUGERIDA (pesquisa 16/11, projeto/contabilidade-pj-pesquisa-precos-folha): é estimativa, não preço fechado
const r2c=x=>Math.round(x*100)/100;

function efetivaAnexo(tab,rbt){const f=tab.find(x=>rbt<=x[0])||tab[tab.length-1];return rbt>0?Math.max(0,(rbt*f[1]-f[2])/rbt):tab[0][1]}

// Anexo III se folha de 12 meses ÷ receita de 12 meses >= 28%; senão Anexo V (LC 123 art. 18 §5º-M). Pró-labore entra na folha (§24).
function anexoSaude(rbt12,folha12){const fr=rbt12>0?folha12/rbt12:0,anexo=fr>=.28?'III':'V';
  const ef=efetivaAnexo(anexo==='III'?A3:A5,rbt12);
  return {fatorR:r2c(fr*10000)/10000,anexo,efetiva:ef,porte:rbt12>LIM_EPP?'acima do Simples':rbt12>LIM_ME?'EPP':'ME',perto:rbt12>.8*LIM_ME&&rbt12<=LIM_ME?'perto do limite de ME (80%)':null}}

function inssEmpregado(sal){let t=0,ant=0;for(const [teto,al] of INSS_EMP){if(sal>ant)t+=(Math.min(sal,teto)-ant)*al;ant=teto}return r2c(t)}

// Holerite estimado. Simples Anexos I a III: sem INSS patronal (CPP no DAS) [LC 123 art. 13 VI; fora só o Anexo IV]; FGTS 8%.
function holerite(sal,{dependentes=0,vt=0}={}){const inss=inssEmpregado(sal),ir=carneLeao(sal,inss+dependentes*DEP_IR).devido;
  const vtd=Math.min(r2c(.06*sal),+vt||0),fgts=r2c(.08*sal),liquido=r2c(sal-inss-ir-vtd);
  // custo mensal médio com 13º e férias (+1/3) provisionados e FGTS sobre eles; vale-transporte pago pela empresa só na parte acima dos 6%
  const prov=sal/12+sal/12*4/3,custo=r2c(sal+fgts+prov+.08*prov+Math.max(0,(+vt||0)-vtd));
  return {salario:sal,inss,ir,vtDesconto:vtd,liquido,fgts,custoMensal:custo}}

// Simulação PJ x PF para a mesma receita. emp = [{salario}]. proLabore = null: o app propõe o menor que fecha o Fator R de 28%.
function simulaPJ({receita,despesas=0,emp=[],proLabore=null}){
  const R=+receita||0,rbt=R*12,folhaEmp=emp.reduce((s,e)=>s+e.salario*1.08,0); // salário + FGTS
  const alvo=Math.max(SM,r2c(.28*R-folhaEmp));
  const P=proLabore==null?(R>0?alvo:0):+proLabore;
  const fr=anexoSaude(rbt,12*(P+folhaEmp)),das=r2c(R*fr.efetiva);
  const inssP=r2c(.11*Math.min(P,TETO)),irP=P?carneLeao(P,inssP).devido:0,n=Math.min(emp.length,3);
  const contador=HONORARIO[n]-(emp.length?0:0);
  const folha=emp.map(e=>holerite(e.salario)),custoFolha=r2c(folha.reduce((s,h)=>s+h.custoMensal,0));
  const pjImp=r2c(das+inssP+irP),pjLiquido=r2c(R-despesas-pjImp-contador-custoFolha);
  // PF: INSS no plano simplificado (11% do salário mínimo) + Carnê-Leão com livro-caixa; sem contador e sem DAS. ISS e outras diferenças ficam de fora.
  const inssPF=r2c(.11*SM),clPF=carneLeao(R,despesas+inssPF).devido,pfImp=r2c(inssPF+clPF),pfLiquido=r2c(R-despesas-pfImp-custoFolha);
  return {receita:R,rbt12:rbt,proLabore:P,proLaboreAlvo:alvo,fatorR:fr.fatorR,anexo:fr.anexo,porte:fr.porte,perto:fr.perto,das,efetiva:fr.efetiva,inssP,irP,
    contador,custoFolha,folha,pj:{impostos:pjImp,liquido:pjLiquido},pf:{impostos:pfImp,liquido:pfLiquido},diferenca:r2c(pjLiquido-pfLiquido),
    aviso:'Estimativa com os números informados. Fica de fora o ISS fixo da pessoa física, o cartão e outras diferenças; o contador confirma.'}}

// Prazo da opção pelo Simples para empresa nova: 30 dias do último deferimento (municipal ou estadual), no máximo 60 dias da abertura do CNPJ.
function prazoOpcaoSimples(abertura,deferimento){const d=s=>new Date(s+'T12:00:00'),mais=(x,n)=>{const y=new Date(x);y.setDate(y.getDate()+n);return dISO(y)};
  const a=mais(d(abertura),60),b=deferimento?mais(d(deferimento),30):a;return b<a?b:a}

// Custos públicos do 1º ano (projeto/custos-abertura-es-2026.md). null = não confirmado: aparece como "a confirmar", nunca como número inventado.
const JUNTA=437.43, A1=[150,300];
const CONSELHO={psicologia:{n:'CRP-16',v:238.49+95.39,fonte:'Res. CRP-16 001/2026'},fisioterapia:{n:'CREFITO-15',v:293+95,fonte:'página do CREFITO-15 (ano não informado; confirmar)'},
  'terapia ocupacional':{n:'CREFITO-15',v:293+95,fonte:'idem'}};
const ALVARA={vitoria:{v:498.62,nota:'valor não confirmado em 2026; pode haver dispensa por baixo risco (Decreto 17.876)'},'vila velha':{v:0,nota:'dispensado se baixo risco A; conferir o CNAE'},
  serra:{v:null,nota:'sem valor publicado'},cariacica:{v:null,nota:'a levantar'}};
function custosAbertura(cidade,profissao){const al=ALVARA[String(cidade||'').toLowerCase()]||{v:null,nota:'cidade fora do levantamento'},cs=CONSELHO[String(profissao||'').toLowerCase()];
  const itens=[{n:'Junta Comercial (JUCEES)',v:JUNTA,nota:'tabela oficial 2026'},{n:'Alvará',v:al.v,nota:al.nota},
    {n:'Registro da empresa no conselho'+(cs?' ('+cs.n+')':''),v:cs?r2c(cs.v):null,nota:cs?cs.fonte:'a levantar'},{n:'Certificado digital A1',v:null,faixa:A1,nota:'preço de mercado, vale 1 ano'}];
  const fixo=itens.reduce((s,i)=>s+(i.v||0),0),pend=itens.filter(i=>i.v==null&&!i.faixa).length;
  return {itens,min:r2c(fixo+A1[0]),max:r2c(fixo+A1[1]),pendentes:pend,txt:'faixa estimada; o valor exato é mostrado antes da contratação'}}

// Passos da abertura (projeto/checklist-abertura-cnpj-saude-2026-11-16.md). dono: contador | cliente | app. depende: ids que precisam estar feitos.
const PASSOS=[[0,'Contrato e proposta assinados','contador',[]],[1,'Viabilidade: nome, endereço e CNAE','contador',[0]],[2,'Tipo (SLU) e contrato social','contador',[1]],
  [3,'Protocolo na Junta (JUCEES)','contador',[2]],[4,'CNPJ e inscrição municipal','contador',[3]],[5,'Opção pelo Simples Nacional (prazo duro)','contador',[4]],
  [6,'Alvará de funcionamento','cliente',[4]],[7,'Vigilância Sanitária e CNES (se atender no consultório)','cliente',[6]],[8,'Registro da empresa no conselho','cliente',[4,6]],
  [9,'Certificado A1 (com emissão assistida, se quiser) e procurações no e-CAC','contador',[4]],[10,'Conta bancária PJ','cliente',[4]],[11,'NFS-e: habilitar e emitir a nota de teste','app',[4,5,9]],
  [12,'Transição PF para PJ (baixa de autônoma, avisar pagadores)','app',[5,11]],[13,'Pró-labore definido pelo Fator R e cadastro no eSocial','contador',[5,9]],
  [14,'Empregado: admissão e eSocial (se houver)','contador',[13]],[15,'Calendário fiscal ligado e 1º relatório mensal','app',[5,13]],[16,'Reunião de entrega','app',[15]]]
  .map(([id,titulo,dono,depende])=>({id,titulo,dono,depende}));
function proximosPassos(feitos){const f=new Set(feitos||[]);return PASSOS.filter(p=>!f.has(p.id)&&p.depende.every(d=>f.has(d)))}

// Calendário fiscal de 12 meses a partir de `de` (aaaa-mm). folha: tem empregado. O dia 20 não é antecipado nem adiado aqui: confirmar com o contador.
function calendario(de,{folha=false,proLabore=true,abertura=null}={}){const [a0,m0]=de.split('-').map(Number),ev=[],add=(data,titulo,tipo,critico)=>ev.push({data,titulo,tipo,critico:!!critico});
  for(let k=0;k<12;k++){const t=new Date(a0,m0-1+k,1),a=t.getFullYear(),m=t.getMonth(),mm=String(m+1).padStart(2,'0'),n=new Date(a,m+1,1),an=n.getFullYear(),mn=String(n.getMonth()+1).padStart(2,'0');
    add(`${an}-${mn}-20`,'DAS do Simples (competência '+mm+'/'+a+')','fiscal',true);
    if(proLabore)add(`${an}-${mn}-20`,'INSS do pró-labore','fiscal');
    if(folha){add(`${an}-${mn}-15`,'eSocial: fechamento da folha','pessoal',true);add(`${an}-${mn}-20`,'FGTS Digital','pessoal',true)}
    if(m===10&&folha)add(`${a}-11-30`,'13º salário, 1ª parcela','pessoal');
    if(m===11&&folha)add(`${a}-12-20`,'13º salário, 2ª parcela','pessoal');
    if(m===11)add(`${a}-12-10`,'Planejar o pró-labore do próximo ano (Fator R)','planejamento');
    if(m===1)add(dISO(ultimoDiaUtil(a,1)),'DMED (último dia útil de fevereiro)','anual',true);
    if(m===2)add(`${a}-03-31`,'DEFIS do Simples (conferir a transição para o PGDAS-D em 2027)','anual',true);
    if(m===3)add(`${a}-04-30`,'IRPF dos sócios (confirmar o prazo do ano)','anual')}
  if(abertura)add(prazoOpcaoSimples(abertura,null),'Último dia para a opção pelo Simples (60 dias da abertura)','fiscal',true);
  const lo=de+'-01',hi=dISO(new Date(a0,m0-1+13,0));
  return ev.filter(e=>e.data>=lo&&e.data<=hi).sort((x,y)=>x.data<y.data?-1:x.data>y.data?1:x.titulo.localeCompare(y.titulo))}

// Alertas ao contador (tabela da §5 do onboarding). r = respostas do questionário.
function alertas(r){const L=[],add=(nivel,txt)=>L.push({nivel,txt});
  if(r.servidor)add('atenção','Servidor público ou outro vínculo: revisar impedimento e ética antes de abrir.');
  if(r.conselhoPendente)add('atenção','Registro no conselho pendente: resolver antes de abrir como PJ.');
  if(r.pendencia)add('atenção','Dívida ou pendência fiscal informada: levantar a situação antes de abrir ou migrar.');
  if((+r.rbtPrevisto||0)>.8*LIM_ME&&(+r.rbtPrevisto||0)<=LIM_ME)add('atenção','Receita prevista acima de 80% do limite de ME: planejar o sublimite.');
  if((+r.rbtPrevisto||0)>LIM_ME)add('atenção','Receita prevista acima de R$ 360 mil: enquadramento como EPP e faixas maiores do DAS.');
  if((+r.rbtPrevisto||0)>LIM_EPP)add('crítico','Receita prevista acima de R$ 4,8 milhões: fora do Simples.');
  if((+r.empregados||0)>3)add('atenção','Mais de 3 empregados: fora do escopo do pacote; orçamento à parte.');
  if(r.local==='consultorio'||r.local==='sala')add('atenção','Atendimento presencial: PGR/PCMSO costumam ser obrigatórios (a dispensa não vale com agente biológico); VISA e CNES conforme o município.');
  if(r.cnpjAberto&&!r.optouSimples&&r.diasAbertura!=null&&r.diasAbertura<=60)add('crítico','CNPJ aberto sem a opção pelo Simples e ainda dentro dos 60 dias: fazer a opção hoje.');
  if(r.regime==='mei')add('crítico','MEI: nenhuma profissão de saúde regulamentada cabe no MEI (Anexo XI); desenquadrar com o contador.');
  if(r.contadorAnterior)add('atenção','Há contabilidade anterior ativa: formalizar o distrato e pedir os documentos.');
  if(r.govBronze)add('atenção','gov.br nível bronze: subir para prata ou ouro para a procuração e o e-CAC.');
  if(r.convenio)add('atenção','Convênio ou repasse de clínica: verificar retenções e cadastro no CNES.');
  return L}

// Fator R mês a mês (12 meses móveis): avisa quando o Anexo muda, para o contador ajustar o pró-labore.
function fatorRMovel(hist){const out=[];for(let i=11;i<hist.length;i++){const j=hist.slice(i-11,i+1),r=j.reduce((s,x)=>s+x.receita,0),f=j.reduce((s,x)=>s+x.folha,0);
  out.push({mes:hist[i].mes,...anexoSaude(r,f)})}return out}

if(typeof module!=='undefined')module.exports={anexoSaude,inssEmpregado,holerite,simulaPJ,prazoOpcaoSimples,custosAbertura,PASSOS,proximosPassos,calendario,alertas,fatorRMovel};
