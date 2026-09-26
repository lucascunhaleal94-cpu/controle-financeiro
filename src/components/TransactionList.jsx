import React from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { Trash2, ArrowUpCircle, ArrowDownCircle, Calendar, Edit2, CheckCircle2, Paperclip } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const TransactionList = () => {
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

  const sortedTransactions = [...currentMonthTransactions].sort((a, b) => {
    const dateA = a.originalDate || a.date;
    const dateB = b.originalDate || b.date;
    return new Date(dateB) - new Date(dateA);
  });

  const handleEditOverride = (t) => {
    const newVal = window.prompt(`Alterar valor de "${t.description}" apenas para este mês (${currentMonth}):`, t.amount);
    if (newVal !== null && newVal !== '') {
      const parsed = parseFloat(newVal.replace(',', '.'));
      if (!isNaN(parsed)) {
        updateFixedExpenseOverride(t.baseId, t.overrideMonth, parsed);
      }
    }
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
              <th style={{ padding: '1rem', fontWeight: '500' }}>Descrição</th>
              <th style={{ padding: '1rem', fontWeight: '500' }}>Data</th>
              <th style={{ padding: '1rem', fontWeight: '500' }}>Categoria/Fonte</th>
              <th style={{ padding: '1rem', fontWeight: '500' }}>Pagamento</th>
              <th style={{ padding: '1rem', fontWeight: '500', textAlign: 'right' }}>Valor</th>
              <th style={{ padding: '1rem', width: '100px', textAlign: 'center' }}>Status</th>
              <th style={{ padding: '1rem', width: '80px', textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((t) => {
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
