import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { TransactionsProvider } from './context/TransactionsContext.jsx'
import AuthScreen from './components/AuthScreen.jsx'
import SupabaseSync from './components/SupabaseSync.jsx'
import { supabase } from './lib/supabase.js'

const RootComponent = () => {
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(() => {
    return window.location.hash.includes('type=recovery');
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('@ControleFinanceiro:activeUser');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const isRecoveryHash = window.location.hash.includes('type=recovery');
    if (isRecoveryHash) {
      setIsPasswordRecovery(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && !currentUser && !isRecoveryHash && !isPasswordRecovery) {
        const user = {
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email,
          email: session.user.email
        };
        handleLogin(user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        return;
      }
      if (!session?.user) {
         setCurrentUser(null);
         localStorage.removeItem('@ControleFinanceiro:activeUser');
      }
    });

    return () => subscription.unsubscribe();
  }, [currentUser, isPasswordRecovery]);

  const handleLogin = (user) => {
    localStorage.setItem('@ControleFinanceiro:activeUser', JSON.stringify(user));
    setCurrentUser(user);
  };

  if (isPasswordRecovery || !currentUser) {
    return (
      <AuthScreen
        onLogin={handleLogin}
        initialMode={isPasswordRecovery ? 'update_password' : 'login'}
        onRecoveryComplete={() => {
          setIsPasswordRecovery(false);
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname);
          }
        }}
      />
    );
  }

  return (
    <TransactionsProvider key={currentUser.id} currentUser={currentUser}>
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
