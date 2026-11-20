/* Seletor PF / CNPJ no cabeçalho (19/11/2026, ordem do Demerval): "Eu sou: PF (autônomo) | CNPJ (empresa)".
   Guarda a escolha neste aparelho (localStorage, só 'pf' ou 'pj', nenhum dado pessoal), leva para o caminho certo
   e, nas telas de cadastro, avisa se a pessoa está no caminho do outro perfil. Sem JS os dois links funcionam do mesmo jeito. */
(function(){
  var K='lals_perfil',S=document.currentScript,B=S?S.src:location.href;
  function ler(){try{var v=localStorage.getItem(K);return v==='pf'||v==='pj'?v:null}catch(e){return null}}
  function gravar(v){try{localStorage.setItem(K,v)}catch(e){}}
  function url(p){return new URL(p,B).pathname}
  var p=location.pathname.replace(/\/+$/,'');
  var daPagina=null;                                   // a página já indica o perfil?
  if(/\/venda\.html$/.test(p))daPagina='pf';
  if(/\/empresa\/(index|diagnostico|virada)\.html$/.test(p)||/\/empresa$/.test(p))daPagina='pj';
  var ativo=daPagina||ler();
  if(daPagina&&(location.pathname.indexOf('/empresa/inicio')<0))gravar(daPagina);
  var css=document.createElement('style');
  css.textContent='.perfil{display:flex;gap:8px;align-items:stretch;margin:8px auto 0;max-width:980px;width:100%;box-sizing:border-box}.topo.com-perfil{flex-wrap:wrap!important}.topo>.perfil{flex:0 0 100%;margin:6px 0 4px}.perfil .pl{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:46px;padding:4px 8px;border-radius:10px;border:1.5px solid var(--accent,#0f6b55);color:var(--accent,#0f6b55);background:#fff;text-decoration:none;font:inherit;line-height:1.2}.perfil .pl b{font-size:15px}.perfil .pl small{font-size:12px;opacity:.9}.perfil .pl[aria-current="true"]{background:var(--accent,#0f6b55);color:var(--accent-fg,#fff)}.perfil-pede{flex:0 0 100%;margin:2px 0 6px;font-size:14px;font-weight:700;color:var(--accent,#0f6b55);text-align:center}.perfil-aviso{max-width:980px;margin:10px auto;padding:12px 14px;border-radius:10px;background:var(--soft,#e2efe9);color:var(--fg,#17231e);font-size:14px}.perfil-aviso a{font-weight:700}html.perfil-trava,html.perfil-trava body{overflow:hidden;height:100%}html.perfil-trava main>:not(.topo){filter:blur(7px);opacity:.3;pointer-events:none;user-select:none}html.perfil-trava .perfil .pl{border-width:2.5px;animation:plpulsa 1.6s ease-in-out infinite}@keyframes plpulsa{0%,100%{box-shadow:0 0 0 0 rgba(15,107,85,.45)}50%{box-shadow:0 0 0 7px rgba(15,107,85,0)}}@media (prefers-reduced-motion:reduce){html.perfil-trava .perfil .pl{animation:none}}';
  document.head.appendChild(css);
  function monta(){
    var topo=document.querySelector('.topo'),main0=document.querySelector('main'); if(!topo&&!main0)return;
    var nav=document.createElement('nav'); nav.className='perfil'; nav.setAttribute('aria-label','Eu sou');
    [['pf','PF · Autônomo(a)','Atendo com o meu CPF','venda.html'],['pj','CNPJ · Empresa','Tenho empresa de saúde','empresa/index.html']].forEach(function(o){
      var a=document.createElement('a'); a.className='pl'; a.href=new URL(o[3],B).href.replace(/^[^:]+:\/\/[^/]+/,'');
      var qs=location.search.replace(/^\?/,'');if(/(^|&)(o|ind)=/.test(qs))a.href+=(a.href.indexOf('?')<0?'?':'&')+qs;
      a.setAttribute('data-cta','topo-'+o[0]); a.setAttribute('data-perfil',o[0]);
      if(ativo===o[0])a.setAttribute('aria-current','true');
      a.innerHTML='<b>'+o[1]+'</b><small>'+o[2]+'</small>';
      a.addEventListener('click',function(){gravar(o[0])});
      nav.appendChild(a)});
    if(topo){topo.classList.add('com-perfil');topo.appendChild(nav)}else main0.insertBefore(nav,main0.firstChild);
    // TRAVA (ordem dele, 20/11): na capa, sem escolha ainda, o resto da página fica desfocado e inativo até marcar PF ou CNPJ
    if(!ler()&&/\/empresa\/inicio\.html$/.test(p)&&topo){
      document.documentElement.classList.add('perfil-trava');
      var d=document.createElement('div'); d.className='perfil-pede'; d.setAttribute('role','status'); d.textContent='Escolha uma opção para continuar';
      topo.appendChild(d);
      [].forEach.call(main0.children,function(c){if(c!==topo){c.setAttribute('inert','');c.setAttribute('aria-hidden','true')}});
    }
  }
  function aviso(){
    var main=document.querySelector('main')||document.body, v=ler(), d=document.createElement('div'); d.className='perfil-aviso'; d.setAttribute('role','note');
    if(/\/empresa\/entrar\.html$/.test(p)&&v==='pf'){d.innerHTML='Você escolheu <b>PF (autônomo)</b>. O cadastro de autônomo é por aqui: <a href="../entrar.html">entrar como PF</a>.';main.insertBefore(d,main.firstChild)}
    else if(/(^|\/)entrar\.html$/.test(p)&&!/\/empresa\//.test(p)&&v==='pj'){d.innerHTML='Você escolheu <b>CNPJ (empresa)</b>. O cadastro da empresa é por aqui: <a href="empresa/entrar.html">entrar como empresa</a>.';main.insertBefore(d,main.firstChild)}
  }
  function pronto(){monta();aviso()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pronto);else pronto();
})();
