// Endereço do banco e chave PÚBLICA (anon). A chave pública pode ficar aqui: quem protege os dados são as regras RLS do banco.
// Nunca colocar aqui a service_role / secret key.
const CONFIG = { url: 'https://yfcogdqahsmaynyggqnk.supabase.co', chave: 'sb_publishable_w0frgqle8xVbblN7SWJteg_tKsaVAmq',
  // true quando o e-mail de entrada sai pelo Resend no domínio e traz o código de 6 números (ferramentas/resend-configurar.sh liga)
  codigo: true,
  // frente "Minha empresa" (17/11/2026): ligada em 18/11/2026 com o "pode publicar" dele. Com false, os blocos e links da empresa ficam escondidos.
  empresa: true };

// Firefox + supabase-js 2.49: a 2ª tentativa de pegar o trava de login (Navigator LockManager) falha na hora e vira erro solto, sem efeito no login. Silenciado só esse caso (18/11/2026).
addEventListener('unhandledrejection',function(e){var m=e&&e.reason&&e.reason.message;if(m&&/LockManager lock/.test(m))e.preventDefault()});
