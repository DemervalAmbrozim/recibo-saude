// Entrada da profissional (projeto completo, parte 03): e-mail com link de acesso → cadastro com 30 dias de teste → oi no WhatsApp.
// O cadastro passa pela função cadastrar_profissional (supabase/010): CPF válido e único, conselho conferido depois pela equipe.
const sb = supabase.createClient(CONFIG.url, CONFIG.chave);
const ZAP = '5527999712727'; // WhatsApp da Assessoria (o mesmo de lancar.js)
const TERMOS = 'resumo-2026-10-27'; // versão aceita, gravada na conta
const $=id=>document.getElementById(id);
const so=s=>String(s||'').replace(/\D/g,'');
const telLimpo=t=>so(t).replace(/^55(?=\d{10,11}$)/,'');
function cpfOk(c){c=so(c);if(c.length!==11||/^(\d)\1+$/.test(c))return false;
  for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=+c[i]*(t+1-i);if(((s*10)%11)%10!==+c[t])return false}return true}
function avisa(t,err){const a=$('aviso');a.textContent=t;a.className='msg'+(err?' err':'');a.hidden=false;clearTimeout(avisa.t);avisa.t=setTimeout(()=>a.hidden=true,7000)}
const mostra=id=>['e-email','e-cad','e-ok','e-equipe'].forEach(x=>$(x).hidden=x!==id);

// Erros do banco em português claro
const ERROS={'cpf invalido':'CPF inválido. Confira os números.','cpf ja cadastrado':'Esse CPF já tem conta. Entre com o e-mail usado no cadastro ou fale com a Assessoria pelo WhatsApp.',
  'conta ja cadastrada':'Esta conta já tem cadastro.','nome invalido':'Escreva o nome completo.','registro invalido':'Escreva o registro no conselho.',
  'whatsapp invalido':'WhatsApp inválido. Use o DDD e o número, ex.: 27 99999-9999.','precisa aceitar os termos':'Marque que leu e aceita como funciona.'};
const traduz=m=>Object.entries(ERROS).find(([k])=>String(m).includes(k))?.[1]||'Não consegui criar a conta. Confira a internet e tente de novo.';

async function inicio(){
  const {data}=await sb.auth.getSession();
  if(!data.session){mostra('e-email');return}
  $('b-sair').hidden=false;
  const r=await sb.rpc('minha_conta',{tok:''});
  if(r.error||!r.data){avisa('Não consegui abrir sua conta. Confira a internet e tente de novo.',true);return}
  if(r.data.cadastrada){location.replace('lancar.html');return}
  const eq=await sb.rpc('e_equipe');
  if(eq.data){mostra('e-equipe');return}
  $('c-email').textContent=r.data.email||'';mostra('e-cad');
}

$('e-email').onsubmit=async e=>{e.preventDefault();
  const r=await sb.auth.signInWithOtp({email:$('email').value.trim(),options:{emailRedirectTo:new URL('entrar.html',location.href).href}});
  const ok=$('email-ok');ok.hidden=false;ok.className='msg'+(r.error?' err':'');
  // Sem servidor de e-mail próprio o Supabase manda poucos e-mails por hora: o erro de limite vira orientação
  ok.textContent=!r.error?'Link enviado. Abra seu e-mail neste celular e toque no link (veja também o spam).'
    :/rate|limit|seconds/i.test(r.error.message)?'Muitos pedidos agora. Espere alguns minutos e tente de novo, ou fale com a Assessoria pelo WhatsApp.'
    :'Não consegui enviar o link. Confira o e-mail e tente de novo.';
};

$('e-cad').onsubmit=async e=>{e.preventDefault();
  const nome=$('c-nome').value.trim().replace(/\s+/g,' '), cpf=so($('c-cpf').value), tel=telLimpo($('c-tel').value);
  if(nome.split(' ').length<2){avisa('Escreva o nome completo, como no CPF.',true);return}
  if(!cpfOk(cpf)){avisa(ERROS['cpf invalido'],true);return}
  if(!/^\d{10,11}$/.test(tel)){avisa(ERROS['whatsapp invalido'],true);return}
  if(!$('c-aceite').checked){avisa(ERROS['precisa aceitar os termos'],true);return}
  const r=await sb.rpc('cadastrar_profissional',{p_nome:nome,p_cpf:cpf,p_ocupacao:$('c-ocup').value,p_registro:$('c-reg').value,
    p_telefone:tel,p_cidade:$('c-cid').value,p_aceite:TERMOS});
  if(r.error){avisa(traduz(r.error.message),true);return}
  const c=await sb.rpc('minha_conta',{tok:''});
  $('ok-ate').textContent=c.data&&c.data.teste_ate?c.data.teste_ate.split('-').reverse().join('/'):'daqui a 30 dias';
  mostra('e-ok');
};

$('b-oi').onclick=()=>{const ocup=$('c-ocup').selectedOptions[0].textContent, cid=$('c-cid').value.trim();
  location.href=`https://wa.me/${ZAP}?text=${encodeURIComponent(`Olá! Acabei de criar minha conta na Lado a Lado Saúde. Sou ${$('c-nome').value.trim()}, ${ocup.toLowerCase()}${cid?', de '+cid:''}.`)}`};
$('b-sair').onclick=async()=>{await sb.auth.signOut();location.reload()};

// Volta do link do e-mail: o Supabase avisa SIGNED_IN (fora do callback, para não travar o cliente)
sb.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_IN')setTimeout(inicio)});
inicio();
