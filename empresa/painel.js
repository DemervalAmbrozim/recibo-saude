// Painel do contador (módulo C9) e medição de tempo e capacidade (E3), 17/11/2026: carteira, fila de prioridades, vencimentos da semana e indicadores.
// Depende de contab.js (calendario, prazoOpcaoSimples, alertas). RASCUNHO: as regras de prioridade são padrão adotado, a calibrar no piloto.
// cliente = {id,nome,plano:'empresa'|'empresa_folha',preco,situacao:'abertura'|'teste'|'ativa'|'pausa',empregados,contratoAssinado,dataAbertura,deferimento,passosFeitos:[ids],
//   enviouMes,dasPago,pendencias:{naoClassificados,recebimentosSemNota},folha:{status:null|'rascunho'|'sombra'|'aprovada'},ciclosSombraAprovados,r:{...respostas do onboarding para alertas()}}
const diasAte=(de,ate)=>Math.round((new Date(ate+'T12:00:00')-new Date(de+'T12:00:00'))/86400000);
const somaDiasP=(iso,n)=>{const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const mesAnteriorP=(iso)=>{const [a,m]=iso.split('-').map(Number),d=new Date(Date.UTC(a,m-2,1));return d.toISOString().slice(0,7)}; // o DAS que vence neste mês é da competência anterior
const dia20=(hoje)=>{const [a,m,d]=hoje.split('-').map(Number),mes=d<=20?m:m+1,ano=mes>12?a+1:a,mm=((mes-1)%12)+1;return `${ano}-${String(mm).padStart(2,'0')}-20`};
const dia15=(hoje)=>dia20(hoje).slice(0,8)+'15';
const quintoUtil=(hoje)=>{const [a,m]=hoje.split('-').map(Number);let d=new Date(Date.UTC(a,m-1,1)),n=0;while(true){const w=d.getUTCDay();if(w!==0&&w!==6){n++;if(n===5)break}d.setUTCDate(d.getUTCDate()+1)}return d.toISOString().slice(0,10)};

// Fila de prioridades: o que o contador deve olhar primeiro (maior prioridade primeiro)
function fila(carteira,hoje){const out=[],add=(c,tipo,pri,texto,prazo)=>out.push({clienteId:c.id,cliente:c.nome,tipo,prioridade:pri,texto,prazo:prazo||null});
  for(const c of carteira){if(c.situacao==='pausa')continue;
    // 1 opção do Simples (prazo duro)
    if(c.dataAbertura&&!(c.passosFeitos||[]).includes(5)){const p=prazoOpcaoSimples(c.dataAbertura,c.deferimento||null),d=diasAte(hoje,p);
      if(d<=15)add(c,'opcao-simples',d<=7?100-Math.max(0,d):75,d<0?'PRAZO PERDIDO da opção pelo Simples ('+p+'): só em janeiro':'Opção pelo Simples vence em '+d+' dia(s) ('+p+')',p)}
    // 2 DAS
    if(c.situacao==='ativa'&&!c.dasPago){const v=dia20(hoje),d=diasAte(hoje,v);if(d<=3)add(c,'das',d<=1?95:90,'DAS vence em '+d+' dia(s) ('+v+') e não há pagamento confirmado',v)}
    // 3 folha, eSocial e FGTS
    if((c.empregados||0)>0&&c.situacao==='ativa'&&!(c.folha&&c.folha.status==='aprovada')){const v=dia15(hoje),d=diasAte(hoje,v);if(d<=3&&d>=-5)add(c,'esocial',85,'Folha sem aprovação e eSocial vence em '+d+' dia(s) ('+v+')',v)}
    // 4 contrato
    if(c.situacao==='ativa'&&!c.contratoAssinado)add(c,'contrato',80,'Contrato não assinado: nada pode ser transmitido à Receita')
    // 5 envio do mês
    if(c.situacao==='ativa'&&!c.enviouMes&&hoje>quintoUtil(hoje))add(c,'envio',60,'Cliente não enviou o extrato e as notas do mês (prazo: '+quintoUtil(hoje)+')')
    // 6 folha aguardando aprovação
    if((c.empregados||0)>0&&c.folha&&['rascunho','sombra'].includes(c.folha.status))add(c,'folha-aprovar',55,'Folha '+c.folha.status+' aguardando a conferência do contador')
    // 7 conciliação
    const nc=(c.pendencias&&c.pendencias.naoClassificados)||0;if(nc>0)add(c,'conciliacao',40+Math.min(nc,10),nc+' lançamento(s) do extrato sem classificação')
    const sn=(c.pendencias&&c.pendencias.recebimentosSemNota)||0;if(sn>0)add(c,'sem-nota',50,sn+' recebimento(s) sem nota fiscal: orientar a emitir')
    // 8 ciclo sombra
    if((c.empregados||0)>0&&(c.ciclosSombraAprovados||0)<2)add(c,'sombra',30,'Folha sombra: '+(c.ciclosSombraAprovados||0)+' de 2 ciclos aprovados')
    // 9 alertas do onboarding
    if(c.r)alertas(c.r).filter(a=>a.nivel==='crítico').forEach(a=>add(c,'alerta',70,a.txt))}
  return out.sort((a,b)=>b.prioridade-a.prioridade||String(a.prazo||'9').localeCompare(String(b.prazo||'9')))}

// Vencimentos dos próximos 7 dias de toda a carteira
function semana(carteira,hoje){const lim=somaDiasP(hoje,7),ev=[];
  for(const c of carteira){if(c.situacao==='pausa'||c.situacao==='abertura')continue;
    calendario(mesAnteriorP(hoje),{folha:(c.empregados||0)>0}).filter(e=>e.data>=hoje&&e.data<=lim).forEach(e=>ev.push({clienteId:c.id,cliente:c.nome,data:e.data,titulo:e.titulo,critico:e.critico}))}
  return ev.sort((a,b)=>a.data<b.data?-1:a.data>b.data?1:a.cliente.localeCompare(b.cliente))}

// Tempo por cliente (E3). Validação: minutos positivos, data válida, tarefa conhecida.
const TAREFAS=['coleta','conciliacao','lancamentos','folha','apuracao','relatorio','reuniao','atendimento','abertura','evento','regularizacao','outra'];
function registraTempo(lista,t){if(!t||!t.clienteId)throw new Error('cliente obrigatório');if(!(t.minutos>0&&t.minutos<=720))throw new Error('minutos devem estar entre 1 e 720');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(t.data||''))throw new Error('data inválida');if(!TAREFAS.includes(t.tarefa))throw new Error('tarefa desconhecida: '+t.tarefa);lista.push({...t});return lista}
function indicadores(carteira,tempos,mes,{custoHora=60,capacidadeComFolha=50,capacidadeSemFolha=100}={}){
  const ativos=carteira.filter(c=>c.situacao==='ativa'),mrr=ativos.reduce((s,c)=>s+(+c.preco||0),0),porPlano={};ativos.forEach(c=>{porPlano[c.plano]=(porPlano[c.plano]||0)+1});
  const doMes=tempos.filter(t=>t.data.startsWith(mes)),horas={};doMes.forEach(t=>{horas[t.clienteId]=(horas[t.clienteId]||0)+t.minutos/60});
  const linhas=ativos.map(c=>{const h=horas[c.id]||0,custo=Math.round(h*custoHora*100)/100,margem=Math.round(((+c.preco||0)-custo)*100)/100;return {clienteId:c.id,cliente:c.nome,plano:c.plano,horas:Math.round(h*100)/100,custo,margem,margemPct:c.preco>0?Math.round(margem/c.preco*1000)/10:null}});
  const totH=Object.values(horas).reduce((s,x)=>s+x,0),comFolha=ativos.filter(c=>(c.empregados||0)>0).length,semFolha=ativos.length-comFolha;
  const carga=comFolha/capacidadeComFolha+semFolha/capacidadeSemFolha;
  return {clientesAtivos:ativos.length,porPlano,receitaMensal:mrr,horasNoMes:Math.round(totH*100)/100,horasPorCliente:ativos.length?Math.round(totH/ativos.length*100)/100:0,custoTotal:Math.round(totH*custoHora*100)/100,
    margemTotal:Math.round((mrr-totH*custoHora)*100)/100,linhas,cargaDoContador:Math.round(carga*100)/100,
    alertaCapacidade:carga>=1?'carga acima da capacidade de um contador: contratar ou dividir a carteira':carga>=0.8?'carga acima de 80% da capacidade':null,
    alertaMargem:linhas.filter(l=>l.margem<0).map(l=>l.cliente+' dá prejuízo no mês ('+l.margem+')')}}
if(typeof module!=='undefined')module.exports={fila,semana,registraTempo,indicadores,TAREFAS,quintoUtil};
