// Tela da profissional, aberta pelo link do WhatsApp (lancar.html#<código>). Sem login: tudo passa pelas funções link_* do banco.
const sb = supabase.createClient(CONFIG.url, CONFIG.chave);
const ZAP = '5527999712727'; // WhatsApp da Assessoria até o produto ir ao mercado (decisão de 17/10/2026)
const TOK = location.hash.slice(1).replace(/^t=/, '');
const $=id=>document.getElementById(id);
const so=s=>String(s||'').replace(/\D/g,'');
const brl=n=>(+n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dBR=iso=>iso.split('-').reverse().join('/');
const hojeISO=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function cpfOk(c){c=so(c);if(c.length!==11||/^(\d)\1+$/.test(c))return false;
  for(let t=9;t<11;t++){let s=0;for(let i=0;i<t;i++)s+=+c[i]*(t+1-i);if(((s*10)%11)%10!==+c[t])return false}return true}
function avisa(t,err){const a=$('aviso');a.textContent=t;a.className='msg'+(err?' err':'');a.hidden=false;clearTimeout(avisa.t);avisa.t=setTimeout(()=>a.hidden=true,5000)}

let D=null;
async function carrega(){
  const r=await sb.rpc('link_dados',{tok:TOK});
  if(r.error){$('ruim').hidden=false;$('tela').hidden=true;return}
  D=r.data;$('tela').hidden=false;
  $('nome').textContent=D.nome||'Recibo Saúde Fácil';
  const sel=$('pac').value;
  $('pac').innerHTML='<option value="">Escolha o paciente</option>'+D.pacientes.map(p=>`<option value="${p.id}">${esc(p.nome)}</option>`).join('')+'<option value="novo">+ Paciente novo</option>';
  if(sel&&[...$('pac').options].some(o=>o.value===sel))$('pac').value=sel;
  $('novo').hidden=$('pac').value!=='novo';
  const pend=D.atendimentos.filter(a=>!a.emitido), feitos=D.atendimentos.filter(a=>a.emitido);
  $('pend').innerHTML=pend.length?pend.map(a=>`<div class="item"><div><b>${esc(a.paciente)}</b><div class="meta">${dBR(a.data)} · ${esc(a.forma)}</div></div>
    <div style="text-align:right"><div class="num">${brl(a.valor)}</div><button class="small" data-del="${a.id}" type="button">Excluir</button></div></div>`).join('')
    +`<div class="item"><b>Total</b><b class="num">${brl(pend.reduce((s,a)=>s+ +a.valor,0))}</b></div>`
    :'<div class="sub">Nada aguardando. Lance o atendimento acima.</div>';
  $('b-zap').hidden=!pend.length;
  $('feitos').innerHTML=feitos.length?feitos.slice(0,30).map(a=>`<div class="item"><div><b>${esc(a.paciente)}</b><div class="meta">${dBR(a.data)}</div></div><span class="pill">recibo emitido</span></div>`).join('')
    :'<div class="sub">Ainda não há recibos emitidos por aqui.</div>';
}
$('pac').onchange=()=>{$('novo').hidden=$('pac').value!=='novo'};
$('f-at').onsubmit=async e=>{e.preventDefault();
  const v=num($('valor').value);
  if(!(v>0)){avisa('Valor inválido. Use, por exemplo, 150,00.',true);return}
  let pac=$('pac').value;
  if(!pac){avisa('Escolha o paciente.',true);return}
  if(pac==='novo'){
    const nome=$('n-nome').value.trim(), cpf=so($('n-cpf').value), pag=so($('n-pag').value);
    if(!nome){avisa('Escreva o nome do paciente.',true);return}
    if(!cpfOk(cpf)){avisa('CPF do paciente inválido. Confira os números.',true);return}
    if(pag&&!cpfOk(pag)){avisa('CPF de quem paga inválido.',true);return}
    const r=await sb.rpc('link_paciente',{tok:TOK,p_nome:nome,p_cpf:cpf,p_cpf_pagador:pag});
    if(r.error){avisa('Não consegui salvar o paciente. Tente de novo.',true);return}
    pac=r.data;$('n-nome').value='';$('n-cpf').value='';$('n-pag').value='';
  }
  const r=await sb.rpc('link_atendimento',{tok:TOK,p_paciente:pac,p_data:$('data').value,p_valor:v,p_forma:$('forma').value});
  if(r.error){avisa('Não consegui salvar. Confira a data e tente de novo.',true);return}
  $('valor').value='';await carrega();$('pac').value=pac;$('novo').hidden=true;avisa('Atendimento salvo.');
};
function num(v){return parseFloat(String(v).replace(/\./g,'').replace(',','.'))}
document.addEventListener('click',async e=>{const id=e.target.dataset&&e.target.dataset.del;if(!id)return;
  const r=await sb.rpc('link_excluir',{tok:TOK,p_atendimento:id});
  if(r.error){avisa('Não consegui excluir.',true);return}
  carrega();});
$('b-zap').onclick=()=>{
  const pend=D.atendimentos.filter(a=>!a.emitido);
  const txt=`Recibo Saúde - ${D.nome}\nAtendimentos para emitir recibo:\n`+pend.slice().reverse().map(a=>`• ${a.paciente}: ${dBR(a.data)} - ${brl(a.valor)}`).join('\n')
    +`\nTotal: ${brl(pend.reduce((s,a)=>s+ +a.valor,0))}`;
  location.href=`https://wa.me/${ZAP}?text=${encodeURIComponent(txt)}`;
};
$('data').value=hojeISO();
if(TOK.length<20){$('ruim').hidden=false}else carrega();
