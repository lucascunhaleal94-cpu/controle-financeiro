import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { TransactionsProvider } from './context/TransactionsContext.jsx'
import AuthScreen from './components/AuthScreen.jsx'

const RootComponent = () => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('@ControleFinanceiro:activeUser');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    // Migração de dados antigos para conta padrão
    const legacyTransactions = localStorage.getItem('@ControleFinanceiro:transactions');
    const users = JSON.parse(localStorage.getItem('@ControleFinanceiro:users') || '[]');
    if (legacyTransactions && users.length === 0) {
      const legacyId = 'legacy_lucas';
      const newUsers = [{ id: legacyId, name: 'Lucas & Gabriela', email: 'lucas@admin.com', password: '123' }];
      localStorage.setItem('@ControleFinanceiro:users', JSON.stringify(newUsers));
      
      const keys = ['transactions', 'settings', 'paidItems', 'categories', 'paymentMethods', 'importedOct2026', 'importedOct2026_part2', 'importedOct2026_part3', 'importedOct2026_part4', 'importedOct2026_part5', 'adjustedInitialBalance_Oct', 'importedOct2026_part6', 'importedOct2026_part7'];
      
      keys.forEach(k => {
        const val = localStorage.getItem(`@ControleFinanceiro:${k}`);
        if (val) {
          localStorage.setItem(`@ControleFinanceiro_${legacyId}:${k}`, val);
          localStorage.removeItem(`@ControleFinanceiro:${k}`);
        }
      });
    }
  }, []);

  const handleLogin = (user) => {
    localStorage.setItem('@ControleFinanceiro:activeUser', JSON.stringify(user));
    setCurrentUser(user);
  };

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <TransactionsProvider currentUser={currentUser}>
      <App />
    </TransactionsProvider>
  );
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
)
