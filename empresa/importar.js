/* IMPORTAR A CARTEIRA do escritório (21/11/2026): planilha CSV (uma linha por cliente, ou por empregado repetindo o CNPJ) → conferência → grava os EMPREGADOS
   das empresas que já existem no sistema. Empresas novas NÃO são criadas aqui (o cadastro da empresa exige a titular e o aceite dela): saem numa lista
   "cadastrar pelo fluxo de entrada". Nada é gravado sem a pré-visualização e o clique do contador. Independente de outros scripts.
   Colunas (nomes flexíveis): cnpj, razao, regime, cnae, abertura, cpf, nome, cargo, salario, admissao, dependentes. Separador ; ou , */
const soD=s=>String(s==null?'':s).replace(/\D/g,'');
const norm0=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase().trim();
function cnpjOk(c){c=soD(c);if(c.length!==14||/^(\d)\1+$/.test(c))return false;const d=(n)=>{let s=0,p=n-7;for(let i=0;i<n;i++){s+=+c[i]*p--;if(p<2)p=9}const r=s%11;return r<2?0:11-r};return d(12)===+c[12]&&d(13)===+c[13]}
function cpfOk(c){c=soD(c);if(c.length!==11||/^(\d)\1+$/.test(c))return false;for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=+c[i]*(t+1-i);if(((s*10)%11)%10!==+c[t])return false}return true}
const SM_IMP={2026:1621};   // salário mínimo de referência; se o ano não estiver aqui, não valida piso
function dataIso(s){s=String(s||'').trim();let m=s.match(/^(\d{4})-(\d{2})-(\d{2})$/)||(s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)&&[0].concat(s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/).slice(1).reverse()));if(!m)return null;const [a,b,c]=[+m[1],+m[2],+m[3]],d=new Date(Date.UTC(a,b-1,c));return d.getUTCFullYear()===a&&d.getUTCMonth()===b-1&&d.getUTCDate()===c?`${m[1]}-${m[2]}-${m[3]}`:null}
function numBR(s){s=String(s==null?'':s).trim().replace(/[R$\s]/g,'');if(!s)return NaN;if(/,/.test(s))s=s.replace(/\./g,'').replace(',','.');return +s}
function lerCarteiraCSV(txt,hoje){
  hoje=hoje||new Date().toISOString().slice(0,10);
  const L=String(txt||'').replace(/^﻿/,'').split(/\r?\n/).filter(l=>l.trim()),erros=[],avisos=[],mapa=new Map();
  if(!L.length)return {clientes:[],erros:[{linha:0,motivo:'arquivo vazio'}],avisos};
  const sep=(L[0].match(/;/g)||[]).length>=(L[0].match(/,/g)||[]).length&&L[0].includes(';')?';':',';
  const split=l=>{const o=[];let c='',q=false;for(const ch of l){if(ch==='"')q=!q;else if(ch===sep&&!q){o.push(c);c=''}else c+=ch}o.push(c);return o.map(x=>x.trim())};
  const cab=split(L[0]).map(norm0),ix=(...k)=>cab.findIndex(c=>k.some(x=>c.includes(x)));
  const I={cnpj:ix('CNPJ'),razao:ix('RAZAO','EMPRESA','CLIENTE'),regime:ix('REGIME'),cnae:ix('CNAE'),abre:ix('ABERTURA','INICIO'),cpf:ix('CPF'),nome:ix('NOME','FUNCIONARIO','EMPREGADO'),cargo:ix('CARGO','FUNCAO'),sal:ix('SALARIO'),adm:ix('ADMISSAO'),dep:ix('DEPENDENTE')};
  if(I.cnpj<0)return {clientes:[],erros:[{linha:1,motivo:'cabeçalho sem a coluna CNPJ'}],avisos};
  for(let k=1;k<L.length;k++){const c=split(L[k]),g=i=>i<0?'':(c[i]||''),ln=k+1,cnpj=soD(g(I.cnpj));
    if(!cnpjOk(cnpj)){erros.push({linha:ln,motivo:`CNPJ inválido (${g(I.cnpj)||'vazio'})`});continue}
    let cl=mapa.get(cnpj);if(!cl){cl={cnpj,razao:g(I.razao)||'',regime:g(I.regime)||'',cnae:soD(g(I.cnae)),abertura:dataIso(g(I.abre))||'',empregados:[],linha:ln};mapa.set(cnpj,cl)}
    else if(g(I.razao)&&cl.razao&&norm0(g(I.razao))!==norm0(cl.razao))avisos.push({linha:ln,motivo:`razão social diferente para o mesmo CNPJ ${cnpj}: mantive a primeira`});
    const nome=g(I.nome),cpf=soD(g(I.cpf));if(!nome&&!cpf&&!g(I.sal))continue;   // linha só de cliente
    const emp={nome,cpf,cargo:g(I.cargo),salario:numBR(g(I.sal)),admissao:dataIso(g(I.adm)),dependentes:parseInt(g(I.dep)||'0',10)||0,linha:ln},m=[];
    if(!nome)m.push('nome vazio');if(!cpfOk(cpf))m.push('CPF inválido');if(!(emp.salario>0))m.push('salário inválido');if(!emp.admissao)m.push('admissão inválida (use AAAA-MM-DD ou DD/MM/AAAA)');
    else if(emp.admissao>hoje)m.push('admissão no futuro');
    if(!m.length){const sm=SM_IMP[+hoje.slice(0,4)];if(sm&&emp.salario<sm)avisos.push({linha:ln,motivo:`salário de ${nome} abaixo do mínimo (${sm}): confirme se é jornada parcial`});
      if(cl.empregados.some(x=>x.cpf===cpf))m.push('CPF repetido na mesma empresa')}
    if(m.length)erros.push({linha:ln,motivo:`${nome||'empregado'}: ${m.join('; ')}`});else cl.empregados.push(emp)}
  return {clientes:[...mapa.values()],erros,avisos}}
// existentes: [{id,cnpj,razao_social}] (DB.empresas()); jaTem: {empresaId:[cpf,...]} para não duplicar empregado
function planoImportacao(lido,existentes,jaTem){
  const ex=new Map((existentes||[]).map(e=>[soD(e.cnpj),e])),P={gravar:[],criar:[],pular:[]};
  for(const c of lido.clientes){const e=ex.get(c.cnpj);
    if(!e){P.criar.push({cnpj:c.cnpj,razao:c.razao,empregados:c.empregados.length,motivo:'empresa ainda não cadastrada: cadastrar pelo fluxo de entrada (a titular aceita)'});continue}
    const tem=new Set((jaTem||{})[e.id]||[]);
    for(const emp of c.empregados){if(tem.has(emp.cpf))P.pular.push({empresa:e.razao_social||c.razao,nome:emp.nome,motivo:'já cadastrado'});else P.gravar.push({empresaId:e.id,empresa:e.razao_social||c.razao,...emp})}}
  return P}
async function importarEmpregados(DB,plano){
  const r={gravados:0,falhas:[]};
  for(const x of plano.gravar){try{await DB.salvarEmpregado(x.empresaId,{nome:x.nome,cpf:x.cpf,cargo:x.cargo,salario:x.salario,admissao:x.admissao,dependentes:x.dependentes});r.gravados++}catch(e){r.falhas.push({empresa:x.empresa,nome:x.nome,motivo:String(e.message||e)})}}
  return r}
if(typeof module!=='undefined')module.exports={lerCarteiraCSV,planoImportacao,importarEmpregados,cnpjOk,cpfOk};
