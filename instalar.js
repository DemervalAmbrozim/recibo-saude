// Botão "Instalar o app" (8g, 28/10): o app é página instalável, não APK. Some quando já está instalado ou ela diz "agora não".
// Android/PC com Chrome: usa o pedido de instalação do navegador. iPhone: o Safari não tem o pedido, mostra o caminho pelo Compartilhar.
(function(){const CH='rs-instalar-nao';
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  const instalado=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  if(instalado||localStorage.getItem(CH))return;
  const ios=/iphone|ipad|ipod/i.test(navigator.userAgent),cel=ios||/android/i.test(navigator.userAgent);
  const box=document.createElement('section');box.className='card';box.id='instalar';box.hidden=true;
  box.innerHTML=`<div class="head"><h2>Instale o app no celular</h2><button type="button" class="small" id="ins-nao">Agora não</button></div>
    <div class="sub" id="ins-txt">Fica um ícone na tela inicial e abre direto, sem procurar o site. Não ocupa espaço: é o mesmo sistema, com os mesmos dados.</div>
    <button type="button" class="pri" id="ins-sim" hidden>Instalar o app</button>`;
  const cab=document.querySelector('main>header');(cab?cab.after(box):document.body.prepend(box));
  const txt=box.querySelector('#ins-txt'),sim=box.querySelector('#ins-sim');let pedido=null;
  box.querySelector('#ins-nao').onclick=()=>{localStorage.setItem(CH,'1');box.remove()};
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();pedido=e;sim.hidden=false;box.hidden=false});
  sim.onclick=async()=>{if(!pedido)return;pedido.prompt();const r=await pedido.userChoice;pedido=null;if(r.outcome==='accepted')box.remove()};
  addEventListener('appinstalled',()=>box.remove());
  // Sem o pedido do navegador (iPhone, ou Chrome que ainda não ofereceu): mostra o caminho à mão, só no celular
  setTimeout(()=>{if(pedido||!cel||!document.getElementById('instalar'))return;
    txt.innerHTML+=ios?'<br><br>No iPhone: abra no <b>Safari</b>, toque em <b>Compartilhar</b> (quadrado com seta) e depois em <b>Adicionar à Tela de Início</b>.'
      :'<br><br>No Chrome: toque nos <b>3 pontinhos</b> (⋮), no alto à direita, e depois em <b>Instalar app</b> ou <b>Adicionar à tela inicial</b>.';
    box.hidden=false},2500)})();
