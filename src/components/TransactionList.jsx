import React, { useState, useMemo } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { Trash2, ArrowUpCircle, ArrowDownCircle, Calendar, Edit2, CheckCircle2, Paperclip, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO, isToday, isBefore, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const TransactionList = ({ onEdit }) => {

const safeFormatDate = (dateString, formatStr) => {
  if (!dateString) return '-';
  const d = parseISO(dateString);
  if (isNaN(d.getTime())) return '-';
  return format(d, formatStr, { locale: ptBR });
};

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

  const [deleteConfirmTx, setDeleteConfirmTx] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'dueDate', direction: 'asc' });
  const [selectedTx, setSelectedTx] = useState([]);
  const [filters, setFilters] = useState({
    description: '',
    date: '',
    dueDate: '',
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
        const formatted = safeFormatDate(displayDate, "dd 'de' MMM").toLowerCase();
        return formatted.includes(filters.date.toLowerCase());
      });
    }
    if (filters.dueDate) {
      result = result.filter(t => {
        if (!t.computedDueDate) return false;
        const formatted = safeFormatDate(t.computedDueDate, "dd 'de' MMM").toLowerCase();
        return formatted.includes(filters.dueDate.toLowerCase());
      });
    }

    if (sortConfig) {
      result.sort((a, b) => {
        if (sortConfig.key === 'date') {
          const dateA = new Date(a.originalDate || a.date).getTime() || 0;
          const dateB = new Date(b.originalDate || b.date).getTime() || 0;
          return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
        }
        if (sortConfig.key === 'dueDate') {
          const dateA = new Date(a.computedDueDate || a.date).getTime() || 0;
          const dateB = new Date(b.computedDueDate || b.date).getTime() || 0;
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Lançamentos do Mês</h2>
        {selectedTx.length > 0 && (
          <button onClick={handleBulkPay} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
            <CheckCircle2 size={16} /> Pagar Selecionados ({selectedTx.length})
          </button>
        )}
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '1rem', width: '40px' }}>
                <input type="checkbox" onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTx(processedTransactions.filter(t => t.type === 'expense').map(t => t.id));
                  } else {
                    setSelectedTx([]);
                  }
                }} checked={selectedTx.length > 0 && selectedTx.length === processedTransactions.filter(t => t.type === 'expense').length} />
              </th>
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
                <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => handleSort('dueDate')}>
                  Vencimento <SortIcon columnKey="dueDate" />
                </div>
                <input 
                  type="text" placeholder="Filtrar..." value={filters.dueDate} 
                  onChange={(e) => handleFilterChange('dueDate', e.target.value)}
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
              const isPaid = t.isPaid;
              const effMonth = t.overrideMonth || currentMonth;
              
              let statusText = "";
              let statusColor = "";
              let statusBg = "";
              
              if (t.type === 'income') {
                statusText = "PAGA";
                statusColor = "var(--income-color)";
                statusBg = "rgba(16, 185, 129, 0.1)";
              } else {
                if (isPaid) {
                  statusText = "PAGA";
                  statusColor = "var(--income-color)";
                  statusBg = "rgba(16, 185, 129, 0.1)";
                } else {
                  const parsedDueDate = parseISO(t.computedDueDate || displayDate);
                  if (isNaN(parsedDueDate.getTime())) {
                    statusText = "DATA INVÁLIDA";
                    statusColor = "var(--text-muted)";
                    statusBg = "transparent";
                  } else {
                    const today = startOfDay(new Date());
                    const dueDate = startOfDay(parsedDueDate);
                    
                    if (isToday(dueDate)) {
                      statusText = "VENCE HOJE";
                      statusColor = "#eab308"; // yellow-500
                      statusBg = "rgba(234, 179, 8, 0.1)";
                    } else if (isBefore(dueDate, today)) {
                      statusText = "VENCIDA";
                      statusColor = "var(--expense-color)";
                      statusBg = "rgba(239, 68, 68, 0.1)";
                    } else {
                      statusText = "A VENCER";
                      statusColor = "#3b82f6"; // blue-500
                      statusBg = "rgba(59, 130, 246, 0.1)";
                    }
                  }
                }
              }

              return (
                <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s', backgroundColor: selectedTx.includes(t.id) ? 'rgba(59, 130, 246, 0.05)' : 'transparent' }}>
                  <td style={{ padding: '1rem' }}>
                    {t.type === 'expense' && (
                      <input type="checkbox" checked={selectedTx.includes(t.id)} onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTx(prev => [...prev, t.id]);
                        } else {
                          setSelectedTx(prev => prev.filter(id => id !== t.id));
                        }
                      }} />
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div className="flex items-center gap-2">
                      {t.type === 'income' ? (
                        <ArrowUpCircle size={18} className="text-income" style={{ flexShrink: 0 }} />
                      ) : (
                        <ArrowDownCircle size={18} className="text-expense" style={{ flexShrink: 0 }} />
                      )}
                      <div>
                        <div style={{ fontWeight: '500', textDecoration: isPaid && t.type === 'expense' ? 'line-through' : 'none', opacity: isPaid && t.type === 'expense' ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                      {safeFormatDate(displayDate, "dd/MM")}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                    {t.type === 'expense' ? (
                      <div className="flex items-center gap-2" style={{ fontWeight: '500' }}>
                        {safeFormatDate(t.computedDueDate || displayDate, "dd/MM")}
                      </div>
                    ) : '-'}
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
                    {t.type === 'expense' ? (
                      <button
                        onClick={() => handleTogglePaid(t)}
                        style={{
                          background: statusBg, border: 'none', cursor: 'pointer',
                          color: statusColor, padding: '0.25rem 0.5rem', borderRadius: '4px',
                          fontSize: '0.75rem', fontWeight: 'bold', width: '100%'
                        }}
                      >
                        {statusText}
                      </button>
                    ) : (
                      <div style={{
                        background: statusBg,
                        color: statusColor, padding: '0.25rem 0.5rem', borderRadius: '4px',
                        fontSize: '0.75rem', fontWeight: 'bold', textAlign: 'center', width: '100%'
                      }}>
                        {statusText}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <div className="flex justify-end gap-2">
                      {(t.isFixedExpense || (!t.isFixed && !t.isFixedExpense)) && (
                          <button 
                            onClick={() => onEdit(t)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            title={t.isFixedExpense ? "Editar neste mês" : "Editar"}
                          >
                            <Edit2 size={18} />
                          </button>
                      )}
                      {!t.isFixed && !t.isFixedExpense && (
                        <>
                          <button 
                            onClick={() => {
                              if(t.groupId) {
                                setDeleteConfirmTx(t);
                              } else {
                                deleteTransaction(t.id);
                              }
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                            title={t.groupId ? "Opções de Exclusão" : "Excluir"}
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

      {deleteConfirmTx && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '400px', backgroundColor: 'var(--bg-main)', margin: 'auto' }}>
            <h3 style={{ marginBottom: '1rem' }}>Excluir Lançamento Parcelado</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
              Você está excluindo o lançamento "<strong>{deleteConfirmTx.description}</strong>". O que deseja fazer?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => { deleteTransaction(deleteConfirmTx.id, 'single'); setDeleteConfirmTx(null); }}>
                Excluir somente esta parcela
              </button>
              <button className="btn btn-danger" onClick={() => { deleteTransaction(deleteConfirmTx.id, 'subsequent'); setDeleteConfirmTx(null); }}>
                Excluir esta e as parcelas seguintes
              </button>
              <button className="btn" style={{ backgroundColor: 'transparent', color: 'var(--text-muted)' }} onClick={() => setDeleteConfirmTx(null)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
