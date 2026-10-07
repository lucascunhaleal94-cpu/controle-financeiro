import React, { useState } from 'react';
import { Wallet, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AuthScreen = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (signInError) throw signInError;
        
        onLogin({
          id: data.user.id,
          name: data.user.user_metadata?.name || email,
          email: data.user.email
        });
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name
            }
          }
        });

        if (signUpError) throw signUpError;
        
        if (data?.user) {
          onLogin({
            id: data.user.id,
            name: data.user.user_metadata?.name || email,
            email: data.user.email
          });
        }
      }
    } catch (err) {
      console.error(err);
      setError(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-main)'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            backgroundColor: 'rgba(59, 130, 246, 0.1)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '1rem'
          }}>
            <Wallet size={32} className="text-primary" />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Controle Financeiro</h2>
          <p className="text-muted text-center" style={{ fontSize: '0.9rem' }}>
            {isLogin ? 'Faça login para acessar seus dados na nuvem.' : 'Crie sua conta na nuvem para começar.'}
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nome (Cabeçalho)</label>
              <input
                type="text" required className="form-control"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: João & Maria"
              />
            </div>
          )}
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>E-mail</label>
            <input
              type="email" required className="form-control"
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Senha</label>
            <input
              type="password" required className="form-control"
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <button disabled={loading} type="submit" className="btn btn-primary w-full" style={{ padding: '0.875rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            {loading ? 'Carregando...' : (isLogin ? <><LogIn size={18} /> Entrar</> : <><UserPlus size={18} /> Criar Conta</>)}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
            {isLogin ? 'Não tem uma conta?' : 'Já possui uma conta?'}
          </p>
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: '500', fontSize: '0.95rem' }}
            disabled={loading}
          >
            {isLogin ? 'Criar uma conta' : 'Fazer login'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
