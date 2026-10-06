import React, { useState } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { ArrowUpCircle, ArrowDownCircle, Wallet, CreditCard, PieChart as PieChartIcon, Users, ChevronDown, ChevronUp, Paperclip, Settings as SettingsIcon } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import CategoryManagerModal from './CategoryManagerModal';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.02) return null; // Oculta fatias muito pequenas

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12px" fontWeight="bold">
      {`${(percent * 100).toFixed(1)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#ffffff', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '0.85rem', color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {payload[0].name}
        </p>
        <p style={{ margin: 0, color: payload[0].payload.fill, fontWeight: 'bold', fontSize: '1.1rem' }}>
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
};

const AreaTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: '#ffffff', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '0.9rem', color: '#334155' }}>
          {label}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <p style={{ margin: 0, color: '#0088FE', fontWeight: 'bold' }}>
            Saldo: {formatCurrency(payload[0].payload.saldo)}
          </p>
          {payload[0].payload.receitas > 0 && (
            <p style={{ margin: 0, color: '#00C49F', fontSize: '0.85rem' }}>
              Entradas: {formatCurrency(payload[0].payload.receitas)}
            </p>
          )}
          {payload[0].payload.despesas > 0 && (
            <p style={{ margin: 0, color: '#FF8042', fontSize: '0.85rem' }}>
              Saídas: {formatCurrency(payload[0].payload.despesas)}
            </p>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c', '#d0ed57', '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1', '#FF6633', '#FFB399', '#FF33FF'];

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
    openAttachment,
    currentMonthTransactions,
    currentMonth,
    settings,
    allTransactions,
    categories,
    getEffectiveMonth
  } = useTransactions();

  const [expandedCategories, setExpandedCategories] = useState({});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const toggleCategory = (catName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catName]: !prev[catName]
    }));
  };

  const chartData = expensesByCategory
    .filter(cat => cat.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .map(cat => ({
      name: cat.name,
      value: cat.spent
    }));

  const [yearStr, monthStr] = currentMonth.split('-');
  const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const shortMonth = monthNames[parseInt(monthStr) - 1];

  let currentBalance = accumulatedBalance;
  const dailyData = [];

  for (let d = 1; d <= daysInMonth; d++) {
    let dayIncome = 0;
    let dayExpense = 0;

    currentMonthTransactions.forEach(t => {
      let txDay = 1;
      
      if (t.paymentMethod && t.paymentMethod.startsWith('CARTÃO')) {
        const dueDay = settings?.dueDays?.overrides?.[currentMonth]?.[t.paymentMethod] 
                    ?? settings?.dueDays?.default?.[t.paymentMethod] 
                    ?? 10;
        txDay = parseInt(dueDay);
      } else {
        const dateStr = t.originalDate || t.date;
        if (dateStr) {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            txDay = parseInt(parts[2]);
          }
        }
      }

      if (txDay > daysInMonth) txDay = daysInMonth;

      if (txDay === d) {
        if (t.type === 'income') {
          dayIncome += t.amount;
        } else if (t.type === 'expense' && t.category !== 'DÍVIDA DE TERCEIROS') {
          dayExpense += t.amount;
        }
      }
    });

    currentBalance += (dayIncome - dayExpense);

    dailyData.push({
      day: `${d.toString().padStart(2, '0')} ${shortMonth}`,
      dayNum: d,
      saldo: currentBalance,
      receitas: dayIncome,
      despesas: dayExpense
    });
  }

  const [expandedHistory, setExpandedHistory] = useState({});
  const toggleHistory = (catName) => {
    setExpandedHistory(prev => ({ ...prev, [catName]: !prev[catName] }));
  };

  const getCategoryHistory = (categoryName) => {
    const uniqueMonthsSet = new Set(allTransactions.map(t => getEffectiveMonth(t)).filter(Boolean));
    const uniqueMonths = [...uniqueMonthsSet].sort();
    
    if (uniqueMonths.length === 0) {
      uniqueMonths.push(currentMonth);
    }

    const catLimit = categories.find(c => c.name === categoryName)?.limit || 0;

    return uniqueMonths.map(month => {
      const monthExpenses = allTransactions.filter(t => 
        t.type === 'expense' && 
        t.category === categoryName && 
        getEffectiveMonth(t) === month
      );
      const gasto = monthExpenses.reduce((acc, t) => acc + t.amount, 0);

      const [y, m] = month.split('-');
      const monthNamesShort = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
      const label = `${monthNamesShort[parseInt(m, 10) - 1]}/${y.substring(2)}`;

      return {
        monthRaw: month,
        label,
        gasto,
        limite: catLimit
      };
    });
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <PieChartIcon size={20} className="text-muted" />
            <h3>Resumo das Categorias</h3>
          </div>
          <button 
            className="btn btn-secondary flex items-center gap-2" 
            onClick={() => setIsCategoryModalOpen(true)}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
          >
            <SettingsIcon size={16} /> Gerenciar
          </button>
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

      {/* Gráfico de Despesas */}
      {chartData.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="flex items-center gap-2 mb-6" style={{ alignSelf: 'flex-start' }}>
            <PieChartIcon size={20} className="text-muted" />
            <h3>Saídas por categoria</h3>
          </div>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={renderCustomizedLabel}
                  innerRadius="50%"
                  outerRadius="80%"
                  fill="#8884d8"
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '14px', paddingLeft: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Histórico das categorias */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="flex items-center gap-2 mb-6">
          <PieChartIcon size={20} className="text-muted" />
          <h3>Histórico das categorias</h3>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {categories.map(cat => {
            const isExpanded = !!expandedHistory[cat.name];
            let historyData = [];
            if (isExpanded) {
              historyData = getCategoryHistory(cat.name);
            }
            
            return (
              <div key={cat.name} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <div 
                  onClick={() => toggleHistory(cat.name)}
                  style={{ 
                    padding: '1rem', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    cursor: 'pointer',
                    backgroundColor: 'var(--bg-secondary)',
                    fontWeight: '600'
                  }}
                >
                  <span>{cat.name}</span>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
                {isExpanded && (
                  <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-main)', borderTop: '1px solid var(--border-color)' }}>
                    <div style={{ width: '100%', height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} tickMargin={10} />
                          <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(val) => `R$ ${val}`} width={80} />
                          <Tooltip 
                            formatter={(value, name) => [formatCurrency(value), name === 'gasto' ? 'Gasto Real' : 'Limite']}
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="limite" name="Limite Máx" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                          <Line type="monotone" dataKey="gasto" name="Gasto Real" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Gráfico de Projeção de Saldo Diário */}
      {dailyData.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ marginBottom: '1.5rem', alignSelf: 'center' }}>Projeção para os próximos dias</h3>
          <div style={{ width: '100%', height: 400 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSaldo" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0088FE" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#0088FE" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color, rgba(255,255,255,0.1))" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12, fill: 'var(--text-muted, #888)' }} 
                  axisLine={false} 
                  tickLine={false} 
                  dy={10} 
                  interval="preserveStartEnd"
                  minTickGap={20}
                />
                <YAxis 
                  orientation="right" 
                  tick={{ fontSize: 12, fill: 'var(--text-muted, #888)' }} 
                  axisLine={false} 
                  tickLine={false} 
                  dx={10}
                  tickFormatter={(val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val)}
                />
                <Tooltip content={<AreaTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="saldo" 
                  stroke="#0088FE" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSaldo)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', gap: '20px', marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted, #888)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#0088FE', borderRadius: '50%' }}></span>
              Saldo
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#00C49F', borderRadius: '50%' }}></span>
              Contas a receber
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: '#FF8042', borderRadius: '50%' }}></span>
              Contas a pagar
            </div>
          </div>
        </div>
      )}

      {isCategoryModalOpen && (
        <CategoryManagerModal onClose={() => setIsCategoryModalOpen(false)} />
      )}
    </div>
  );
};

export default Dashboard;
