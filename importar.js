// Importar pacientes (revisão item 10): texto colado da planilha (Excel/Google, separado por tab), CSV (; ou ,) ou contatos .vcf.
// Só lê e separa; quem grava é o lancar.js, um por um, pelo link_paciente (que já reaproveita o mesmo CPF).
// Devolve {ok:[{nome,cpf,cpf_pagador,telefone,email}], semCpf:[nome], repetidos:n}
function impCpfOk(c){c=String(c||'').replace(/\D/g,'');if(c.length!==11||/^(\d)\1+$/.test(c))return false;
  for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=+c[i]*(t+1-i);if(((s*10)%11)%10!==+c[t])return false}return true}
const impSo=s=>String(s||'').replace(/\D/g,'');
const impNorm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const impTel=t=>{const d=impSo(t).replace(/^55(?=\d{10,11}$)/,'');return /^\d{10,11}$/.test(d)?d:''};
const impMail=m=>/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(m||'').trim())?String(m).trim():'';
const impNome=s=>String(s||'').replace(/\s+/g,' ').trim();

// vCard: FN (ou N), TEL, EMAIL e um CPF em qualquer campo (NOTE costuma ter)
function impVcf(txt){const out=[];
  for(const b of String(txt).replace(/\r?\n[ \t]/g,'').split(/BEGIN:VCARD/i).slice(1)){const ls=b.split(/\r?\n/),v=k=>{const l=ls.find(x=>new RegExp('^'+k+'[;:]','i').test(x));return l?l.slice(l.indexOf(':')+1).trim():''};
    let nome=v('FN');if(!nome){const n=v('N').split(';');nome=[n[1],n[0]].filter(Boolean).join(' ')}
    const cpf=(b.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g)||[]).map(impSo).find(impCpfOk)||'';
    out.push({nome:impNome(nome),cpf,telefone:impTel(v('TEL')),email:impMail(v('EMAIL')),cpf_pagador:''})}
  return out}

// Planilha: com cabeçalho (nome, cpf, telefone/whatsapp/celular, e-mail, responsável/pagador) ou sem (acha o CPF e o nome em cada linha)
function impTabela(txt){const linhas=String(txt).split(/\r?\n/).filter(l=>l.trim());if(!linhas.length)return [];
  const sep=linhas[0].includes('\t')?'\t':(linhas[0].split(';').length>=linhas[0].split(',').length?';':',');
  const cel=l=>{const r=[];let c='',q=false;for(const ch of l){if(ch==='"'){q=!q;continue}if(ch===sep&&!q){r.push(c);c='';continue}c+=ch}r.push(c);return r.map(x=>x.trim())};
  const cab=cel(linhas[0]).map(impNorm),acha=re=>cab.findIndex(h=>re.test(h));
  const temCab=cab.some(h=>/^(nome|paciente|cliente)/.test(h)||/cpf/.test(h));
  const iN=acha(/^(nome|paciente|cliente)/),iC=acha(/^cpf$|cpf do paciente|cpf paciente|^cpf\b(?!.*(pag|resp))/),iP=acha(/pagador|responsavel|cpf (da )?(mae|pai)/),
    iT=acha(/tel|whats|celular|fone/),iE=acha(/mail/);
  return (temCab?linhas.slice(1):linhas).map(l=>{const c=cel(l);
    if(temCab&&iN>=0)return {nome:impNome(c[iN]),cpf:impSo(c[iC]),cpf_pagador:iP>=0?impSo(c[iP]):'',telefone:iT>=0?impTel(c[iT]):'',email:iE>=0?impMail(c[iE]):''};
    const cpfs=c.map(impSo).filter(impCpfOk);
    return {nome:impNome(c.find(x=>/[a-zà-ú]{2}/i.test(x)&&!/@/.test(x))||''),cpf:cpfs[0]||'',cpf_pagador:cpfs[1]||'',
      telefone:impTel(c.find(x=>impTel(x)&&!impCpfOk(x))||''),email:impMail(c.find(x=>/@/.test(x))||'')}})}

function impLer(txt,ja){const brutos=/BEGIN:VCARD/i.test(txt)?impVcf(txt):impTabela(txt),vistos=new Set(ja||[]),r={ok:[],semCpf:[],repetidos:0};
  for(const p of brutos){if(!p.nome||p.nome.length<3)continue;
    if(!impCpfOk(p.cpf)){r.semCpf.push(p.nome);continue}
    if(vistos.has(p.cpf)){r.repetidos++;continue}vistos.add(p.cpf);
    if(!impCpfOk(p.cpf_pagador)||p.cpf_pagador===p.cpf)p.cpf_pagador='';r.ok.push(p)}
  return r}
if(typeof module!=='undefined')module.exports={impLer,impVcf,impTabela};

// Agenda (revisão item 11): eventos do .ics (Google Agenda: endereço secreto iCal ou arquivo exportado) viram atendimentos para confirmar.
// Casa o título do evento com a paciente pelo nome inteiro, ou 1º nome + sobrenome; sem casar (ou com 2 iguais) fica de fora.
// Pula o que já foi lançado (mesma paciente, mesmo dia) e evento cancelado. Valor e forma sugeridos = os do último atendimento dela.
// 8f ressalva 1 (28/10, teste com agenda real do Google): consulta fixa "repetir toda semana" vem como 1 evento com RRULE;
// a série é aberta aqui (DAILY/WEEKLY/MONTHLY/YEARLY, INTERVAL, BYDAY, COUNT, UNTIL), tira EXDATE e troca a sessão remarcada (RECURRENCE-ID).
function impIcsDia(x){const d=String(x).trim().match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2}).*?(Z)?)?$/);if(!d)return '';
  if(d[7])return new Date(Date.UTC(+d[1],d[2]-1,+d[3],+d[5],+d[6])-3*36e5).toISOString().slice(0,10); // hora UTC → Brasília
  return `${d[1]}-${d[2]}-${d[3]}`}
function impIcsSerie(ini,rr,ex,ate){const r={};rr.split(';').forEach(x=>{const [k,v]=x.split('=');r[k]=v});
  const passo=Math.max(1,+r.INTERVAL||1),cnt=+r.COUNT||0,ult=r.UNTIL?impIcsDia(r.UNTIL):'',lim=ult&&ult<ate?ult:ate,out=[];
  const dd=s=>new Date(s+'T12:00:00Z'),iso=d=>d.toISOString().slice(0,10),dias=['SU','MO','TU','WE','TH','FR','SA'];
  const bd=r.FREQ==='WEEKLY'&&r.BYDAY?r.BYDAY.split(',').map(x=>dias.indexOf(x.slice(-2))).filter(x=>x>=0):null;
  let n=0;for(let i=0;i<2000;i++){let ds=[];const d=dd(ini);
    if(r.FREQ==='DAILY')d.setUTCDate(d.getUTCDate()+i*passo);
    else if(r.FREQ==='WEEKLY')d.setUTCDate(d.getUTCDate()+i*7*passo);
    else if(r.FREQ==='MONTHLY')d.setUTCMonth(d.getUTCMonth()+i*passo);
    else if(r.FREQ==='YEARLY')d.setUTCFullYear(d.getUTCFullYear()+i*passo);else return [ini];
    if(bd){const dom=new Date(d);dom.setUTCDate(d.getUTCDate()-d.getUTCDay());ds=bd.map(w=>{const x=new Date(dom);x.setUTCDate(dom.getUTCDate()+w);return iso(x)}).sort().filter(x=>x>=ini)}
    else ds=[iso(d)];
    for(const x of ds){if(x>lim||(cnt&&n>=cnt))return out;n++;if(!ex.has(x))out.push(x)}
    if(ds.length&&ds[0]>lim)return out}
  return out}
// Ocorrências do .ics até "ate" (séries abertas, cancelado fora, remarcação trocada), com a hora de Brasília quando houver
function impIcsHora(x){const d=String(x).trim().match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2}).*?(Z)?$/);if(!d)return '';
  if(d[6]){const t=new Date(Date.UTC(+d[1],d[2]-1,+d[3],+d[4],+d[5])-3*36e5);return t.toISOString().slice(11,16)}
  return `${d[4]}:${d[5]}`}
function impIcsOcs(txt,ate){
  const evs=String(txt).replace(/\r?\n[ \t]/g,'').split(/BEGIN:VEVENT/i).slice(1).map(b=>{const ls=b.split(/\r?\n/);
    const v=k=>{const l=ls.find(x=>new RegExp('^'+k+'[;:]','i').test(x));return l?l.slice(l.indexOf(':')+1).trim():''};
    const ex=new Set(ls.filter(x=>/^EXDATE[;:]/i.test(x)).flatMap(x=>x.slice(x.indexOf(':')+1).split(',').map(impIcsDia)));
    return {uid:v('UID'),rid:v('RECURRENCE-ID')?impIcsDia(v('RECURRENCE-ID')):'',dt:impIcsDia(v('DTSTART')),hora:impIcsHora(v('DTSTART')),rr:v('RRULE'),ex,
      tit:v('SUMMARY'),cancel:/CANCELLED/i.test(v('STATUS'))}}).filter(e=>e.dt);
  const troca=new Set(evs.filter(e=>e.rid&&e.uid).map(e=>e.uid+'|'+e.rid)),ocs=[];
  for(const e of evs){if(e.cancel)continue;
    if(e.rr&&!e.rid)impIcsSerie(e.dt,e.rr,e.ex,ate).forEach(d=>{if(!troca.has(e.uid+'|'+d))ocs.push({dt:d,tit:e.tit,hora:e.hora})});
    else ocs.push({dt:e.dt,tit:e.tit,hora:e.hora})}
  return ocs}
// Paciente do título: nome inteiro, ou 1º nome + sobrenome; 2 iguais = nenhuma
function impCasa(pacientes,t0){const ps=pacientes.filter(p=>p.ativo!==false).map(p=>({p,t:impNorm(p.nome).split(/[^a-z0-9]+/).filter(w=>w.length>2)}));
  const ws=impNorm(String(t0).replace(/\\,/g,',')).split(/[^a-z0-9]+/);
  const cs=ps.filter(({t})=>t.length&&(t.every(w=>ws.includes(w))||(ws.includes(t[0])&&t.slice(1).some(w=>ws.includes(w)))));
  const c=cs.length===1?cs[0]:cs.length>1?(cs.filter(({t})=>t.every(w=>ws.includes(w))).length===1?cs.find(({t})=>t.every(w=>ws.includes(w))):null):null;
  return c?c.p:null}
function impIcs(txt,pacientes,ats,desde,ate){const out=[],ja=new Set(ats.map(a=>a.paciente+'|'+a.data)); // link_dados traz o nome da paciente, não o id
  for(const {dt,tit} of impIcsOcs(txt,ate)){
    if(dt<desde||dt>ate)continue;
    const p=impCasa(pacientes,tit);
    if(!p||ja.has(p.nome+'|'+dt))continue;ja.add(p.nome+'|'+dt);
    const ult=ats.filter(a=>a.paciente===p.nome).sort((x,y)=>x.data<y.data?1:-1)[0];
    out.push({data:dt,paciente_id:p.id,nome:p.nome,valor:ult?+ult.valor:null,forma:ult?ult.forma:'pix'})}
  return out.sort((x,y)=>x.data<y.data?-1:1)}
// Lembrete de consulta (concorrência 31/10, F5): consultas de um dia na agenda viram mensagem pronta para a PROFISSIONAL
// mandar do WhatsApp dela (link wa.me). Nada sai do nosso número e nada vai para o banco: só lê a agenda no aparelho.
function impLembretes(txt,pacientes,dia,quando){const out=[],ja=new Set(),dd=dia.split('-').reverse().slice(0,2).join('/');
  for(const {dt,tit,hora} of impIcsOcs(txt,dia)){if(dt!==dia)continue;const p=impCasa(pacientes,tit);if(!p||ja.has(p.id+'|'+hora))continue;ja.add(p.id+'|'+hora);
    const tel=String(p.telefone||'').replace(/\D/g,''),nome1=p.nome.trim().split(/\s+/)[0];
    const msg=`Olá, ${nome1}! Passando para lembrar do seu atendimento ${quando||'em'} ${dd}${hora?` às ${hora}`:''}. Posso confirmar? Se precisar remarcar, é só me avisar por aqui.`;
    out.push({paciente_id:p.id,nome:p.nome,hora,tel,msg,link:/^\d{10,11}$/.test(tel)?`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`:''})}
  return out.sort((a,b)=>(a.hora||'99')<(b.hora||'99')?-1:1)}
if(typeof module!=='undefined')module.exports={...(module.exports||{}),impIcs,impLembretes};

// Sistema da clínica (ensaio 29/10, obs. 26 e 27): exportação em planilha com data, paciente e, se tiver, valor. Sai no mesmo formato da agenda.
// Datas 25/10/2026, 25/10/26 ou 2026-10-25; valor 180, 180,00 ou R$ 1.200,00. Paciente casa pelo nome como na agenda.
const impDia=s=>{s=String(s||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return `${m[1]}-${m[2]}-${m[3]}`;
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);if(!m)return '';const a=m[3].length===2?'20'+m[3]:m[3];return `${a}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`};
const impReal=s=>{s=String(s||'').replace(/r\$|\s/gi,'');if(!/^-?[\d.,]+$/.test(s))return null;
  const v=/,\d{1,2}$/.test(s)?+s.replace(/\./g,'').replace(',','.'):/\.\d{1,2}$/.test(s)?+s.replace(/,/g,''):+s.replace(/[.,]/g,'');return isNaN(v)?null:v};
function impSep(l){return l.includes('\t')?'\t':(l.split(';').length>=l.split(',').length?';':',')}
function impCels(l,sep){const r=[];let c='',q=false;for(const ch of l){if(ch==='"'){q=!q;continue}if(ch===sep&&!q){r.push(c);c='';continue}c+=ch}r.push(c);return r.map(x=>x.trim())}
function impAgendaCsv(txt,pacientes,ats,desde,ate){const ls=String(txt).split(/\r?\n/).filter(l=>l.trim());if(!ls.length)return [];
  const sep=impSep(ls[0]),cab=impCels(ls[0],sep).map(impNorm),acha=re=>cab.findIndex(h=>re.test(h));
  let iD=acha(/^(data|dia|date)/),iN=acha(/paciente|cliente|nome/),iV=acha(/valor|preco|total/),iS=acha(/status|situacao/);const temCab=iD>=0&&iN>=0;
  if(!temCab){const c=impCels(ls[0],sep);iD=c.findIndex(x=>impDia(x));iN=c.findIndex(x=>/[a-zà-ú]{3}/i.test(x)&&!impDia(x));iV=c.findIndex((x,i)=>i!==iD&&impReal(x)>0&&!/\//.test(x))}
  const ps=pacientes.filter(p=>p.ativo!==false).map(p=>({p,t:impNorm(p.nome).split(/[^a-z0-9]+/).filter(w=>w.length>2)})),ja=new Set(ats.map(a=>a.paciente+'|'+a.data)),out=[];
  for(const l of temCab?ls.slice(1):ls){const c=impCels(l,sep),dt=impDia(c[iD]);if(!dt||dt<desde||dt>ate)continue;
    if(iS>=0&&/cancel|falt|desmarc|nao compareceu/.test(impNorm(c[iS])))continue;
    const ws=impNorm(c[iN]).split(/[^a-z0-9]+/),cs=ps.filter(({t})=>t.length&&t[0]===ws[0]&&t.slice(1).every(w=>ws.includes(w))||(t.length&&t.every(w=>ws.includes(w))));
    if(cs.length!==1||ja.has(cs[0].p.nome+'|'+dt))continue;const p=cs[0].p;ja.add(p.nome+'|'+dt);
    const ult=ats.filter(a=>a.paciente===p.nome).sort((x,y)=>x.data<y.data?1:-1)[0],v=iV>=0?impReal(c[iV]):null;
    out.push({data:dt,paciente_id:p.id,nome:p.nome,valor:v>0?v:ult?+ult.valor:null,forma:ult?ult.forma:'pix'})}
  return out.sort((x,y)=>x.data<y.data?-1:1)}

// Extrato do banco (ensaio 29/10, obs. 25): OFX (todo banco exporta) ou planilha com data, descrição e valor.
// Confere o que entrou com o que ela lançou: crédito casado com atendimento pago, crédito que pode ser um "a receber",
// crédito sem lançamento (atendimento esquecido? ou transferência entre contas dela) e despesa do consultório que saiu e não foi lançada.
function impExtrato(txt){txt=String(txt||'');const out=[];
  if(/<STMTTRN>/i.test(txt)){for(const b of txt.split(/<STMTTRN>/i).slice(1)){const v=k=>{const m=b.match(new RegExp('<'+k+'>([^<\\r\\n]*)','i'));return m?m[1].trim():''};
      const d=v('DTPOSTED'),valor=impReal(v('TRNAMT').replace(/^\+/,''));if(!/^\d{8}/.test(d)||valor===null)continue;
      out.push({data:`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`,valor,desc:(v('NAME')+' '+v('MEMO')).trim()})}return out}
  const ls=txt.split(/\r?\n/).filter(l=>l.trim());if(!ls.length)return out;const sep=impSep(ls[0]);
  for(const l of ls){const c=impCels(l,sep),iD=c.findIndex(x=>impDia(x));if(iD<0)continue;
    const vs=c.map((x,i)=>i!==iD&&/\d/.test(x)&&!/[a-z]{3}/i.test(x.replace(/r\$/i,''))?impReal(x):null).filter(x=>x!==null&&x!==0);if(!vs.length)continue;
    out.push({data:impDia(c[iD]),valor:vs[0],desc:c.filter((x,i)=>i!==iD&&/[a-zà-ú]{3}/i.test(x)).join(' ')})}
  return out}
const IMP_CONTA=/aluguel|condominio|energia|\bedp\b|enel|cemig|light|cesan|sabesp|saneamento|agua|vivo|claro|\btim\b|\boi\b|internet|telefon|crefito|crp|cref|conselho|anuidade|iptu/;
function impConcilia(movs,ats,ds){const dif=(a,b)=>Math.abs((new Date(a+'T12:00')-new Date(b+'T12:00'))/864e5),usados=new Set(),r={confere:[],receber:[],semLanc:[],despOk:[],despFalta:[],semExtrato:[]};
  if(!movs.length)return r;const ini=movs.reduce((m,x)=>x.data<m?x.data:m,movs[0].data),fim=movs.reduce((m,x)=>x.data>m?x.data:m,movs[0].data);
  const pagos=ats.filter(a=>a.pago!==false&&a.data>=ini&&a.data<=fim&&!/dinheiro/i.test(a.forma||'')),abertos=ats.filter(a=>a.pago===false);
  for(const m of movs.filter(x=>x.valor>0)){
    // O mais provável, não o primeiro: nome da paciente na descrição do Pix, depois o dia mais próximo (senão um Pix "rouba" o atendimento de outra)
    const nd=impNorm(m.desc),nome=x=>{const t=impNorm(x.paciente).split(/[^a-z0-9]+/).filter(w=>w.length>2);return t.length&&t.every(w=>nd.includes(w))?0:1};
    let a=pagos.filter(x=>!usados.has(x.id)&&Math.abs(+x.valor-m.valor)<0.01&&dif(x.data,m.data)<=3).sort((x,y)=>nome(x)-nome(y)||dif(x.data,m.data)-dif(y.data,m.data))[0];
    if(!a){const g={};pagos.filter(x=>!usados.has(x.id)&&dif(x.data,m.data)<=3).forEach(x=>{const k=x.paciente+'|'+x.data;(g[k]=g[k]||[]).push(x)});
      const k=Object.keys(g).find(k=>Math.abs(g[k].reduce((s,x)=>s+ +x.valor,0)-m.valor)<0.01);if(k){g[k].forEach(x=>usados.add(x.id));r.confere.push({mov:m,paciente:g[k][0].paciente});continue}}
    if(a){usados.add(a.id);r.confere.push({mov:m,paciente:a.paciente});continue}
    const ab=abertos.find(x=>!usados.has(x.id)&&Math.abs(+x.valor-m.valor)<0.01&&x.data<=m.data);
    if(ab){usados.add(ab.id);r.receber.push({mov:m,at:ab});continue}
    r.semLanc.push({mov:m})}
  const dsU=new Set();
  for(const m of movs.filter(x=>x.valor<0)){const v=-m.valor,d=ds.find(x=>!dsU.has(x.id)&&Math.abs(+(x.valor_pago||x.valor)-v)<0.01&&dif(x.data,m.data)<=7);
    if(d){dsU.add(d.id);r.despOk.push({mov:m,desp:d});continue}
    if(IMP_CONTA.test(impNorm(m.desc)))r.despFalta.push({mov:m})}
  r.semExtrato=pagos.filter(x=>!usados.has(x.id)&&/pix|transf/i.test(x.forma||''));
  return r}
if(typeof module!=='undefined')module.exports={...(module.exports||{}),impAgendaCsv,impExtrato,impConcilia};
