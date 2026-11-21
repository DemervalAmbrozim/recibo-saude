// FECHAMENTO DO MÊS: automações de eficiência (21/11/2026, "faz tudo"): (1) guia paga pelo extrato, (2) lembretes de vencimento, (3) folha do mês a partir da anterior,
// (4) orquestrador do mês e (5) fila do dia. Funções puras: nada aqui envia mensagem, grava no banco nem aprova folha; quem envia, grava e aprova é quem chama,
// depois do OK. Depende de folha.js (calculaFolha). ESTIMATIVA: o contador confere.

const dMs=s=>Date.UTC(+s.slice(0,4),+s.slice(5,7)-1,+s.slice(8,10));
const diasEntreFech=(a,b)=>Math.round((dMs(b)-dMs(a))/86400000);   // b - a
const brlFech=v=>(+v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dBRFech=s=>s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4);
const NOMES_MES_FECH=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mesTxt=c=>NOMES_MES_FECH[+c.slice(5,7)-1]+' de '+c.slice(0,4);

// (1) Marca a guia como paga quando o extrato mostra o débito. guias: saída de guiasDoMes; itens: saída de classifica().itens.
// Casa por tipo/descrição, valor (tolerância) e janela de datas. Cada item do extrato paga no máximo uma guia. Nunca marca por palavra só: valor diferente = "conferir".
const PADRAO_GUIA={das:/\bDAS\b|SIMPLES NACIONAL|PGDAS/i,fgts:/FGTS/i,'darf-carne-leao':/DARF|RECEITA FEDERAL|CARN[EÊ]/i,'inss-pro-labore':/DARF|RECEITA FEDERAL|DCTFWEB|\bINSS\b|\bGPS\b/i,'irrf-pro-labore':/DARF|RECEITA FEDERAL|DCTFWEB|IRRF/i};
function marcaPagoPorExtrato(guias,itens,{tolerancia=0.05,diasAposVenc=15}={}){
  const usados=new Set(),out=[];
  for(const g of guias){
    const pad=PADRAO_GUIA[g.id];if(!pad||!(g.valor>0)){out.push({guiaId:g.id,status:'sem valor a pagar'});continue}
    const [a,m]=g.competencia.split('-').map(Number),ini=`${m===12?a+1:a}-${String(m===12?1:m+1).padStart(2,'0')}-01`;
    const noPrazo=it=>it.valor<0&&!usados.has(it.id)&&it.data>=ini&&diasEntreFech(g.vencimento,it.data)<=diasAposVenc&&(pad.test(it.descricao||'')||(g.id==='das'&&it.tipo==='das'));
    const cand=itens.filter(noPrazo);
    const exato=cand.filter(it=>Math.abs(-it.valor-g.valor)<=tolerancia).sort((x,y)=>x.data<y.data?-1:1)[0];
    if(exato){usados.add(exato.id);const at=diasEntreFech(g.vencimento,exato.data);
      out.push({guiaId:g.id,status:at>0?'pago com atraso':'pago',itemId:exato.id,dataPagamento:exato.data,atrasoDias:Math.max(0,at)});continue}
    const quase=cand[0];
    out.push(quase?{guiaId:g.id,status:'conferir valor',itemId:quase.id,dataPagamento:quase.data,pagoValor:-quase.valor,diferenca:Math.round((-quase.valor-g.valor)*100)/100}:{guiaId:g.id,status:'em aberto'});
  }
  return out}

// (2) Lembrete de vencimento: 5 dias, 1 dia, no dia, e atraso (1, 3 e 7 dias depois). Devolve null quando não é dia de lembrar ou a guia já está paga.
function lembreteGuia(guia,hoje,pago=false){
  if(pago||!(guia.valor>0))return null;
  const d=diasEntreFech(hoje,guia.vencimento),mes=mesTxt(guia.competencia),v=dBRFech(guia.vencimento),val=brlFech(guia.valor);
  const conf=guia.confirmarDia?' (o contador confirma a data exata)':'';
  const quando=d===5?'d-5':d===1?'d-1':d===0?'dia':[-1,-3,-7].includes(d)?'atraso':null;
  if(!quando)return null;
  const T={'d-5':`Lembrete: o ${guia.nome} de ${mes} (${val}) vence em ${v}${conf}. A guia oficial sai no portal; o app tem o passo a passo.`,
    'd-1':`Amanhã vence o ${guia.nome} de ${mes} (${val}), dia ${v}${conf}. Se já pagou, é só avisar aqui.`,
    'dia':`Hoje vence o ${guia.nome} de ${mes} (${val})${conf}. Pagando hoje, evita multa e juros.`,
    'atraso':`O ${guia.nome} de ${mes} (${val}) venceu em ${v} e ainda não vemos o pagamento. Se já pagou, avise aqui; se não, fale com a gente para ver a guia com juros.`};
  return {quando,guiaId:guia.id,texto:T[quando]+'\n— Equipe Lado a Lado Saúde'}}

// (3) Folha do mês a partir da anterior. anterior: [{id,nome,salario,divisor,dependentes,filhosSF,vtCusto}]; variaveis: {id: mov} ou {id:null} = "sem alteração".
// Quem ainda não respondeu fica pendente. A folha nunca nasce aprovada: aprovadaPeloContador sempre false.
function folhaDoMes({anterior,variaveis={},comp,ano}){
  const itens=[],pendentes=[];let liquido=0,fgts=0,custo=0;
  for(const e of anterior){
    const respondeu=Object.prototype.hasOwnProperty.call(variaveis,e.id);
    if(!respondeu){pendentes.push(e.id);itens.push({id:e.id,nome:e.nome,pronto:false,motivo:'aguardando faltas e horas extras da cliente'});continue}
    let f;try{f=calculaFolha(e,variaveis[e.id]||{},ano)}catch(err){itens.push({id:e.id,nome:e.nome,pronto:false,motivo:'erro: '+err.message});pendentes.push(e.id);continue}
    if(!f.ok){itens.push({id:e.id,nome:e.nome,pronto:false,motivo:'dados inválidos: '+(f.erros||[]).join('; ')});pendentes.push(e.id);continue}
    itens.push({id:e.id,nome:e.nome,pronto:true,folha:f});liquido+=f.liquido||0;fgts+=f.fgts||0;custo+=f.custoEmpresa||f.custo||0}
  return {comp,itens,pendentes,totalLiquido:Math.round(liquido*100)/100,totalFGTS:Math.round(fgts*100)/100,completa:pendentes.length===0&&itens.length>0,aprovadaPeloContador:false,
    proximoPasso:pendentes.length?'pedir à cliente as faltas e horas extras de quem falta':'contador confere e aprova (1 clique); só então o FGTS e o Fator R do mês valem'}}
function mensagemVariaveis(emp,comp){return `Oi! Para fechar a folha de ${mesTxt(comp)}: ${emp.nome} teve falta, hora extra ou atraso neste mês? Responda "sem alteração" se foi tudo normal, ou me diga os dias e as horas.\n— Equipe Lado a Lado Saúde`}

// (4) Orquestrador do mês: o que acontece em cada dia. hoje: 'AAAA-MM-DD'. Só dias úteis. dono: quem faz; ok: precisa do OK do Demerval antes.
function orquestradorMes(hoje){
  const dt=new Date(dMs(hoje)),dow=dt.getUTCDay(),d=+hoje.slice(8,10),T=[];
  if(dow===0||dow===6)return [];
  const add=(id,titulo,dono,ok=false)=>T.push({id,titulo,dono,precisaOK:ok});
  if(d===1)add('apuracao','Apurar o mês anterior de cada empresa: DAS estimado, Fator R, INSS e FGTS','Hexa');
  if(d===2)add('relatorio-contador','Enviar o relatório do mês para cada contador (só números)','Hexa',true);
  if(d===5)add('cobrar-documentos','Cobrar da cliente o extrato e as notas do mês que ainda faltam','Hexa',true);
  if(d===15)add('esocial-folha','Prazo do eSocial: fechamento da folha (dia 15)','Contador');
  if([15,19,20].includes(d)||d===1&&false)add('lembretes-vencimento','Mandar os lembretes de vencimento do DAS, INSS e FGTS (5 dias, 1 dia e no dia)','Hexa',true);
  if(d===25)add('folha-variaveis','Pedir à cliente as faltas e horas extras do mês','Hexa',true);
  if(d>=26&&d<=28)add('folha-aprovar','Contador confere e aprova a folha-sombra do mês','Contador');
  const ult=new Date(Date.UTC(+hoje.slice(0,4),+hoje.slice(5,7),0));while([0,6].includes(ult.getUTCDay()))ult.setUTCDate(ult.getUTCDate()-1);
  if(dt.getTime()===ult.getTime())add('carne-leao-dctfweb','Último dia útil: vence o Carnê-Leão das autônomas e a DCTFWeb (conferir prazo)','Hexa');
  add('pago-por-extrato','Conciliar os extratos que chegaram e marcar as guias pagas','Hexa');
  return T}

// (5) Fila do dia: um texto só para o Demerval, com o que precisa de OK. pendencias: {notas, recibos, guias} (contagens); tarefas: saída do orquestrador.
function filaDoDia({hoje,tarefas,pendencias={}}){
  const L=[`Fila do dia ${dBRFech(hoje)}`],ok=tarefas.filter(t=>t.precisaOK),auto=tarefas.filter(t=>!t.precisaOK);
  if(pendencias.recibos)L.push(`- ${pendencias.recibos} pedido(s) de recibo aguardando emissão`);
  if(pendencias.notas)L.push(`- ${pendencias.notas} pedido(s) de nota fiscal aguardando emissão`);
  const fo=pendencias.folha;   // {clientes, comEmpregados, aprovadas, sombra, semFolha, afastamentosAbertos}: lido do banco real pelo orquestrador
  if(fo&&fo.comEmpregados>0){const f=[];f.push(`${fo.aprovadas} de ${fo.comEmpregados} folha(s) do mês aprovada(s)`);if(fo.sombra)f.push(`${fo.sombra} em sombra para o contador aprovar`);if(fo.semFolha)f.push(`${fo.semFolha} cliente(s) ainda sem folha calculada`);L.push('- Folha em lote: '+f.join(', '))}
  if(fo&&fo.afastamentosAbertos)L.push(`- ${fo.afastamentosAbertos} afastamento(s) em andamento (confira os avisos na folha em lote)`);
  if(pendencias.guiasVencendo)L.push(`- ${pendencias.guiasVencendo} guia(s) vencendo em até 5 dias sem pagamento no extrato`);
  if(ok.length){L.push('Precisam do seu OK:');ok.forEach(t=>L.push('  • '+t.titulo))}
  if(auto.length){L.push('Rodam sozinhas:');auto.forEach(t=>L.push('  • '+t.titulo+(t.dono==='Contador'?' (contador)':'')))}
  if(L.length===1)L.push('Nada para hoje.');
  return L.join('\n')}
if(typeof module!=='undefined')module.exports={marcaPagoPorExtrato,lembreteGuia,folhaDoMes,mensagemVariaveis,orquestradorMes,filaDoDia};
