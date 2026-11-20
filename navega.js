/* Navegação (20/11/2026, ordem do Demerval: "tocar na logomarca do cabeçalho direciona para a capa principal... não tem como voltar nas telas anteriores").
   1) A logomarca do cabeçalho de toda tela pública leva à capa (empresa/inicio.html).
   2) Quando a pessoa chegou de outra tela do site, aparece "‹ Voltar" (volta de verdade à tela anterior; sem histórico, vai à capa). Acesso direto não mostra.
   Não vale para o app logado (lancar, painel): lá a logomarca não deve tirar a pessoa do trabalho. */
(function(){
  var S=document.currentScript,B=S?S.src:location.href;
  var qs=location.search.replace(/^\?/,''),orig=/(^|&)(o|ind)=/.test(qs)?'?'+qs:'';
  var capa=new URL('empresa/inicio.html',B).pathname+orig;
  var css=document.createElement('style');
  css.textContent='.logo-voltar{display:inline-block;line-height:0;border-radius:8px}.voltar{display:inline-flex;align-items:center;gap:4px;position:relative;min-height:28px;padding:0 4px;font:inherit;font-size:14px;font-weight:600;color:var(--accent,#0f6b55);text-decoration:none}.voltar::after{content:"";position:absolute;inset:-8px -6px}.topo>.voltar{flex:0 0 100%}main>.voltar{margin:0 0 -8px;justify-self:start}';
  document.head.appendChild(css);
  function pronto(){
    var img=[].filter.call(document.querySelectorAll('img.logo-marca'),function(i){return !i.closest('footer')})[0];
    if(img){var pic=img.closest('picture')||img;
      if(!pic.closest('a')){var a=document.createElement('a');a.href=capa;a.className='logo-voltar';a.setAttribute('aria-label','Voltar à página inicial');pic.parentNode.insertBefore(a,pic);a.appendChild(pic)}}
    var veioDoSite=false;try{veioDoSite=!!document.referrer&&new URL(document.referrer).origin===location.origin&&new URL(document.referrer).pathname!==location.pathname}catch(e){}
    if(!veioDoSite)return;
    var v=document.createElement('a');v.className='voltar';v.href=capa;v.textContent='‹ Voltar';v.setAttribute('aria-label','Voltar para a tela anterior');
    v.addEventListener('click',function(e){if(history.length>1){e.preventDefault();history.back()}});
    var topo=document.querySelector('.topo'),main=document.querySelector('main');
    if(topo){topo.classList.add('com-voltar');topo.style.flexWrap='wrap';topo.appendChild(v)}else if(main)main.insertBefore(v,main.firstChild);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pronto);else pronto();
})();
