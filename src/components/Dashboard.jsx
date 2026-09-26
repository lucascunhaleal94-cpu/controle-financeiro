import React, { useState } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { ArrowUpCircle, ArrowDownCircle, Wallet, CreditCard, PieChart, Users, ChevronDown, ChevronUp, Paperclip } from 'lucide-react';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const Dashboard = () => {
  const {
    totalIncome,
    totalExpense,
    monthNet,
    accumulatedBalance,
    finalBalance,
    expensesByCategory,
    expensesByPaymentMethod,
    incomesBySource,
    thirdPartyDebtTotal,
    openAttachment
  } = useTransactions();

  const [expandedCategories, setExpandedCategories] = useState({});

  const toggleCategory = (catName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Resumo Financeiro Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <div className="card" style={{ borderLeft: '4px solid var(--income-color)' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-muted">Total Recebimentos</h3>
            <ArrowUpCircle color="var(--income-color)" size={24} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{formatCurrency(totalIncome)}</div>
        </div>
        
        <div className="card" style={{ borderLeft: '4px solid var(--expense-color)' }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-muted">Total Gastos</h3>
            <ArrowDownCircle color="var(--expense-color)" size={24} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>{formatCurrency(totalExpense)}</div>
        </div>

        <div className="card" style={{ borderLeft: `4px solid ${monthNet >= 0 ? 'var(--income-color)' : 'var(--warning-color)'}` }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-muted">Saldo do Mês (Usado)</h3>
            <Wallet color={monthNet >= 0 ? "var(--income-color)" : "var(--warning-color)"} size={24} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 'bold' }}>
            {formatCurrency(monthNet)}
          </div>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
            Receitas - Despesas
          </p>
        </div>
      </div>

      {thirdPartyDebtTotal > 0 && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.05)',
          border: '1px solid var(--warning-color)',
          borderRadius: '8px',
          padding: '1rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          color: 'var(--text-main)'
        }}>
          <Users size={28} className="text-warning" />
          <div>
            <div style={{ fontWeight: '600', color: 'var(--warning-color)', marginBottom: '0.25rem' }}>
              Reembolsos Esperados (Dívida de Terceiros): {formatCurrency(thirdPartyDebtTotal)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Esse valor já está incluído no "Resumo por Forma de Pagamento", mas <strong>não foi subtraído do seu saldo principal</strong> pois você será reembolsado.
            </div>
          </div>
        </div>
      )}

      {/* Saldo Acumulado e Restante */}
      <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="text-center">
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Saldo Acumulado (Meses Anteriores)</p>
          <h2 style={{ color: accumulatedBalance < 0 ? 'var(--expense-color)' : 'var(--income-color)' }}>
            {formatCurrency(accumulatedBalance)}
          </h2>
        </div>
        
        <div style={{ width: '2px', height: '50px', backgroundColor: 'var(--border-color)' }}></div>
        
        <div className="text-center">
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.25rem' }}>Saldo Restante (Atual)</p>
          <h2 style={{ fontSize: '2rem', color: finalBalance < 0 ? 'var(--expense-color)' : 'var(--income-color)' }}>
            {formatCurrency(finalBalance)}
          </h2>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Recebimentos por Fonte */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <ArrowUpCircle size={20} className="text-income" />
            <h3>Resumo dos Recebimentos</h3>
          </div>
          <div className="flex-col gap-4">
            {incomesBySource.map((source) => (
              <div key={source.source} className="flex justify-between items-center" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span>{source.source}</span>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(source.received)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo Pagamentos */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={20} className="text-muted" />
            <h3>Resumo dos Pagamentos</h3>
          </div>
          <div className="flex-col gap-4">
            {expensesByPaymentMethod.map((method) => (
              <div key={method.method} className="flex justify-between items-center" style={{ padding: '0.75rem 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.9rem' }}>{method.method}</span>
                <span style={{ fontWeight: 'bold', color: method.spent > 0 ? 'var(--expense-color)' : 'inherit' }}>
                  {formatCurrency(method.spent)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Categorias e Limites */}
      <div className="card">
        <div className="flex items-center gap-2 mb-6">
          <PieChart size={20} className="text-muted" />
          <h3>Resumo das Categorias</h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {expensesByCategory.map((cat) => {
            const isOverLimit = cat.percentage > 100;
            const isWarning = cat.percentage > 80 && !isOverLimit;
            const isExpanded = !!expandedCategories[cat.name];
            const hasTransactions = cat.transactions && cat.transactions.length > 0;
            
            return (
              <div key={cat.name} style={{ background: isExpanded ? 'rgba(255,255,255,0.02)' : 'transparent', padding: isExpanded ? '1rem' : '0', borderRadius: '8px', transition: 'all 0.3s' }}>
                <div 
                  className="flex justify-between items-center mb-2" 
                  style={{ fontSize: '0.9rem', cursor: hasTransactions ? 'pointer' : 'default' }}
                  onClick={() => hasTransactions && toggleCategory(cat.name)}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontWeight: '600' }}>{cat.name}</span>
                    {hasTransactions && (
                      <span className="text-muted" title="Ver detalhes">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <span className="text-muted">Gasto: <span style={{ color: 'var(--text-main)' }}>{formatCurrency(cat.spent)}</span></span>
                    {cat.limit > 0 && (
                      <span className="text-muted">Máx: <span style={{ color: 'var(--text-main)' }}>{formatCurrency(cat.limit)}</span></span>
                    )}
                  </div>
                </div>
                
                {cat.limit > 0 ? (
                  <div className="progress-container">
                    <div 
                      className={`progress-bar ${isOverLimit ? 'progress-danger' : isWarning ? 'progress-warning' : 'progress-good'}`}
                      style={{ width: `${Math.min(cat.percentage, 100)}%` }}
                    ></div>
                  </div>
                ) : null}
                
                {cat.limit > 0 && !isExpanded && (
                  <div className="text-right mt-2" style={{ fontSize: '0.75rem', color: isOverLimit ? 'var(--expense-color)' : 'var(--text-muted)' }}>
                    {cat.percentage.toFixed(0)}% Utilizado
                  </div>
                )}

                {/* Área Expandível de Transações */}
                {isExpanded && hasTransactions && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                    <table style={{ width: '100%', fontSize: '0.85rem', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>
                          <th style={{ paddingBottom: '0.5rem', fontWeight: '500' }}>Descrição</th>
                          <th style={{ paddingBottom: '0.5rem', fontWeight: '500' }}>Pagamento</th>
                          <th style={{ paddingBottom: '0.5rem', fontWeight: '500' }}>Parcela</th>
                          <th style={{ paddingBottom: '0.5rem', fontWeight: '500', textAlign: 'right' }}>Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cat.transactions.sort((a,b) => b.amount - a.amount).map(t => (
                          <tr key={t.id} style={{ borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '0.5rem 0' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {t.description}
                                {t.isFixedExpense && <span className="text-muted" style={{ fontSize: '0.7rem' }}>(Fixo)</span>}
                                {t.hasAttachment && (
                                  <button 
                                    onClick={() => openAttachment(t.attachmentKey)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                                    title="Ver Anexo"
                                  >
                                    <Paperclip size={12} className="text-muted" />
                                  </button>
                                )}
                              </div>
                              {t.details && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.1rem' }}>
                                  {t.details}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '0.5rem 0', color: 'var(--text-muted)' }}>{t.paymentMethod}</td>
                            <td style={{ padding: '0.5rem 0', color: 'var(--text-muted)' }}>
                              {t.installmentsTotal > 1 ? `${t.currentInstallment}/${t.installmentsTotal}` : '-'}
                            </td>
                            <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: '500' }}>
                              {formatCurrency(t.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
