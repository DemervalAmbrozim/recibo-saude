// Clínicas (8i, supabase/025): a secretária cola ou envia o relatório de recebimentos do sistema da clínica (Excel/CSV).
// Na 1ª vez ela diz qual coluna é o quê (o "molde", guardado na clínica); nos meses seguintes é só colar.
// Só lê e separa: linha boa vai para o banco (clinica_importar, que não duplica); linha sem CPF, sem profissional
// reconhecida ou de convênio fica numa lista para corrigir. A chave de cada linha é a mesma se o relatório vier de novo.
const CLI_CAMPOS=[['data','Data do pagamento',1],['paciente','Paciente',1],['cpf','CPF do paciente',1],['valor','Valor recebido',1],['profissional','Profissional',1],
  ['cpf_pagador','CPF de quem pagou',0],['forma','Forma de pagamento',0],['codigo','Nº do recebimento',0]];
function cliCpfOk(c){c=String(c||'').replace(/\D/g,'');if(c.length!==11||/^(\d)\1+$/.test(c))return false;
  for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=+c[i]*(t+1-i);if(((s*10)%11)%10!==+c[t])return false}return true}
const cliSo=s=>String(s||'').replace(/\D/g,'');
const cliNorm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();

// Tabela colada do Excel (tab) ou CSV (; ou ,), com aspas. Pula linhas de título antes do cabeçalho (a 1ª com 3+ colunas cheias).
function cliTabela(txt){const ls=[];String(txt||'').replace(/^\uFEFF/,'').split(/\r?\n/).forEach((l,i)=>{if(l.trim())ls.push([l,i+1])});if(!ls.length)return {cab:[],linhas:[],nums:[]};
  const conta=(l,c)=>l.split(c).length;let ini=ls.findIndex(([l])=>Math.max(conta(l,'\t'),conta(l,';'),conta(l,','))>=3);if(ini<0)ini=0;
  const l0=ls[ini][0],sep=l0.includes('\t')?'\t':(conta(l0,';')>=conta(l0,',')?';':',');
  const cel=l=>{const r=[];let c='',q=false;for(let i=0;i<l.length;i++){const ch=l[i];
    if(ch==='"'){if(q&&l[i+1]==='"'){c+='"';i++}else q=!q;continue}if(ch===sep&&!q){r.push(c.trim());c='';continue}c+=ch}r.push(c.trim());return r};
  const corpo=ls.slice(ini+1);return {cab:cel(l0),linhas:corpo.map(([l])=>cel(l)),nums:corpo.map(([,n])=>n),sep}} // nums = linha do Excel

// Palpite do molde pelo nome das colunas (Clinicorp, Simples Dental, Codental, Feegow, iClinic e afins usam nomes parecidos)
function cliAdivinha(cab){const h=cab.map(cliNorm),m={},usado=new Set();
  const pega=(campo,...res)=>{for(const re of res){const i=h.findIndex((x,j)=>!usado.has(j)&&re.test(x));if(i>=0){m[campo]=cab[i];usado.add(i);return}}};
  pega('cpf_pagador',/cpf.*(pagador|responsavel|titular|pagante)/,/(pagador|responsavel|titular).*cpf/);
  pega('cpf',/cpf.*(paciente|cliente)/,/^cpf$/,/^cpf\b(?!.*(profissional|dentista|medico|prestador))/);
  pega('profissional',/profissional|dentista|fisioterapeuta|psicolog|medic[oa]|executante|prestador|atendido por|doutor/);
  pega('paciente',/^(nome do )?(paciente|cliente)$/,/paciente|cliente/,/^nome$/);
  pega('data',/data.*(pagamento|recebimento|baixa|liquida|credito)/,/(pago|recebido) em/,/^data$/,/^dt\b/,/data/);
  pega('valor',/valor.*(pago|recebido|liquido)/,/^valor$/,/^(total|recebido|pago)$/,/valor/);
  pega('forma',/forma|meio de pagamento|tipo de pagamento/,/^pagamento$/);
  pega('codigo',/\b(n[oº°]?|numero|codigo|cod|id)\b.*(recebimento|recibo|pagamento|lancamento|transacao|titulo)/); // nunca o código do paciente: duplicaria a chave
  return m}

// Data do relatório: 05/10/2026, 5/10/26, 2026-10-05, 05-10-2026, com hora ou não, ou o número de série do Excel
function cliData(s){s=String(s||'').trim();let m;
  if(/^\d{5}(\.\d+)?$/.test(s)){const d=new Date(Date.UTC(1899,11,30)+Math.floor(+s)*864e5);return d.toISOString().slice(0,10)}
  if((m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)))return cliIso(+m[1],+m[2],+m[3]);
  if((m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2}|\d{4})\b/)))return cliIso(m[3].length===2?2000+ +m[3]:+m[3],+m[2],+m[1]);
  return ''}
function cliIso(a,m,d){const x=new Date(Date.UTC(a,m-1,d));return x.getUTCFullYear()===a&&x.getUTCMonth()===m-1&&x.getUTCDate()===d?x.toISOString().slice(0,10):''}
// Valor: R$ 1.234,56 · 1234,56 · 1234.56 · 1,234.56 · (150,00) ou -150 = estorno (negativo)
function cliValor(s){let t=String(s||'').replace(/R\$|\s/g,'');if(!t)return NaN;const neg=/^\(.*\)$/.test(t)||/^-/.test(t);t=t.replace(/[()\-+]/g,'');
  if(!/^[\d.,]+$/.test(t))return NaN;
  const ip=t.lastIndexOf('.'),iv=t.lastIndexOf(',');let n;
  if(ip>=0&&iv>=0)n=ip>iv?+t.replace(/,/g,''):+t.replace(/\./g,'').replace(',','.');
  else if(iv>=0)n=/^\d{1,3}(,\d{3})+$/.test(t)&&!/,\d{2}$/.test(t)?+t.replace(/,/g,''):+t.replace(',','.');
  else n=/^\d{1,3}(\.\d{3})+$/.test(t)?+t.replace(/\./g,''):+t;
  return neg?-n:n}
// Forma do relatório → a do app; convênio é pago pela operadora (empresa): não é recibo do Receita Saúde
function cliForma(s){const f=cliNorm(s);if(!f)return 'Pix';
  if(/convenio|plano de saude|operadora|glosa|unimed|amil|bradesco saude|sulamerica/.test(f))return 'convenio';
  if(/pix/.test(f))return 'Pix';if(/dinheiro|especie/.test(f))return 'Dinheiro';if(/cart|credito|debito/.test(f))return 'Cartão';
  if(/transf|ted|doc|deposito|boleto/.test(f))return 'Transferência';return 'Pix'}

// Profissional da linha: apelido já resolvido pela secretária, CPF, ou nome (sem Dr./Dra.) que case com 1 só do grupo
const cliTira=s=>cliNorm(s).replace(/\b(dr|dra|doutor|doutora|prof|ft|psi)\b\.?/g,' ').replace(/[^a-z0-9 ]/g,' ').split(' ').filter(w=>w.length>1&&!['de','da','do','das','dos','e'].includes(w));
function cliProf(txt,membros,apelidos){const k=cliNorm(txt);if(!k)return {id:'',motivo:'sem profissional'};
  if(apelidos&&apelidos[k]&&membros.some(m=>m.id===apelidos[k]))return {id:apelidos[k]};
  const c=cliSo(txt);if(c.length===11){const m=membros.find(m=>m.cpf===c);return m?{id:m.id}:{id:'',motivo:'profissional fora do grupo'}}
  const ws=cliTira(txt);if(!ws.length)return {id:'',motivo:'sem profissional'};
  const ts=membros.map(m=>({m,t:cliTira(m.nome)}));
  let cs=ts.filter(({t})=>ws.every(w=>t.includes(w)));
  if(cs.length!==1&&ws.length===1)cs=ts.filter(({t})=>t[0]===ws[0]);
  return cs.length===1?{id:cs[0].m.id}:{id:'',motivo:cs.length?'mais de uma profissional com esse nome':'profissional não reconhecida'}}

// Aplica o molde. Devolve {ok, pend, ignoradas, erro}. ok/pend levam a linha do relatório (nº como no Excel) e os campos lidos.
function cliAplica(tab,molde,membros,hoje){const col=molde&&molde.colunas||{},apel=molde&&molde.apelidos||{},r={ok:[],pend:[],ignoradas:0,erro:'',avisos:[]};
  const h=tab.cab.map(cliNorm),idx={};
  for(const [k,,obrig] of CLI_CAMPOS){if(!col[k]){if(obrig){r.erro=`Falta dizer qual coluna é "${CLI_CAMPOS.find(c=>c[0]===k)[1]}".`;return r}continue}
    const i=h.indexOf(cliNorm(col[k]));
    if(i<0&&obrig){r.erro=`A coluna "${col[k]}" não está neste relatório. O sistema da clínica mudou o modelo? Refaça o molde.`;return r}
    if(i<0){r.avisos.push(`A coluna "${col[k]}" não veio neste relatório`+(k==='cpf_pagador'?': o recibo sai no CPF do paciente.':'.'));continue}idx[k]=i}
  const vistos={};hoje=hoje||new Date().toISOString().slice(0,10);
  tab.linhas.forEach((c,j)=>{const v=k=>idx[k]==null?'':String(c[idx[k]]||'').trim(),linha=tab.nums?tab.nums[j]:j+2;
    const nome=v('paciente').replace(/\s+/g,' ');
    if(!nome&&!v('valor')&&!v('cpf')){r.ignoradas++;return}
    if(c.some(x=>/^(total|subtotal|soma|totais)\b/i.test(String(x).trim()))){r.ignoradas++;return} // linha de total do relatório
    const x={linha,nome,cpf:cliSo(v('cpf')),cpf_pagador:cliSo(v('cpf_pagador')),data:cliData(v('data')),valor:cliValor(v('valor')),
      forma:cliForma(v('forma')),prof_txt:v('profissional'),codigo:v('codigo')};
    const p=cliProf(x.prof_txt,membros,apel);x.prof=p.id;
    const mot=[];
    if(x.forma==='convenio')mot.push('convênio: pago pela operadora, não sai recibo do Receita Saúde');
    if(!x.data)mot.push('data inválida');else if(x.data>hoje)mot.push('data no futuro');
    if(!(x.valor>0))mot.push(x.valor<0?'estorno ou valor negativo':'valor inválido');
    if(!cliCpfOk(x.cpf))mot.push(x.cpf?'CPF do paciente inválido':'sem CPF do paciente');
    if(nome.length<2)mot.push('sem nome do paciente');
    if(!x.prof)mot.push(p.motivo);
    if(x.cpf_pagador&&(!cliCpfOk(x.cpf_pagador)||x.cpf_pagador===x.cpf))x.cpf_pagador='';
    if(mot.length){x.motivo=mot.join('; ');r.pend.push(x);return}
    r.ok.push(cliChave(x,vistos))});
  r.vistos=vistos;return r}
// Chave estável: nº do recebimento, se o sistema dá; senão profissional|data|CPF|centavos + ordem entre linhas iguais
function cliChave(x,vistos){const base=x.codigo?'n:'+cliNorm(x.codigo):[x.data,x.cpf,Math.round(x.valor*100)].join('|');
  const k=x.prof+'|'+base;vistos[k]=(vistos[k]||0)+1;x.chave=k+'#'+vistos[k];return x}
// Linha corrigida na tela (profissional escolhida, CPF digitado): volta a passar pelas mesmas regras
function cliCorrige(x,novo,vistos,hoje){const y={...x,...novo};hoje=hoje||new Date().toISOString().slice(0,10);y.cpf=cliSo(y.cpf);
  const mot=[];if(y.forma==='convenio')mot.push('convênio');if(!y.data||y.data>hoje)mot.push('data');if(!(y.valor>0))mot.push('valor');
  if(!cliCpfOk(y.cpf))mot.push('CPF do paciente');if(!y.prof)mot.push('profissional');if((y.nome||'').length<2)mot.push('nome');
  if(mot.length)return {erro:'Ainda falta: '+mot.join(', ')};delete y.motivo;return {ok:cliChave(y,vistos)}}
// Para o banco: só os campos que clinica_importar lê
const cliEnvio=ls=>ls.map(x=>({linha:x.linha,prof:x.prof,data:x.data,nome:x.nome,cpf:x.cpf,cpf_pagador:x.cpf_pagador||'',valor:Math.round(x.valor*100)/100,forma:x.forma,chave:x.chave}));
const cliPreco=n=>249+59*Math.max(0,(n||0)-3); // igual a clinica_preco do banco
if(typeof module!=='undefined')module.exports={CLI_CAMPOS,cliTabela,cliAdivinha,cliData,cliValor,cliForma,cliProf,cliAplica,cliCorrige,cliEnvio,cliPreco};
