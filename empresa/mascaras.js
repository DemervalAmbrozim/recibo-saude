// Máscaras automáticas de digitação (27/11/2026, pedido do Demerval: "vírgula e pontos automáticos, o contador ou o cliente só digita números").
// Reais: o usuário digita só os números e o campo mostra 1.234,56 (dinheiro em reais com 2 casas, padrão D5). Percentual: 12,50. CPF, CNPJ, CEP e telefone com pontuação automática.
// Como ligar: data-mascara="dinheiro|percentual|cpf|cnpj|cep|telefone|numero" no campo, ou, sem atributo, pelo rótulo: "R$" = dinheiro; rótulo que começa com CPF, CNPJ ou CEP. Percentual só com o atributo (rótulos com % podem ser horas).
// Leitura: numeroDe('1.234,56') = 1234.56. O valor do campo continua em texto brasileiro, e os leitores existentes (tira os pontos e troca a vírgula) já entendem.
(function(){
  const dig=s=>String(s==null?'':s).replace(/\D/g,'');
  function dinheiro(s){let d=dig(s).replace(/^0+(?=\d)/,'');if(!d)return '';d=d.padStart(3,'0');const ent=d.slice(0,-2).replace(/^0+(?=\d)/,'')||'0';return ent.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+','+d.slice(-2)}
  function percentual(s){let d=dig(s).replace(/^0+(?=\d)/,'');if(!d)return '';d=d.padStart(3,'0');return (d.slice(0,-2).replace(/^0+(?=\d)/,'')||'0')+','+d.slice(-2)}
  const cpf=s=>{const d=dig(s).slice(0,11);return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2')};
  const cnpj=s=>{const d=dig(s).slice(0,14);return d.replace(/(\d{2})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1/$2').replace(/(\d{4})(\d{1,2})$/,'$1-$2')};
  const cep=s=>dig(s).slice(0,8).replace(/(\d{5})(\d{1,3})$/,'$1-$2');
  const telefone=s=>{const d=dig(s).slice(0,11);return d.length<=10?d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{4})(\d{1,4})$/,'$1-$2'):d.replace(/(\d{2})(\d)/,'($1) $2').replace(/(\d{5})(\d{1,4})$/,'$1-$2')};
  const numero=s=>dig(s);
  const FORMATA={dinheiro,percentual,cpf,cnpj,cep,telefone,numero};
  // texto brasileiro -> número. 1.234,56 e 10.000 (milhar, como já vem nos campos antigos) são texto brasileiro; 1234.56 e 0.5 vêm do código
  function numeroDe(s){if(typeof s==='number')return s;let t=String(s==null?'':s).trim();if(t==='')return 0;if(/,/.test(t)||/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,'').replace(',','.');const n=+t;return isNaN(n)?0:n}
  // número -> texto brasileiro com 2 casas
  const reais=n=>{const c=Math.round(Math.abs(+n||0)*100);return (n<0?'-':'')+dinheiro(String(c))||'0,00'};
  function tipoDoCampo(el){const a=el.getAttribute&&el.getAttribute('data-mascara');if(a)return FORMATA[a]?a:null;
    if(el.type&&!['text','tel','search',''].includes(el.type))return null;if(el.getAttribute('data-sem-mascara')!==null)return null;
    const lb=el.closest&&el.closest('label'),t=((lb&&lb.textContent)||el.getAttribute('aria-label')||el.placeholder||'');
    if(/R\$/.test(t))return 'dinheiro';if(/^\s*CPF\b/.test(t))return 'cpf';if(/^\s*CNPJ\b/.test(t))return 'cnpj';if(/^\s*CEP\b/.test(t))return 'cep';return null}   // só pelo rótulo que COMEÇA com CPF, CNPJ ou CEP; percentual NUNCA por rótulo (ex.: "Horas extras 50%" são horas): só com data-mascara="percentual"
  function aplica(el){if(el.__mascara)return;const tp=tipoDoCampo(el);if(!tp)return;el.__mascara=tp;el.setAttribute('inputmode','numeric');if(tp==='dinheiro'||tp==='percentual')el.setAttribute('autocomplete','off');
    const f=FORMATA[tp];
    // valor que já vem preenchido em texto brasileiro (ex.: "10.000"): vira 10.000,00
    if((tp==='dinheiro'||tp==='percentual')&&el.value!==''){const n=numeroDe(el.value);el.value=tp==='dinheiro'?reais(n):percentual(String(Math.round(n*100)))}
    else if(el.value!=='')el.value=f(el.value);
    el.addEventListener('input',()=>{const antes=el.value,novo=f(antes);if(novo!==antes){el.value=novo;try{el.setSelectionRange(novo.length,novo.length)}catch(e){el.__semCursor=true}el.dispatchEvent(new Event('input',{bubbles:true}))}}); // reavisa quem calcula com o valor já formatado (o segundo disparo não muda nada e para)
  }
  function liga(raiz){const r=raiz||document;if(!r.querySelectorAll)return;r.querySelectorAll('input').forEach(aplica)}
  const api={dinheiro,percentual,cpf,cnpj,cep,telefone,numeroDe,reais,liga,tipoDoCampo};
  if(typeof module!=='undefined')module.exports=api;
  if(typeof window!=='undefined'){window.Mascaras=api;
    const inicia=()=>{liga(document);try{new MutationObserver(m=>{for(const x of m)x.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.tagName==='INPUT')aplica(n);else liga(n)}})}).observe(document.body,{childList:true,subtree:true})}catch(e){window.__mascarasSemObservador=true}};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',inicia);else inicia()}
})();
