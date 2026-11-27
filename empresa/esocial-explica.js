// eSocial: explica o código de rejeição com o TEXTO OFICIAL (27/11/2026). Catálogo: esocial-mensagens.json, gerado do PDF "Mensagens do Sistema" v2.5 (abril/2026) do gov.br.
// NÃO interpreta: devolve a mensagem oficial com os parâmetros {0}, {1}... preenchidos e a "Ação Sugerida" oficial. Código fora do catálogo: diz que não achou (nada de chute).
// O que é nosso e rotulado como tal: "tipo" (só reconhece falha temporária quando o PRÓPRIO texto oficial diz "tente novamente" ou "falha ... temporária").
(function(){
  const norm=c=>{const m=String(c==null?'':c).toUpperCase().match(/(\d{1,4})/);return m?'MS'+m[1].padStart(4,'0'):null};
  function explicaRejeicao(codigo,catalogo,params){
    const cod=norm(codigo);if(!cod)return{ok:false,erros:['informe o código da rejeição (ex.: MS0269 ou 269)']};
    if(!catalogo||!catalogo.mensagens)return{ok:false,erros:['catálogo de mensagens não carregado']};
    const e=catalogo.mensagens[cod];
    if(!e)return{ok:true,achou:false,codigo:cod,aviso:'Código '+cod+' não consta no catálogo oficial carregado ('+catalogo.fonte+'). Confira o código no retorno do eSocial; o sistema não deduz significado pelo número.'};
    const P=Array.isArray(params)?params:[],sub=t=>String(t).replace(/\{(\d+)\}/g,(m,i)=>P[+i]!=null&&P[+i]!==''?String(P[+i]):m);
    const temp=/tente novamente|falha pode ser tempor|pode ser tempor|Tente mais tarde/i.test(e.mensagem+' '+e.acao);
    return{ok:true,achou:true,codigo:cod,mensagem:sub(e.mensagem),acao:e.acao?sub(e.acao):'',pagina:e.pagina,
      tipo:temp?'falha temporária (o texto oficial manda tentar de novo)':'erro de dado ou regra: corrigir e reenviar',
      fonte:catalogo.fonte,url:catalogo.url,
      aviso:'Texto oficial do eSocial. Quem corrige o dado é o contador; o sistema não reenvia sozinho.'}}
  if(typeof window!=='undefined')window.explicaRejeicao=explicaRejeicao;
  if(typeof module!=='undefined')module.exports={explicaRejeicao};
})();
