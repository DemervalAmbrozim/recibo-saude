// Medição ANÔNIMA de visitas e cliques das páginas de apresentação (SQL 057): só o total por dia, página e botão. Sem cookie, sem IP, sem identificador.
// Respeita "Não rastrear" do navegador. Falha em silêncio: nunca atrapalha a página. Só entra nas páginas públicas (capa, venda, empresa, captação), nunca no app logado.
(function(){try{
  if(navigator.doNotTrack==='1'||window.doNotTrack==='1'||typeof CONFIG==='undefined')return;
  if(/^(localhost|127\.|\[::1\])/.test(location.hostname)&&!window.__METRICA_TESTE)return; // desenvolvimento e testes não entram na contagem
  var pagina=(location.pathname.replace(/^\//,'')||'inicio').toLowerCase().replace(/[^a-z0-9/._-]/g,'-').slice(0,60);
  function manda(cta){try{fetch(CONFIG.url+'/rest/v1/rpc/registrar_clique',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json',apikey:CONFIG.chave,Authorization:'Bearer '+CONFIG.chave},body:JSON.stringify({p_cta:cta,p_pagina:pagina})}).catch(function(){})}catch(e){}}
  var k='rs_visita_'+pagina;if(!sessionStorage.getItem(k)){sessionStorage.setItem(k,'1');manda('visita')}
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-cta]');if(a)manda(String(a.getAttribute('data-cta')).slice(0,40))},true);
}catch(e){}})();
