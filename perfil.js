/* PF / CNPJ dentro do "Entrar" (20/11/2026, ordem do Demerval: "inclui dentro do entrar... PF-Autônomo  CNPJ-empresa").
   O botão "Já sou cliente · Entrar na minha conta" vira duas opções no próprio cabeçalho, na mesma linha do logo:
   [PF · Autônomo] [CNPJ · Empresa]. Quem quer entrar (ou começar) precisa escolher; a escolha marca o perfil neste aparelho
   (localStorage 'lals_perfil' = pf|pj, nenhum dado pessoal) e leva ao cadastro/entrada daquele perfil.
   Qualquer link para a venda (PF) ou para a página da empresa (CNPJ) também marca o perfil. Sem JS, os dois links funcionam igual. */
(function(){
  var K='lals_perfil',S=document.currentScript,B=S?S.src:location.href;
  function ler(){try{var v=localStorage.getItem(K);return v==='pf'||v==='pj'?v:null}catch(e){return null}}
  function gravar(v){try{localStorage.setItem(K,v)}catch(e){}}
  var p=location.pathname.replace(/\/+$/,'');
  var daPagina=null;
  if(/\/venda\.html$/.test(p))daPagina='pf';
  if(/\/empresa\/(index|diagnostico|virada)\.html$/.test(p)||/\/empresa$/.test(p))daPagina='pj';
  if(daPagina)gravar(daPagina);
  var ativo=daPagina||ler();
  var qs=location.search.replace(/^\?/,''),comOrigem=/(^|&)(o|ind)=/.test(qs);
  function rel(path){var u=new URL(path,B);return u.pathname+(comOrigem?'?'+qs:'')}
  var css=document.createElement('style');
  css.textContent='.entrar-perfil{display:flex;flex-direction:column;align-items:stretch;gap:2px;flex:0 0 auto}.entrar-perfil .ep-t{font-size:12px;line-height:1.1;text-align:center;color:#4a5a53;font-weight:600}.entrar-perfil .ep-b{display:flex;gap:8px}.entrar-perfil a{position:relative;display:flex;align-items:center;justify-content:center;text-align:center;min-height:32px;padding:2px 9px;border:1.5px solid #0f6b55;border-radius:8px;background:#fff;color:#0f6b55;font:inherit;font-weight:700;font-size:12.5px;line-height:1.1;text-decoration:none;white-space:nowrap}.entrar-perfil a::after{content:"";position:absolute;inset:-6px -3px}.entrar-perfil a[aria-current="true"]{background:#0f6b55;color:#fff}@media (max-width:420px){.entrar-perfil a{padding:2px 7px}}.entrar-como{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:2px 0 4px;font-size:14px;color:var(--muted,#5d6e66)}.entrar-como>span{flex:0 0 100%}.entrar-como a{position:relative;display:inline-flex;flex:1 1 0;justify-content:center;align-items:center;min-height:32px;padding:2px 12px;border:1.5px solid var(--accent,#0f6b55);border-radius:8px;color:var(--accent,#0f6b55);font-weight:700;font-size:13px;text-decoration:none}.entrar-como a::after{content:"";position:absolute;inset:-6px -3px}.entrar-como a[aria-current="true"]{background:var(--accent,#0f6b55);color:var(--accent-fg,#fff)}.perfil-aviso{max-width:980px;margin:10px auto;padding:12px 14px;border-radius:10px;background:var(--soft,#e2efe9);color:var(--fg,#17231e);font-size:14px}.perfil-aviso a{font-weight:700;display:inline-block;padding:10px 2px}';
  document.head.appendChild(css);
  function monta(){
    var antigo=document.querySelector('.topo .entrar-conta'); if(!antigo)return;
    var box=document.createElement('div'); box.className='entrar-perfil'; box.setAttribute('role','group'); box.setAttribute('aria-label','Entrar na minha conta: escolha o seu perfil');
    var t=document.createElement('span'); t.className='ep-t'; t.textContent='Já sou cliente · Entrar:'; box.appendChild(t);
    var b=document.createElement('div'); b.className='ep-b'; box.appendChild(b);
    [['pf','PF · Autônomo','entrar.html'],['pj','CNPJ · Empresa','empresa/entrar.html']].forEach(function(o){
      var a=document.createElement('a'); a.href=rel(o[2]); a.setAttribute('data-cta','topo-entrar-'+o[0]); a.setAttribute('data-perfil',o[0]);
      a.setAttribute('aria-label','Entrar como '+(o[0]==='pf'?'autônomo(a), pessoa física':'empresa, CNPJ'));
      if(ativo===o[0])a.setAttribute('aria-current','true');
      a.textContent=o[1]; a.addEventListener('click',function(){gravar(o[0])}); b.appendChild(a)});
    antigo.replaceWith(box);
  }
  // links para a venda (PF) e para a página da empresa (CNPJ) também marcam o perfil
  document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href]'); if(!a||a.hasAttribute('data-perfil'))return;
    var u; try{u=new URL(a.getAttribute('href'),location.href)}catch(x){return}
    if(u.origin!==location.origin)return;
    if(/\/venda\.html$/.test(u.pathname))gravar('pf'); else if(/\/empresa\/(index\.html)?$/.test(u.pathname))gravar('pj')},true);
  function aviso(){
    var main=document.querySelector('main')||document.body, v=ler(), d=document.createElement('div'); d.className='perfil-aviso'; d.setAttribute('role','note');
    if(/\/empresa\/entrar\.html$/.test(p)&&v==='pf'){d.innerHTML='Você escolheu <b>PF (autônomo)</b>. O cadastro de autônomo é por aqui: <a href="../entrar.html">entrar como PF</a>.';main.insertBefore(d,main.firstChild)}
    else if(/(^|\/)entrar\.html$/.test(p)&&!/\/empresa\//.test(p)&&v==='pj'){d.innerHTML='Você escolheu <b>CNPJ (empresa)</b>. O cadastro da empresa é por aqui: <a href="empresa/entrar.html">entrar como empresa</a>.';main.insertBefore(d,main.firstChild)}
  }
  function comoEntrar(){
    var ePF=/(^|\/)entrar\.html$/.test(p)&&!/\/empresa\//.test(p),ePJ=/\/empresa\/entrar\.html$/.test(p); if(!ePF&&!ePJ)return;
    var head=document.querySelector('header.head'); if(!head)return;
    var d=document.createElement('div'); d.className='entrar-como'; d.setAttribute('role','group'); d.setAttribute('aria-label','Entrando como');
    d.innerHTML='<span>Você está entrando como:</span>';
    [['pf','PF · Autônomo','entrar.html',ePF],['pj','CNPJ · Empresa','empresa/entrar.html',ePJ]].forEach(function(o){
      var a=document.createElement('a'); a.href=rel(o[2]); a.textContent=o[1]; a.setAttribute('data-perfil',o[0]); a.setAttribute('data-cta','entrando-'+o[0]);
      if(o[3])a.setAttribute('aria-current','true'); a.addEventListener('click',function(){gravar(o[0])}); d.appendChild(a)});
    head.insertAdjacentElement('afterend',d);
  }
  function pronto(){monta();comoEntrar();aviso()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',pronto);else pronto();
})();
