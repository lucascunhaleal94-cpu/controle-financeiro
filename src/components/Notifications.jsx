import React, { useState, useEffect, useRef } from 'react';
import { useTransactions, PAYMENT_METHODS } from '../context/TransactionsContext';
import { Bell, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Notifications = () => {
  const { allTransactions, getEffectiveMonth, paidItems, togglePaidStatus, settings } = useTransactions();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const today = startOfDay(new Date());
    const notifs = [];

    // 1. Processar Despesas Fixas Recorrentes
    const fixedExpenses = allTransactions.filter(t => t.isFixedExpense);
    fixedExpenses.forEach(fe => {
      const monthStr = fe.overrideMonth;
      const isPaid = paidItems[monthStr]?.[fe.baseId];
      
      if (!isPaid) {
        const dueDate = parseISO(fe.date);
        const diff = differenceInDays(dueDate, today);
        
        if (diff <= 2) {
          notifs.push({
            id: `notif-fe-${fe.baseId}-${monthStr}`,
            title: fe.description,
            monthStr,
            itemId: fe.baseId,
            type: 'fixed_expense',
            amount: fe.amount,
            dueDate,
            diff,
            isLate: diff < 0
          });
        }
      }
    });

    // 2. Processar Faturas de Cartão de Crédito
    // Agrupar despesas por cartão e mês efetivo
    const cardExpenses = allTransactions.filter(t => t.type === 'expense' && !t.isFixedExpense && t.paymentMethod?.startsWith('CARTÃO'));
    
    const invoices = {}; // { '2026-09': { 'CARTÃO NUBANK': 1500 } }
    
    cardExpenses.forEach(t => {
      const effMonth = getEffectiveMonth(t);
      if (!invoices[effMonth]) invoices[effMonth] = {};
      if (!invoices[effMonth][t.paymentMethod]) invoices[effMonth][t.paymentMethod] = 0;
      invoices[effMonth][t.paymentMethod] += t.amount;
    });

    Object.keys(invoices).forEach(effMonth => {
      Object.keys(invoices[effMonth]).forEach(card => {
        const amount = invoices[effMonth][card];
        const isPaid = paidItems[effMonth]?.[card];
        
        if (!isPaid && amount > 0) {
          const dueDay = settings.dueDays?.overrides?.[effMonth]?.[card] 
                      ?? settings.dueDays?.default?.[card] 
                      ?? 10;
          
          const dueDayStr = String(dueDay).padStart(2, '0');
          const dueDate = parseISO(`${effMonth}-${dueDayStr}`);
          const diff = differenceInDays(dueDate, today);

          if (diff <= 2) {
            notifs.push({
              id: `notif-card-${card}-${effMonth}`,
              title: `Fatura ${card}`,
              monthStr: effMonth,
              itemId: card,
              type: 'credit_card',
              amount,
              dueDate,
              diff,
              isLate: diff < 0
            });
          }
        }
      });
    });

    // Ordenar: mais atrasados/urgentes primeiro
    notifs.sort((a, b) => a.diff - b.diff);
    setNotifications(notifs);

  }, [allTransactions, paidItems, settings, getEffectiveMonth]);

  const handleMarkAsPaid = (monthStr, itemId) => {
    togglePaidStatus(monthStr, itemId);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button 
        className="btn btn-outline" 
        style={{ position: 'relative', padding: '0.5rem', border: 'none', background: 'transparent' }}
        onClick={() => setIsOpen(!isOpen)}
        title="Notificações"
      >
        <Bell size={24} color="var(--text-main)" />
        {notifications.length > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '4px',
            background: 'var(--expense-color)', color: 'white',
            borderRadius: '50%', width: '18px', height: '18px',
            fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 'bold'
          }}>
            {notifications.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', right: '0',
          width: '350px', background: 'var(--surface-color)',
          border: '1px solid var(--border-color)', borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 1000,
          marginTop: '0.5rem', maxHeight: '500px', overflowY: 'auto'
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold' }}>
            Notificações e Vencimentos
          </div>
          
          {notifications.length === 0 ? (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Nenhum vencimento próximo. Tudo em dia! 🎉
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {notifications.map(n => {
                const isUrgent = n.diff <= 0;
                return (
                  <div key={n.id} style={{
                    padding: '1rem', borderBottom: '1px solid var(--border-color)',
                    borderLeft: `4px solid ${isUrgent ? 'var(--expense-color)' : 'var(--warning-color)'}`,
                    background: isUrgent ? 'rgba(239, 68, 68, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                    display: 'flex', flexDirection: 'column', gap: '0.5rem'
                  }}>
                    <div className="flex justify-between items-start">
                      <div style={{ fontWeight: '600' }}>
                        {isUrgent ? <AlertCircle size={14} className="inline mr-1 text-expense" /> : <AlertTriangle size={14} className="inline mr-1 text-warning" />}
                        {n.title}
                      </div>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>
                        {formatCurrency(n.amount)}
                      </div>
                    </div>
                    
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Vencimento: {format(n.dueDate, "dd/MM/yyyy")} ({format(parseISO(`${n.monthStr}-01`), "MMM/yyyy", { locale: ptBR })})
                      <br/>
                      <span style={{ color: isUrgent ? 'var(--expense-color)' : 'var(--warning-color)', fontWeight: '500' }}>
                        {n.diff < 0 ? `Atrasado há ${Math.abs(n.diff)} dia(s)` : n.diff === 0 ? 'Vence HOJE' : `Vence em ${n.diff} dia(s)`}
                      </span>
                    </div>

                    <button 
                      onClick={() => handleMarkAsPaid(n.monthStr, n.itemId)}
                      className="btn" 
                      style={{ 
                        marginTop: '0.5rem', padding: '0.4rem', fontSize: '0.8rem', 
                        background: 'transparent', border: '1px solid var(--income-color)', color: 'var(--income-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                      }}
                    >
                      <CheckCircle2 size={16} /> Marcar como Pago
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;
