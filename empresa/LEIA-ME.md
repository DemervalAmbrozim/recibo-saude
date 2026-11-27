# app/empresa: frente "Minha empresa" (CNPJ de pequeno porte)

Separada de propósito da frente Autônoma (`app/`, no ar). Aqui moram os módulos da empresa: `contab.js` (simulação, Anexo/Fator R, abertura, calendário, alertas), `folha.js` (folha própria F1 e F2), `contabil.js` (escrituração), `concilia.js` (conciliação bancária), `relatorio.js` (relatório mensal) e o protótipo `contabilidade.html`.
- **Nenhum arquivo daqui é carregado pelo app da autônoma.** O único compartilhamento é a leitura de `../regras.js` (Carnê-Leão e tabelas).
- Não publicado. Testes: `node testes/{contab,folha,contabil,concilia,relatorio}.test.js` e `testes/rodar-navegador.sh navegador-contabilidade`.
- Arquitetura e regras de convivência: `projeto/arquitetura-duas-frentes-2026-11-17.md`.
