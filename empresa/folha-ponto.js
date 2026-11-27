// Folha: importação do ESPELHO DE PONTO em planilha (27/11/2026; matriz da folha, linha 32: outros sistemas têm integração com ponto; nós não tínhamos).
// Carregar antes de folha-telas.js. Só LÊ texto colado ou de arquivo CSV/TXT (separador ; ou tabulação ou vírgula) e devolve os movimentos que calculaFolha (folha.js) já entende.
// NÃO adivinha o layout de nenhum fabricante de relógio: o contador confere os nomes das colunas. Nada é gravado nem enviado.
// Colunas aceitas (maiúscula, acento e espaço não importam): id|matricula|cpf, nome, he50|horas extras 50, he100|horas extras 100 (descanso e feriado),
// noturnas|horas noturnas, faltas|faltas dias, atraso|atrasos (horas), comissao|comissoes (R$), salario (opcional, só para mostrar o cálculo).
// Horas: "10,5", "10.5" ou "10:30".  [CONFERIR COM O DANIEL] a regra da empresa para atraso, tolerância de minutos e banco de horas: aqui o atraso entra como veio.
(function(){
  const r2p=x=>Math.round((+x+Number.EPSILON)*100)/100;
  const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const COL={id:['id','matricula','cpf'],nome:['nome','empregado','funcionario'],heNormais:['he50','horasextras50','horaextra50','he'],heDescanso:['he100','horasextras100','horaextra100'],
    horasNoturnas:['noturnas','horasnoturnas','adicionalnoturno'],faltasDias:['faltas','faltasdias','faltasinjustificadas'],atrasoHoras:['atraso','atrasos','atrasohoras','atrasoshoras'],
    comissao:['comissao','comissoes'],salario:['salario','salariobase']};
  const HORAS=['heNormais','heDescanso','horasNoturnas','atrasoHoras'];
  function num(x){x=String(x==null?'':x).trim();if(x==='')return 0;
    if(/^-?\d+:\d{1,2}$/.test(x)){const[h,m]=x.split(':');if(+m>59)return NaN;return (+h)+(+m)/60}
    x=x.replace(/\s/g,'');if(/,/.test(x))x=x.replace(/\./g,'').replace(',','.');return /^-?\d+(\.\d+)?$/.test(x)?+x:NaN}
  function importaPonto(texto,o={}){
    const linhas=String(texto||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if(linhas.length<2)return{ok:false,erros:['cole o cabeçalho e pelo menos uma linha de empregado']};
    const sep=linhas[0].includes(';')?';':linhas[0].includes('\t')?'\t':',';
    const cab=linhas[0].split(sep).map(norm),idx={};
    for(const k in COL){const i=cab.findIndex(c=>COL[k].includes(c));if(i>=0)idx[k]=i}
    if(idx.id==null)return{ok:false,erros:['falta a coluna de identificação (id, matrícula ou cpf)']};
    const campos=Object.keys(idx).filter(k=>!['id','nome','salario'].includes(k));
    if(!campos.length)return{ok:false,erros:['nenhuma coluna de movimento reconhecida (he50, he100, noturnas, faltas, atraso, comissao)']};
    const diasUteis=o.diasUteis>0?+o.diasUteis:25,mov={},linhasR=[],erros=[],alertas=[],vistos=new Set();
    for(let n=1;n<linhas.length;n++){
      const c=linhas[n].split(sep),id=String(c[idx.id]||'').trim();
      if(!id){erros.push('linha '+(n+1)+': sem identificação');continue}
      if(vistos.has(id)){erros.push('linha '+(n+1)+': empregado '+id+' repetido (some as linhas antes de colar)');continue}
      vistos.add(id);const m={},nome=idx.nome!=null?String(c[idx.nome]||'').trim():id;let bad=false;
      for(const k of campos){const v=num(c[idx[k]]);if(isNaN(v)||v<0){erros.push('linha '+(n+1)+' ('+nome+'): valor inválido em '+k);bad=true;break}m[k]=HORAS.includes(k)?r2p(v):k==='comissao'?r2p(v):v}
      if(bad)continue;
      if((m.faltasDias||0)>31){erros.push('linha '+(n+1)+' ('+nome+'): mais de 31 faltas no mês');continue}
      if((m.heNormais||0)+(m.heDescanso||0)>2*diasUteis)alertas.push(nome+": "+r2p((m.heNormais||0)+(m.heDescanso||0))+' h extras no mês passam de 2 h por dia útil (CLT art. 59): conferir acordo ou banco de horas.');
      if(m.faltasDias>0)alertas.push(nome+": "+m.faltasDias+' falta(s). Atestado ou falta justificada NÃO é desconto; falta injustificada na semana pode tirar o DSR (Lei 605/49, art. 6º): conferir antes de lançar dsrPerdidos.');
      mov[id]=m;const L={id,nome,mov:m};if(idx.salario!=null){const s=num(c[idx.salario]);if(!isNaN(s)&&s>0)L.salario=s}linhasR.push(L)}
    if(!linhasR.length)return{ok:false,erros:erros.length?erros:['nenhum empregado válido']};
    return{ok:true,movimentos:mov,linhas:linhasR,erros,alertas,colunasLidas:Object.keys(idx),
      aviso:'Importação do que está na planilha. A empresa confere o espelho de ponto antes de pagar; o sistema não decide tolerância, banco de horas nem justificativa de falta.'}}
  if(typeof window!=='undefined')window.importaPonto=importaPonto;
  if(typeof module!=='undefined')module.exports={importaPonto};
})();
