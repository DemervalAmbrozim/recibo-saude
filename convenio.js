// Relatório do convênio (reunião Daniel 31/10, item 28): a profissional PF que recebe direto do convênio importa o demonstrativo de pagamento
// da operadora (planilha) e vê, por convênio e mês, o atendido × pago × glosa, com o IR e o INSS retidos.
// Convênio é pessoa jurídica: não sai recibo do Receita Saúde (o recibo pede o CPF de quem paga, manual Receita Saúde, pergunta 12) e não entra
// no Carnê-Leão; vai na declaração em "Rendimentos tributáveis recebidos de pessoa jurídica", com o CNPJ do convênio e o IR retido.
// Mesmo molde de colunas do extrato (item 29): na 1ª vez de cada convênio ela confirma qual coluna é o quê; o molde fica no convênio, no banco.
// Usa impExtTabela, impDia, impReal e impNorm de importar.js.
const CV_CAMPOS=[['data_pag','Data do pagamento'],['data_atend','Data do atendimento'],['paciente','Paciente / beneficiário'],['guia','Nº da guia'],
  ['apresentado','Valor apresentado (cobrado)'],['pago','Valor pago (liberado)'],['glosa','Glosa'],['irrf','IR retido'],['inss','INSS retido']];
function cvAdivinha(cab){const h=cab.map(impNorm),m={},usado=new Set();
  const pega=(k,...res)=>{for(const re of res){const i=h.findIndex((x,j)=>!usado.has(j)&&re.test(x));if(i>=0){m[k]=i;usado.add(i);return}}};
  pega('irrf',/\b(ir|irrf)\b/,/imposto de renda/);pega('inss',/inss|previd/);pega('glosa',/glos/);
  pega('data_pag',/data.*(pagamento|pgto|credito|liberac|repasse)/,/(pago|creditado) em/);pega('data_atend',/data.*(atendimento|realiza|execu|servico|procedimento)/,/^data$/,/^dt\b/);
  pega('guia',/guia/,/\b(n[oº°]?|numero)\b.*(senha|autoriza|conta)/);pega('paciente',/paciente|beneficiario|cliente/,/^nome$/);
  pega('apresentado',/apresentad|cobrad|informad|faturad/,/valor.*(total|bruto)/);pega('pago',/valor.*(pago|liberad|aprovad|liquido)/,/^(pago|liberado|aprovado)$/,/^valor$/,/valor/);
  return m}
const cvMoldeOk=m=>!!m&&(m.data_pag!==undefined||m.data_atend!==undefined)&&(m.pago!==undefined||m.apresentado!==undefined);
// Linhas pelo molde. Sem coluna de glosa: apresentado − pago. Linha de total, sem data ou sem valor fica de fora.
// Chave estável (não duplica ao importar o mesmo demonstrativo de novo): nº da guia + data, senão datas|paciente|centavos + ordem entre linhas iguais.
function cvLinhas(tab,m){const out=[],vistos={},n=i=>i===undefined?null:i,R=x=>Math.round(x*100)/100;
  for(const c of tab.linhas){if(c.some(x=>/^(total|subtotal|soma|totais)\b/i.test(String(x).trim())))continue;
    const v=k=>n(m[k])===null?'':String(c[m[k]]||'').trim(),num=k=>{const x=impReal(v(k));return x===null?null:Math.abs(x)};
    const y={data_pag:impDia(v('data_pag'))||null,data_atend:impDia(v('data_atend'))||null,paciente:v('paciente').replace(/\s+/g,' ').slice(0,80),guia:v('guia').slice(0,40),
      apresentado:num('apresentado'),pago:num('pago'),glosa:num('glosa'),irrf:num('irrf')||0,inss:num('inss')||0};
    if(!y.data_pag&&!y.data_atend)continue;if(!(y.pago>0)&&!(y.apresentado>0))continue;
    if(y.glosa===null)y.glosa=y.apresentado!==null&&y.pago!==null?Math.max(0,R(y.apresentado-y.pago)):0;
    if(y.apresentado===null)y.apresentado=R((y.pago||0)+y.glosa);if(y.pago===null)y.pago=0;
    const base=y.guia?'g:'+impNorm(y.guia)+'|'+(y.data_atend||''):[y.data_atend||'',y.data_pag||'',impNorm(y.paciente),Math.round(y.apresentado*100)].join('|');
    vistos[base]=(vistos[base]||0)+1;y.chave=base+'#'+vistos[base];out.push(y)}
  return out}
// Por convênio e mês (regime de caixa: mês do pagamento; sem data de pagamento = "a receber", no mês do atendimento)
function cvMeses(ls,convs){const nome=id=>(convs.find(c=>c.id===id)||{}).nome||'Convênio',g={},R=x=>Math.round(x*100)/100;
  for(const x of ls){const pend=!x.data_pag,mes=(x.data_pag||x.data_atend).slice(0,7),k=x.convenio_id+'|'+mes+'|'+(pend?1:0);
    const t=g[k]||(g[k]={convenio_id:x.convenio_id,convenio:nome(x.convenio_id),mes,receber:pend,guias:0,apresentado:0,pago:0,glosa:0,irrf:0,inss:0});
    t.guias++;for(const c of ['apresentado','pago','glosa','irrf','inss'])t[c]=R(t[c]+ +x[c])}
  return Object.values(g).map(t=>({...t,liquido:R(t.pago-t.irrf-t.inss)})).sort((a,b)=>b.mes.localeCompare(a.mes)||a.convenio.localeCompare(b.convenio)||a.receber-b.receber)}
// Para a declaração do ano: um informe por convênio (CNPJ, rendimento pago, IR retido, INSS retido), pelo ano do pagamento
function cvAno(ls,convs,ano){const R=x=>Math.round(x*100)/100,g={};
  for(const x of ls){if(!x.data_pag||!x.data_pag.startsWith(ano)||!(+x.pago>0))continue;const c=convs.find(c=>c.id===x.convenio_id)||{};
    const t=g[x.convenio_id]||(g[x.convenio_id]={nome:c.nome||'Convênio',cnpj:c.cnpj||'',pago:0,irrf:0,inss:0});t.pago=R(t.pago+ +x.pago);t.irrf=R(t.irrf+ +x.irrf);t.inss=R(t.inss+ +x.inss)}
  return Object.values(g).sort((a,b)=>b.pago-a.pago)}
function cvCnpjOk(c){c=String(c||'').replace(/\D/g,'');if(c.length!==14||/^(\d)\1+$/.test(c))return false;
  const dv=t=>{let s=0,p=t-7;for(let i=0;i<t;i++){s+=+c[i]*p--;if(p<2)p=9}const r=s%11;return r<2?0:11-r};return dv(12)===+c[12]&&dv(13)===+c[13]}
if(typeof module!=='undefined')module.exports={CV_CAMPOS,cvAdivinha,cvMoldeOk,cvLinhas,cvMeses,cvAno,cvCnpjOk};
