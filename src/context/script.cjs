const fs = require('fs');
let c = fs.readFileSync('C:/Users/Lucas/Desktop/SISTEMAS/PROJETO LOVABLE/Controle-Financeiro-Pessoal/src/context/TransactionsContext.jsx', 'utf8');

c = c.replace(
  'export const TransactionsProvider = ({ children }) => {',
  'export const TransactionsProvider = ({ children, currentUser }) => {\n  const getStorageKey = (key) => `@ControleFinanceiro_${currentUser.id}:${key}`;'
);

c = c.replace(/['`]@ControleFinanceiro:([^'"`]+)['`]/g, 'getStorageKey(\'$1\')');

fs.writeFileSync('C:/Users/Lucas/Desktop/SISTEMAS/PROJETO LOVABLE/Controle-Financeiro-Pessoal/src/context/TransactionsContext.jsx', c);
