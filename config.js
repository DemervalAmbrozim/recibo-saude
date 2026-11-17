// Endereço do banco e chave PÚBLICA (anon). A chave pública pode ficar aqui: quem protege os dados são as regras RLS do banco.
// Nunca colocar aqui a service_role / secret key.
const CONFIG = { url: 'https://yfcogdqahsmaynyggqnk.supabase.co', chave: 'sb_publishable_w0frgqle8xVbblN7SWJteg_tKsaVAmq',
  // true quando o e-mail de entrada sai pelo Resend no domínio e traz o código de 6 números (ferramentas/resend-configurar.sh liga)
  codigo: true,
  // frente "Minha empresa" (17/11/2026): false até o "pode publicar" dele. Com false, os blocos e links da empresa ficam escondidos.
  empresa: false };
