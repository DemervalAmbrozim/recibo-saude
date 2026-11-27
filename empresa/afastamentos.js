// Folha própria, fase F6 (17/11/2026): AFASTAMENTOS E SST (faltas, atestado, doença, maternidade, paternidade, estabilidade, CAT, exames ocupacionais, PGR/PCMSO).
// Para empresa de saúde no Simples com até 3 empregados CLT. Fonte × estado de cada regra: projeto/afastamentos-f6-fontes-2026-11-17.md.
// ESTIMATIVA: o contador confere. Convenção: texto de lei que foi LIDO no Planalto/gov.br nesta fase vem sem marca; o que não foi lido no texto oficial vem "conferir".
// Não faz diagnóstico, não decide perícia, não promete resultado: calcula prazos e valores e levanta alertas em português simples.
// Cada função devolve { ok, erros[] , ... }: ok=false quando a entrada é inválida (data inexistente, fim antes do início, salário <= 0).

const r2a=x=>Math.round((x+Number.EPSILON)*100)/100;
const AVISO='Estimativa; o contador confere.';
const MS=86400000;
// Datas 'AAAA-MM-DD' em UTC, estritas: 2026-02-30 é inválida.
const parseD=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const [a,m,d]=s.split('-').map(Number),x=new Date(Date.UTC(a,m-1,d));return(x.getUTCFullYear()===a&&x.getUTCMonth()===m-1&&x.getUTCDate()===d)?x:null};
const isoD=d=>d.toISOString().slice(0,10);
const somaD=(iso,n)=>isoD(new Date(parseD(iso).getTime()+n*MS));
const entreD=(a,b)=>Math.round((parseD(b)-parseD(a))/MS); // b - a em dias
const ultDiaMes=(a,m)=>new Date(Date.UTC(a,m+1,0)).getUTCDate();
const addMesesD=(iso,n)=>{const d=parseD(iso),a=d.getUTCFullYear(),m=d.getUTCMonth()+n,aa=a+Math.floor(m/12),mm=((m%12)+12)%12;return isoD(new Date(Date.UTC(aa,mm,Math.min(d.getUTCDate(),ultDiaMes(aa,mm)))))};
const diaSemana=iso=>parseD(iso).getUTCDay(); // 0=domingo
const segundaDaSemana=iso=>somaD(iso,-((diaSemana(iso)+6)%7));
const falha=(...e)=>({ok:false,erros:e});
const numPos=x=>typeof x==='number'&&isFinite(x)&&x>0;
function validaPeriodo(inicio,fim,erros,rot='período'){const a=parseD(inicio),b=parseD(fim);if(!a)erros.push(`${rot}: data de início inválida (use AAAA-MM-DD)`);if(!b)erros.push(`${rot}: data de fim inválida (use AAAA-MM-DD)`);if(a&&b&&b<a)erros.push(`${rot}: o fim é antes do início`)}

// ===== 1. FALTAS JUSTIFICADAS E ATESTADO =====
// CLT art. 473 (ausência sem prejuízo do salário). CONFERIDO em 17/11/2026 no texto atualizado da CLT na Câmara dos Deputados (auditoria externa): incisos I a XII conforme abaixo. Antes desta conferência a lista vinha de fontes secundárias; resto do comentário antigo: contador abrir o texto oficial.
// Contagem de dias do art. 473: o app registra o número de dias da lei; quem decide dia corrido ou útil é o contador (conferir).
const MOTIVOS_FALTA={
  falecimento:{dias:2,inciso:'I',texto:'Falecimento de cônjuge, ascendente, descendente, irmão ou pessoa declarada na CTPS (dependente econômica)'},
  casamento:{dias:3,inciso:'II',texto:'Casamento do empregado'},
  nascimento_filho:{dias:5,inciso:'III',texto:'Nascimento de filho (licença-paternidade, 5 dias até 31/12/2026; mudança a partir de 2027: ver licencaPaternidade)'},
  doacao_sangue:{dias:1,inciso:'IV',texto:'Doação voluntária de sangue devidamente comprovada: 1 dia a cada 12 meses'},
  alistamento_eleitoral:{dias:2,inciso:'V',texto:'Alistamento eleitoral: até 2 dias, consecutivos ou não'},
  servico_militar:{dias:null,inciso:'VI',texto:'Exigências do serviço militar: pelo período necessário'},
  vestibular:{dias:null,inciso:'VII',texto:'Provas de vestibular para ingresso em ensino superior: nos dias das provas'},
  juizo:{dias:null,inciso:'VIII',texto:'Comparecimento a juízo: pelo tempo necessário'},
  acompanhar_gestante:{dias:null,inciso:'X',texto:'Acompanhar esposa ou companheira grávida: pelo tempo necessário, em até 6 consultas médicas ou exames complementares'},
  consulta_filho:{dias:1,inciso:'XI',texto:'Acompanhar filho de até 6 anos em consulta médica: 1 dia por ano'},
  exame_preventivo_cancer:{dias:3,inciso:'XII',texto:'Exames preventivos comprovados: até 3 dias, a cada 12 meses de trabalho (o texto lido cortou antes do complemento "de câncer": conferir a redação final do inciso)'},
  atestado_medico:{dias:null,inciso:null,texto:'Atestado médico: falta justificada; até 15 dias a empresa paga, depois o INSS (ver afastamentoDoenca)'}
};
function faltaJustificada(motivo){
  if(typeof motivo!=='string'||!motivo.trim())return falha('informe o motivo da falta');
  const m=MOTIVOS_FALTA[motivo.trim()];
  if(!m)return{ok:true,erros:[],justificada:null,motivo,dias:null,texto:'Motivo não está na lista do art. 473; sem previsão legal, a falta é injustificada, salvo abono do empregador ou norma coletiva (o contador decide).',conferir:true,fonte:'CLT art. 473 (conferir texto oficial)',aviso:AVISO};
  return{ok:true,erros:[],justificada:true,motivo,dias:m.dias,inciso:m.inciso,texto:m.texto,conferir:false,fonte:'CLT art. 473'+(m.inciso?', inciso '+m.inciso:'')+' (texto da CLT atualizada na Câmara, conferido em 17/11/2026)',aviso:AVISO};
}
// Férias e faltas injustificadas (CLT art. 130): inciso I (30 dias se até 5 faltas) LIDO no Planalto; os demais valores (24/18/12) conferir.
function diasFeriasPorFaltas(faltasInjustificadas){
  const n=faltasInjustificadas;if(!Number.isInteger(n)||n<0)return falha('número de faltas injustificadas inválido');
  const dias=n<=5?30:n<=14?24:n<=23?18:n<=32?12:0;
  return{ok:true,erros:[],dias,conferir:n>5,fonte:'CLT art. 130 (inciso I lido; II a IV conferir)'};
}
// Desconto de falta injustificada de mensalista: dia = salário/30 por falta + descontar o DSR da semana em que houve falta (Lei 605/1949, art. 6º: caput e §1º/§2º LIDOS no Planalto em 18/11/2026; o repouso não é devido quando, sem motivo justificado, o empregado não cumpre integralmente o horário da semana anterior; são justificados os motivos do art. 473 da CLT, a ausência abonada pela empresa, a falta por acidente de trabalho e a doença comprovada).
// Falta justificada (atestado, art. 473) não desconta nem perde DSR. Se vierem as datas das faltas, o DSR é contado por semana (seg-dom) com falta; sem datas, supõe uma semana por falta (valor máximo) e avisa.
function calculaAtestado(o={}){
  const {salario,dias=0,faltasInjustificadas=0,datasFaltasInjustificadas=null,inicio=null}=o,e=[];
  if(!numPos(salario))e.push('salário deve ser maior que zero');
  if(!Number.isInteger(dias)||dias<0)e.push('dias de atestado inválidos');
  if(!Number.isInteger(faltasInjustificadas)||faltasInjustificadas<0)e.push('faltas injustificadas inválidas');
  if(inicio!==null&&!parseD(inicio))e.push('data de início do atestado inválida');
  let semanas=null;
  if(Array.isArray(datasFaltasInjustificadas)){
    if(datasFaltasInjustificadas.some(d=>!parseD(d)))e.push('data de falta injustificada inválida');
    else{if(datasFaltasInjustificadas.length!==faltasInjustificadas)e.push('quantidade de datas diferente do número de faltas');else semanas=new Set(datasFaltasInjustificadas.map(segundaDaSemana)).size}
  }
  if(e.length)return falha(...e);
  const valorDia=r2a(salario/30);
  const dsr=semanas!==null?semanas:faltasInjustificadas;
  const descFalta=r2a(valorDia*faltasInjustificadas),descDSR=r2a(Math.min(valorDia*dsr,Math.max(0,salario-descFalta)));
  const avisos=[AVISO];
  if(semanas===null&&faltasInjustificadas>0)avisos.push('Sem as datas das faltas, o desconto do DSR foi calculado no máximo (1 por falta); informe as datas para ficar exato.');
  if(dias>15)avisos.push('Atestado acima de 15 dias: a empresa paga só os 15 primeiros e o INSS paga do 16º dia (Lei 8.213, art. 60); use afastamentoDoenca.');
  const f=diasFeriasPorFaltas(faltasInjustificadas);
  return{ok:true,erros:[],valorDia,diasAtestado:dias,descontoAtestado:0,diasPagosEmpresa:Math.min(dias,15),faltasInjustificadas,semanasComFalta:dsr,descontoFaltas:descFalta,descontoDSR:descDSR,descontoTotal:r2a(descFalta+descDSR),diasFerias:f.dias,fontes:['CLT art. 473 (conferir)','Lei 605/1949 art. 6º (conferir)','CLT art. 130 (I lido)'],avisos};
}

// ===== 2. AFASTAMENTO POR DOENÇA =====
// Lei 8.213/1991, art. 59 (incapacidade por mais de 15 dias consecutivos), art. 60 (devido ao empregado a contar do 16º dia; empresa paga os 15 primeiros dias) e art. 63 (empregado em gozo de benefício é considerado licenciado): LIDOS no Planalto.
// Nova incapacidade pela MESMA doença em até 60 dias: soma dos períodos (Decreto 3.048/1999, art. 75, §3º e §4º, lidos no Planalto em 17/11/2026: §3º conta os 60 dias da cessação do BENEFÍCIO anterior; §4º, quando a pessoa voltou no 16º dia, conta da data do RETORNO; a lei fala em 'mesmo motivo que gerou a incapacidade'. O termo final (dia 60 incluído ou não) não tem texto lido. Aqui contam do dia seguinte ao fim do período anterior e 60 dias exatos ainda somam).
//  - se o período anterior já passou de 15 dias (INSS pagou), o INSS paga do 1º dia do novo afastamento;
//  - se o anterior (ou a cadeia) usou menos de 15 dias, a empresa paga só o que falta para completar 15.
function afastamentoDoenca(o={}){
  const {inicio,fim,salario,afastamentosAnteriores=[],mesmaDoenca=true,acidenteTrabalho=false}=o,e=[];
  validaPeriodo(inicio,fim,e,'afastamento');
  if(!numPos(salario))e.push('salário deve ser maior que zero');
  if(!Array.isArray(afastamentosAnteriores))e.push('afastamentosAnteriores deve ser uma lista');
  else afastamentosAnteriores.forEach((p,i)=>{const t=[];validaPeriodo(p&&p.inicio,p&&p.fim,t,'afastamento anterior '+(i+1));e.push(...t);if(p&&parseD(p.inicio)&&parseD(inicio)&&parseD(p.fim)&&parseD(p.fim)>=parseD(inicio))e.push('afastamento anterior '+(i+1)+' termina depois do início do novo')});
  if(e.length)return falha(...e);
  const diasTotais=entreD(inicio,fim)+1,avisos=[];
  let somaAnterior=false,diasConsumidos=0,anteriorEncadeado=null;
  if(mesmaDoenca&&afastamentosAnteriores.length){
    const ord=afastamentosAnteriores.slice().sort((a,b)=>parseD(b.fim)-parseD(a.fim));
    let refInicio=inicio,cadeia=[];
    for(const p of ord){const gap=entreD(somaD(p.fim,1),refInicio);if(gap<=60){cadeia.push(p);refInicio=p.inicio}else break}
    if(cadeia.length){somaAnterior=true;anteriorEncadeado=cadeia[0];diasConsumidos=cadeia.reduce((s,p)=>s+entreD(p.inicio,p.fim)+1,0);avisos.push(`Mesma doença em até 60 dias: soma com ${cadeia.length} afastamento(s) anterior(es) (${diasConsumidos} dia(s)). Conferir a regra e a CID com o contador (Decreto 3.048, art. 75).`)}
  }
  const restanteEmpresa=Math.max(0,15-diasConsumidos);
  const diasEmpresa=Math.min(diasTotais,restanteEmpresa);
  const diasInss=diasTotais-diasEmpresa;
  const inicioInss=diasInss>0?somaD(inicio,diasEmpresa):null;
  const valorEmpresa=r2a(salario/30*diasEmpresa);
  if(inicioInss)avisos.push(`A partir de ${inicioInss} o INSS paga o benefício (auxílio por incapacidade temporária): o empregado precisa ter perícia agendada no INSS (Meu INSS ou 135).`);
  if(!acidenteTrabalho&&diasInss>0)avisos.push('Afastamento acima de 15 dias por doença comum: conferir carência (12 contribuições, salvo exceções) no INSS.');
  const feriasPerde=diasInss>180;
  if(feriasPerde)avisos.push('Mais de 6 meses recebendo benefício do INSS no período aquisitivo: pode perder o direito às férias (CLT art. 133, IV); o contador confere o período aquisitivo.');
  avisos.push(AVISO);
  return{ok:true,erros:[],diasTotais,diasEmpresa,valorEmpresa,inicioInss,diasInss,fimPrazoEmpresa:diasEmpresa>0?somaD(inicio,diasEmpresa-1):null,somaComAnterior:somaAnterior,diasAnterioresSomados:diasConsumidos,anteriorEncadeado,
    ferias:{contaComoFalta:false,regra:'Afastamento por acidente de trabalho ou doença atestada pelo INSS não é falta para as férias (CLT art. 131, III, lido); passa de 6 meses de benefício no período aquisitivo, perde o direito (art. 133, IV, lido).',perdeDireitoPossivel:feriasPerde},
    fgts:acidenteTrabalho?{deposita:true,regra:'Acidente de trabalho: o depósito do FGTS continua durante o afastamento (Lei 8.036/1990, art. 15, §5º, lido).'}:{deposita:diasInss>0?false:true,regra:'Doença comum: nos 15 primeiros dias, o FGTS incide sobre o salário pago; depois, com o INSS pagando, o depósito é devido só nos casos do art. 15 §5º (serviço militar e acidente de trabalho). CONFERIR com o contador.',conferir:true},
    licenciado:'Durante o benefício o contrato fica suspenso e o empregado é considerado licenciado (Lei 8.213, art. 63).',avisos};
}

// ===== 3. MATERNIDADE, PATERNIDADE, ESTABILIDADES =====
// Salário-maternidade: 120 dias (Lei 8.213, art. 71, lido); a empresa paga e compensa no recolhimento das contribuições sobre a folha (art. 72, §1º, lido). Valor igual à remuneração integral da empregada (art. 72, caput: conferir). Início até 28 dias antes do parto (CLT art. 392: conferir).
// Empresa Cidadã (Lei 11.770/2008, +60 dias): a lei NÃO foi lida nesta fase. Para o Simples Nacional, a dedução do valor pago nos 60 dias extras só existe para pessoa jurídica no lucro real: CONFERIR se a empresa do Simples pode aderir e como compensa; o app só calcula o custo estimado (sem compensação).
// Compensação de empresa do Simples: como se faz no recolhimento (DAS/eSocial): CONFERIR.
function salarioMaternidade(o={}){
  const {inicio,salario,mediaVariaveis=0,dataParto=null,empresaCidada=false,teto=null}=o,e=[];
  if(!parseD(inicio))e.push('data de início da licença inválida (use AAAA-MM-DD)');
  if(!numPos(salario))e.push('salário deve ser maior que zero');
  if(typeof mediaVariaveis!=='number'||!(mediaVariaveis>=0))e.push('média de variáveis inválida');
  if(dataParto!==null&&!parseD(dataParto))e.push('data do parto inválida');
  if(teto!==null&&!numPos(teto))e.push('teto inválido');
  if(e.length)return falha(...e);
  const avisos=[];
  if(dataParto){const a=entreD(inicio,dataParto);if(a>28)avisos.push('A licença começou mais de 28 dias antes do parto: conferir (CLT art. 392).');if(a<0)avisos.push('A licença começa depois do parto: confirmar a data (parto antecipado é caso à parte, o contador confere).')}
  const diasLicenca=120+(empresaCidada?60:0);
  const base=r2a(salario+mediaVariaveis);
  const mensal=teto?Math.min(base,teto):base;
  if(teto&&base>teto)avisos.push('Valor limitado ao teto informado: conferir o teto aplicável (Constituição, art. 248, e Lei 8.213).');
  const total=r2a(mensal/30*diasLicenca),do120=r2a(mensal/30*120);
  if(empresaCidada)avisos.push('Empresa Cidadã (+60 dias): a adesão é voluntária da pessoa jurídica (Lei 11.770/2008, art. 1º, lido em 18/11/2026). A dedução do imposto devido SÓ existe para empresa tributada pelo lucro real (art. 5º, lido): empresa do Simples Nacional não deduz, e os 60 dias extras são custo dela. A remuneração na prorrogação é integral (art. 3º).');
  avisos.push('A empresa paga o salário-maternidade e compensa as contribuições sobre a folha (Lei 8.213, art. 72, §1º); como compensar no Simples: conferir.');
  avisos.push(AVISO);
  const fim=somaD(inicio,diasLicenca-1);
  return{ok:true,erros:[],inicio,fim,diasLicenca,retorno:somaD(fim,1),valorMensal:mensal,valorTotal:total,valorCompensavel:do120,valorSemCompensacao:r2a(total-do120),quemPaga:'empresa (compensa com o INSS no recolhimento)',
    estabilidade:{tipo:'gestante',regra:'Da confirmação da gravidez até 5 meses após o parto (ADCT, art. 10, II, b: conferir texto)'},avisos,
    fontes:['Lei 8.213 arts. 71 e 72 §1º (lidos)','CLT art. 392 (conferir)','Lei 11.770/2008 arts. 1º, 1º-A, 3º e 5º (lidos em 18/11/2026)']};
}
// Licença-paternidade: 5 dias até 31/12/2026 (CF art. 7º XIX e ADCT art. 10 §1º, este último ainda sem texto oficial lido). LEI 15.371, de 31/03/2026 (Planalto, lida em 17/11/2026 na auditoria externa): art. 11: 10 dias a partir de 01/01/2027, 15 dias a partir de 01/01/2028 e 20 dias a partir de 01/01/2029;
// os 20 dias de 2029 DEPENDEM do cumprimento da meta fiscal do Anexo de Metas Fiscais da LDO (art. 11 §§1º e 2º): sem confirmação da meta, vale 15. Quem paga: a EMPRESA paga o salário-paternidade e é reembolsada pela Previdência (Lei 8.213 art. 73-D; ME e pequena empresa têm direito ao reembolso). Art. 4º: veda a dispensa arbitrária ou sem justa causa até 1 mês após o fim da licença. Art. 10: Empresa Cidadã prorroga em 15 dias.
// Ainda a conferir: qual data vale (nascimento ou início da licença) e o ADCT art. 10.
function diasPaternidade(ano,metaFiscalCumprida=false){return ano<=2026?5:ano===2027?10:ano===2028?15:(metaFiscalCumprida?20:15)}
function licencaPaternidade(o={}){
  const {dataNascimento,inicio=null,salario}=o,e=[];
  if(!parseD(dataNascimento))e.push('data de nascimento inválida (use AAAA-MM-DD)');
  if(inicio!==null&&!parseD(inicio))e.push('data de início inválida');
  if(!numPos(salario))e.push('salário deve ser maior que zero');
  if(e.length)return falha(...e);
  const ini=inicio||dataNascimento,ano=parseD(dataNascimento).getUTCFullYear(),dias=diasPaternidade(ano,o.metaFiscalCumprida===true);
  const novaRegra=ano>=2027;
  const avisos=[novaRegra?'Lei 15.371/2026 (vale desde 01/01/2027): a empresa paga o salário-paternidade e é reembolsada pela Previdência. Há estabilidade até 1 mês depois do fim da licença. Conferir com o contador qual data vale (nascimento ou início da licença).'+(ano>=2029&&o.metaFiscalCumprida!==true?' De 2029 em diante os 20 dias dependem da meta fiscal da LDO: sem confirmação, o cálculo usa 15 dias.':''):'Até 31/12/2026: 5 dias, pagos pela empresa (ADCT, art. 10, §1º).',
    'Empresa Cidadã (dias extras): conferir se se aplica ao Simples.',AVISO];
  return{ok:true,erros:[],dias,inicio:ini,fim:somaD(ini,dias-1),valor:r2a(salario/30*dias),quemPaga:novaRegra?'empresa paga e é reembolsada pela Previdência (Lei 8.213, art. 73-D)':'empresa',conferir:novaRegra&&ano>=2029&&o.metaFiscalCumprida!==true,estabilidadeAteMesesAposFim:novaRegra?1:0,avisos,fontes:['CF art. 7º XIX e ADCT art. 10 §1º (conferir texto)','Lei 15.371/2026, arts. 4º, 10 e 11 (Planalto, conferido em 17/11/2026)']};
}
// Estabilidades. Gestante: ADCT, art. 10, II, b (confirmação da gravidez até 5 meses após o parto): texto da CF não lido nesta fase, conferir.
// Acidentário: Lei 8.213, art. 118 (mínimo de 12 meses após a cessação do auxílio por acidente de trabalho): lido.
// inicio/fim: gestante = confirmação da gravidez / data do parto; acidentario = início do afastamento / fim do benefício acidentário (cessação).
function estabilidade(o={}){
  const {tipo,inicio,fim=null}=o,e=[];
  if(tipo!=='gestante'&&tipo!=='acidentario')e.push("tipo deve ser 'gestante' ou 'acidentario'");
  if(!parseD(inicio))e.push('data de início inválida (use AAAA-MM-DD)');
  if(fim!==null&&!parseD(fim))e.push('data de fim inválida (use AAAA-MM-DD)');
  if(parseD(inicio)&&fim&&parseD(fim)&&parseD(fim)<parseD(inicio))e.push('o fim é antes do início');
  if(e.length)return falha(...e);
  if(tipo==='gestante'){
    const termino=fim?addMesesD(fim,5):null;
    return{ok:true,erros:[],tipo,inicio,termino,pendente:!fim,regra:'Gestante: da confirmação da gravidez até 5 meses após o parto (ADCT art. 10, II, b).',avisos:[fim?'Demissão sem justa causa dentro do período gera indenização ou reintegração: o contador confere antes de qualquer desligamento.':'Informe a data do parto para calcular o fim.',AVISO],conferir:true};
  }
  const termino=fim?addMesesD(fim,12):null;
  return{ok:true,erros:[],tipo,inicio,termino,pendente:!fim,regra:'Acidentário: mínimo de 12 meses de manutenção do contrato após a cessação do auxílio por incapacidade temporária acidentária (Lei 8.213, art. 118).',avisos:[fim?'A contagem dos 12 meses começa na cessação do benefício acidentário; o contador confere o último dia.':'Informe a data de cessação do benefício acidentário.',AVISO],conferir:false};
}

// ===== 4. ACIDENTE DE TRABALHO: CAT =====
// Lei 8.213, art. 22 (lido, redação da LC 150/2015): comunicar à Previdência até o 1º dia útil seguinte ao da ocorrência; em caso de morte, imediatamente à autoridade competente. Multa por falta de comunicação (entre o mínimo e o máximo do salário de contribuição). Estabilidade: art. 118.
// Doença ocupacional: a CAT conta do diagnóstico/início da incapacidade (Decreto 3.048: conferir; não lido).
// Feriados: informe feriados[] (AAAA-MM-DD). Sem a lista, só fim de semana é pulado, e o prazo calculado pode ser MENOR que o real (lado seguro).
function prazoCAT(dataAcidente,opt={}){
  const {obito=false,feriados=[]}=opt;
  if(!parseD(dataAcidente))return falha('data do acidente inválida (use AAAA-MM-DD)');
  if(!Array.isArray(feriados)||feriados.some(f=>!parseD(f)))return falha('lista de feriados inválida');
  if(obito)return{ok:true,erros:[],prazo:dataAcidente,imediato:true,regra:'Morte: comunicação imediata à autoridade competente (Lei 8.213, art. 22).',avisos:['Comunicar hoje; sem prazo de dia útil.',AVISO]};
  let d=somaD(dataAcidente,1);
  const util=x=>{const w=diaSemana(x);return w!==0&&w!==6&&!feriados.includes(x)};
  while(!util(d))d=somaD(d,1);
  const av=['Depois da CAT: estabilidade de 12 meses se houver benefício acidentário (art. 118) e evento S-2210 no eSocial.',AVISO];
  if(!feriados.length)av.unshift('Sem lista de feriados o prazo pode ser menor que o real; informe os feriados locais.');
  return{ok:true,erros:[],prazo:d,imediato:false,regra:'CAT até o 1º dia útil seguinte ao acidente (Lei 8.213, art. 22).',multa:'Falta de comunicação gera multa entre o mínimo e o máximo do salário de contribuição, maior em reincidência (art. 22).',avisos:av};
}

// ===== 5. SST: EXAMES OCUPACIONAIS, PGR/GRO, eSocial =====
// NR-7 (PCMSO) texto vigente: o arquivo do gov.br não abriu em texto (PDF comprimido); os prazos abaixo vêm de RESUMOS da busca (gov.br e sites de terceiros). Tudo "conferir" até o contador ou o médico do trabalho abrir o item.
//  - admissional: antes de o empregado assumir; periódico: anual ou menor se exposto a risco do PGR ou doença crônica (a critério do médico), senão a cada 2 anos;
//  - retorno ao trabalho: antes da volta, quando afastado 30 dias ou mais (doença ou acidente, ocupacional ou não); mudança de riscos ocupacionais (antes "mudança de função"): antes da mudança;
//  - demissional: até 10 dias do fim do contrato; dispensável se o último exame ocupacional foi há menos de 135 dias (grau de risco 1 e 2) ou 90 dias (grau 3 e 4). O pedido original citava 90 dias para grau 1 e 2: as fontes achadas dizem 135; conferir no texto da NR-7.
const LIMITE_DISPENSA_DEMISSIONAL={1:135,2:135,3:90,4:90};
function examesSST(o={}){
  const {tipo,ultimoExame=null,grauRisco,admissao=null,dataRef=null,expostoRiscos=false,cronico=false,diasAfastamento=null,dataDemissao=null,dataMudanca=null}=o,e=[];
  const tipos=['admissional','periodico','retorno','mudanca','demissional'];
  if(!tipos.includes(tipo))e.push('tipo deve ser um de: '+tipos.join(', '));
  if(![1,2,3,4].includes(grauRisco))e.push('grau de risco deve ser 1, 2, 3 ou 4 (NR-4)');
  for(const [k,v] of [['ultimoExame',ultimoExame],['admissao',admissao],['dataRef',dataRef],['dataDemissao',dataDemissao],['dataMudanca',dataMudanca]])if(v!==null&&!parseD(v))e.push(k+': data inválida (use AAAA-MM-DD)');
  if(e.length)return falha(...e);
  const base={ok:true,erros:[],tipo,conferir:true,esocial:'S-2220 (monitoramento da saúde do trabalhador, a cada ASO)',aviso:AVISO};
  if(tipo==='admissional'){
    if(!admissao)return falha('admissional: informe a data de admissão');
    return Object.assign(base,{obrigatorio:true,prazo:admissao,regra:'Antes de o empregado assumir a função (NR-7: conferir item).',vencido:dataRef?parseD(dataRef)>parseD(admissao)&&!ultimoExame:null});
  }
  if(tipo==='periodico'){
    if(!ultimoExame)return falha('periódico: informe a data do último exame');
    const meses=(expostoRiscos||cronico)?12:24,prox=addMesesD(ultimoExame,meses);
    return Object.assign(base,{obrigatorio:true,intervaloMeses:meses,prazo:prox,vencido:dataRef?parseD(dataRef)>parseD(prox):null,regra:meses===12?'Exposto a risco do PGR ou com doença crônica: anual ou menor, a critério do médico responsável (NR-7: conferir).':'Demais empregados: a cada 2 anos (NR-7: conferir).'});
  }
  if(tipo==='retorno'){
    if(diasAfastamento===null||!Number.isInteger(diasAfastamento)||diasAfastamento<0)return falha('retorno: informe os dias de afastamento (inteiro >= 0)');
    const ob=diasAfastamento>=30;
    return Object.assign(base,{obrigatorio:ob,prazo:ob?'antes da volta ao trabalho':null,regra:ob?'Afastamento de 30 dias ou mais: exame clínico antes de o empregado voltar (NR-7: conferir se é 30 ou mais ou mais de 30).':'Afastamento menor que 30 dias: sem exame de retorno obrigatório.'});
  }
  if(tipo==='mudanca'){
    return Object.assign(base,{obrigatorio:true,prazo:dataMudanca||'antes da mudança',regra:'Mudança de riscos ocupacionais (antes chamada mudança de função): exame antes da mudança (NR-7 item 7.5.10, conferido em 17/11/2026).'});
  }
  if(!dataDemissao)return falha('demissional: informe a data da demissão');
  const lim=LIMITE_DISPENSA_DEMISSIONAL[grauRisco];
  const dias=ultimoExame?entreD(ultimoExame,dataDemissao):null;
  const dispensa=dias!==null&&dias>=0&&dias<lim;
  return Object.assign(base,{obrigatorio:!dispensa,dispensavel:dispensa,diasDesdeUltimo:dias,limiteDias:lim,prazo:somaD(dataDemissao,10),regra:`Até 10 dias do fim do contrato; pode ser dispensado se o último exame ocupacional foi há menos de ${lim} dias (grau ${grauRisco}). Conferir na NR-7 e com o médico coordenador.`});
}
// NR-1 (GRO/PGR), item 1.8 (ME e EPP): resumo oficial do MTE (FAQ/manual de 2026 e NR-1 atualizada) achado por busca; o texto da NR-1 NÃO foi lido por inteiro. CONFERIR.
//  - dispensa de ELABORAR o PGR para ME/EPP de grau de risco 1 ou 2 que, no levantamento preliminar de perigos, não identifiquem agentes físicos, químicos ou biológicos e façam a declaração digital;
//  - a dispensa é do PGR, não do GRO: riscos de acidentes e ergonômicos continuam a gerenciar; a dispensa não afasta as demais NRs;
//  - PCMSO também dispensado nesses casos (sem agentes físicos, químicos, biológicos nem fatores ergonômicos), mas os exames e o ASO continuam obrigatórios.
// Clínica de saúde costuma ter agente biológico: a dispensa tende a NÃO se aplicar; quem decide é o responsável técnico/contador.
function dispensaPGR(o={}){
  const {meEpp,grauRisco,agentesFisicosQuimicosBiologicos,fatoresErgonomicos=false}=o,e=[];
  if(typeof meEpp!=='boolean')e.push('informe se é ME ou EPP (true/false)');
  if(![1,2,3,4].includes(grauRisco))e.push('grau de risco deve ser 1, 2, 3 ou 4');
  if(typeof agentesFisicosQuimicosBiologicos!=='boolean')e.push('informe se há agentes físicos, químicos ou biológicos (true/false)');
  if(e.length)return falha(...e);
  const pgr=meEpp&&grauRisco<=2&&!agentesFisicosQuimicosBiologicos;
  const pcmso=pgr&&!fatoresErgonomicos;
  const av=[];
  if(!pgr)av.push(!meEpp||grauRisco>2?'Fora da dispensa do item 1.8 (precisa ser ME/EPP de grau 1 ou 2): elaborar o PGR.':'Há agente físico, químico ou biológico: a declaração de inexistência não vale e o PGR é obrigatório.');
  else av.push('Dispensa de elaborar o PGR com declaração digital (ferramenta do MTE); o GRO continua (acidentes e ergonomia).');
  av.push('A dispensa não elimina exames médicos e ASO nem as demais NRs.',AVISO);
  return{ok:true,erros:[],dispensaPGR:pgr,dispensaPCMSO:pcmso,grOContinua:true,examesEAsoContinuam:true,avisos:av,conferir:false,fonte:'NR-1 itens 1.8.4 (dispensa do PGR), 1.8.6 (dispensa do PCMSO, exige também ausência de risco ergonômico) e 1.8.7.1 (exames e ASO continuam); PDF oficial do gov.br lido em 17/11/2026'};
}
// eSocial: só nomes e quando geram obrigação (resumo; leiaute e prazos NÃO consultados: conferir no manual do eSocial).
const EVENTOS_ESOCIAL_SST={
  'S-2210':{nome:'Comunicação de Acidente de Trabalho (CAT)',quando:'a cada acidente de trabalho, no prazo da CAT (1º dia útil seguinte; morte, imediato)'},
  'S-2220':{nome:'Monitoramento da Saúde do Trabalhador (ASO)',quando:'a cada exame ocupacional (admissional, periódico, retorno, mudança de riscos, demissional)'},
  'S-2230':{nome:'Afastamento Temporário',quando:'atestado/afastamento, licença-maternidade e paternidade, auxílio por incapacidade; conferir a partir de quantos dias o evento é exigido'},
  'S-2240':{nome:'Condições Ambientais do Trabalho: Agentes Nocivos',quando:'quando há exposição a agente nocivo; conferir a dispensa de ME/EPP'}
};

// ===== ALERTAS PARA O CONTADOR =====
// empregado: {nome,salario,admissao,grauRisco,ultimoExame}; eventos: [{tipo,inicio,fim,...}], tipos: atestado, doenca, acidente, maternidade, paternidade, demissao, mudanca_funcao.
// dataRef: hoje (AAAA-MM-DD) para ver prazos vencidos; sem ela, os alertas de prazo vencido não saem.
function alertasAfastamento(empregado,eventos,dataRef=null){
  const e=[];
  if(!empregado||typeof empregado!=='object')e.push('empregado inválido');
  else if(!numPos(empregado.salario))e.push('salário deve ser maior que zero');
  if(!Array.isArray(eventos))e.push('eventos deve ser uma lista');
  if(dataRef!==null&&!parseD(dataRef))e.push('data de referência inválida');
  if(e.length)return falha(...e);
  const nome=empregado.nome||'Empregado',al=[],push=(nivel,texto,conferir=true)=>al.push({nivel,texto:conferir?texto+' '+AVISO:texto,conferir});
  for(const ev of eventos){
    const t=ev&&ev.tipo,pre=`${nome}: `;
    if(t==='atestado'||t==='doenca'){
      const p=[];validaPeriodo(ev.inicio,ev.fim,p,'evento '+t);if(p.length){e.push(...p);continue}
      const r=afastamentoDoenca({inicio:ev.inicio,fim:ev.fim,salario:empregado.salario,afastamentosAnteriores:ev.afastamentosAnteriores||[],acidenteTrabalho:!!ev.acidenteTrabalho});
      if(!r.ok){e.push(...r.erros);continue}
      if(r.diasInss>0){push('atencao',pre+`afastamento de ${r.diasTotais} dias: a empresa paga até o dia ${r.fimPrazoEmpresa||'(já esgotado)'} e o INSS a partir de ${r.inicioInss}. Orientar perícia no INSS e lançar S-2230.`);
        if(r.diasTotais>=30)push('atencao',pre+'afastamento de 30 dias ou mais: exame de retorno ao trabalho antes da volta (NR-7).')}
      else push('info',pre+`atestado de ${r.diasTotais} dia(s): pago pela empresa, sem desconto. Lançar S-2230 se a regra do eSocial exigir.`);
      if(r.somaComAnterior)push('atencao',pre+'mesma doença em até 60 dias do afastamento anterior: os períodos se somam; conferir a CID e o início do INSS.');
      if(r.ferias.perdeDireitoPossivel)push('atencao',pre+'mais de 6 meses de benefício no período aquisitivo: pode perder o direito às férias (art. 133, IV).');
    }else if(t==='acidente'){
      if(!parseD(ev.inicio)){e.push('evento acidente: data inválida');continue}
      const c=prazoCAT(ev.inicio,{obito:!!ev.obito,feriados:ev.feriados||[]});
      if(ev.dataCAT&&!parseD(ev.dataCAT)){e.push('data da CAT inválida');continue}
      if(!ev.dataCAT){const venc=dataRef&&parseD(dataRef)>parseD(c.prazo);push(venc?'critico':'atencao',pre+`acidente de trabalho em ${ev.inicio}: emitir a CAT até ${c.prazo}${venc?' (PRAZO VENCIDO: emitir já; há multa)':''}. Evento S-2210.`)}
      else if(parseD(ev.dataCAT)>parseD(c.prazo))push('critico',pre+`CAT emitida em ${ev.dataCAT}, depois do prazo (${c.prazo}): possível multa; o contador avalia.`);
      push('atencao',pre+'acidente de trabalho: depósito do FGTS continua no afastamento e, havendo benefício acidentário, estabilidade de 12 meses após a alta (art. 118).');
    }else if(t==='maternidade'){
      if(!parseD(ev.inicio)){e.push('evento maternidade: data inválida');continue}
      const m=salarioMaternidade({inicio:ev.inicio,salario:empregado.salario,empresaCidada:!!ev.empresaCidada});
      push('atencao',pre+`licença-maternidade de ${ev.inicio} a ${m.fim} (${m.diasLicenca} dias); a empresa paga e compensa nas contribuições. Estabilidade da gestante até 5 meses após o parto: não desligar sem o contador.`);
      if(ev.empresaCidada)push('atencao',pre+'Empresa Cidadã: conferir se se aplica ao Simples antes de prometer os 60 dias extras.');
    }else if(t==='paternidade'){
      if(!parseD(ev.inicio)){e.push('evento paternidade: data inválida');continue}
      const p=licencaPaternidade({dataNascimento:ev.nascimento||ev.inicio,inicio:ev.inicio,salario:empregado.salario});
      push('info',pre+`licença-paternidade de ${p.inicio} a ${p.fim} (${p.dias} dias). ${p.conferir?'Regra nova de 2027: conferir quem paga.':''}`.trim());
    }else if(t==='demissao'){
      if(!parseD(ev.inicio)){e.push('evento demissão: data inválida');continue}
      const g=empregado.grauRisco;
      if([1,2,3,4].includes(g)){const x=examesSST({tipo:'demissional',ultimoExame:empregado.ultimoExame||null,grauRisco:g,dataDemissao:ev.inicio});
        push('atencao',pre+(x.dispensavel?`exame demissional pode ser dispensado (último exame há ${x.diasDesdeUltimo} dias, limite ${x.limiteDias}); o médico coordenador confirma.`:`fazer o exame demissional até ${x.prazo} (S-2220).`))}
      else push('atencao',pre+'informe o grau de risco da empresa para conferir o exame demissional.');
      const est=(eventos.filter(x=>x&&x.tipo==='maternidade'||x&&x.tipo==='acidente'));
      if(est.length)push('critico',pre+'há maternidade ou acidente registrado: confira a estabilidade antes de desligar (ADCT art. 10 II b; Lei 8.213 art. 118).');
    }else if(t==='mudanca_funcao'){
      push('atencao',pre+'mudança de riscos ocupacionais: exame antes da mudança (NR-7) e atualizar S-2220/S-2240 se for o caso.');
    }else e.push('tipo de evento desconhecido: '+t);
  }
  if(empregado.admissao&&!parseD(empregado.admissao))e.push('data de admissão inválida');
  if(empregado.admissao&&empregado.ultimoExame&&parseD(empregado.admissao)&&parseD(empregado.ultimoExame)&&dataRef&&[1,2,3,4].includes(empregado.grauRisco)){
    const x=examesSST({tipo:'periodico',ultimoExame:empregado.ultimoExame,grauRisco:empregado.grauRisco,dataRef,expostoRiscos:!!empregado.expostoRiscos});
    if(x.ok&&x.vencido)push('atencao',`${nome}: exame periódico vencido em ${x.prazo}.`);
  }
  if(e.length)return falha(...e);
  const ordem={critico:0,atencao:1,info:2};al.sort((a,b)=>ordem[a.nivel]-ordem[b.nivel]);
  return{ok:true,erros:[],alertas:al,total:al.length,criticos:al.filter(a=>a.nivel==='critico').length};
}

if(typeof module!=='undefined')module.exports={MOTIVOS_FALTA,faltaJustificada,diasFeriasPorFaltas,calculaAtestado,afastamentoDoenca,salarioMaternidade,diasPaternidade,licencaPaternidade,estabilidade,prazoCAT,examesSST,LIMITE_DISPENSA_DEMISSIONAL,dispensaPGR,EVENTOS_ESOCIAL_SST,alertasAfastamento,AVISO};
