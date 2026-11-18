// Registro de acesso (Marco Civil, art. 15): avisa o servidor UMA vez por sessão do navegador. O servidor lê o IP; aqui nunca se guarda nada.
// Falha em silêncio: o registro nunca pode atrapalhar quem está entrando. tipo = 'login' (jwt) ou 'link' (tok).
function registraAcesso(tipo,tok,jwt){try{var k='rs_acesso_'+tipo;if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1');
  fetch(CONFIG.url+'/functions/v1/registrar-acesso',{method:'POST',headers:{'Content-Type':'application/json',apikey:CONFIG.chave,Authorization:'Bearer '+(jwt||CONFIG.chave)},body:JSON.stringify({tipo:tipo,tok:tok||undefined})}).catch(function(){})}catch(e){}}
