import React, { useState, useEffect } from 'react';
import { Wallet, LogIn, UserPlus, KeyRound, Mail, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

const AuthScreen = ({ onLogin, initialMode = 'login', onRecoveryComplete }) => {
  // Modes: 'login' | 'register' | 'forgot' | 'change' | 'update_password'
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialMode === 'update_password') {
      setMode('update_password');
    }
  }, [initialMode]);

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
    setPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (mode === 'login') {
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
      } else if (mode === 'register') {
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
      } else if (mode === 'forgot') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });

        if (resetError) throw resetError;

        setSuccessMsg('Enviamos um link de restauração de senha para o seu e-mail! Verifique sua caixa de entrada e a pasta de spam.');
      } else if (mode === 'change') {
        if (newPassword.length < 6) {
          throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('A confirmação da nova senha não confere.');
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (signInError) {
          throw new Error('E-mail ou senha atual incorretos.');
        }

        const { error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (updateError) throw updateError;

        await supabase.auth.signOut();
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setMode('login');
        setSuccessMsg('Senha alterada com sucesso! Faça login com sua nova senha.');
      } else if (mode === 'update_password') {
        if (newPassword.length < 6) {
          throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('A confirmação da nova senha não confere.');
        }

        const { data, error: updateError } = await supabase.auth.updateUser({
          password: newPassword
        });

        if (updateError) throw updateError;

        if (onRecoveryComplete) {
          onRecoveryComplete();
        }

        if (data?.user) {
          onLogin({
            id: data.user.id,
            name: data.user.user_metadata?.name || data.user.email,
            email: data.user.email
          });
        } else {
          switchMode('login');
          setSuccessMsg('Senha redefinida com sucesso! Faça login com sua nova senha.');
        }
      }
    } catch (err) {
      console.error(err);
      setError(
        err.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login':
        return 'Faça login para acessar seus dados na nuvem.';
      case 'register':
        return 'Crie sua conta na nuvem para começar.';
      case 'forgot':
        return 'Informe o e-mail cadastrado para receber o link de restauração.';
      case 'change':
        return 'Informe seu e-mail, senha atual e defina a nova senha.';
      case 'update_password':
        return 'Digite abaixo a sua nova senha de acesso.';
      default:
        return '';
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
            {getSubtitle()}
          </p>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nome (Cabeçalho)</label>
              <input
                type="text" required className="form-control"
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: João & Maria"
              />
            </div>
          )}

          {mode !== 'update_password' && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>E-mail</label>
              <input
                type="email" required className="form-control"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'change') && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                {mode === 'change' ? 'Senha Atual' : 'Senha'}
              </label>
              <input
                type="password" required className="form-control"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              {mode === 'login' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => switchMode('change')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}
                  >
                    Alterar senha
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontSize: '0.82rem', padding: 0 }}
                  >
                    Esqueci minha senha
                  </button>
                </div>
              )}
            </div>
          )}

          {(mode === 'change' || mode === 'update_password') && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Nova Senha</label>
                <input
                  type="password" required className="form-control"
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Confirmar Nova Senha</label>
                <input
                  type="password" required className="form-control"
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                />
              </div>
            </>
          )}

          <button disabled={loading} type="submit" className="btn btn-primary w-full" style={{ padding: '0.875rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
            {loading ? 'Carregando...' : (
              mode === 'login' ? <><LogIn size={18} /> Entrar</> :
              mode === 'register' ? <><UserPlus size={18} /> Criar Conta</> :
              mode === 'forgot' ? <><Mail size={18} /> Restaurar Senha por E-mail</> :
              <><KeyRound size={18} /> Salvar Nova Senha</>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
          {mode === 'login' || mode === 'register' ? (
            <>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                {mode === 'login' ? 'Não tem uma conta?' : 'Já possui uma conta?'}
              </p>
              <button
                onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: '500', fontSize: '0.95rem' }}
                disabled={loading}
              >
                {mode === 'login' ? 'Criar uma conta' : 'Fazer login'}
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                if (mode === 'update_password' && onRecoveryComplete) {
                  onRecoveryComplete();
                }
                switchMode('login');
              }}
              style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: '500', fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              disabled={loading}
            >
              <ArrowLeft size={16} /> Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
