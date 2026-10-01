import React, { useState } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { X, Plus, Trash2, Edit2, Save, AlertTriangle } from 'lucide-react';

const PaymentMethodManagerModal = ({ onClose }) => {
  const { paymentMethods, addPaymentMethod, updatePaymentMethod, deletePaymentMethod, allTransactions, settings } = useTransactions();
  
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [substituteMethod, setSubstituteMethod] = useState('');

  const handleEdit = (method) => {
    setEditingId(method);
    setEditName(method);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    if (editName.toUpperCase() !== editingId && paymentMethods.includes(editName.toUpperCase())) {
      alert("Este método de pagamento já existe.");
      return;
    }
    updatePaymentMethod(editingId, editName);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    let formattedName = newName.toUpperCase();
    if (!formattedName.startsWith('CARTÃO')) {
      formattedName = 'CARTÃO ' + formattedName;
    }
    if (paymentMethods.includes(formattedName)) {
      alert("Este cartão já existe.");
      return;
    }
    addPaymentMethod(formattedName);
    setIsAdding(false);
    setNewName('');
  };

  const attemptDelete = (method) => {
    const hasTransactions = allTransactions.some(t => t.paymentMethod === method) || 
                            (settings.fixedExpenses || []).some(fe => fe.paymentMethod === method);
    if (hasTransactions) {
      setDeleteCandidate(method);
      setSubstituteMethod('');
    } else {
      deletePaymentMethod(method, 'delete');
    }
  };

  const confirmDelete = (deleteTransactions) => {
    if (deleteTransactions) {
      deletePaymentMethod(deleteCandidate, 'delete');
    } else {
      if (!substituteMethod) {
        alert("Selecione um cartão para vincular os gastos, ou escolha excluir os gastos.");
        return;
      }
      deletePaymentMethod(deleteCandidate, 'migrate', substituteMethod);
    }
    setDeleteCandidate(null);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.8)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 60,
      padding: '1rem'
    }}>
      <div className="card glass-panel animate-fade-in" style={{ 
        width: '100%', 
        maxWidth: '600px',
        maxHeight: '90vh',
        overflowY: 'auto',
        position: 'relative'
      }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >
          <X size={24} />
        </button>
        <h2 style={{ marginBottom: '1.5rem' }}>Gerenciar Cartões e Métodos</h2>

        {deleteCandidate ? (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--expense-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--expense-color)', fontWeight: 'bold' }}>
              <AlertTriangle size={24} />
              Atenção: O cartão "{deleteCandidate}" possui gastos vinculados!
            </div>
            <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Você está prestes a excluir um cartão que já foi utilizado em lançamentos. Para não perder o histórico, você pode transferir esses lançamentos para outro cartão existente.
            </p>
            
            <div className="form-group">
              <label className="form-label">Transferir gastos para:</label>
              <select className="form-control" value={substituteMethod} onChange={(e) => setSubstituteMethod(e.target.value)}>
                <option value="">-- Escolha um cartão/método --</option>
                {paymentMethods.filter(m => m !== deleteCandidate).map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mt-4" style={{ flexWrap: 'wrap' }}>
              <button className="btn btn-primary" style={{ flex: 1, minWidth: '150px' }} onClick={() => confirmDelete(false)}>
                Transferir e Excluir
              </button>
              <button className="btn btn-danger" style={{ flex: 1, minWidth: '150px' }} onClick={() => confirmDelete(true)}>
                Excluir TUDO
              </button>
              <button className="btn btn-secondary" style={{ flex: 1, minWidth: '100px' }} onClick={() => setDeleteCandidate(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {paymentMethods.map(method => {
                const isSystemFixed = method === 'DINHEIRO/PIX';
                return (
                  <div key={method} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px' }}>
                    {editingId === method ? (
                      <>
                        <input 
                          type="text" 
                          className="form-control" 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)} 
                          style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" onClick={handleSaveEdit} style={{ padding: '0.5rem' }}><Save size={18} /></button>
                        <button className="btn btn-secondary" onClick={() => setEditingId(null)} style={{ padding: '0.5rem' }}><X size={18} /></button>
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1, fontWeight: 'bold' }}>{method}</div>
                        {!isSystemFixed && (
                          <>
                            <button className="text-muted" onClick={() => handleEdit(method)} title="Editar"><Edit2 size={18} /></button>
                            <button className="text-expense" onClick={() => attemptDelete(method)} title="Excluir"><Trash2 size={18} /></button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {isAdding ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="Nome do cartão (ex: XP, NUBANK)" 
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleAdd} style={{ padding: '0.5rem' }}><Save size={18} /></button>
                <button className="btn btn-secondary" onClick={() => setIsAdding(false)} style={{ padding: '0.5rem' }}><X size={18} /></button>
              </div>
            ) : (
              <button className="btn btn-secondary w-full flex items-center justify-center gap-2" onClick={() => setIsAdding(true)}>
                <Plus size={18} /> Novo Cartão
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentMethodManagerModal;
