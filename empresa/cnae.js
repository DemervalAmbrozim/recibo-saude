// Tabela CNAE x Anexo das profissões de saúde (17/11/2026). Fonte: projeto/cnae-anexo-defis-irpf-socios-2026-11-17.md (IBGE/Concla + CGSN art. 25 §1º + LC 123).
// verificado=false: item inferido da regra ou não achado nominalmente. Os Anexos VI e VII (CNAE impeditivos/ambíguos) NÃO foram lidos: o simulador do Portal do Simples é a prova final.
const CNAES_SAUDE=[
 {cod:'8650-0/04',prof:'Fisioterapia',anexo:'III/V',fatorR:true,iss:'4.08',verificado:true},
 {cod:'8650-0/03',prof:'Psicologia',anexo:'III/V',fatorR:true,iss:'4.15/4.16',verificado:true},
 {cod:'8650-0/06',prof:'Fonoaudiologia',anexo:'III/V',fatorR:true,iss:'4.08',verificado:true},
 {cod:'8650-0/05',prof:'Terapia ocupacional',anexo:'III/V',fatorR:true,iss:'4.08',verificado:true},
 {cod:'8650-0/02',prof:'Nutrição',anexo:'III/V',fatorR:true,iss:'4.10',verificado:false,obs:'a lei fala em "clínicas de nutrição"; o enquadramento do nutricionista é pelo CNAE (o contador confirma)'},
 {cod:'8630-5/04',prof:'Odontologia',anexo:'III/V',fatorR:true,iss:'4.12',verificado:true},
 {cod:'8630-5/03',prof:'Medicina, consultas',anexo:'III/V',fatorR:true,iss:'4.01',verificado:true},
 {cod:'8630-5/01',prof:'Medicina, clínica com procedimentos cirúrgicos',anexo:'III/V',fatorR:true,iss:'4.03',verificado:true},
 {cod:'8630-5/02',prof:'Medicina, clínica com exames complementares',anexo:'III/V',fatorR:true,iss:'4.02/4.03',verificado:true},
 {cod:'8630-5/06',prof:'Vacinação e imunização',anexo:'III/V',fatorR:true,iss:'',verificado:true},
 {cod:'8650-0/01',prof:'Enfermagem',anexo:'III/V',fatorR:true,iss:'4.06',verificado:true,obs:'atenção à cessão de mão de obra (art. 17, XII) em home care'},
 {cod:'8650-0/99',prof:'Biomedicina e farmacêutico prestando serviço (não especificados)',anexo:'III/V',fatorR:true,iss:'4.01/4.07',verificado:false,obs:'não há CNAE próprio; enquadra em "outras atividades intelectuais" (o contador confirma)'},
 {cod:'8640-2/02',prof:'Laboratório clínico (análises)',anexo:'III/V',fatorR:true,iss:'4.02',verificado:true},
 {cod:'7500-1/00',prof:'Veterinária',anexo:'III/V',fatorR:true,iss:'5.01-5.03',verificado:true},
 {cod:'9313-1/00',prof:'Educação física, personal trainer e pilates',anexo:'III/V',fatorR:true,iss:'6.04',verificado:true},
 {cod:'8591-1/00',prof:'Educação física, ensino de esportes',anexo:'III/V',fatorR:true,iss:'8.02 ou 6.04 conforme o município',verificado:false,obs:'o ISS depende da lei municipal'},
 {cod:'4771-7/01',prof:'Farmácia, comércio de balcão',anexo:'I',fatorR:false,iss:'',verificado:true,obs:'comércio: segregar ST e monofásico'},
 {cod:'4771-7/02',prof:'Farmácia de manipulação',anexo:'III ou I',fatorR:false,iss:'',verificado:true,obs:'III se sob encomenda com prescrição; I nos demais casos; misto exige segregação'}];
const MEI_NAO_ADMITE='Nenhuma destas profissões de saúde cabe no MEI (Anexo XI da Res. CGSN não as inclui).';
function normCnae(c){const d=String(c||'').replace(/\D/g,'');return d.length===7?d.slice(0,4)+'-'+d[4]+'/'+d.slice(5):null}
function buscaCnae(c){const k=normCnae(c);if(!k)return {achou:false,motivo:'código inválido: use 7 dígitos, como 8650-0/04'};
  const r=CNAES_SAUDE.find(x=>x.cod===k);
  if(!r)return {achou:false,cod:k,motivo:'CNAE fora da tabela de saúde: o contador confere o Anexo antes de qualquer opção pelo Simples'};
  const avisos=[];if(!r.verificado)avisos.push('enquadramento inferido da regra, a confirmar com o contador');if(r.obs)avisos.push(r.obs);
  avisos.push('lista de CNAE impeditivos (Anexos VI e VII) ainda não conferida nominalmente: confirmar no simulador do Portal do Simples');
  return {achou:true,...r,mei:false,avisos}}
function sugereCnae(profissao){const t=String(profissao||'').toLowerCase();return t.length<3?[]:CNAES_SAUDE.filter(x=>x.prof.toLowerCase().includes(t))}
if(typeof module!=='undefined')module.exports={CNAES_SAUDE,buscaCnae,sugereCnae,normCnae,MEI_NAO_ADMITE};
