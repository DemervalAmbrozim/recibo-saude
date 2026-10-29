// Aba Clínica do painel (8i, supabase/025): a secretária (ou a equipe) importa o relatório do sistema da clínica e vê quem falta emitir.
// A leitura do relatório está em clinica.js; aqui só a tela. Usa sb, $, esc, brl, avisa, falhou, PROFS, abrir, SEC e EQUIPE de app.js.
let CLIS=[],CLIP=null,CLIM=null,CLIR=null; // clínicas que ela vê, painel do mês, molde em uso, resultado da leitura
const cliId=()=>$('cli-sel').value;
function cliEntrar(lista){CLIS=lista||[];$('nav-cli').hidden=!CLIS.length;
  $('cli-sel').innerHTML=CLIS.map(c=>`<option value="${c.id}">${esc(c.nome)}${c.ativa?'':' (inativa)'}</option>`).join('');$('cli-sel').hidden=CLIS.length<2;
  // Só secretária: sem despesas, ajustes, imposto e PDFs (o banco também não entrega)
  if(SEC){['t-desp','t-aj'].forEach(t=>document.querySelector(`nav button[data-t="${t}"]`).hidden=true);document.querySelectorAll('.nao-sec').forEach(c=>c.hidden=true)}
  if(!PROFS.length)document.querySelectorAll('nav button').forEach(b=>{if(b.id!=='nav-cli'&&b.id!=='nav-adm')b.hidden=true});
  if(CLIS.length)cliAbrir()}
async function cliAbrir(){if(!cliId())return;
  const r=await sb.rpc('clinica_painel',{p_clinica:cliId(),p_mes:$('cli-mes').value});if(falhou(r,'abrir a clínica'))return;
  CLIP=r.data;CLIM=CLIP.molde&&CLIP.molde.colunas?JSON.parse(JSON.stringify(CLIP.molde)):null;cliTela();cliLer()}
$('cli-sel').onchange=cliAbrir;$('cli-mes').onchange=cliAbrir;

function cliTela(){const c=CLIP,ps=c.profissionais||[],sec=(c.secretarias||[]).find(s=>s.cpf);
  $('cli-nome').textContent=c.nome;$('cli-cnpj').hidden=c.quem_recebe!=='clinica';$('cli-imp-card').hidden=c.quem_recebe==='clinica';
  $('cli-painel').innerHTML=ps.length?ps.map(p=>`<div class="item"><div><b>${esc(p.nome||'(sem nome)')}</b>
      <div class="meta">${esc(OCUP[p.ocupacao]||'')}${p.registro?' · '+esc(p.registro):''} · ${p.atendimentos} recebimento(s), ${brl(+p.valor)}</div>
      <div class="meta">${p.procuracao_ok?'procuração conferida':'procuração a conferir no e-CAC'}${!(p.registro||'').trim()||!cpfOk(p.cpf)?' · falta CPF ou registro no cadastro dela':''}</div></div>
    <div style="text-align:right"><span class="pill ${p.falta?'pend':''}">${p.falta?`falta emitir ${p.falta} (${brl(+p.falta_valor)})`:'tudo emitido'}</span></div>
    <div style="grid-column:1/-1" class="btns"><button class="small" data-cli-fech="${p.id}" type="button">Abrir fechamento</button>
      <button class="small" data-cli-proc="${p.id}" data-ok="${p.procuracao_ok?1:0}" type="button">${p.procuracao_ok?'Desfazer procuração':'Procuração conferida'}</button></div></div>`).join('')
    :'<div class="sub">Nenhum profissional no grupo ainda. A Assessoria põe cada um depois do cadastro dele.</div>';
  $('cli-preco').textContent=`${ps.length} profissional(is) no grupo · plano Clínica ${brl(+c.preco)}/mês (até 3, depois R$ 59 por profissional).`;
  $('cli-emissao').innerHTML=c.emissao==='secretaria'
    ?`<ol class="passos"><li>Cada profissional cadastra no e-CAC uma procuração para o <b>CPF da secretária</b>${sec?` (${esc(sec.nome)}, <span class="mono">${fmtCpf(sec.cpf)}</span>)`:' (a Assessoria cadastra o CPF dela aqui)'}, só com o serviço <b>IRPF - Carnê Leão Web</b>. O app de cada um mostra o passo a passo.</li>
      <li>No fim do mês: importe o relatório acima, toque em <b>Abrir fechamento</b> em cada profissional e baixe o arquivo dele (um por profissional).</li>
      <li>No e-CAC, com o seu gov.br, troque o perfil para <b>Procurador</b> e escolha o CPF do profissional. Abra o Carnê-Leão Web → Escrituração → <b>Importar Escrituração</b>, clique em <b>Analisar Arquivo</b> e depois em Importar.</li>
      <li>Volte ao fechamento e toque em <b>Marcar estes como emitidos</b>. Cole a lista da Receita em "Confirmar recibos".</li></ol>`
    :'A Assessoria importa no Carnê-Leão de cada profissional, pela procuração para o CPF do responsável (cada um manda <b>procuração</b> no WhatsApp da Assessoria e recebe o CPF). A clínica só importa o relatório e acompanha este painel.'}

document.addEventListener('click',async e=>{const t=e.target.dataset||{};
  if(t.cliFech){$('prof-sel').value=t.cliFech;await abrir(t.cliFech);document.querySelector('nav button[data-t="t-fech"]').click()}
  if(t.cliProc){const r=await sb.rpc('clinica_procuracao',{p_clinica:cliId(),p_prof:t.cliProc,p_ok:t.ok!=='1'});if(falhou(r,'marcar a procuração'))return;cliAbrir()}
  if(t.cliCor!==undefined){const i=+t.cliCor,x=CLIR.pend[i],q=s=>document.querySelector(`[data-cli-${s}="${i}"]`);
    const novo={};if(q('p'))novo.prof=q('p').value;if(q('c'))novo.cpf=q('c').value;
    const k=cliCorrige(x,novo,CLIR.vistos);if(k.erro){avisa(k.erro,true);return}
    if(novo.prof&&x.prof_txt){CLIM.apelidos=CLIM.apelidos||{};CLIM.apelidos[cliNorm(x.prof_txt)]=novo.prof} // no próximo mês já reconhece
    CLIR.ok.push(k.ok);CLIR.pend.splice(i,1);cliPrevia()}
  if(t.cliTira!==undefined){CLIR.pend.splice(+t.cliTira,1);CLIR.ignoradas++;cliPrevia()}});

// Leitura: cola → molde (guardado ou palpite) → prévia com o que entra e o que corrigir
let cliTab=null;
$('cli-txt').oninput=()=>cliLer();
$('cli-arq').onchange=async e=>{const f=e.target.files[0];if(!f)return;let t=await f.text();
  if(t.includes('�'))t=new TextDecoder('windows-1252').decode(await f.arrayBuffer()); // CSV do Excel no Brasil costuma vir assim
  $('cli-txt').value=t;cliLer()};
function cliLer(){const txt=$('cli-txt').value;cliTab=txt.trim()?cliTabela(txt):null;CLIR=null;
  if(!cliTab||!cliTab.cab.length){$('cli-molde').hidden=true;$('cli-prev').innerHTML='';$('cli-pend').innerHTML='';$('b-cli-imp').hidden=true;return}
  if(!CLIM)CLIM={colunas:cliAdivinha(cliTab.cab),apelidos:{}};
  const op=v=>'<option value="">(não tem)</option>'+cliTab.cab.map(h=>`<option${h===v?' selected':''}>${esc(h)}</option>`).join('');
  $('cli-cols').innerHTML=CLI_CAMPOS.map(([k,n,ob])=>`<label>${n}${ob?'':' (se tiver)'} <select data-cli-col="${k}">${op(CLIM.colunas[k]||'')}</select></label>`).join('');
  $('cli-molde').hidden=false;
  CLIR=cliAplica(cliTab,CLIM,(CLIP.profissionais||[]).map(p=>({id:p.id,nome:p.nome,cpf:p.cpf})));
  $('cli-molde').open=!!CLIR.erro||!(CLIP.molde&&CLIP.molde.colunas);cliPrevia()}
document.addEventListener('change',e=>{const k=e.target.dataset&&e.target.dataset.cliCol;if(!k)return;
  if(e.target.value)CLIM.colunas[k]=e.target.value;else delete CLIM.colunas[k];cliLer()});
function cliPrevia(){const r=CLIR;if(r.erro){$('cli-prev').innerHTML=`<div class="msg err">${esc(r.erro)}</div>`;$('cli-pend').innerHTML='';$('b-cli-imp').hidden=true;return}
  const ps=CLIP.profissionais||[],nome=id=>(ps.find(p=>p.id===id)||{}).nome||'',por={};r.ok.forEach(x=>{por[x.prof]=(por[x.prof]||0)+x.valor});
  $('cli-prev').innerHTML=`<div class="sub"><b>${r.ok.length}</b> para importar (${brl(r.ok.reduce((s,x)=>s+x.valor,0))}) · <b>${r.pend.length}</b> para corrigir${r.ignoradas?` · ${r.ignoradas} ignorada(s)`:''}</div>`
    +Object.entries(por).map(([id,v])=>`<div class="item"><span>${esc(nome(id))}</span><span class="num">${brl(v)}</span></div>`).join('')
    +r.avisos.map(a=>`<div class="msg">${esc(a)}</div>`).join('');
  const sel=i=>`<select data-cli-p="${i}" style="width:auto;padding:6px 8px" aria-label="Profissional"><option value="">Profissional</option>${ps.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')}</select>`;
  $('cli-pend').innerHTML=r.pend.map((x,i)=>{const conv=/convênio|estorno/.test(x.motivo);return `<div class="item"><div><b>Linha ${x.linha}: ${esc(x.nome||'(sem nome)')}</b>
      <div class="meta">${x.data?dBR(x.data):'sem data'} · ${x.valor>0?brl(x.valor):'sem valor'}${x.prof_txt?' · '+esc(x.prof_txt):''}</div><div class="meta">${esc(x.motivo)}</div></div>
    <div style="grid-column:1/-1" class="btns">${conv?'':`${/profissional/.test(x.motivo)?sel(i):''}${/CPF/.test(x.motivo)?`<input data-cli-c="${i}" inputmode="numeric" placeholder="CPF do paciente" style="width:auto;max-width:170px;padding:6px 8px">`:''}
      ${/profissional|CPF/.test(x.motivo)&&!/data|valor|nome/.test(x.motivo)?`<button class="small" data-cli-cor="${i}" type="button">Corrigir</button>`:''}`}
      <button class="small" data-cli-tira="${i}" type="button">${conv?'Ok, não entra':'Deixar de fora'}</button></div></div>`}).join('');
  $('b-cli-imp').hidden=!r.ok.length;$('b-cli-imp').textContent=`Importar ${r.ok.length} recebimento(s)`}

$('b-cli-imp').onclick=async e=>{const r=CLIR;if(!r||!r.ok.length)return;
  if(r.pend.length&&!confirm(`${r.pend.length} linha(s) ainda para corrigir ficam de fora agora (dá para colar o relatório de novo depois, sem duplicar). Importar as ${r.ok.length} boas?`))return;
  e.target.disabled=true;let novos=0,rep=0;
  try{const ls=cliEnvio(r.ok);
    for(let i=0;i<ls.length;i+=500){const x=await sb.rpc('clinica_importar',{p_clinica:cliId(),p_linhas:ls.slice(i,i+500)});
      if(x.error){avisa(/nota fiscal/.test(x.error.message)?'Esta clínica recebe no CNPJ: fale com a Assessoria.':'Não consegui importar. Confira a internet e tente de novo (o que já entrou não duplica).',true);return}
      novos+=x.data.novos;rep+=x.data.repetidos}
    if(JSON.stringify(CLIM)!==JSON.stringify(CLIP.molde))await sb.rpc('clinica_molde',{p_clinica:cliId(),p_molde:CLIM});
    $('cli-txt').value='';$('cli-arq').value='';avisa(`${novos} recebimento(s) importado(s)${rep?`, ${rep} já estavam`:''}.`);
    if(S.prof)abrir(S.prof.id);cliAbrir()}
  finally{e.target.disabled=false}};

// ---------- Admin: clínicas (equipe) ----------
async function admCliTela(){if(!EQUIPE)return;
  const r=await sb.from('clinicas').select('id,nome,cidade,quem_recebe,emissao,sistema,ativa,clinica_membros(profissional_id),clinica_secretarias(email,nome)').order('nome');
  if(r.error){$('adm-cli').hidden=true;return} // 025 ainda não rodou
  const nome=id=>(PROFS.find(p=>p.id===id)||{}).nome||'(profissional)';
  $('adm-cli-lista').innerHTML=r.data.length?r.data.map(c=>`<div class="item"><div><b>${esc(c.nome)}</b>${c.ativa?'':' (inativa)'}<div class="meta">${esc(c.cidade||'')}${c.sistema?' · sistema '+esc(c.sistema):''} · emite: ${c.emissao==='secretaria'?'secretária':'Assessoria'}</div>
      ${c.quem_recebe==='clinica'?'<div class="meta" style="color:var(--bad,#b00)">recebe no CNPJ: caso de nota fiscal/repasse (contador)</div>':''}
      <div class="meta">${c.clinica_membros.map(m=>esc(nome(m.profissional_id))).join(', ')||'sem profissional'}</div>
      <div class="meta">${c.clinica_secretarias.map(s=>esc(s.nome||s.email)).join(', ')||'sem secretária'}</div></div>
    <div class="num">${brl(cliPreco(c.clinica_membros.length))}/mês</div></div>`).join(''):'<div class="sub">Nenhuma clínica ainda.</div>';
  $('gc-cli').innerHTML=r.data.map(c=>`<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  $('gc-prof').innerHTML=profsUnicos().filter(p=>p.papel!=='secretaria').map(p=>`<option value="${p.id}">${esc(p.nome||'(sem nome)')}</option>`).join('')}
$('nc-recebe').onchange=()=>$('nc-aviso').hidden=$('nc-recebe').value!=='clinica';
$('b-nc').onclick=async()=>{if(!$('nc-recebe').value){avisa('Responda quem recebe do paciente: é o que decide se é recibo ou nota fiscal.',true);return}
  const cn=so($('nc-cnpj').value);if(cn&&cn.length!==14){avisa('CNPJ com 14 números (ou deixe vazio).',true);return}
  const r=await sb.rpc('clinica_criar',{p_nome:$('nc-nome').value,p_cnpj:cn,p_cidade:$('nc-cidade').value,p_quem_recebe:$('nc-recebe').value,p_emissao:$('nc-emissao').value,p_sistema:$('nc-sistema').value});
  if(falhou(r,'criar a clínica'))return;['nc-nome','nc-cnpj','nc-cidade','nc-sistema'].forEach(i=>$(i).value='');avisa('Clínica criada. Agora ponha os profissionais e a secretária.');admCliTela();cliRecarrega()};
async function cliRecarrega(){const r=await sb.rpc('minhas_clinicas');if(!r.error)cliEntrar(r.data)}
const gcMembro=async por=>{const r=await sb.rpc('clinica_membro',{p_clinica:$('gc-cli').value,p_prof:$('gc-prof').value,p_por:por});
  if(falhou(r,'mudar o grupo'))return;avisa(por?'Profissional no grupo: a secretária já vê os atendimentos dela.':'Profissional fora do grupo.');admCliTela();cliRecarrega()};
$('b-gc-por').onclick=()=>gcMembro(true);$('b-gc-tirar').onclick=()=>gcMembro(false);
const gsSec=async por=>{const em=$('gs-email').value.trim(),cp=so($('gs-cpf').value);if(!mailOk(em)){avisa('E-mail da secretária inválido.',true);return}
  if(por&&cp&&!cpfOk(cp)){avisa('CPF da secretária inválido.',true);return}
  const r=await sb.rpc('clinica_secretaria',{p_clinica:$('gc-cli').value,p_email:em,p_nome:$('gs-nome').value,p_cpf:cp,p_por:por});
  if(falhou(r,'mudar a secretária'))return;avisa(r.data.replace(/^./,c=>c.toUpperCase())+'.');['gs-email','gs-nome','gs-cpf'].forEach(i=>$(i).value='');admCliTela()};
$('b-gs-por').onclick=()=>gsSec(true);$('b-gs-tirar').onclick=()=>gsSec(false);
document.querySelector('nav button[data-t="t-adm"]').addEventListener('click',admCliTela);
$('cli-mes').value=hojeISO().slice(0,7);
