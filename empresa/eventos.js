// Eventos da empresa de saúde (degrau 2, item 7): entrada de sócio, saída de sócio, alteração contratual, mudança de endereço, mudança de atividade (CNAE) e baixa. 17/11/2026.
// Gera o PLANO do evento: passos em ordem, quem faz, o que o app confere sozinho e alertas conforme os dados da empresa.
// Só o que é lei certa vem sem marca. Prazos e valores que dependem do município, do conselho ou da Junta vêm marcados "conferir" e quem confere é o contador (ou o advogado, na parte societária).
// Base legal usada (Código Civil): art. 1.003, parágrafo único (cedente responde por 2 anos pelas obrigações do tempo em que era sócio) e art. 1.032 (retirante ou excluído responde por até 2 anos após a averbação). Sociedade simples de profissão intelectual registra no Cartório de Registro Civil de Pessoas Jurídicas; sociedade empresária, na Junta (JUCEES, no ES): o app pergunta qual é.
// ESTIMATIVA/RASCUNHO: o contador confere cada plano antes do primeiro cliente.
const TIPOS_EVENTO=['entrada_socio','saida_socio','alteracao_contratual','mudanca_endereco','mudanca_cnae','baixa'];
const NOMES_EVENTO={entrada_socio:'Entrada de sócio',saida_socio:'Saída de sócio',alteracao_contratual:'Alteração do contrato social',mudanca_endereco:'Mudança de endereço',mudanca_cnae:'Mudança de atividade (CNAE)',baixa:'Baixa (encerramento) da empresa'};
const P=(quem,texto,extra={})=>Object.assign({quem,texto,conferir:false},extra);
function planoEvento(tipo,d={}){
  if(!TIPOS_EVENTO.includes(tipo))throw new Error('evento desconhecido: '+tipo);
  const {registro='cartorio',empregados=0,socios=2,temSaldoBanco=false,socioConselho=true,mesesAteSimples=null,rendeiMaisDe4800=false}=d;
  const orgao=registro==='junta'?'Junta Comercial (JUCEES)':'Cartório de Registro Civil de Pessoas Jurídicas';
  const passos=[],avisos=[],fora=[];
  const add=(...p)=>p.forEach(x=>passos.push(x));
  if(rendeiMaisDe4800)fora.push('Receita acima de R$ 4,8 milhões: fora do escopo por enquanto (Simples); o contador decide o regime.');
  if(empregados>3)fora.push('Mais de 3 empregados: fora do escopo por enquanto.');
  if(tipo==='entrada_socio'){
    add(P('Advogado/contador','Minuta da alteração contratual com o novo sócio, participação e administração'),
        P('Sócios','Assinatura da alteração (assinatura eletrônica com certificado ICP-Brasil é aceita quando o órgão do registro permite)',{conferir:true}),
        P('Contador',`Registro no ${orgao} e atualização do CNPJ (quadro societário) na Receita`),
        P('App','Cadastrar o sócio, a participação e o pró-labore; recalcular o Fator R do mês (regra em contab.js)'),
        P('Contador','Conselho profissional do novo sócio: registro da empresa e responsável técnico, se o conselho exigir',{conferir:true}),
        P('Contador','Nova procuração eletrônica/SERPRO se mudar quem outorga',{conferir:true}));
    if(socios+1>2)avisos.push('Com 3 ou mais sócios, conferir se o contrato prevê quórum de deliberação.');
    avisos.push('O novo sócio entra no informe de rendimentos e no IRPF dele (socios.js) a partir do mês da entrada.');
  }else if(tipo==='saida_socio'){
    add(P('Advogado/contador','Alteração contratual de retirada (ou distrato, se a sociedade acabar com a saída) com apuração de haveres e quitação'),
        P('Contador','Balanço de determinação (balanço na data da saída) para apurar o que o sócio recebe',{conferir:true}),
        P('Sócios',`Assinar e registrar no ${orgao}`),
        P('Contador','Atualizar CNPJ na Receita; encerrar o pró-labore do sócio e emitir o informe até a data da saída'),
        P('App','Parar lançamentos de pró-labore e lucros do sócio retirante e recalcular o Fator R'));
    avisos.push('O sócio que sai continua respondendo por até 2 anos, depois da averbação, pelas obrigações do tempo em que era sócio (Código Civil, arts. 1.003 e 1.032): guardar a prova do registro.');
    if(socios<=2)avisos.push('Sociedade ficaria com 1 sócio: o contador e o advogado definem se vira empresário individual/SLU ou se recompõe a pluralidade (a lei dá prazo para recompor, conferir o prazo).');
  }else if(tipo==='alteracao_contratual'){
    add(P('Advogado/contador','Redigir a alteração (capital, objeto, administração, nome empresarial)'),
        P('Sócios',`Assinar e registrar no ${orgao}`),
        P('Contador','Atualizar CNPJ na Receita, município (inscrição e alvará) e conselho profissional',{conferir:true}),
        P('App','Atualizar o cadastro da empresa e refazer o diagnóstico fiscal (diagnostico.js)'));
    avisos.push('Mudança de objeto ou de CNAE pode mudar o Anexo do Simples e o ISS: rodar cnae.js antes de assinar.');
  }else if(tipo==='mudanca_endereco'){
    add(P('Contador','Alteração contratual do endereço (se constar no contrato) e registro'),
        P('Contador','Atualizar CNPJ na Receita, inscrição municipal e alvará do novo município/bairro',{conferir:true}),
        P('Contador','Vigilância Sanitária e CNES do novo endereço, se a atividade exigir',{conferir:true}),
        P('App','Atualizar o endereço no cadastro, nos recibos e nas notas'));
    avisos.push('Mudar de município pode trocar o local do ISS e a alíquota: o contador confere antes de emitir a primeira nota no endereço novo.');
  }else if(tipo==='mudanca_cnae'){
    add(P('App','Rodar cnae.js: Anexo do Simples, Fator R e ISS da nova atividade, com os avisos'),
        P('Contador','Atualizar atividades no CNPJ e no município e conferir se o conselho aceita a atividade',{conferir:true}),
        P('Advogado/contador','Alteração do objeto social, se o contrato listar atividades'));
    avisos.push('Atividade nova pode sair do Simples ou mudar de anexo: não emitir nota da atividade nova antes de o contador confirmar.');
  }else{
    if(empregados>0)add(P('App','ANTES de tudo: rescisão de cada empregado (folha.js, rescisão), pagamento no prazo e guias de FGTS e INSS'));
    add(P('App','Fechar o mês: DAS e PGDAS-D até a data da baixa, balancete e DRE final'),
        P('Contador','Declaração final do Simples (DEFIS de extinção, ou o formato novo no PGDAS-D a partir de 2027): conferir o leiaute e o prazo',{conferir:true}),
        P('Sócios','Distrato social e registro no '+orgao),
        P('Contador','Baixa do CNPJ na Receita, no município (inscrição e alvará), no conselho e no CNES',{conferir:true}),
        P('Contador','Certidões negativas federal, estadual e municipal antes do pedido, quando exigidas',{conferir:true}),
        P('App','Gerar o pacote final: balanço, informes dos sócios e arquivo guardado por 5 anos'));
    if(temSaldoBanco)avisos.push('Há saldo em banco: distribuir ao sócio como lucro isento só até o limite do lucro apurado (lucros.js); o que passar vira outra tributação e o contador decide.');
    avisos.push('Baixa não apaga dívida: pendência continua e pode ser cobrada dos sócios; guardar os documentos por pelo menos 5 anos (conferir com o contador).');
    if(socioConselho)avisos.push('Comunicar o conselho profissional; atenção à anuidade e à inscrição de pessoa física, que continuam.');
  }
  if(mesesAteSimples!==null&&mesesAteSimples<=0&&tipo!=='baixa')avisos.push('A opção pelo Simples está vencida: conferir exclusão e prazo antes de qualquer alteração.');
  const total=passos.length,conf=passos.filter(p=>p.conferir).length;
  return {tipo,nome:NOMES_EVENTO[tipo],passos,avisos,fora,total,conferir:conf,rascunho:true};
}
if(typeof module!=='undefined')module.exports={TIPOS_EVENTO,NOMES_EVENTO,planoEvento};
