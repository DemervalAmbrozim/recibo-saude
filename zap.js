// Motor do WhatsApp (27/10/2026): entende o que a profissional escreve ("Maria 180 pix") e responde.
// Não fala com o banco direto: recebe os dados (link_dados) e um objeto api com as mesmas funções link_* do app.
// Assim a regra é uma só para app, painel e zap. Usa regras.js (apura, ultimoDiaUtil, contas).
// Roda no navegador, no node (testes) e na função zap do Supabase (supabase/functions/zap).

const ZAP_MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const zNorm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const zBrl=n=>(+n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const zDBR=iso=>iso.split('-').reverse().join('/').slice(0,5);
const zISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const zCpf=c=>{c=String(c||'').replace(/\D/g,'');if(c.length!==11||/^(\d)\1+$/.test(c))return false;
  for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=+c[i]*(t+1-i);if(((s*10)%11)%10!==+c[t])return false}return true};

const FORMAS={pix:'Pix',dinheiro:'Dinheiro',especie:'Dinheiro',cartao:'Cartão',credito:'Cartão',debito:'Cartão',transferencia:'Transferência',ted:'Transferência',doc:'Transferência'};
const A_RECEBER=['receber','fiado','depois','pendente','deve'];
// Palavra da despesa → conta do Carnê-Leão (regras.js)
const DESP={aluguel:'P10.01.00002',condominio:'P10.01.00003',agua:'P10.01.00001',luz:'P10.01.00007',energia:'P10.01.00007',
  internet:'P10.01.00014',telefone:'P10.01.00014',gas:'P10.01.00008',iptu:'P10.01.00009',anuidade:'P10.01.00004',crefito:'P10.01.00004',
  conselho:'P10.01.00004',limpeza:'P10.01.00011',escritorio:'P10.01.00012',funcionario:'P10.01.00013',salario:'P10.01.00013',iss:'P10.01.00010',inss:INSS};

// Valor: 180 | 180,50 | 1.200 | R$ 1.200,00
const zValor=t=>{t=t.replace(/^r\$/,'');if(!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t))return null;const v=parseFloat(t.replace(/\./g,'').replace(',','.'));return v>0?v:null};
// Data: hoje | ontem | anteontem | 25/10 | 25/10/2026 | dia 25
function zData(t,hoje,ant){const h=new Date(hoje+'T12:00');
  if(t==='hoje')return hoje;if(t==='ontem'){h.setDate(h.getDate()-1);return zISO(h)}if(t==='anteontem'){h.setDate(h.getDate()-2);return zISO(h)}
  let m=t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if(m){let a=m[3]?+m[3]:h.getFullYear();if(a<100)a+=2000;const d=new Date(a,+m[2]-1,+m[1],12);
    if(d.getDate()!==+m[1])return null;if(!m[3]&&d>h)d.setFullYear(a-1);return zISO(d)}
  if(ant==='dia'&&/^\d{1,2}$/.test(t)){const d=new Date(h.getFullYear(),h.getMonth(),+t,12);if(d>h)d.setMonth(d.getMonth()-1);return d.getDate()===+t?zISO(d):null}
  return null}

// Separa a linha em: nome, valor, forma, data, a receber
function zPartes(linha,hoje){const ts=zNorm(linha).replace(/\s+r\$\s*/g,' r$').split(/\s+/).filter(Boolean);
  const r={nome:[],valor:null,forma:null,data:null,receber:false,resto:[]};
  ts.forEach((t,i)=>{const v=zValor(t),d=zData(t,hoje,ts[i-1]);
    if(r.valor===null&&v!==null&&r.nome.length)r.valor=v;
    else if(d)r.data=d;else if(FORMAS[t])r.forma=FORMAS[t];else if(A_RECEBER.includes(t))r.receber=true;
    else if(['a','de','em','no','na','dia','reais','real','r$','pago','paga','pagou','com','pelo','pela'].includes(t)&&r.nome.length)r.resto.push(t);
    else if(r.valor===null)r.nome.push(t);else r.resto.push(t)});
  return r}

// Acha a paciente pelo começo do nome: "maria" acha "Maria Silva"; "maria s" separa duas Marias
function zAcha(pacs,nome){const q=nome.filter(Boolean);if(!q.length)return[];
  const exato=pacs.filter(p=>zNorm(p.nome)===q.join(' '));if(exato.length)return exato;
  const seq=p=>{const ns=zNorm(p.nome).split(/\s+/);let i=0;for(const n of ns)if(i<q.length&&n.startsWith(q[i]))i++;return i===q.length?ns:null};
  const ini=pacs.filter(p=>{const ns=seq(p);return ns&&ns[0].startsWith(q[0])});
  // Sem ninguém pelo 1º nome, vale o sobrenome ou o nome do meio: "silva" acha "Maria Silva"
  return ini.length?ini:pacs.filter(p=>seq(p))}

const AJUDA=`É só escrever como fala:
• *Maria 180 pix* (lança o atendimento de hoje)
• *Maria 180 ontem* ou *Maria 180 25/10*
• *Maria 180 a receber* (ainda não pagou)
• *Maria recebi 90* (recebeu tudo ou parte)
• *aluguel 1200* (despesa do consultório)
• *resumo* (o mês até agora)
• *cnpj* (pessoa física ou CNPJ: o que sai mais barato)
• *darf* (Carnê-Leão a pagar)
• *a receber* (quem está devendo)
• *novo Maria Silva 123.456.789-09* (paciente nova)
• *desfazer* (apaga o último lançamento)
Pode mandar vários de uma vez, um por linha.`;

// Resumo do mês: recebido, atendimentos, a receber, despesas e Carnê-Leão estimado
function zResumo(D,hoje){const mes=hoje.slice(0,7),[a,m]=mes.split('-').map(Number);
  const pagos=D.atendimentos.filter(x=>x.pago!==false), noMes=pagos.filter(x=>x.data.startsWith(mes)),
    abertos=D.atendimentos.filter(x=>x.pago===false), ds=D.despesas.filter(x=>x.data.startsWith(mes));
  const r=apura(pagos,D.despesas,mes);
  return `*${ZAP_MESES[m-1]} até ${zDBR(hoje)}*\nRecebido: ${zBrl(soma(noMes))} em ${noMes.length} atendimento${noMes.length===1?'':'s'}`
    +(abertos.length?`\nA receber: ${zBrl(soma(abertos))} (${abertos.length})`:'')
    +(ds.length?`\nDespesas lançadas: ${zBrl(soma(ds))}`:'')
    +`\nCarnê-Leão estimado deste mês: ${r.darf.pagar?zBrl(r.darf.pagar)+`, vence ${ultimoDiaUtil(m===12?a+1:a,m%12).toLocaleDateString('pt-BR')}`:'nada a pagar até agora'}.`
    +((c=>c?.mostra?`\nPela sua média, um CNPJ pode sair ${zBrl(c.eco)} por mês mais barato. Mande *cnpj* para ver.`:'')(cnpjAviso(pagos,D.despesas,mes)))}

// DARF do mês passado (vence no último dia útil deste mês)
function zDarf(D,hoje){const h=new Date(hoje+'T12:00'),p=new Date(h.getFullYear(),h.getMonth()-1,1),mes=zISO(p).slice(0,7);
  const r=apura(D.atendimentos.filter(x=>x.pago!==false),D.despesas,mes),venc=ultimoDiaUtil(h.getFullYear(),h.getMonth());
  const nome=`${ZAP_MESES[p.getMonth()]}/${p.getFullYear()}`;
  return r.darf.pagar?`Carnê-Leão de ${nome}: *${zBrl(r.darf.pagar)}*, vence em ${venc.toLocaleDateString('pt-BR')}. A Assessoria gera o DARF e manda aqui.`
    :r.darf.adia?`Carnê-Leão de ${nome}: ${zBrl(r.darf.total)}. Abaixo de R$ 10 a Receita não gera DARF: soma ao mês seguinte.`
    :`Carnê-Leão de ${nome}: nada a pagar (recebido ${zBrl(r.rec)}).`}

function zReceber(D){const ab=D.atendimentos.filter(x=>x.pago===false);
  return ab.length?'*A receber*\n'+ab.map(x=>`• ${x.paciente}: ${zBrl(x.valor)} (${zDBR(x.data)})`).join('\n')+`\nTotal: ${zBrl(soma(ab))}\nQuando pagar: *nome recebi valor*`
    :'Ninguém devendo. 👏'}

const zErro=e=>/somente leitura/.test(e)?'Sua conta está só para consulta e não aceita lançamentos. Fale com a Assessoria para continuar.'
  :/data invalida/.test(e)?'Essa data não dá: lance até um ano para trás e nunca no futuro.':'Não consegui gravar agora. Tente de novo em instantes.';

// Uma linha da mensagem. est = memória da conversa (escolha entre homônimas, último lançamento).
async function zLinha(linha,D,api,est,hoje){const t=zNorm(linha);
  if(!t)return null;
  if(/^(oi|ola|bom dia|boa tarde|boa noite|ajuda|menu|\?)\b/.test(t)&&t.split(' ').length<=3)return `Olá, ${(D.nome||'').split(' ')[0]}! `+AJUDA;
  if(/^(resumo|mes|extrato|quanto)$/.test(t))return zResumo(D,hoje);
  if(/^(cnpj|empresa|pj)$/.test(t)){const c=cnpjAviso(D.atendimentos.filter(x=>x.pago!==false),D.despesas,hoje.slice(0,7));
    return !c?'Para comparar pessoa física e CNPJ preciso de 3 meses completos com atendimentos lançados.':c.mostra?c.txt:`Pela média de ${zBrl(c.R)} por mês, o CNPJ ainda não compensa: a diferença seria de ${zBrl(c.eco)} por mês. Eu aviso se isso mudar.`}
  if(/^(darf|imposto|carne[ -]?leao)$/.test(t))return zDarf(D,hoje);
  if(/^(a receber|receber|pendentes?|devendo)$/.test(t))return zReceber(D);
  // Perguntas do jeito que se fala, sem número: "quanto já recebi esse mês?", "quanto pago de imposto?", "quem me deve?"
  if(!/\d/.test(t)){if(/\b(imposto|carne|darf|leao)\b/.test(t)&&/\b(quanto|qual|tenho|vou|devo|pagar|pago)\b/.test(t))return zDarf(D,hoje);
    if(/\bquem\b.*\b(deve|devendo|falta|pagou)\b|\b(falta|ainda) receber\b/.test(t))return zReceber(D);
    if(/\bquanto\b.*\b(recebi|ganhei|faturei|entrou|fiz|tirei)\b|\bcomo (esta|ta) (o|meu) mes\b/.test(t))return zResumo(D,hoje)}
  if(/^(recibos?|pdfs?)$/.test(t))return 'Os PDFs dos recibos chegam aqui assim que a Assessoria emitir no Receita Saúde, no fechamento do mês. O paciente também vê no app Receita Saúde (gov.br).';
  if(/^(desfazer|desfaz|apagar|apaga|cancela|cancelar)$/.test(t)){const u=est.ultimo;
    if(!u)return 'Não tenho lançamento recente seu para desfazer. Para apagar outro, use o app (aba Lançar).';
    if(u.tipo==='rec')return `O último foi um ${u.txt}: esse se corrige no app (aba Lançar). Nada foi apagado.`;
    try{await api[u.tipo==='desp'?'apagaDespesa':'apaga'](u.id)}catch(e){return zErro(String(e.message||e))}
    est.ultimo=null;return `Desfeito: ${u.txt}.`}
  // Escolha entre homônimas: "2"
  if(/^\d$/.test(t)&&est.escolha){const e=est.escolha,p=e.opcoes[+t-1];if(!p)return `Responda com um número de 1 a ${e.opcoes.length}.`;
    est.escolha=null;return zLanca(Object.assign(e.pedido,{pac:p}),D,api,est,hoje)}
  // Paciente nova: novo Maria Silva 12345678909
  let m=linha.match(/^\s*(novo|nova|cadastrar|cadastra)\s+(.+?)\s+(?:cpf\s*)?([\d.\-\s]{11,14})\s*$/i);
  if(m){const cpf=m[3].replace(/\D/g,''),nome=m[2].replace(/\bcpf\b/i,'').trim();
    if(!zCpf(cpf))return 'Esse CPF não confere. Mande de novo: *novo Nome Sobrenome 123.456.789-09*';
    if(nome.split(/\s+/).length<2)return 'Mande o nome completo, como vai no recibo: *novo Nome Sobrenome CPF*';
    try{const id=await api.paciente(nome,cpf);D.pacientes.push({id,nome});return `Cadastrada: ${nome}. Agora é só lançar: *${nome.split(' ')[0]} 180 pix*`}
    catch(e){return zErro(String(e.message||e))}}
  if(/^(novo|nova|cadastrar|cadastra)\b/.test(t))return 'Para cadastrar: *novo Nome Sobrenome 123.456.789-09* (o CPF de quem é atendido).';
  const p=zPartes(linha,hoje);
  // Recebeu: "Maria recebi 90" ou "recebi Maria"
  const iR=p.nome.findIndex(x=>/^(recebi|recebido|pagou|quitou)$/.test(x));
  if(iR>=0||p.resto.some(x=>/^(recebi|recebido|pagou|quitou)$/.test(x))){const nome=p.nome.filter((x,i)=>i!==iR);
    const ab=D.atendimentos.filter(x=>x.pago===false&&!x.emitido),cand=zAcha(D.pacientes,nome);
    const dela=ab.filter(x=>cand.some(c=>zNorm(c.nome)===zNorm(x.paciente))).sort((a,b)=>a.data<b.data?-1:1);
    if(!dela.length)return cand.length?`Não há nada a receber de ${cand[0].nome}. Mande *a receber* para ver a lista.`:`Não achei "${nome.join(' ')}". Mande *a receber* para ver a lista.`;
    const a=dela[0],v=Math.min(p.valor||a.valor,a.valor);
    try{await api.receber(a.id,v,p.data||hoje)}catch(e){return zErro(String(e.message||e))}
    a.valor-=v;if(a.valor<=0)a.pago=true;
    // "desfazer" agora não pode apagar o atendimento de antes: recebimento se corrige no app
    est.ultimo={tipo:'rec',txt:`recebimento de ${a.paciente}`};
    return `✅ Recebido de ${a.paciente}: ${zBrl(v)}`+(a.valor>0?`. Ainda falta ${zBrl(a.valor)}.`:'.')}
  // Despesa: "aluguel 1200" (ou "despesa aluguel 1200")
  const n0=p.nome[0]==='despesa'||p.nome[0]==='paguei'?p.nome.slice(1):p.nome;
  if(DESP[n0[0]]&&p.valor&&(n0!==p.nome||!zAcha(D.pacientes,p.nome).length)){const cod=DESP[n0[0]];
    const locs=D.locais.filter(l=>TIPOS[l.tipo]&&TIPOS[l.tipo][1]>0),loc=IMOVEL.includes(cod)&&locs[0]||null;
    try{const id=await api.despesa(cod,p.data||hoje,p.valor,loc&&loc.id);
      const txt=`${nomeCod(cod)}: ${zBrl(p.valor)} em ${zDBR(p.data||hoje)}`;est.ultimo={tipo:'desp',id,txt};
      return `✅ Despesa lançada. ${txt}`+(loc&&TIPOS[loc.tipo][1]<1?` (abate ${Math.round(TIPOS[loc.tipo][1]*100)}% por ser ${TIPOS[loc.tipo][0].toLowerCase()}).`:'.')+' Errou? *desfazer*'}
    catch(e){return zErro(String(e.message||e))}}
  if(!p.nome.length)return p.valor?'De quem é esse valor? Ex.: *Maria 180 pix*':'Não entendi. '+AJUDA;
  if(!p.valor)return `Faltou o valor. Ex.: *${p.nome[0].replace(/^./,c=>c.toUpperCase())} 180 pix*`;
  const cand=zAcha(D.pacientes,p.nome);
  if(!cand.length)return `Não achei "${p.nome.join(' ')}" entre seus pacientes. Para cadastrar: *novo Nome Sobrenome CPF*`;
  if(cand.length>1){est.escolha={opcoes:cand.slice(0,9),pedido:p};
    return `Qual delas?\n`+cand.slice(0,9).map((c,i)=>`${i+1}. ${c.nome}`).join('\n')+'\nResponda só com o número.'}
  return zLanca(Object.assign(p,{pac:cand[0]}),D,api,est,hoje)}

async function zLanca(p,D,api,est,hoje){const data=p.data||hoje,forma=p.forma||'Pix',pago=!p.receber;
  if(data>hoje)return 'Essa data ainda não chegou. Lance no dia do atendimento.';
  let id;try{id=await api.lanca(p.pac.id,data,p.valor,forma,pago)}catch(e){return zErro(String(e.message||e))}
  D.atendimentos.unshift({id,data,valor:p.valor,forma,paciente:p.pac.nome,pago,emitido:false});
  const txt=`${p.pac.nome} · ${zBrl(p.valor)} · ${pago?forma:'a receber'} · ${data===hoje?'hoje':zDBR(data)}`;est.ultimo={tipo:'at',id,txt};
  const mes=hoje.slice(0,7),noMes=D.atendimentos.filter(x=>x.pago!==false&&x.data.startsWith(mes));
  return `✅ ${txt}\nNo mês: ${zBrl(soma(noMes))} em ${noMes.length}. Errou? *desfazer*`}

// Mensagem inteira (pode ter várias linhas). Devolve o texto da resposta; est é alterado no lugar.
async function zapResponde(texto,D,api,est,hoje){const out=[];
  const linhas=String(texto||'').split(/\n+/).filter(l=>l.trim()).slice(0,20);
  for(const l of linhas){const r=await zLinha(l,D,api,est,hoje);if(r)out.push(r)}
  return out.join('\n\n')||AJUDA}

if(typeof module!=='undefined')module.exports={zapResponde,zPartes,zAcha,zData,zValor,AJUDA};
