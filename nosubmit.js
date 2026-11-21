/* Impede o envio nativo do formulário de cadastro (o app cadastra por JS). Existe para tirar o atributo onsubmit="return false" das páginas e poder remover 'unsafe-inline' do CSP (21/11/2026). */
document.addEventListener('submit',function(e){if(e.target&&e.target.id==='f-conta')e.preventDefault()});
