// Tabela 18 do eSocial (motivos de afastamento temporário) como o MOS S-1.3 a descreve, evento S-2230, item 2.1 "obrigatoriedade" (LIDO em 27/11/2026).
// Lida só a regra para o nosso público: empregado CLT de empresa privada (categoria 1XX, tpRegTrab [1], tpRegPrev [1]). Quadro lido até o código 51; os códigos 2, 4, 8, 9, 14, 23, 30, 32, 33 e do 52 em diante
// Códigos encerrados (8, 14, 23, 30, 33) e inexistentes (2, 4, 9, 32) conferidos na Tabela 18 oficial das Tabelas S-1.3; do 52 em diante não consta e aparece como "desconhecido". 'condicional' = a obrigação depende de uma condição escrita em 'nota'. [CONFERIR COM O CONTADOR] em dúvida.
(function(){
  const O='obrigatoria',F='facultativa',N='nao_enviar',C='condicional';
  const T=[
    [1,'Acidente/Doença do trabalho',O,'Obrigatória independentemente dos dias (categoria 1XX).'],
    [3,'Acidente/Doença não relacionada ao trabalho',C,'Obrigatória só se: duração acima de 15 dias; ou, em até 60 dias pela mesma doença, somar mais de 15 dias; ou em até 60 dias do retorno de afastamento anterior pela mesma doença que gerou auxílio por incapacidade temporária. Nas demais hipóteses é opcional (MOS item 5.1).'],
    [5,'Afastamento/licença de servidor público prevista em estatuto, sem remuneração',N,'Só categorias 3XX e 410.'],
    [6,'Aposentadoria por invalidez (aposentadoria por incapacidade permanente)',O,'Obrigatória para 1XX com regime CLT.'],
    [7,'Acompanhamento: licença para acompanhamento de membro da família enfermo',F,''],
    [10,'Afastamento/licença de servidor público prevista em estatuto, com remuneração',N,'Só 410 ou 3XX estatutário.'],
    [11,'Cárcere',C,'Obrigatória nos casos que geram direito ao auxílio-reclusão.'],
    [12,'Cargo eletivo: candidato (Lei 7.664/1988, art. 25, parágrafo único), celetistas em geral',O,'Obrigatória para 1XX com regime CLT.'],
    [13,'Cargo eletivo: candidato (LC 64/1990, art. 1º, II, "l"), servidor público',O,'Obrigatória para 1XX com regime CLT.'],
    [15,'Gozo de férias ou recesso',O,'Obrigatória (categoria 1XX).'],
    [16,'Licença remunerada (lei, liberalidade da empresa ou acordo/convenção coletiva)',F,''],
    [17,'Licença-maternidade',O,''],
    [18,'Licença-maternidade: prorrogação por 60 dias (Lei 11.770/2008, Empresa Cidadã)',O,''],
    [19,'Licença-maternidade: aborto não criminoso',O,''],
    [20,'Licença-maternidade: adoção ou guarda judicial de criança',O,''],
    [21,'Licença não remunerada ou suspensão contratual por obrigação legal incompatível com o serviço',C,'Obrigatória se o afastamento ocupou todo o mês calendário, sem remuneração; nos demais casos é facultativa.'],
    [22,'Mandato eleitoral',N,'Para 1XX só vale para empregado público; empresa privada não envia.'],
    [24,'Mandato sindical',O,''],
    [25,'Mulher vítima de violência (Lei 11.340/2006, art. 9º, §2º, II)',O,''],
    [26,'Participação de empregado no CNPS (Lei 8.213/1991, art. 3º)',F,''],
    [27,'Qualificação: suspensão do contrato (CLT art. 476-A)',O,'Obrigatória para 1XX com regime CLT.'],
    [28,'Representante sindical em reunião oficial de organismo internacional',F,''],
    [29,'Serviço militar obrigatório',C,'Obrigatória se o afastamento ocupou todo o mês calendário, sem remuneração; nos demais casos é facultativa.'],
    [31,'Servidor público em disponibilidade',N,'Só 301 e 307.'],
    [34,'Inatividade do trabalhador avulso por mais de 90 dias',N,'Só categoria 2XX.'],
    [35,'Licença-maternidade: antecipação e/ou prorrogação mediante atestado médico',O,''],
    [36,'Afastamento de exercente de mandato eletivo para cargo em comissão',N,'Só 303 e 304.'],
    [37,'Suspensão temporária do contrato (MP 936/2020)',O,'Obrigatória para 1XX (regra de 2020; conferir se ainda cabe).'],
    [38,'Impedimento de concorrência à escala para trabalho avulso',N,'Só 2XX.'],
    [39,'Suspensão de pagamento de servidor por não recadastramento',N,'Só 3XX e 410.'],
    [40,'Exercício em outro órgão de servidor ou empregado público cedido',N,'Só 410.'],
    [41,'Qualificação: suspensão do contrato (Lei 14.457/2022, art. 15)',O,''],
    [42,'Qualificação: suspensão do contrato (Lei 14.457/2022, art. 17)',O,''],
    [43,'Licença-maternidade: prorrogação por 60 dias (Lei 15.156/2025, criança com deficiência por síndrome congênita do vírus Zika)',O,''],
    [44,'Suspensão contratual por ajuizamento de reclamação trabalhista pleiteando rescisão indireta',O,'Obrigatória para 1XX com regime CLT.'],
    [45,'Suspensão contratual para ajuizamento de inquérito de apuração de falta grave',O,'Obrigatória para 1XX com regime CLT.'],
    [46,'Licença-paternidade',O,''],
    [47,'Licença-paternidade: prorrogação (Lei 11.770/2008, Empresa Cidadã)',O,''],
    [48,'Licença-paternidade: responsável parental sobrevivente, adoção ou guarda judicial',O,''],
    [49,'Licença-paternidade: antecipação e/ou prorrogação mediante atestado médico',O,''],
    [50,'Licença-paternidade: prorrogação de 1/3 do período (Lei 15.371/2026, art. 12)',O,''],
    [51,'Licença-paternidade: equiparação à licença-maternidade por ausência materna no registro civil',O,'']
  ].map(([cod,descricao,obrigatoriedade,nota])=>({cod:String(cod).padStart(2,'0'),descricao,obrigatoriedade,nota}));
  // Tabela 18 oficial (Tabelas do eSocial S-1.3, gov.br): códigos ENCERRADOS (não usar em período posterior ao término) e códigos que não constam da tabela.
  const ENCERRADOS={'08':['Afastamento do empregado para participar de atividade do Conselho Curador do FGTS','18/07/2021'],'14':['Cessão/Requisição','09/03/2022'],'23':['Mandato eleitoral, com remuneração','18/07/2021'],'30':['Suspensão disciplinar (art. 474 da CLT)','18/07/2021'],'33':['Licença maternidade 180 dias, Lei 13.301/2016','18/07/2021']};
  const INEXISTENTES=['02','04','09','32'];
  const POR=Object.fromEntries(T.map(x=>[x.cod,x]));
  const ROT={obrigatoria:'Obrigatória para empregado CLT',facultativa:'Facultativa',nao_enviar:'Não deve ser enviada por empresa privada com empregado CLT',condicional:'Obrigatória só em certas condições'};
  // codigo: '1', '01' ou 1. Devolve {conhecido, cod, descricao, obrigatoriedade, rotulo, nota}
  function motivoAfastamento(codigo){const cod=String(codigo==null?'':codigo).replace(/\D/g,'').padStart(2,'0'),x=POR[cod];
    if(!x&&ENCERRADOS[cod])return{conhecido:true,encerrado:true,cod,descricao:ENCERRADOS[cod][0],termino:ENCERRADOS[cod][1],obrigatoriedade:'nao_enviar',rotulo:'Código encerrado em '+ENCERRADOS[cod][1]+' (Tabela 18 oficial): não usar em afastamento posterior',nota:'Fonte: Tabelas do eSocial S-1.3, Tabela 18.'};
    if(!x&&INEXISTENTES.indexOf(cod)>=0)return{conhecido:false,cod,inexistente:true,aviso:'Código '+cod+' não consta da Tabela 18 (Tabelas do eSocial S-1.3). Confira o motivo do afastamento.'};
    if(!x)return{conhecido:false,cod,aviso:'Código '+cod+' fora do quadro lido (códigos 1 a 51 do MOS S-2230 item 2.1). Confira na Tabela 18 do eSocial. [CONFERIR COM O CONTADOR]'};
    return{conhecido:true,...x,rotulo:ROT[x.obrigatoriedade]}}
  const api={motivoAfastamento,listaMotivos:()=>T.map(x=>({...x,rotulo:ROT[x.obrigatoriedade]}))};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined')Object.assign(window,api);
})();
