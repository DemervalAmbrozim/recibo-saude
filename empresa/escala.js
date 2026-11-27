// ESCALA DO ESCRITÓRIO (21/11/2026): quanto tempo do contador cada rotina mensal consome e quanto o sistema já faz sozinho.
// IMPORTANTE: as HORAS por tarefa e o PERCENTUAL automático são PREMISSAS de partida (estimativa do Hexa), marcadas como tal na tela: o Daniel troca pelos
// números do escritório dele. O estado ("funciona", "ensaio") é o real, conferido nos testes. Automatizar não elimina a conferência: ela entra como tarefa própria.
const TAREFAS_ESCRITORIO=[
 {id:'documentos',nome:'Receber e cobrar extrato e notas da cliente',horas:0.5,auto:0.8,como:'Cobrança automática pelo WhatsApp no dia 5 (com OK em lote); extrato importado em CSV ou OFX.',estado:'pronto; o envio depende do modelo da Meta'},
 {id:'conciliacao',nome:'Classificar e conciliar o extrato',horas:0.7,auto:0.6,como:'Conciliação automática (62,5% no exemplo da aba 4), molde aprendido por banco; o contador confirma o resto.',estado:'funciona'},
 {id:'lancamentos',nome:'Lançar na escrituração',horas:0.6,auto:0.9,como:'Lançamentos em partidas dobradas gerados de nota, extrato, folha e DAS; o banco recusa o que não fecha.',estado:'funciona'},
 {id:'apuracao',nome:'Apurar o Simples (anexo, Fator R, DAS)',horas:0.5,auto:0.8,como:'Apuração estimada e pró-labore do Fator R; a transmissão no PGDAS-D sai pelo robô ou pelo SERPRO, depois do OK.',estado:'estimativa funciona; transmissão em ensaio'},
 {id:'guias',nome:'Preparar guias e avisar vencimentos',horas:0.3,auto:0.7,como:'Guia assistida, lembretes e guia marcada como paga pelo extrato; emissão oficial por robô ou SERPRO.',estado:'assistida funciona; oficial em ensaio'},
 {id:'folha',nome:'Folha de pagamento (por empregado)',horas:0.8,auto:0.6,como:'Cálculo, holerite e variáveis pedidas pelo WhatsApp; o contador aprova; o eSocial está em ensaio.',estado:'cálculo funciona; eSocial em ensaio',folha:true},
 {id:'relatorio',nome:'Relatório mensal para a cliente',horas:0.4,auto:0.95,como:'Resumo de uma página gerado da escrituração e entregue pelo WhatsApp e pelo app.',estado:'funciona'},
 {id:'notas',nome:'Emitir notas fiscais (quando a cliente pede)',horas:0.4,auto:0.5,como:'Pedido pelo WhatsApp, planilha pronta; o robô emite com OK; hoje a emissão é manual no portal.',estado:'ensaio'},
 {id:'duvidas',nome:'Dúvidas e atendimento da cliente',horas:0.6,auto:0.3,como:'O Hexa responde o que está nas regras; o resto vai ao contador.',estado:'funciona em parte'}];
const CONFERENCIA_H=0.25;   // o que NÃO se automatiza: o contador conferir e assinar o que o sistema preparou (por cliente por mês)
const r2e=x=>Math.round(x*100)/100;

// entrada: {fatorAuto (0 a 1, multiplica todos os percentuais: 0,5 = cenário conservador), clientes, pctComFolha (0 a 1), empregadosPorClienteComFolha, horasUteisContador, honorarioMedio, custoHora, tarefas (opcional: sobrescreve horas/auto por id)}
function capacidadeEscritorio(e){
  const n=Math.max(0,+e.clientes||0),pf=Math.min(1,Math.max(0,e.pctComFolha==null?0.3:+e.pctComFolha)),emp=Math.max(1,+e.empregadosPorClienteComFolha||1.5),
    fator=e.fatorAuto!=null?Math.min(1,Math.max(0,+e.fatorAuto)):1,util=+e.horasUteisContador>0?+e.horasUteisContador:140,hon=+e.honorarioMedio||0,ch=+e.custoHora>=0?+e.custoHora:60,ov=e.tarefas||{};
  let antes=0,depois=0;const linhas=TAREFAS_ESCRITORIO.map(t=>{
    const o=ov[t.id]||{},h=o.horas!=null?Math.max(0,+o.horas):t.horas,a=Math.min(1,Math.max(0,(o.auto!=null?+o.auto:t.auto)*fator)),
      peso=t.folha?pf*emp:1,hAntes=h*peso,hDepois=hAntes*(1-a);antes+=hAntes;depois+=hDepois;
    return {id:t.id,nome:t.nome,horas:h,auto:a,hAntes:r2e(hAntes),hDepois:r2e(hDepois),economia:r2e(hAntes-hDepois),como:t.como,estado:t.estado,folha:!!t.folha}});
  depois+=CONFERENCIA_H;antes+=CONFERENCIA_H;   // conferência existe nos dois cenários
  const cap=h=>h>0?Math.floor(util/h):0,capA=cap(antes),capD=cap(depois);
  return {clientes:n,linhas,horasClienteAntes:r2e(antes),horasClienteDepois:r2e(depois),pctMenosHoras:antes>0?r2e((1-depois/antes)*100):0,
    horasMesAntes:r2e(antes*n),horasMesDepois:r2e(depois*n),horasLiberadasMes:r2e((antes-depois)*n),
    clientesPorContadorAntes:capA,clientesPorContadorDepois:capD,contadoresAntes:capA?r2e(n/capA):null,contadoresDepois:capD?r2e(n/capD):null,
    margemMesAntes:r2e(n*hon-antes*n*ch),margemMesDepois:r2e(n*hon-depois*n*ch),conferenciaH:CONFERENCIA_H,
    aviso:'Horas e percentuais são premissas de partida, para o contador trocar pelos números dele. A conferência do contador continua em todos os clientes. Estimativa, não promessa.'}}
if(typeof module!=='undefined')module.exports={TAREFAS_ESCRITORIO,CONFERENCIA_H,capacidadeEscritorio};
