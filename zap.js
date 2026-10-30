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
• *lançar* (passo a passo com opções: paciente, valor, forma e dia)
• *Maria 180 pix* (lança o atendimento de hoje)
• *Maria 180 ontem* ou *Maria 180 25/10*
• *Maria 180 a receber* (ainda não pagou)
• *Maria recebi 90* (recebeu tudo ou parte)
• *aluguel 1200* (despesa do consultório)
• *resumo* (o mês até agora)
• *cnpj* (pessoa física ou CNPJ: o que sai mais barato)
• *reforma* (os novos impostos de 2027 e o que muda para você)
• *procuração* (passo a passo para a Assessoria emitir por você)
• *posts* (seus posts do mês, do bônus)
• *darf* (Carnê-Leão a pagar)
• *paguei* (marca o DARF do mês passado como pago)
• *posso deduzir o curso?* (o que abate no livro-caixa)
• *a receber* (quem está devendo)
• *Maria pacote 10 1500 pix* e depois *Maria sessão* (pacotes)
• *novo Maria Silva 123.456.789-09* (paciente nova)
• *desfazer* (apaga o último lançamento)
• foto ou PDF de uma conta paga (guardo o comprovante e lanço a despesa)
• *indicar* (seu código para indicar uma colega)
• *suporte* e o que aconteceu (fala com uma pessoa)
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

// Primeira semana da cliente (rotina 19h45): 1º, 3º e 7º dia desde o cadastro, com o que fazer e o que já ganhou.
// d = dias desde o cadastro (0 = o próprio dia). Outros dias: nada.
function zSemana1(D,d){const at=D.atendimentos||[],ds=D.despesas||[],q=n=>`${n} atendimento${n===1?'':'s'}`;
  if(d===0)return at.length
    ?`Bem-vinda! Você já lançou ${q(at.length)} (${zBrl(soma(at))}). É assim todo dia: mandou aqui, está guardado e o recibo sai pronto no fim do mês.`
    :`Bem-vinda! Seu primeiro passo leva 10 segundos: mande aqui o último atendimento, ex.: *Maria 180 pix*. O resto (recibo, Carnê-Leão, lembretes) é com a gente. Mande *ajuda* para ver tudo que dá para fazer.`;
  if(d===2)return (at.length?`Em 3 dias: ${q(at.length)}, ${zBrl(soma(at))} guardados com recibo garantido.`:`Ainda sem atendimentos lançados. Mande o de hoje, ex.: *Maria 180 pix*.`)
    +(ds.length?` Despesas: ${zBrl(soma(ds))}, que já abatem do Carnê-Leão.`:` Próximo passo: a despesa do consultório (ex.: *aluguel 1200*). Ela abate do Carnê-Leão e diminui o imposto.`);
  if(d===6)return `Sua primeira semana: ${q(at.length)} (${zBrl(soma(at))})`+(ds.length?` e ${zBrl(soma(ds))} em despesas`:'')
    +`. Mande *resumo* para ver o mês e *darf* para saber o Carnê-Leão. No último dia do mês eu aviso para conferir, e os recibos saem sem você digitar nada de novo.`;
  return ''}

// "paguei" (8f ressalva 2): marca o DARF do mês passado como pago hoje, pelo valor calculado ou o que ela disser ("paguei 126,42")
async function zPaguei(t,D,api,hoje){const h=new Date(hoje+'T12:00'),p=new Date(h.getFullYear(),h.getMonth()-1,1),mes=zISO(p).slice(0,7),nome=`${ZAP_MESES[p.getMonth()]}/${p.getFullYear()}`;
  const v=t.match(/([\d.]+(,\d{1,2})?)$/),calc=apura(D.atendimentos.filter(x=>x.pago!==false),D.despesas,mes).darf.pagar,val=v?+v[1].replace(/\./g,'').replace(',','.'):calc;
  if(!(val>0))return `Não há DARF de ${nome} para pagar. Se você pagou outro valor, mande *paguei* e o valor, ex.: *paguei 126,42*.`;
  if(!api.darfPago)return 'Anotado.';try{await api.darfPago(mes,val,hoje)}catch(e){return zErro(String(e.message||e))}
  D.darfs=(D.darfs||[]).filter(x=>x.mes!==mes).concat({mes,valor:val,pago_em:hoje});
  return `Anotado ✅ DARF de ${nome}: ${zBrl(val)}, pago hoje. Entra como pago no relatório do IR. Guarde o comprovante do banco.`+(calc&&Math.abs(calc-val)>0.009?`\nObs.: o valor calculado era ${zBrl(calc)}. Se pagou com multa ou outro valor, está certo assim.`:'')}
// DARF do mês passado (vence no último dia útil deste mês)
function zDarf(D,hoje){const h=new Date(hoje+'T12:00'),p=new Date(h.getFullYear(),h.getMonth()-1,1),mes=zISO(p).slice(0,7);
  const r=apura(D.atendimentos.filter(x=>x.pago!==false),D.despesas,mes),venc=ultimoDiaUtil(h.getFullYear(),h.getMonth());
  const nome=`${ZAP_MESES[p.getMonth()]}/${p.getFullYear()}`;
  const pg=(D.darfs||[]).find(x=>x.mes===mes);if(pg)return `Carnê-Leão de ${nome}: ${zBrl(+pg.valor)}, pago em ${new Date(pg.pago_em+'T12:00').toLocaleDateString('pt-BR')} ✅`;
  return r.darf.pagar?`Carnê-Leão de ${nome}: *${zBrl(r.darf.pagar)}*, vence em ${venc.toLocaleDateString('pt-BR')}. A Assessoria gera o DARF e manda aqui.`
    :r.darf.adia?`Carnê-Leão de ${nome}: ${zBrl(r.darf.total)}. Abaixo de R$ 10 a Receita não gera DARF: soma ao mês seguinte.`
    :`Carnê-Leão de ${nome}: nada a pagar (recebido ${zBrl(r.rec)}).`}

function zReceber(D){const ab=D.atendimentos.filter(x=>x.pago===false);
  return ab.length?'*A receber*\n'+ab.map(x=>`• ${x.paciente}: ${zBrl(x.valor)} (${zDBR(x.data)})`).join('\n')+`\nTotal: ${zBrl(soma(ab))}\nQuando pagar: *nome recebi valor*`
    :'Ninguém devendo. 👏'}

const zErro=e=>/somente leitura/.test(e)?'Sua conta está só para consulta e não aceita lançamentos. Fale com a Assessoria para continuar.'
  :/data invalida/.test(e)?'Essa data não dá: lance até um ano para trás e nunca no futuro.':'Não consegui gravar agora. Tente de novo em instantes.';

// Procuração no e-CAC (revisão item 5): o mesmo passo a passo do app (lancar.html, proc-passos). Ressalva 4 (29/10): o manual Receita Saúde 2.1,
// pergunta 10, pede o CPF do representante; procurador CNPJ exige e-CNPJ. O CPF não fica no código público: vem do segredo PROCURADOR_CPF (api.procurador).
const PROCURACAO=`Procuração no e-CAC (5 minutos, no computador ou no celular):
1. Entre no e-CAC (cav.receita.fazenda.gov.br) com o seu gov.br (nível prata ou ouro).
2. Menu *Senhas e Procurações* → *Cadastro, Consulta e Cancelamento - Procuração para e-CAC* → *Cadastrar Procuração*.
3. Procurador: escolha *CPF* e digite {CPF} (responsável pela Lado a Lado Assessoria). É CPF, não CNPJ: assim o Receita Saúde abre o perfil Representante.
4. Validade: pode deixar a que o e-CAC sugere; você cancela quando quiser, no mesmo menu.
5. Marque só o serviço *IRPF - Carnê Leão Web* e confirme.
Pronto? Responda *fiz a procuração* que a Assessoria confere.`;

// Perguntas livres (revisão item 15, 28/10): "posso deduzir o curso?". Regra do livro-caixa: RIR/2018 (Decreto 9.580/2018) art. 68,
// conferido no Planalto em 28/10/2026: abate salário com carteira e encargos (I), emolumentos (II) e custeio necessário à atividade (III);
// não abate depreciação de equipamento e arrendamento (§ ún. I) nem locomoção e transporte (§ ún. II). O que é parecer vai ao contador.
const ART68='(Regulamento do IR, art. 68)',CONTADOR_Q=' Isso é parecer: mande *suporte* que a Assessoria leva ao contador.';
const PERGUNTAS=[
  [/carro|combustivel|gasolina|estacionamento|uber|onibus|transporte|locomocao|pedagio|moto\b/,`Não abate. Carro, combustível, estacionamento e transporte ficam de fora para quem é da saúde ${ART68}.`],
  [/congresso|seminario|simposio|jornada|encontro cientifico|workshop|livro/,`Abate, se for da sua área e necessário ao trabalho: inscrição, livros e material, hospedagem e transporte da viagem, sem reembolso (Receita, Perguntas e Respostas IRPF 2026, nº 444 e 438). Guarde a nota e o certificado de presença. Lance em despesas.`],
  [/curso|especializacao|pos.graduacao|mestrado|formacao/,`Depende. Congresso e seminário da área abatem (Perguntas e Respostas IRPF 2026, nº 444); curso longo, pós ou especialização a Receita costuma tratar como despesa de instrução da declaração anual, não do livro-caixa. Guarde a nota.`+CONTADOR_Q],
  [/computador|notebook|celular|aparelho|equipamento|maca|maquina|movel|moveis|cadeira|ar.condicionado|impressora|leasing|arrendamento/,`Compra de equipamento ou móvel não abate, nem a depreciação ou o arrendamento ${ART68}. Material que se gasta no atendimento (luva, gel, papel, álcool) abate: lance em *material*.`],
  [/reforma|obra|pintura|conserto do (imovel|consultorio)/,`Reforma e obra do imóvel não abatem como despesa do mês ${ART68}. Manutenção pequena do consultório é parecer.`+CONTADOR_Q],
  [/secretaria|funcionari|empregad|salario|recepcionista|faxineir|diarista/,`Abate o salário de quem tem carteira assinada e os encargos (INSS, FGTS) ${ART68}. Sem carteira (diarista, ajudante), abate se for custeio necessário ao atendimento, com recibo (Perguntas e Respostas IRPF 2026, nº 440).`+CONTADOR_Q],
  [/aluguel|condominio|luz|energia|agua|internet|telefone|iptu/,`Abate, se for do lugar onde você atende ${ART68}: consultório ou sala, 100%; casa que também é consultório, 1/5 das contas. Lance com o local: ex. *aluguel 1200*.`],
  [/anuidade|crefito|crp\b|conselho|crefono|cro\b|crm\b/,`A anuidade do conselho abate: é obrigatória para trabalhar (Perguntas e Respostas IRPF 2026, nº 439; ${ART68.slice(1,-1)}). Lance em despesas e guarde o boleto pago.`],
  [/plano de saude|escola|faculdade dos filhos|medico|dentista|remedio|farmacia|previdencia privada|pgbl/,`Isso não entra no livro-caixa do mês: é dedução da declaração anual do IR (saúde, educação, PGBL), com regras próprias.`+CONTADOR_Q]];
function zPergunta(t){if(!/(posso|pode|da pra|da para|consigo).{0,20}(deduz|abat|descont|lancar)|^(deduz|abate)|\b(e dedutivel|abate\?|deduz\?)/.test(t))return null;
  const r=PERGUNTAS.find(([re])=>re.test(t));
  return r?r[1]:`Pela lei, abate o que é necessário para receber e manter a sua atividade: aluguel e contas do consultório, material, salário de quem tem carteira ${ART68}.`+CONTADOR_Q}

// Lançamento guiado (pedido do ensaio de 29/10: "didático, com opções"): *lançar* → paciente → valor → forma → dia.
// est.guia guarda só ids e números (LGPD): {passo, ops:[ids], pac, valor, forma, pago}
const G_FORMAS=[['Pix',true],['Dinheiro',true],['Cartão',true],['Transferência',true],['a receber',false]];
const G_SAIR=/^(sair|cancela|cancelar|parar|desisto)$/,G_FORA=/^(oi|ola|ajuda|menu|resumo|darf|a receber|desfazer)$/;
function gPergunta(g,D,hoje){const pac=D.pacientes.find(x=>x.id===g.pac);
  if(g.passo==='pac')return `*Lançar atendimento* (1 de 4)\nQual paciente?\n`+g.ops.map((id,i)=>`${i+1}. ${D.pacientes.find(x=>x.id===id).nome}`).join('\n')
    +'\nResponda com o número ou escreva o nome. Para sair: *sair*';
  if(g.passo==='valor'){const u=D.atendimentos.filter(x=>pac&&zNorm(x.paciente)===zNorm(pac.nome)).sort((a,b)=>a.data<b.data?1:-1)[0];g.ult=u?+u.valor:null;
    return `*${pac.nome}* (2 de 4)\nQual o valor?\n`+(u?`1. ${zBrl(u.valor)} (o último lançado)\nou escreva outro valor, ex.: *180*`:'Escreva o valor, ex.: *180*')}
  if(g.passo==='forma')return `*${pac.nome} · ${zBrl(g.valor)}* (3 de 4)\nComo pagou?\n`+G_FORMAS.map(([f,pg],i)=>`${i+1}. ${pg?f:'Ainda não pagou (a receber)'}`).join('\n');
  const o=new Date(hoje+'T12:00');o.setDate(o.getDate()-1);
  return `*${pac.nome} · ${zBrl(g.valor)} · ${g.pago?g.forma:'a receber'}* (4 de 4)\nQuando foi o atendimento?\n1. Hoje (${zDBR(hoje)})\n2. Ontem (${zDBR(zISO(o))})\nou escreva a data, ex.: *25/10*`}
function gInicio(D,est,hoje){const vistos=[];
  for(const a of [...D.atendimentos].sort((a,b)=>a.data<b.data?1:-1)){const p=D.pacientes.find(x=>zNorm(x.nome)===zNorm(a.paciente));if(p&&!vistos.includes(p.id))vistos.push(p.id)}
  for(const p of D.pacientes)if(!vistos.includes(p.id))vistos.push(p.id);
  if(!vistos.length)return 'Você ainda não tem pacientes cadastrados. Primeiro: *novo Nome Sobrenome 123.456.789-09*';
  est.escolha=null;est.guia={passo:'pac',ops:vistos.slice(0,8)};return gPergunta(est.guia,D,hoje)}
async function gResponde(t,linha,D,api,est,hoje){const g=est.guia,n=/^\d$/.test(t)?+t:0,de_novo=x=>`${x}\n\n`+gPergunta(g,D,hoje);
  if(G_SAIR.test(t)){est.guia=null;return 'Lançamento cancelado. Nada foi gravado.'}
  if(G_FORA.test(t)){est.guia=null;return undefined}
  if(g.passo==='pac'){if(n){if(!g.ops[n-1])return de_novo(`Responda com um número de 1 a ${g.ops.length}.`);g.pac=g.ops[n-1]}
    else{const q=zPartes(linha,hoje);if(q.valor){est.guia=null;return undefined}  // escreveu a frase inteira: segue o jeito rápido
      const c=zAcha(D.pacientes,q.nome);
      if(!c.length)return `Não achei "${linha.trim()}" entre seus pacientes. Escreva de novo, ou *sair* e cadastre: *novo Nome Sobrenome CPF*`;
      if(c.length>1){g.ops=c.slice(0,8).map(x=>x.id);return gPergunta(g,D,hoje)}g.pac=c[0].id}
    g.passo='valor';return gPergunta(g,D,hoje)}
  if(g.passo==='valor'){const v=n===1&&g.ult?g.ult:zValor(t.replace(/\s/g,''));if(!v)return de_novo('Não entendi o valor.');
    g.valor=v;g.passo='forma';return gPergunta(g,D,hoje)}
  if(g.passo==='forma'){const f=n?G_FORMAS[n-1]:FORMAS[t]?[FORMAS[t],true]:A_RECEBER.some(x=>t.includes(x))?G_FORMAS[4]:null;
    if(!f)return de_novo(`Responda com um número de 1 a ${G_FORMAS.length}.`);g.forma=f[1]?f[0]:'Pix';g.pago=f[1];g.passo='data';return gPergunta(g,D,hoje)}
  const o=new Date(hoje+'T12:00');o.setDate(o.getDate()-1);
  const data=n===1?hoje:n===2?zISO(o):zData(t.replace(/^dia /,''),hoje,/^dia /.test(t)?'dia':'');
  if(!data)return de_novo('Não entendi a data.');
  const pac=D.pacientes.find(x=>x.id===g.pac);est.guia=null;
  return zLanca({pac,valor:g.valor,forma:g.forma,receber:!g.pago,data},D,api,est,hoje)}

// Uma linha da mensagem. est = memória da conversa (escolha entre homônimas, último lançamento).
async function zLinha(linha,D,api,est,hoje){const t=zNorm(linha);
  if(!t)return null;
  if(est.guia){const r=await gResponde(t,linha,D,api,est,hoje);if(r!==undefined)return r}
  if(/^(lancar|lanca|lancamento|novo atendimento|atendimento)$/.test(t))return gInicio(D,est,hoje);
  if(/^(oi|ola|bom dia|boa tarde|boa noite|ajuda|menu|\?)\b/.test(t)&&t.split(' ').length<=3)return `Olá, ${(D.nome||'').split(' ')[0]}! `+AJUDA;
  {const q=zPergunta(t);if(q)return q}
  if(/^(resumo|mes|extrato|quanto)$/.test(t))return zResumo(D,hoje);
  if(/^(reforma|reforma tributaria|cbs|ibs|2027)$/.test(t)){const ano=hoje.slice(0,4),rec=soma(D.atendimentos.filter(x=>x.pago!==false&&x.data.startsWith(ano))),r=reforma(rec,ano);
    return `*Reforma tributária*: PIS, Cofins e ISS viram CBS (federal) e IBS. O Carnê-Leão não muda.
• *2026*: só teste, você não paga nada.
• *2027*: quem recebe mais de ${zBrl(r.lim)} no ano como pessoa física passa a emitir nota fiscal e pagar CBS. Saúde tem 60% de desconto: perto de 3,5% do recebido (estimativa, a alíquota ainda não saiu).
• *2029 a 2032*: o ISS da prefeitura cai aos poucos e o IBS sobe. *2033*: ISS acaba; perto de 10,6% no total (estimativa).
• Abaixo da linha: nada muda, segue o recibo do Receita Saúde.
Você em ${ano}: ${zBrl(rec)} recebidos (${Math.round(r.p*100)}% da linha). ${r.p<0.8?'Folgada.':'Perto ou acima: mande *cnpj* para comparar com empresa.'}`}
  if(/^(cnpj|empresa|pj)$/.test(t)){const c=cnpjAviso(D.atendimentos.filter(x=>x.pago!==false),D.despesas,hoje.slice(0,7));
    return !c?'Para comparar pessoa física e CNPJ preciso de 3 meses completos com atendimentos lançados.':c.mostra?c.txt:`Pela média de ${zBrl(c.R)} por mês, o CNPJ ainda não compensa: a diferença seria de ${zBrl(c.eco)} por mês. Eu aviso se isso mudar.`}
  // Pacote Vire CNPJ: "quero" (resposta ao aviso) ou "quero conversar" vira pedido no Admin
  if(/^(quero|quero conversar|quero cnpj|quero abrir( o)? cnpj|conversar)$/.test(t)){if(!api.pedido)return 'Anotado. A Assessoria vai chamar você aqui.';
    const c=cnpjAviso(D.atendimentos.filter(x=>x.pago!==false),D.despesas,hoje.slice(0,7));
    try{await api.pedido('cnpj',c?Math.round(c.R):null,c?c.eco:null)}catch(e){return zErro(String(e.message||e))}
    return 'Pedido anotado ✅ A Assessoria vai chamar você aqui para marcar 20 minutos com o contador parceiro, com a sua conta na tela. É uma conversa: a decisão é sua.'}
  if(/^(procuracao|como faco a procuracao|procuracao e-?cac)$/.test(t))return PROCURACAO.replace('{CPF}',/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(api.procurador||'')&&!/^0+$/.test(String(api.procurador).replace(/\D/g,''))?'*'+api.procurador+'*':'o CPF que a Assessoria te manda aqui em seguida');
  if(/^(fiz|feita|pronto|ja fiz)( a)? procuracao$|^procuracao (feita|pronta|ok)$/.test(t)){if(!api.pedido)return 'Recebido! A Assessoria confere no e-CAC.';
    try{await api.pedido('procuracao',null,null)}catch(e){return zErro(String(e.message||e))}
    return 'Recebido ✅ A Assessoria confere no e-CAC em até 1 dia útil e avisa aqui.'}
  if(/^(posts?|meus posts|bonus)$/.test(t)){if(!api.posts)return 'Os posts do mês chegam aqui assim que ficarem prontos.';
    let l;try{l=await api.posts()}catch(e){return zErro(String(e.message||e))}
    return l&&l.length?`Seus posts de ${l.mes}:\n`+l.map((x,i)=>`${i+1}. ${x.nome}: ${x.url}`).join('\n')+'\nOs links valem 7 dias. Cada post vem com a legenda pronta; confira antes de publicar.'
      :'Os posts deste mês ainda estão em preparo. Eu mando aqui assim que ficarem prontos.'}
  if(/^(darf|imposto|carne[ -]?leao)$/.test(t))return zDarf(D,hoje);
  if(/^(ja )?paguei( o)?( darf| carne[ -]?leao| imposto)?( r?\$? ?[\d.,]+)?$|^darf pago$/.test(t))return zPaguei(t,D,api,hoje);
  if(/^(a receber|receber|pendentes?|devendo)$/.test(t))return zReceber(D);
  // Perguntas do jeito que se fala, sem número: "quanto já recebi esse mês?", "quanto pago de imposto?", "quem me deve?"
  if(!/\d/.test(t)){if(/\b(imposto|carne|darf|leao)\b/.test(t)&&/\b(quanto|qual|tenho|vou|devo|pagar|pago)\b/.test(t))return zDarf(D,hoje);
    if(/\bquem\b.*\b(deve|devendo|falta|pagou)\b|\b(falta|ainda) receber\b/.test(t))return zReceber(D);
    if(/\bquanto\b.*\b(recebi|ganhei|faturei|entrou|fiz|tirei)\b|\bcomo (esta|ta) (o|meu) mes\b/.test(t))return zResumo(D,hoje)}
  if(/^(recibos?|pdfs?)$/.test(t))return 'Os PDFs dos recibos chegam aqui assim que a Assessoria emitir no Receita Saúde, no fechamento do mês. O paciente também vê no app Receita Saúde (gov.br).';
  if(/^(desfazer|desfaz|apagar|apaga|cancela|cancelar)$/.test(t)){const u=est.ultimo;
    if(!u)return 'Não tenho lançamento recente seu para desfazer. Para apagar outro, use o app (aba Lançar).';
    if(u.tipo==='rec')return `O último foi um ${u.txt}: esse se corrige no app (aba Lançar). Nada foi apagado.`;
    try{await api[{desp:'apagaDespesa',sess:'apagaSessao'}[u.tipo]||'apaga'](u.id)}catch(e){return zErro(String(e.message||e))}
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
  // Indicação (revisão item 19): código e link para mandar à colega
  if(/^(indicar|indicacao|indique|codigo)$/.test(t)){if(!api.indicacao)return 'Em breve.';let x;try{x=await api.indicacao()}catch(e){return zErro(String(e.message||e))}
    return `Seu código: *${x.codigo}*. A colega ganha 60 dias de teste e você ganha 1 mês quando ela assinar.\nEncaminhe este link para ela: https://demervalambrozim.github.io/recibo-saude/venda.html?ind=${x.codigo}`
      +(x.indicadas?`\n${x.indicadas} já usaram seu código, ${x.pagaram} assinaram.`:'')}
  // Foto do comprovante lida (revisão item 14): "sim" lança o que foi lido
  if(/^(sim|s|ok|isso|pode|confirmo)$/.test(t)&&est.foto&&est.foto.lido){const l=est.foto.lido;
    return zLinha(`despesa ${l.tipo} ${l.valor.toFixed(2).replace('.',',')} ${l.data.split('-').reverse().join('/')}`,D,api,est,hoje)}
  // Pacotes (revisão item 9): "Maria pacote 10 1500 pix" (1 recibo, na data do pagamento), "Maria sessão" (abate 1), "pacotes" (saldos)
  if(/^pacotes?$/.test(t)){if(!api.pacotes)return 'Pacotes ainda não disponíveis.';let l;try{l=await api.pacotes()}catch(e){return zErro(String(e.message||e))}
    return l.length?'*Pacotes com saldo*\n'+l.map(k=>`• ${k.paciente}: ${k.sessoes-k.usadas} de ${k.sessoes} (pago ${zDBR(k.data)})`).join('\n'):'Nenhum pacote com saldo. Para lançar: *Maria pacote 10 1500 pix*'}
  m=t.match(/^(.+?) pacote (?:de )?(\d{1,2})(?: sessoes| sessao)?(?: (.*))?$/);
  if(m){const q=zPartes(m[1]+' '+(m[3]||''),hoje),n=+m[2];
    if(n<2||n>60)return 'O pacote vai de 2 a 60 sessões.';if(!q.valor)return `Faltou o valor pago. Ex.: *${m[1]} pacote ${n} 1500 pix*`;
    const c=zAcha(D.pacientes,q.nome);if(c.length!==1)return c.length?`Tem mais de uma ${q.nome.join(' ')}. Mande com o nome completo.`:`Não achei "${q.nome.join(' ')}". Para cadastrar: *novo Nome Sobrenome CPF*`;
    const data=q.data||hoje,forma=q.forma||'Pix';if(data>hoje)return 'Essa data ainda não chegou. Lance no dia do pagamento.';
    let r;try{r=await api.pacote(c[0].id,data,q.valor,forma,n)}catch(e){return zErro(String(e.message||e))}
    D.atendimentos.unshift({id:r.atendimento,data,valor:q.valor,forma,paciente:c[0].nome,pago:true,emitido:false});
    const txt=`pacote de ${n} sessões de ${c[0].nome} · ${zBrl(q.valor)} · ${forma} · ${data===hoje?'hoje':zDBR(data)}`;est.ultimo={tipo:'at',id:r.atendimento,txt};
    return `✅ ${txt.replace(/^./,x=>x.toUpperCase())}\nUm recibo só, na data do pagamento. A cada sessão mande *${c[0].nome.split(' ')[0]} sessão*. Errou? *desfazer*`}
  m=t.match(/^(.+?) sessao(?: (.*))?$/);
  if(m&&api.sessao){const c=zAcha(D.pacientes,m[1].split(' ')),data=m[2]?zData(m[2].replace(/^dia /,''),hoje,m[2].startsWith('dia ')?'dia':''):hoje;
    if(!data)return 'Não entendi a data. Ex.: *Maria sessão ontem* ou *Maria sessão 25/10*';
    if(c.length!==1)return c.length?`Tem mais de uma ${m[1]}. Mande com o nome completo.`:`Não achei "${m[1]}" entre seus pacientes.`;
    let r;try{r=await api.sessao(c[0].id,data)}catch(e){const s=String(e.message||e);
      return /sem pacote/.test(s)?`${c[0].nome} não tem pacote com saldo. Se ela pagou a sessão, mande *${c[0].nome.split(' ')[0]} 180 pix*.`:zErro(s)}
    est.ultimo={tipo:'sess',id:r.sessao,txt:`sessão de ${c[0].nome} em ${zDBR(data)}`};
    return `✅ Sessão de ${c[0].nome} (${zDBR(data)}): ${r.usadas} de ${r.sessoes}. `+(r.restam?`Restam ${r.restam}.`:'Pacote encerrado.')+' Errou? *desfazer*'}
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
    const fo=est.foto;try{const id=await api.despesa(cod,p.data||hoje,p.valor,loc&&loc.id,fo?'pelo WhatsApp · comprovante '+fo.caminho:undefined);est.foto=null;
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

// Resposta à foto do comprovante: o que foi lido (confirmar com "sim") ou o pedido do tipo e do valor
function zFotoPergunta(l){return l?`📎 Comprovante guardado. Li: *${nomeCod(DESP[l.tipo])}*, ${zBrl(l.valor)}, ${l.data.split('-').reverse().join('/')}.\nEstá certo? Responda *sim*. Se não, mande do jeito certo, ex.: *luz 230,45*.`
  :'📎 Comprovante guardado. Agora mande o tipo e o valor, ex.: *luz 230,45* ou *aluguel 1200 05/10*, que eu lanço com a foto junto.'}

// Suporte (revisão item 26, projeto/manual-suporte.md): "suporte ..." vira pedido no Admin, com o texto inteiro
const SUPORTE=/^(suporte|atendente|atendimento|falar com (alguem|uma pessoa|a assessoria|voces)|ajuda humana|reclamacao|problema)\b/;
const SUPORTE_OK='Recebido. Uma pessoa da Assessoria responde aqui em até 1 dia útil (segunda a sexta, 8h às 18h). Se for erro num recibo já emitido, a correção é sem custo.';
// Mensagem inteira (pode ter várias linhas). Devolve o texto da resposta; est é alterado no lugar.
async function zapResponde(texto,D,api,est,hoje){const out=[];
  if(SUPORTE.test(zNorm(String(texto||'').split(/\n/)[0]))){const resto=String(texto).replace(/^\s*\S+\s*/,'').trim();
    if(!resto)return 'Escreva *suporte* e, na mesma mensagem, o que aconteceu. Ex.: *suporte o recibo da Maria saiu com o valor errado*. Não escreva diagnóstico nem dado de saúde do paciente.';
    if(!api.suporte)return SUPORTE_OK;
    try{await api.suporte(String(texto).trim())}catch(e){return zErro(String(e.message||e))}
    return SUPORTE_OK}
  const linhas=String(texto||'').split(/\n+/).filter(l=>l.trim()).slice(0,20);
  for(const l of linhas){const r=await zLinha(l,D,api,est,hoje);if(r)out.push(r)}
  return out.join('\n\n')||AJUDA}

if(typeof module!=='undefined')module.exports={zapResponde,zFotoPergunta,zSemana1,zPartes,zAcha,zData,zValor,AJUDA,PROCURACAO};
