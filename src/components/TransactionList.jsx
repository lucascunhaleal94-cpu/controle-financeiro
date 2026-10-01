import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { Trash2, ArrowUpCircle, ArrowDownCircle, Calendar, Edit2, CheckCircle2, Paperclip, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const TransactionList = ({ onEdit }) => {
  const { 
    currentMonthTransactions, 
    deleteTransaction, 
    updateFixedExpenseOverride, 
    currentMonth, 
    paidItems, 
    togglePaidStatus,
    openAttachment
  } = useTransactions();

  if (currentMonthTransactions.length === 0) {
    return (
      <div className="card text-center" style={{ padding: '3rem', marginTop: '2rem' }}>
        <p className="text-muted">Nenhuma transação cadastrada para esta fatura/mês.</p>
      </div>
    );
  }

  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [filters, setFilters] = useState({
    description: '',
    date: '',
    category: '',
    paymentMethod: '',
    amount: ''
  });

  const processedTransactions = useMemo(() => {
    let result = [...currentMonthTransactions];

    if (filters.description) {
      result = result.filter(t => t.description.toLowerCase().includes(filters.description.toLowerCase()));
    }
    if (filters.category) {
      result = result.filter(t => (t.category || t.source || '').toLowerCase().includes(filters.category.toLowerCase()));
    }
    if (filters.paymentMethod) {
      result = result.filter(t => (t.paymentMethod || '').toLowerCase().includes(filters.paymentMethod.toLowerCase()));
    }
    if (filters.amount) {
      result = result.filter(t => String(t.amount).includes(filters.amount));
    }
    if (filters.date) {
      result = result.filter(t => {
        const displayDate = t.originalDate || t.date;
        const formatted = format(parseISO(displayDate), "dd 'de' MMM", { locale: ptBR }).toLowerCase();
        return formatted.includes(filters.date.toLowerCase());
      });
    }

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === 'date') {
          const dateA = new Date(a.originalDate || a.date);
          const dateB = new Date(b.originalDate || b.date);
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }
        if (sortConfig.key === 'amount') {
          return sortConfig.direction === 'asc' ? a.amount - b.amount : b.amount - a.amount;
        }
        
        let valA = '';
        let valB = '';
        if (sortConfig.key === 'description') {
          valA = a.description.toLowerCase(); 
          valB = b.description.toLowerCase();
        } else if (sortConfig.key === 'category') {
          valA = (a.category || a.source || '').toLowerCase(); 
          valB = (b.category || b.source || '').toLowerCase();
        } else if (sortConfig.key === 'paymentMethod') {
          valA = (a.paymentMethod || '').toLowerCase(); 
          valB = (b.paymentMethod || '').toLowerCase();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [currentMonthTransactions, sortConfig, filters]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown size={14} className="text-muted" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  

  const handleTogglePaid = (t) => {
    if (t.isFixedExpense) {
      togglePaidStatus(t.overrideMonth, t.baseId);
    } else if (t.paymentMethod?.startsWith('CARTÃO')) {
      const isCurrentlyPaid = paidItems[currentMonth]?.[t.paymentMethod];
      if (!isCurrentlyPaid) {
        if (window.confirm(`Isso marcará a fatura inteira do ${t.paymentMethod} deste mês como PAGA. Deseja continuar?`)) {
          togglePaidStatus(currentMonth, t.paymentMethod);
        }
      } else {
        if (window.confirm(`Desmarcar o pagamento da fatura do ${t.paymentMethod} deste mês?`)) {
          togglePaidStatus(currentMonth, t.paymentMethod);
        }
      }
    }
  };

  return (
    <div className="card" style={{ marginTop: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Lançamentos do Mês</h2>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '1rem', fontWeight: '500' }}>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => handleSort('description')}>
                  Descrição <SortIcon columnKey="description" />
                </div>
                <input 
                  type="text" placeholder="Filtrar..." value={filters.description} 
                  onChange={(e) => handleFilterChange('description', e.target.value)}
                  style={{ width: '100%', marginTop: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                />
              </th>
              <th style={{ padding: '1rem', fontWeight: '500' }}>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => handleSort('date')}>
                  Data <SortIcon columnKey="date" />
                </div>
                <input 
                  type="text" placeholder="Filtrar..." value={filters.date} 
                  onChange={(e) => handleFilterChange('date', e.target.value)}
                  style={{ width: '100%', marginTop: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                />
              </th>
              <th style={{ padding: '1rem', fontWeight: '500' }}>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => handleSort('category')}>
                  Categoria/Fonte <SortIcon columnKey="category" />
                </div>
                <input 
                  type="text" placeholder="Filtrar..." value={filters.category} 
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  style={{ width: '100%', marginTop: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                />
              </th>
              <th style={{ padding: '1rem', fontWeight: '500' }}>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => handleSort('paymentMethod')}>
                  Pagamento <SortIcon columnKey="paymentMethod" />
                </div>
                <input 
                  type="text" placeholder="Filtrar..." value={filters.paymentMethod} 
                  onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
                  style={{ width: '100%', marginTop: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit' }}
                />
              </th>
              <th style={{ padding: '1rem', fontWeight: '500', textAlign: 'right' }}>
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }} onClick={() => handleSort('amount')}>
                  <SortIcon columnKey="amount" /> Valor
                </div>
                <input 
                  type="text" placeholder="Filtrar..." value={filters.amount} 
                  onChange={(e) => handleFilterChange('amount', e.target.value)}
                  style={{ width: '100%', marginTop: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'transparent', color: 'inherit', textAlign: 'right' }}
                />
              </th>
              <th style={{ padding: '1rem', width: '100px', textAlign: 'center', verticalAlign: 'top' }}>Status</th>
              <th style={{ padding: '1rem', width: '80px', textAlign: 'right', verticalAlign: 'top' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {processedTransactions.map((t) => {
              const displayDate = t.originalDate || t.date;
              
              let isPaid = true; // Dinheiro/Pix e Incomes são pagos por padrão
              let showStatusToggle = false;

              if (t.type === 'expense') {
                if (t.isFixedExpense) {
                  isPaid = paidItems[t.overrideMonth]?.[t.baseId] || false;
                  showStatusToggle = true;
                } else if (t.paymentMethod?.startsWith('CARTÃO')) {
                  isPaid = paidItems[currentMonth]?.[t.paymentMethod] || false;
                  showStatusToggle = true;
                }
              }

              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }}>
                  <td style={{ padding: '1rem' }}>
                    <div className="flex items-center gap-2">
                      {t.type === 'income' ? (
                        <ArrowUpCircle size={18} className="text-income" style={{ flexShrink: 0 }} />
                      ) : (
                        <ArrowDownCircle size={18} className="text-expense" style={{ flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ fontWeight: '500', textDecoration: isPaid && t.type === 'expense' && showStatusToggle ? 'line-through' : 'none', opacity: isPaid && t.type === 'expense' && showStatusToggle ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {t.description}
                          {t.hasAttachment && (
                            <button 
                              onClick={() => openAttachment(t.attachmentKey)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                              title="Ver Anexo"
                            >
                              <Paperclip size={14} className="text-muted" />
                            </button>
                          )}
                        </div>
                        {t.details && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontStyle: 'italic' }}>
                            {t.details}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    <div className="flex items-center gap-2">
                      <Calendar size={14} />
                      {format(parseISO(displayDate), "dd 'de' MMM", { locale: ptBR })}
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {t.type === 'expense' ? (
                      <span className="badge badge-expense">{t.category}</span>
                    ) : (
                      <span className="badge badge-income">{t.source}</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {t.type === 'expense' ? t.paymentMethod : '-'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: t.type === 'income' ? 'var(--income-color)' : 'var(--text-main)' }}>
                    {t.type === 'income' ? '+ ' : '- '}
                    {formatCurrency(t.amount)}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'center' }}>
                    {showStatusToggle ? (
                      <button
                        onClick={() => handleTogglePaid(t)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: isPaid ? 'var(--income-color)' : 'var(--text-muted)'
                        }}
                        title={isPaid ? "Desmarcar como Pago" : "Marcar como Pago"}
                      >
                        <CheckCircle2 size={20} />
                      </button>
                    ) : (
                      <CheckCircle2 size={20} style={{ color: 'var(--income-color)', opacity: 0.5 }} title="Pago na hora (Dinheiro/Pix)" />
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      {t.isFixedExpense && (
                        <button 
                          onClick={() => handleEditOverride(t)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                          title="Editar valor neste mês"
                        >
                          <Edit2 size={18} />
                        </button>
                      )}
                      {!t.isFixed && !t.isFixedExpense && (
                        <>
                          <button 
                            onClick={() => onEdit(t)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              if(t.groupId) {
                                if(window.confirm('Esta é uma compra parcelada. Deseja excluir TODAS as parcelas dessa compra?')) {
                                  deleteTransaction(t.id);
                                }
                              } else {
                                deleteTransaction(t.id);
                              }
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            title={t.groupId ? "Excluir todas as parcelas" : "Excluir"}
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionList;
