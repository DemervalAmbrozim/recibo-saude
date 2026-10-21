// Página do teste guiado: roteiro, perguntas e críticas. Abre com o código do link da profissional fictícia (teste.html#<código>).
const sb = supabase.createClient(CONFIG.url, CONFIG.chave);
const TOK = location.hash.slice(1).replace(/^t=/, '');
const $=id=>document.getElementById(id);
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function avisa(t,err){const a=$('aviso');a.textContent=t;a.className='msg'+(err?' err':'');a.hidden=false;clearTimeout(avisa.t);avisa.t=setTimeout(()=>a.hidden=true,5000)}
const GRAV={grave:'grave',importante:'importante',sugestao:'sugestão'};
async function lista(){
  const r=await sb.rpc('link_criticas',{tok:TOK});
  if(r.error){$('ruim').hidden=false;$('tela').hidden=true;return false}
  $('tela').hidden=false;
  $('l-cr').innerHTML=r.data.length?r.data.map(c=>`<div class="item"><div><b>${esc(c.tela)}</b><div class="meta">${esc(c.texto)}</div></div><span class="pill ${c.gravidade==='grave'?'pend':''}">${GRAV[c.gravidade]}</span></div>`).join('')
    :'<div class="sub">Nada registrado ainda.</div>';
  return true;
}
$('f-cr').onsubmit=async e=>{e.preventDefault();
  const t=$('c-texto').value.trim();if(t.length<3){avisa('Escreva o que você viu.',true);return}
  const r=await sb.rpc('link_critica',{tok:TOK,p_tela:$('c-tela').value,p_gravidade:$('c-grav').value,p_texto:t});
  if(r.error){avisa('Não consegui registrar. Confira a internet e tente de novo.',true);return}
  $('c-texto').value='';await lista();avisa('Registrado. Obrigado!');
};
$('a-app').href='lancar.html#'+TOK;
if(TOK.length<20)$('ruim').hidden=false;else lista();
