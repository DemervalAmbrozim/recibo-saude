// App instalável: guarda a casca do app para abrir rápido; os dados vêm sempre do banco (rede primeiro).
// 8h (sem internet): a biblioteca do banco vem de fora (jsdelivr) e também fica guardada, senão o app não abre sem rede
const LIB='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.js';
const C='rs-v23', CASCA=[LIB,'lancar.html','lancar.js','instalar.js','importar.js','entrar.html','entrar.js','regras.js','config.js','icone-192.png','profissional.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CASCA)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
  if(e.request.method!=='GET'||(u.origin!==location.origin&&e.request.url!==LIB))return;
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(C).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request,{ignoreSearch:true})))});
