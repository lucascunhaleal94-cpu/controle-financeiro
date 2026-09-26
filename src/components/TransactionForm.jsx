import React, { useState } from 'react';
import { useTransactions, CATEGORIES, PAYMENT_METHODS, INCOME_SOURCES } from '../context/TransactionsContext';
import { X } from 'lucide-react';
import { format } from 'date-fns';

const TransactionForm = ({ onClose }) => {
  const { addTransaction, currentMonth } = useTransactions();
  
  const initialDate = format(new Date(), 'yyyy-MM-dd').startsWith(currentMonth) 
    ? format(new Date(), 'yyyy-MM-dd') 
    : `${currentMonth}-01`;

  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(initialDate);
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [source, setSource] = useState(INCOME_SOURCES[0]);
  const [installments, setInstallments] = useState(1);
  const [details, setDetails] = useState(''); // Novo campo
  const [attachment, setAttachment] = useState(null); // Arquivo anexo

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description || !amount || !date) return;

    addTransaction({
      type,
      description,
      amount,
      date,
      details,
      attachment,
      installments,
      ...(type === 'expense' ? { category, paymentMethod } : { source })
    });

    onClose();
  };

  const isCreditCard = type === 'expense' && paymentMethod.startsWith('CARTÃO');

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
      <div className="card" style={{ width: '100%', maxWidth: '500px', position: 'relative' }}>
        <button 
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
        >
          <X size={24} />
        </button>
        
        <h2 style={{ marginBottom: '1.5rem' }}>Nova Transação</h2>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            className={`btn w-full ${type === 'expense' ? 'btn-danger' : 'btn-outline'}`}
            onClick={() => setType('expense')}
            style={type === 'expense' ? { border: '1px solid var(--expense-color)', color: 'var(--expense-color)' } : {}}
          >
            Despesa
          </button>
          <button
            type="button"
            className={`btn w-full ${type === 'income' ? 'btn-outline' : 'btn-outline'}`}
            onClick={() => setType('income')}
            style={type === 'income' ? { border: '1px solid var(--income-color)', color: 'var(--income-color)', backgroundColor: 'rgba(16, 185, 129, 0.1)' } : {}}
          >
            Receita
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Descrição</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ex: Conta de Luz"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Detalhes Adicionais (Opcional)</label>
            <textarea
              className="form-control"
              placeholder="Alguma observação sobre essa transação..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Anexo (PDF ou Imagem) - Opcional</label>
            <input
              type="file"
              accept=".pdf,image/*"
              className="form-control"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file && file.size > 15 * 1024 * 1024) {
                  alert('O arquivo deve ter no máximo 15MB');
                  e.target.value = '';
                  return;
                }
                setAttachment(file || null);
              }}
              style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.02)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div className="form-group w-full">
              <label className="form-label">{isCreditCard ? 'Valor Total (R$)' : 'Valor (R$)'}</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-control"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group w-full">
              <label className="form-label">Data da Compra</label>
              <input
                type="date"
                className="form-control"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          {type === 'expense' ? (
            <>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div className="form-group w-full">
                  <label className="form-label">Categoria</label>
                  <select 
                    className="form-control" 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group w-full">
                  <label className="form-label">Forma de Pagamento</label>
                  <select 
                    className="form-control" 
                    value={paymentMethod} 
                    onChange={(e) => {
                      setPaymentMethod(e.target.value);
                      if (!e.target.value.startsWith('CARTÃO')) {
                        setInstallments(1);
                      }
                    }}
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {isCreditCard && (
                <div className="form-group">
                  <label className="form-label">Parcelas (Valor total será dividido)</label>
                  <input
                    type="number"
                    min="1"
                    max="48"
                    className="form-control"
                    value={installments}
                    onChange={(e) => setInstallments(e.target.value)}
                    required
                  />
                  {installments > 1 && amount && (
                    <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      {installments}x de R$ {(amount / installments).toFixed(2)}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="form-group">
              <label className="form-label">Fonte de Recebimento</label>
              <select 
                className="form-control" 
                value={source} 
                onChange={(e) => setSource(e.target.value)}
              >
                {INCOME_SOURCES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          )}

          <button type="submit" className="btn btn-primary w-full mt-4" style={{ padding: '0.875rem' }}>
            Salvar Transação
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
