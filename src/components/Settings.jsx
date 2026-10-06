import React, { useState } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import PaymentMethodManagerModal from './PaymentMethodManagerModal';
import { Settings as SettingsIcon, Trash2, PlusCircle, CreditCard, Edit2, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const Settings = () => {
  const { settings, updateSettings, currentMonth, addFixedExpense, removeFixedExpense, editFixedExpense, categories, paymentMethods, exportBackup, importBackup } = useTransactions();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [due, setDue] = useState('');
  const [cat, setCat] = useState(categories[0]?.name || '');
  const [pay, setPay] = useState(paymentMethods?.[0] || 'DINHEIRO/PIX');
  const [editingFixedExpenseId, setEditingFixedExpenseId] = useState(null);

  const handleFixedIncomeChange = (source, value) => {
    updateSettings({
      fixedIncomes: {
        ...settings.fixedIncomes,
        [source]: value
      }
    });
  };

  const handleClosingDayChange = (card, day) => {
    const parsedDay = parseInt(day) || 1;
    updateSettings({
      closingDays: {
        ...settings.closingDays,
        overrides: {
          ...settings.closingDays.overrides,
          [currentMonth]: {
            ...(settings.closingDays.overrides?.[currentMonth] || {}),
            [card]: parsedDay
          }
        }
      }
    });
  };

  const handleDueDayChange = (card, day) => {
    const parsedDay = parseInt(day) || 1;
    updateSettings({
      dueDays: {
        ...(settings.dueDays || { default: {}, overrides: {} }),
        overrides: {
          ...(settings.dueDays?.overrides || {}),
          [currentMonth]: {
            ...(settings.dueDays?.overrides?.[currentMonth] || {}),
            [card]: parsedDay
          }
        }
      }
    });
  };

  const handleAddOrEditFixedExpense = (e) => {
    e.preventDefault();
    if (!desc || !amt || !due) return;
    
    if (editingFixedExpenseId) {
      editFixedExpense(editingFixedExpenseId, {
        description: desc,
        amount: parseFloat(amt),
        dueDate: parseInt(due),
        category: cat,
        paymentMethod: pay
      });
      setEditingFixedExpenseId(null);
    } else {
      addFixedExpense({
        description: desc,
        amount: parseFloat(amt),
        dueDate: parseInt(due),
        category: cat,
        paymentMethod: pay
      });
    }
    setDesc(''); setAmt(''); setDue('');
  };

  const monthName = format(parseISO(`${currentMonth}-01`), 'MMMM yyyy', { locale: ptBR });
  const creditCards = paymentMethods.filter(m => m.startsWith('CARTÃO'));
  const fixedExpensesList = settings.fixedExpenses || [];

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      importBackup(evt.target.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon size={24} className="text-primary" />
          <h2>Rendas Fixas (Automáticas)</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div className="form-group">
            <label className="form-label">LUCAS (R$)</label>
            <input
              type="number" step="0.01" min="0" className="form-control"
              value={settings.fixedIncomes?.LUCAS || 0}
              onChange={(e) => handleFixedIncomeChange('LUCAS', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">GABRIELA (R$)</label>
            <input
              type="number" step="0.01" min="0" className="form-control"
              value={settings.fixedIncomes?.GABRIELA || 0}
              onChange={(e) => handleFixedIncomeChange('GABRIELA', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon size={24} className="text-warning" />
          <h2>Saldo Inicial Acumulado (Anterior ao App)</h2>
        </div>
        <div className="form-group" style={{ maxWidth: '250px' }}>
          <label className="form-label">Valor (R$)</label>
          <input
            type="number" step="0.01" className="form-control"
            value={settings.initialBalance || 0}
            onChange={(e) => updateSettings({ initialBalance: parseFloat(e.target.value) || 0 })}
          />
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Usado como ponto de partida antes do mês inicial do sistema ({settings.appStartDate}).
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon size={24} className="text-expense" />
          <h2>Despesas Fixas Recorrentes</h2>
        </div>
        <form onSubmit={handleAddOrEditFixedExpense} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
          <div className="form-group" style={{ flex: '1 1 200px', marginBottom: 0 }}>
            <label className="form-label">Descrição</label>
            <input type="text" className="form-control" placeholder="Ex: Luz" value={desc} onChange={e => setDesc(e.target.value)} required />
          </div>
          <div className="form-group" style={{ flex: '1 1 100px', marginBottom: 0 }}>
            <label className="form-label">Valor</label>
            <input type="number" step="0.01" className="form-control" placeholder="0,00" value={amt} onChange={e => setAmt(e.target.value)} required />
          </div>
          <div className="form-group" style={{ flex: '1 1 80px', marginBottom: 0 }}>
            <label className="form-label">Dia</label>
            <input type="number" min="1" max="31" className="form-control" placeholder="15" value={due} onChange={e => setDue(e.target.value)} required />
          </div>
          <div className="form-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
            <label className="form-label">Categoria</label>
            <select className="form-control" value={cat} onChange={e => setCat(e.target.value)}>
              {categories.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: '1 1 150px', marginBottom: 0 }}>
            <label className="form-label">Pagamento</label>
            <select className="form-control" value={pay} onChange={(e) => {
              const method = e.target.value;
              setPay(method);
              if (method.startsWith('CARTÃO')) {
                const defaultDue = settings.dueDays?.default?.[method] || 10;
                setDue(String(defaultDue));
              }
            }}>
              {paymentMethods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 1 100px', marginBottom: 0 }}>
            <button type="submit" className="btn btn-outline" style={{ height: '42px', flex: 1, color: 'var(--expense-color)', borderColor: 'var(--expense-color)' }}>
              {editingFixedExpenseId ? <><Save size={18} /> Salvar</> : <><PlusCircle size={18} /> Add</>}
            </button>
            {editingFixedExpenseId && (
              <button type="button" className="btn btn-outline" style={{ height: '42px', flex: 1, color: 'var(--text-muted)', borderColor: 'var(--text-muted)' }} onClick={() => {
                setEditingFixedExpenseId(null);
                setDesc(''); setAmt(''); setDue('');
              }}>
                Cancelar
              </button>
            )}
          </div>
        </form>

        {fixedExpensesList.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {fixedExpensesList.map(fe => (
              <div key={fe.id} className="flex justify-between items-center" style={{ padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <div>
                  <div style={{ fontWeight: '500' }}>{fe.description}</div>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                    Todo dia {fe.dueDate} • {fe.paymentMethod} • {fe.category}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span style={{ fontWeight: '600' }}>{formatCurrency(fe.amount)}</span>
                  <button onClick={() => {
                    setEditingFixedExpenseId(fe.id);
                    setDesc(fe.description);
                    setAmt(String(fe.amount));
                    setDue(String(fe.dueDate));
                    setCat(fe.category);
                    setPay(fe.paymentMethod);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => removeFixedExpense(fe.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <CreditCard size={24} className="text-warning" />
          <h2>Fechamento e Vencimento de Cartões (<span style={{ textTransform: 'capitalize' }}>{monthName}</span>)</h2>
          <button className="btn btn-secondary" style={{ marginLeft: 'auto', padding: '0.25rem 0.75rem', fontSize: '0.85rem' }} onClick={() => setShowPaymentModal(true)}>Gerenciar Cartões</button>
        </div>
        <p className="text-muted mb-6" style={{ fontSize: '0.9rem' }}>
          Altere as datas especificamente para as faturas de <strong>{monthName}</strong>.
        </p>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '0.5rem 0', fontWeight: '500' }}>Cartão</th>
              <th style={{ padding: '0.5rem 0', fontWeight: '500', width: '120px' }}>Dia Fechamento</th>
              <th style={{ padding: '0.5rem 0', fontWeight: '500', width: '120px' }}>Dia Vencimento</th>
            </tr>
          </thead>
          <tbody>
            {creditCards.map(card => {
              const currentClose = settings.closingDays?.overrides?.[currentMonth]?.[card] ?? settings.closingDays?.default?.[card] ?? 10;
              const currentDue = settings.dueDays?.overrides?.[currentMonth]?.[card] ?? settings.dueDays?.default?.[card] ?? 21;
              return (
                <tr key={card} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '1rem 0' }}>{card}</td>
                  <td style={{ padding: '1rem 0' }}>
                    <input
                      type="number" min="1" max="31" className="form-control"
                      value={currentClose}
                      onChange={(e) => handleClosingDayChange(card, e.target.value)}
                      style={{ padding: '0.5rem', width: '80px' }}
                    />
                  </td>
                  <td style={{ padding: '1rem 0' }}>
                    <input
                      type="number" min="1" max="31" className="form-control"
                      value={currentDue}
                      onChange={(e) => handleDueDayChange(card, e.target.value)}
                      style={{ padding: '0.5rem', width: '80px' }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon size={24} className="text-primary" />
          <h2>Backup (Exportar e Importar)</h2>
        </div>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          Use estas opções para transferir seus dados entre o sistema local (computador) e a versão publicada na nuvem (Vercel).
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={exportBackup}>
            Baixar Dados Atuais
          </button>
          <div>
            <input type="file" id="importFile" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
            <label htmlFor="importFile" className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-block', margin: 0 }}>
              Importar Arquivo de Dados
            </label>
          </div>
        </div>
      </div>

      {showPaymentModal && <PaymentMethodManagerModal onClose={() => setShowPaymentModal(false)} />}
    </div>
  );
};

export default Settings;
