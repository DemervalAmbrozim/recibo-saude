// Fila do eSocial (F5, 17/11/2026): regras de ORDEM e PRONTIDÃO dos eventos e o transmissor com a ligação trocável. Não fala com a rede.
// Fonte da ordem e dos pré-requisitos: projeto/esocial-leiaute-fase4-2026-11-17.md (MOS S-1.3 e Manual do Desenvolvedor 7.5.9 e 7.9.1, lidos em 17/11/2026). Leiaute e prazos podem mudar: o contador/desenvolvedor reconfere antes de transmitir.
// A transmissão REAL (assinatura XML com e-CNPJ A1, procuração eletrônica RFB, contrato SERPRO) é feita por uma função `enviar` que será ligada quando houver esses itens; aqui ela é recebida de fora e nos testes é simulada.
// Estado do evento na fila: rascunho, pronto, enviado, aceito, rejeitado (igual ao banco, supabase/052).
const GRUPO={ 'S-1000':1,'S-1005':1,'S-1010':1,'S-1020':1,'S-1070':1,
  'S-2190':2,'S-2200':2,'S-2205':2,'S-2206':2,'S-2210':2,'S-2220':2,'S-2230':2,'S-2240':2,'S-2299':2,'S-2300':2,'S-2306':2,'S-2399':2,'S-3000':2,
  'S-1200':3,'S-1210':3,'S-1260':3,'S-1270':3,'S-1280':3,'S-1298':3,'S-1299':3 };
const ORDEM=['S-1000','S-1005','S-1020','S-1010','S-1070','S-2190','S-2200','S-2300','S-2205','S-2206','S-2230','S-2210','S-2220','S-2240','S-2299','S-2306','S-2399','S-3000','S-1200','S-1210','S-1280','S-1298','S-1299'];
// Pré-requisitos: aceitos para a MESMA empresa. `mesmoEmpregado` = o pré-requisito vale para o empregado/sócio do próprio evento (um dos tipos da lista).
const PREREQ={
  'S-1005':{todos:['S-1000']},'S-1010':{todos:['S-1000']},'S-1020':{todos:['S-1000']},'S-1070':{todos:['S-1000']},'S-2190':{todos:['S-1000']},
  'S-2200':{todos:['S-1000','S-1005']},'S-2300':{todos:['S-1000']},
  'S-2205':{umDeMesmoEmpregado:['S-2200','S-2300']},'S-2206':{umDeMesmoEmpregado:['S-2200']},'S-2230':{umDeMesmoEmpregado:['S-2200']},
  'S-2210':{umDeMesmoEmpregado:['S-2190','S-2200']},'S-2220':{umDeMesmoEmpregado:['S-2190','S-2200']},'S-2240':{umDeMesmoEmpregado:['S-2190','S-2200']},
  'S-2299':{todos:['S-1005','S-1010','S-1020'],umDeMesmoEmpregado:['S-2200']},
  'S-2306':{umDeMesmoEmpregado:['S-2300']},'S-2399':{umDeMesmoEmpregado:['S-2300']},
  'S-1200':{todos:['S-1005','S-1010','S-1020'],umDeMesmoEmpregado:['S-2200','S-2300']},
  'S-1210':{umDeMesmoEmpregadoECompetencia:['S-1200']}, 'S-1298':{umDeMesmaCompetencia:['S-1299']}, 'S-1299':{fechamento:true} };
// Fora do perfil (doc, tabela 2): comercialização rural e avulsos não se aplicam; S-1280 só para Simples com atividades concomitantes (classTrib 03), então fica com o contador.
const FORA=['S-1260','S-1270'],SO_CONTADOR=['S-1280'];
const nc=x=>x?String(x).slice(0,7):null; // 'aaaa-mm' e 'aaaa-mm-01' são a mesma competência
const POR_PESSOA=['S-2190','S-2200','S-2205','S-2206','S-2210','S-2220','S-2230','S-2240','S-2299','S-2300','S-2306','S-2399','S-1200','S-1210'];
const aceito=(f,t,emp,fn)=>f.some(x=>x.tipo===t&&x.status==='aceito'&&(!fn||fn(x)));
function prontoParaTransmitir(ev,fila){
  const motivos=[];const f=(fila||[]).filter(x=>x.empresa_id===undefined||ev.empresa_id===undefined||x.empresa_id===ev.empresa_id);
  if(!/^S-\d{4}$/.test(ev.tipo||''))return {ok:false,motivos:['tipo do evento inválido']};
  if(FORA.includes(ev.tipo)||!(ev.tipo in GRUPO))motivos.push('evento '+ev.tipo+' fora do escopo desta empresa (ver o plano do eSocial)');
  if(SO_CONTADOR.includes(ev.tipo))motivos.push(ev.tipo+' só vale para Simples com atividades concomitantes (classTrib 03): o contador decide antes de enviar');
  if(ev.status!=='pronto')motivos.push('o evento precisa estar "pronto" (hoje: '+ev.status+')');
  if(ev.tipo!=='S-1000'&&!aceito(f,'S-1000'))motivos.push('S-1000 ainda não aceito: nenhum outro evento pode ser enviado antes dele');
  const r=PREREQ[ev.tipo]||{};
  (r.todos||[]).forEach(t=>{if(!aceito(f,t))motivos.push(t+' ainda não aceito')});
  if(POR_PESSOA.includes(ev.tipo)&&!ev.empregado_id)motivos.push('este evento é por empregado ou sócio: falta indicar quem');
  if(ev.tipo==='S-3000'&&!ev.recibo_alvo)motivos.push('S-3000 precisa do recibo do evento a excluir (o grupo do S-3000 está a conferir no manual)');
  if(r.umDeMesmoEmpregado&&ev.empregado_id&&!r.umDeMesmoEmpregado.some(t=>aceito(f,t,0,x=>x.empregado_id===ev.empregado_id)))motivos.push('falta '+r.umDeMesmoEmpregado.join(' ou ')+' aceito para este empregado ou sócio');
  if(r.umDeMesmoEmpregadoECompetencia&&ev.empregado_id&&!aceito(f,'S-1200',0,x=>x.empregado_id===ev.empregado_id&&nc(x.competencia)===nc(ev.competencia))&&!(ev.tipo==='S-1210'&&(aceito(f,'S-2299',0,x=>x.empregado_id===ev.empregado_id)||aceito(f,'S-2399',0,x=>x.empregado_id===ev.empregado_id))))motivos.push('falta S-1200 aceito para este empregado nesta competência (ou S-2299/S-2399 se ele saiu)');
  if(r.umDeMesmaCompetencia&&!aceito(f,'S-1299',0,x=>nc(x.competencia)===nc(ev.competencia)))motivos.push('S-1299 desta competência ainda não aceito (S-1298 só reabre mês fechado)');
  if(r.fechamento){
    if(!ev.competencia)motivos.push('S-1299 precisa da competência');
    const pend=f.filter(x=>nc(x.competencia)===nc(ev.competencia)&&['S-1200','S-1210'].includes(x.tipo)&&x.status!=='aceito');
    if(pend.length)motivos.push(pend.length+' evento(s) S-1200/S-1210 da competência ainda não aceito(s)');
    // "sem movimento": o contador marca explicitamente (sem_movimento:true); o S-1299 é mensal mesmo sem fatos geradores (MOS S-1.3, conferir o leiaute)
    if(ev.sem_movimento!==true&&!f.some(x=>nc(x.competencia)===nc(ev.competencia)&&x.tipo==='S-1200'&&x.status==='aceito'))motivos.push('nenhum S-1200 aceito nesta competência: se o mês não teve movimento, o contador marca "sem movimento" no evento');
  }
  // mês já fechado: S-1200 e S-1210 só depois de reabrir com S-1298 (senão o eSocial rejeita)
  if(['S-1200','S-1210'].includes(ev.tipo)&&aceito(f,'S-1299',0,x=>nc(x.competencia)===nc(ev.competencia))&&!aceito(f,'S-1298',0,x=>nc(x.competencia)===nc(ev.competencia)))motivos.push('competência já fechada (S-1299 aceito): reabra com S-1298 antes de enviar este evento');
  if(['S-1200','S-1210','S-1299','S-1298'].includes(ev.tipo)&&!ev.competencia)motivos.push('evento periódico precisa da competência');
  return {ok:motivos.length===0,motivos};
}
// Ordena para o envio: grupo 1, 2, 3; dentro do grupo, pela ordem lógica; empate por competência e criação.
function ordenaParaEnvio(eventos){return [...eventos].sort((a,b)=>(GRUPO[a.tipo]||9)-(GRUPO[b.tipo]||9)||ORDEM.indexOf(a.tipo)-ORDEM.indexOf(b.tipo)||String(a.competencia||'').localeCompare(String(b.competencia||''))||String(a.criado_em||'').localeCompare(String(b.criado_em||'')))}
// Lotes: um grupo por lote; no grupo 1 (tabelas) um evento por lote (espera o sucesso do anterior). Grupos 2 e 3: até 50 eventos por lote (limite conservador; conferir no Manual do Desenvolvedor).
function lotes(eventos,max=50){const out=[];for(const e of ordenaParaEnvio(eventos)){const g=GRUPO[e.tipo],u=out[out.length-1];
  if(u&&u.grupo===g&&g!==1&&u.eventos.length<max)u.eventos.push(e);else out.push({grupo:g,eventos:[e]})}return out}
// Prazo mensal: dia 15 do mês seguinte, antecipado para o dia útil anterior se cair em fim de semana ou feriado nacional de data fixa (feriados móveis e locais: passe em `feriados`, ou o contador confere). comp = 'aaaa-mm' ou 'aaaa-mm-01'.
const FERIADOS_FIXOS=['01-01','04-21','05-01','09-07','10-12','11-02','11-15','12-25']; // nacionais de data fixa; os móveis (Sexta-feira Santa, Corpus Christi, ponto facultativo) e os locais entram em `feriados`
function prazoFechamento(comp,feriados=[]){const [a,m]=String(comp).split('-').map(Number);if(!a||!m||m<1||m>12)return null;const d=new Date(Date.UTC(m===12?a+1:a,m===12?0:m,15));
  const extra=new Set(feriados);const nao=x=>[0,6].includes(x.getUTCDay())||FERIADOS_FIXOS.includes(x.toISOString().slice(5,10))||extra.has(x.toISOString().slice(0,10));
  while(nao(d))d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10)}
// Transmissor: enviar(lote)->Promise<{protocolo}|{erro}>, grava(id,campos)->Promise. Sem `enviar` real nada é transmitido (modo ensaio). Não passa ao próximo lote se um falhar.
async function transmitir({fila,enviar,grava,ensaio=false}){
  const prontos=fila.filter(e=>e.status==='pronto'),bloqueados=[],enviados=[],falhas=[];
  const livres=[];for(const e of prontos){const r=prontoParaTransmitir(e,fila);if(r.ok)livres.push(e);else bloqueados.push({id:e.id,tipo:e.tipo,motivos:r.motivos})}
  if(ensaio||typeof enviar!=='function')return {ensaio:true,transmitido:false,sairiam:ordenaParaEnvio(livres).map(e=>e.tipo+(e.competencia?' '+e.competencia:'')),bloqueados,enviados,falhas};
  for(const l of lotes(livres)){let r;try{r=await enviar(l)}catch(e){r={erro:String(e&&e.message||e)}}
    if(!r||r.erro||!r.protocolo){for(const e of l.eventos){await grava(e.id,{status:'rejeitado',erro:(r&&r.erro)||'sem protocolo no retorno'});falhas.push({id:e.id,tipo:e.tipo,erro:(r&&r.erro)||'sem protocolo no retorno'})}break}
    for(const e of l.eventos){await grava(e.id,{status:'enviado',protocolo:r.protocolo});enviados.push({id:e.id,tipo:e.tipo,protocolo:r.protocolo})}}
  return {ensaio:false,transmitido:enviados.length>0,enviados,bloqueados,falhas};
}
// ===== Painel de status, reagendar, retificar e excluir (26/11/2026)
// Quatro grupos, como nos painéis de status de outros sistemas: em andamento (enviado, esperando o retorno), pendentes (rascunho ou pronto que ainda não pode seguir, com o MOTIVO), processados (aceitos, com recibo) e rejeitados (com o motivo do eSocial).
// Nada é transmitido aqui: só organiza a fila e devolve o evento novo para quem grava. Retificação = novo evento com indicador de retificação e o recibo do anterior; exclusão = S-3000 com o recibo do evento a excluir [conferir o leiaute vigente].
function painelStatus(fila,opc){
  // opc.catalogo + opc.explica (esocial-explica.js): se o motivo do retorno traz um código MS, anexa o texto OFICIAL e separa falha temporária de erro de dado (27/11/2026).
  const ex=opc&&opc.catalogo&&typeof opc.explica==='function'?opc.explica:null;
  const f=fila||[],g={andamento:[],pendentes:[],processados:[],rejeitados:[]};
  for(const e of f){const base={id:e.id,tipo:e.tipo,competencia:e.competencia||null,empregado_id:e.empregado_id||null};
    if(e.status==='aceito')g.processados.push({...base,recibo:e.recibo||e.protocolo||null});
    else if(e.status==='enviado')g.andamento.push({...base,protocolo:e.protocolo||null});
    else if(e.status==='rejeitado'){const R={...base,motivo:e.erro||'sem motivo no retorno',podeReagendar:true};
      const mc=ex&&String(e.erro||'').match(/\bMS\d{3,4}\b/i);if(mc){const x=ex(mc[0],opc.catalogo,opc.params);if(x&&x.achou){R.codigo=x.codigo;R.oficial={mensagem:x.mensagem,acao:x.acao};R.subtipo=/temporária/.test(x.tipo)?'falha temporária':'erro de dado'}}
      g.rejeitados.push(R)}
    else{const r=prontoParaTransmitir(e.status==='rascunho'?{...e,status:'pronto'}:e,f);g.pendentes.push({...base,status:e.status,motivos:e.status==='rascunho'?['ainda é rascunho: o contador marca "pronto"'].concat(r.motivos):r.motivos})}}
  return {...g,totais:{andamento:g.andamento.length,pendentes:g.pendentes.length,processados:g.processados.length,rejeitados:g.rejeitados.length,total:f.length},
    aviso:'Painel de acompanhamento. A transmissão real só roda com e-CNPJ A1, procuração e contrato SERPRO.'}}
// Rejeitado volta para "pronto" DEPOIS de o motivo ser corrigido (o contador diz o que corrigiu). Não cria evento novo (como o "reagendar" de outros sistemas).
function reagendar(ev,correcao){
  if(!ev||ev.status!=='rejeitado')return {ok:false,erro:'só evento rejeitado pode ser reagendado (hoje: '+(ev&&ev.status)+')'};
  if(!correcao||!String(correcao).trim())return {ok:false,erro:'diga o que foi corrigido antes de reagendar (fica no histórico)'};
  return {ok:true,campos:{status:'pronto',erro:null,historico:(ev.historico||[]).concat([{quando:new Date().toISOString(),acao:'reagendado',nota:String(correcao).trim(),motivo_anterior:ev.erro||null}])}}}
// Retificar: o evento aceito tem de ter recibo; o novo evento nasce como rascunho e leva o recibo do anterior.
function retificar(ev){
  if(!ev||ev.status!=='aceito')return {ok:false,erro:'só evento aceito pode ser retificado (hoje: '+(ev&&ev.status)+')'};
  const rec=ev.recibo||ev.protocolo;if(!rec)return {ok:false,erro:'o evento aceito não tem recibo gravado: sem ele não há como retificar'};
  if(['S-3000','S-1298','S-1299'].includes(ev.tipo))return {ok:false,erro:ev.tipo+' não se retifica (para desfazer, use exclusão ou reabertura conforme o manual) [conferir]'};
  return {ok:true,evento:{tipo:ev.tipo,empresa_id:ev.empresa_id,empregado_id:ev.empregado_id,competencia:ev.competencia,payload:ev.payload,status:'rascunho',retifica:true,recibo_anterior:rec}}}
// Excluir: gera o S-3000 apontando para o recibo do evento aceito.
function excluir(ev){
  if(!ev||ev.status!=='aceito')return {ok:false,erro:'só evento aceito pode ser excluído (hoje: '+(ev&&ev.status)+')'};
  const rec=ev.recibo||ev.protocolo;if(!rec)return {ok:false,erro:'o evento aceito não tem recibo gravado: sem ele não há como excluir'};
  if(ev.tipo==='S-3000')return {ok:false,erro:'não se exclui um S-3000'};
  return {ok:true,evento:{tipo:'S-3000',empresa_id:ev.empresa_id,empregado_id:ev.empregado_id,competencia:ev.competencia,status:'rascunho',recibo_alvo:rec,tipo_alvo:ev.tipo}}}
if(typeof module!=='undefined')module.exports={painelStatus,reagendar,retificar,excluir,GRUPO,ORDEM,PREREQ,prontoParaTransmitir,ordenaParaEnvio,lotes,prazoFechamento,transmitir};
