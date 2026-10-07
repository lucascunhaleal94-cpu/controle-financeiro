import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { TransactionsProvider } from './context/TransactionsContext.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import SupabaseSync from './components/SupabaseSync.jsx'
import { supabase } from './lib/supabase.js'

const RootComponent = () => {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('@ControleFinanceiro:activeUser');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !currentUser) {
        const user = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email,
          email: session.user.email
        };
        handleLogin(user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
         setCurrentUser(null);
         localStorage.removeItem('@ControleFinanceiro:activeUser');
      }
    });

    return () => subscription.unsubscribe();
  }, [currentUser]);

  const handleLogin = (user) => {
    localStorage.setItem('@ControleFinanceiro:activeUser', JSON.stringify(user));
    setCurrentUser(user);
  };

  if (!currentUser) {
    return <AuthScreen onLogin={handleLogin} />;
  }

  return (
    <TransactionsProvider currentUser={currentUser}>
      <SupabaseSync currentUser={currentUser}>
        <App />
      </SupabaseSync>
    </TransactionsProvider>
  );
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>,
)
