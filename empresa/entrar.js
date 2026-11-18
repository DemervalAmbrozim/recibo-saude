// Cadastro da frente "Minha empresa" (rascunho, 17/11/2026): e-mail → dados da profissional (se ainda não tem conta) → dados da empresa → pj_cadastrar_empresa (supabase/048).
// Mesma conta da frente Autônoma (um login só). Não publicado: o SQL 048 só existe no PC até o "pode publicar".
const sb = supabase.createClient(CONFIG.url, CONFIG.chave);
const ZAP = '5527999712727';
const TERMOS = 'empresa-rascunho-2026-11-17'; // versão do texto aceito, gravada no consentimento
const $=id=>document.getElementById(id);
const so=s=>String(s||'').replace(/\D/g,'');
const telLimpo=t=>so(t).replace(/^55(?=\d{10,11}$)/,'');
const mCpf=v=>{v=so(v).slice(0,11);return v.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2')};
const mCnpj=v=>{v=so(v).slice(0,14);return v.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2')};
const mTel=v=>{v=so(v).slice(0,11);return v.length>6?v.replace(/^(\d{2})(\d{4,5})(\d{4})$/,'($1) $2-$3').replace(/^(\d{2})(\d+)$/,'($1) $2'):v.replace(/^(\d{2})(\d+)$/,'($1) $2')};
function cpfOk(c){c=so(c);if(c.length!==11||/^(\d)\1+$/.test(c))return false;for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=+c[i]*(t+1-i);if(((s*10)%11)%10!==+c[t])return false}return true}
function cnpjOk(c){c=so(c);if(c.length!==14||/^(\d)\1+$/.test(c))return false;
  const dv=n=>{const p=n===12?[5,4,3,2,9,8,7,6,5,4,3,2]:[6,5,4,3,2,9,8,7,6,5,4,3,2];let s=0;for(let i=0;i<n;i++)s+=+c[i]*p[i];const r=s%11;return r<2?0:11-r};
  return dv(12)===+c[12]&&dv(13)===+c[13]}
document.addEventListener('DOMContentLoaded',()=>{
  const m=(id,fn,ok)=>{const e=$(id);if(!e)return;e.addEventListener('input',()=>{e.value=fn(e.value);if(ok){const n=so(e.value).length;e.classList.toggle('bad',n===(id==='p-cpf'?11:14)&&!ok(e.value))}})};
  m('p-cpf',mCpf,cpfOk);m('x-cnpj',mCnpj,cnpjOk);m('p-tel',mTel,null)});
function avisa(t,err){const a=$('aviso');a.textContent=t;a.className='msg'+(err?' err':'');a.hidden=false;clearTimeout(avisa.t);avisa.t=setTimeout(()=>a.hidden=true,7000)}
const mostra=id=>['e-email','e-prof','e-emp','e-ok','e-equipe'].forEach(x=>$(x).hidden=x!==id);
const ERROS={'cpf invalido':'CPF inválido. Confira os números.','cpf ja cadastrado':'Esse CPF já tem conta. Entre com o e-mail usado no cadastro ou fale com a equipe pelo WhatsApp.',
  'nome invalido':'Escreva o nome completo.','whatsapp invalido':'WhatsApp inválido. Use o DDD e o número.','cnpj invalido':'CNPJ inválido. Confira os números.','cnpj ja cadastrado':'Esse CNPJ já está cadastrado. Fale com a equipe pelo WhatsApp.',
  'razao social invalida':'Escreva a razão social, como no cartão do CNPJ.','precisa aceitar os termos':'Marque que leu e aceita como funciona.','fora do escopo':'Por enquanto atendemos empresas no Simples Nacional com até 3 funcionários. Fale com a equipe para avisarmos quando abrir.',
  'cadastre-se como profissional primeiro':'Falta preencher seus dados antes. Volte um passo.'};
const traduz=m=>{const s=String(m||'');if(/Could not find the function|PGRST202|does not exist|schema cache/i.test(s))return 'O cadastro da empresa ainda não está aberto. Fale com a equipe pelo WhatsApp que a gente cadastra com você.';
  return Object.entries(ERROS).find(([k])=>s.includes(k))?.[1]||'Não consegui cadastrar. Confira a internet e tente de novo.'};

async function inicio(){
  const {data}=await sb.auth.getSession();
  if(!data.session){mostra('e-email');return}
  $('b-sair').hidden=false;
  const r=await sb.rpc('minha_conta',{tok:''});
  if(r.error||!r.data){avisa('Não consegui abrir sua conta. Confira a internet e tente de novo.',true);return}
  const eq=await sb.rpc('e_equipe');if(eq.data){mostra('e-equipe');return}
  if(r.data.cadastrada){
    // quem já tem empresa vai para a área dela; "?nova=1" mantém o cadastro de outra empresa
    if(!new URLSearchParams(location.search).get('nova')){try{const m=await sb.rpc('pj_minhas_empresas');if(Array.isArray(m.data)&&m.data.length){location.replace('cliente.html');return}}catch(e){}}
    mostra('e-emp');return}
  $('p-email').textContent=r.data.email||'';mostra('e-prof');
}
const ORIGEM=(()=>{const q=(new URLSearchParams(location.search).get('o')||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,20);try{if(q)localStorage.setItem('rs-o',q);return q||localStorage.getItem('rs-o')||''}catch(e){return q}})();

$('e-email').onsubmit=async e=>{e.preventDefault();
  const r=await sb.auth.signInWithOtp({email:$('email').value.trim(),options:{emailRedirectTo:new URL('entrar.html',location.href).href,data:{origem:ORIGEM}}});
  const ok=$('email-ok');ok.hidden=false;ok.className='msg'+(r.error?' err':'');
  if(!r.error&&CONFIG.codigo){$('cod-box').hidden=false;$('cod').focus()}
  ok.textContent=!r.error?(CONFIG.codigo?'E-mail enviado. Digite o código de 6 números ou toque no link do e-mail.':'Link enviado. Abra seu e-mail neste celular e toque no link.')
    :/rate|limit|seconds/i.test(r.error.message)?'Muitos pedidos agora. Espere alguns minutos e tente de novo, ou fale com a equipe pelo WhatsApp.':'Não consegui enviar o link. Confira o e-mail e tente de novo.'};
$('b-cod').onclick=async()=>{const t=so($('cod').value);if(t.length<6){avisa('Digite os 6 números do e-mail.',true);return}
  const r=await sb.auth.verifyOtp({email:$('email').value.trim(),token:t,type:'email'});
  if(r.error){avisa('Código vencido ou errado. Peça um e-mail novo.',true);return}$('cod-box').hidden=true;$('email-ok').hidden=true;inicio()};

// Passo 2: dados da titular da empresa (pj_cadastrar_titular: NÃO cria o teste da frente Autônoma; contas separadas por trás)
$('e-prof').onsubmit=async e=>{e.preventDefault();
  const nome=$('p-nome').value.trim().replace(/\s+/g,' '),cpf=so($('p-cpf').value),tel=telLimpo($('p-tel').value);
  if(nome.split(' ').length<2){avisa('Escreva o nome completo, como no CPF.',true);return}
  if(!cpfOk(cpf)){avisa(ERROS['cpf invalido'],true);return}
  if(!/^\d{10,11}$/.test(tel)){avisa(ERROS['whatsapp invalido'],true);return}
  const r=await sb.rpc('pj_cadastrar_titular',{p_nome:nome,p_cpf:cpf,p_ocupacao:$('p-ocup').value,p_registro:$('p-reg').value,p_telefone:tel,p_cidade:$('p-cid').value,p_aceite:TERMOS,p_origem:ORIGEM});
  if(r.error){avisa(traduz(r.error.message),true);return}mostra('e-emp')};

// Passo 3: empresa
const entrada=()=>(document.querySelector('input[name="x-entrada"]:checked')||{}).value||'ja_tenho_cnpj';
function atualizaEmpresa(){const ponte=entrada()==='ponte';$('x-cnpj-box').hidden=ponte;
  const emp=+$('x-emp').value,reg=$('x-reg').value,mun=$('x-mun').value,av=$('x-aviso');let t='';
  if(emp>3)t='Mais de 3 funcionários fica fora por enquanto. Fale com a equipe para avisarmos quando abrir.';
  else if(reg==='presumido')t='Lucro presumido ou real fica fora por enquanto. Fale com a equipe.';
  else if(mun==='outro')t='Atendemos por enquanto a Grande Vitória. Entre na lista de espera falando com a equipe pelo WhatsApp.';
  else if(reg==='mei')t='Atenção: nenhuma profissão de saúde regulamentada cabe no MEI. O contador vai conversar com você sobre o enquadramento.';
  av.textContent=t;av.hidden=!t;$('e-emp').dataset.bloqueia=(emp>3||reg==='presumido'||mun==='outro')?'1':'';}
['x-emp','x-reg','x-mun'].forEach(i=>$(i).addEventListener('change',atualizaEmpresa));
document.querySelectorAll('input[name="x-entrada"]').forEach(i=>i.addEventListener('change',atualizaEmpresa));
$('e-emp').onsubmit=async e=>{e.preventDefault();atualizaEmpresa();
  if($('e-emp').dataset.bloqueia){avisa($('x-aviso').textContent,true);return}
  const ponte=entrada()==='ponte',cnpj=so($('x-cnpj').value);
  if(!ponte){if(!cnpjOk(cnpj)){avisa(ERROS['cnpj invalido'],true);return}if($('x-razao').value.trim().length<3){avisa(ERROS['razao social invalida'],true);return}}
    if(!$('x-aceite').checked){avisa(ERROS['precisa aceitar os termos'],true);return}
  const r=await sb.rpc('pj_cadastrar_empresa',{p_cnpj:ponte?'':cnpj,p_razao:ponte?'':$('x-razao').value.trim(),p_cnae:ponte?'':$('x-cnae').value.trim(),p_abertura:ponte?null:($('x-abre').value||null),p_regime:$('x-reg').value,
    p_municipio:$('x-mun').value,p_empregados:+$('x-emp').value,p_ciclo:$('x-ciclo').value,p_entrada:entrada(),p_contador_anterior:$('x-ant').checked,p_origem:ORIGEM,p_aceite:TERMOS});
  if(r.error){avisa(traduz(r.error.message),true);return}
  $('ok-titulo').textContent=ponte?'Pedido de abertura recebido.':'Empresa cadastrada.';
  $('ok-texto').textContent=ponte?'A equipe fala com você no WhatsApp para a conversa de 20 minutos e para assinar o contrato. Nada é enviado à Receita antes do contrato. O primeiro passo é a viabilidade do nome, do endereço e da atividade.'
    :'A equipe fala com você no WhatsApp para olhar a situação fiscal da empresa, assinar o contrato e pedir os acessos. Nada é enviado à Receita antes do contrato.';
  mostra('e-ok')};
$('b-oi').onclick=()=>{location.href=`https://wa.me/${ZAP}?text=${encodeURIComponent('Olá! Acabei de cadastrar minha empresa na Lado a Lado Saúde.')}`};
$('b-sair').onclick=async()=>{await sb.auth.signOut();location.reload()};
sb.auth.onAuthStateChange((ev,ses)=>{if(ev==='SIGNED_IN'){if(ses&&ses.access_token&&typeof registraAcesso==='function')registraAcesso('login',null,ses.access_token);setTimeout(inicio)}});
inicio();
