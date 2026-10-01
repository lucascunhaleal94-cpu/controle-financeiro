import React, { useState } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { X, Plus, Edit2, Trash2, Save, AlertTriangle } from 'lucide-react';

const CategoryManagerModal = ({ onClose }) => {
  const { categories, addCategory, updateCategory, deleteCategory, allTransactions } = useTransactions();
  
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLimit, setEditLimit] = useState('');
  
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLimit, setNewLimit] = useState('');

  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [substituteCat, setSubstituteCat] = useState('');

  const handleEdit = (cat) => {
    setEditingId(cat.name);
    setEditName(cat.name);
    setEditLimit(cat.limit || 0);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) return;
    updateCategory(editingId, editName, editLimit);
    setEditingId(null);
  };

  const handleAdd = () => {
    if (!newName.trim()) return;
    if (categories.find(c => c.name === newName.toUpperCase())) {
      alert("Categoria já existe");
      return;
    }
    addCategory({ name: newName, limit: newLimit });
    setIsAdding(false);
    setNewName('');
    setNewLimit('');
  };

  const attemptDelete = (cat) => {
    const hasTransactions = allTransactions.some(t => t.category === cat.name);
    if (hasTransactions) {
      setDeleteCandidate(cat);
      setSubstituteCat('');
    } else {
      deleteCategory(cat.name);
    }
  };

  const confirmDelete = (deleteTransactions) => {
    if (deleteTransactions) {
      deleteCategory(deleteCandidate.name, null);
    } else {
      if (!substituteCat) {
        alert("Selecione uma categoria para vincular os gastos, ou escolha excluir os gastos.");
        return;
      }
      deleteCategory(deleteCandidate.name, substituteCat);
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
      zIndex: 50,
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
        <h2 style={{ marginBottom: '1.5rem' }}>Gerenciar Categorias</h2>

        {deleteCandidate ? (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--expense-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <div className="flex items-center gap-2 mb-4" style={{ color: 'var(--expense-color)', fontWeight: 'bold' }}>
              <AlertTriangle size={24} />
              Atenção: A categoria "{deleteCandidate.name}" possui gastos vinculados!
            </div>
            <p style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Você está prestes a excluir uma categoria que já foi utilizada em lançamentos. Para não perder o histórico, você pode transferir esses lançamentos para outra categoria existente.
            </p>
            
            <div className="form-group">
              <label className="form-label">Transferir gastos para:</label>
              <select className="form-control" value={substituteCat} onChange={(e) => setSubstituteCat(e.target.value)}>
                <option value="">-- Escolha uma categoria --</option>
                {categories.filter(c => c.name !== deleteCandidate.name).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => confirmDelete(false)}>
                Transferir e Excluir
              </button>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => confirmDelete(true)}>
                Excluir TUDO (Categoria e Gastos)
              </button>
              <button className="btn btn-secondary" onClick={() => setDeleteCandidate(null)}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {categories.map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px' }}>
                  {editingId === cat.name ? (
                    <>
                      <input 
                        type="text" 
                        className="form-control" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)} 
                        style={{ flex: 2 }}
                      />
                      <input 
                        type="number" 
                        className="form-control" 
                        value={editLimit} 
                        onChange={(e) => setEditLimit(e.target.value)} 
                        placeholder="Limite (Máx)" 
                        style={{ flex: 1 }}
                      />
                      <button className="btn btn-primary" onClick={handleSaveEdit} style={{ padding: '0.5rem' }}><Save size={18} /></button>
                      <button className="btn btn-secondary" onClick={() => setEditingId(null)} style={{ padding: '0.5rem' }}><X size={18} /></button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 2, fontWeight: 'bold' }}>{cat.name}</div>
                      <div style={{ flex: 1, color: 'var(--text-muted)' }}>Máx: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cat.limit || 0)}</div>
                      <button className="text-muted" onClick={() => handleEdit(cat)} title="Editar"><Edit2 size={18} /></button>
                      <button className="text-expense" onClick={() => attemptDelete(cat)} title="Excluir"><Trash2 size={18} /></button>
                    </>
                  )}
                </div>
              ))}
            </div>

            {isAdding ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)} 
                  placeholder="Nome da categoria" 
                  style={{ flex: 2 }}
                />
                <input 
                  type="number" 
                  className="form-control" 
                  value={newLimit} 
                  onChange={(e) => setNewLimit(e.target.value)} 
                  placeholder="Limite (Máx)" 
                  style={{ flex: 1 }}
                />
                <button className="btn btn-primary" onClick={handleAdd} style={{ padding: '0.5rem' }}><Save size={18} /></button>
                <button className="btn btn-secondary" onClick={() => setIsAdding(false)} style={{ padding: '0.5rem' }}><X size={18} /></button>
              </div>
            ) : (
              <button className="btn btn-secondary w-full flex items-center justify-center gap-2" onClick={() => setIsAdding(true)}>
                <Plus size={18} /> Nova Categoria
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CategoryManagerModal;
