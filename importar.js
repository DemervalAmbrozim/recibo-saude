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
function impIcs(txt,pacientes,ats,desde,ate){const out=[],ja=new Set(ats.map(a=>a.paciente+'|'+a.data)); // link_dados traz o nome da paciente, não o id
  const ps=pacientes.filter(p=>p.ativo!==false).map(p=>({p,t:impNorm(p.nome).split(/\s+/).filter(w=>w.length>2)}));
  for(const b of String(txt).replace(/\r?\n[ \t]/g,'').split(/BEGIN:VEVENT/i).slice(1)){
    const v=k=>{const l=b.split(/\r?\n/).find(x=>new RegExp('^'+k+'[;:]','i').test(x));return l?l.slice(l.indexOf(':')+1).trim():''};
    if(/CANCELLED/i.test(v('STATUS')))continue;
    const d=v('DTSTART').match(/^(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2}).*?(Z)?)?$/);if(!d)continue;
    let dt=`${d[1]}-${d[2]}-${d[3]}`;
    if(d[7]){const u=new Date(Date.UTC(+d[1],d[2]-1,+d[3],+d[5],+d[6])-3*36e5);dt=u.toISOString().slice(0,10)} // hora UTC → Brasília
    if(dt<desde||dt>ate)continue;
    const tit=impNorm(v('SUMMARY').replace(/\\,/g,',')),ws=tit.split(/[^a-z0-9]+/);
    const cs=ps.filter(({t})=>t.length&&(t.every(w=>ws.includes(w))||(ws.includes(t[0])&&t.slice(1).some(w=>ws.includes(w)))));
    const c=cs.length===1?cs[0]:cs.length>1?(cs.filter(({t})=>t.every(w=>ws.includes(w))).length===1?cs.find(({t})=>t.every(w=>ws.includes(w))):null):null;
    if(!c||ja.has(c.p.nome+'|'+dt))continue;ja.add(c.p.nome+'|'+dt);
    const ult=ats.filter(a=>a.paciente===c.p.nome).sort((x,y)=>x.data<y.data?1:-1)[0];
    out.push({data:dt,paciente_id:c.p.id,nome:c.p.nome,valor:ult?+ult.valor:null,forma:ult?ult.forma:'pix'})}
  return out.sort((x,y)=>x.data<y.data?-1:1)}
if(typeof module!=='undefined')module.exports={...(module.exports||{}),impIcs};
