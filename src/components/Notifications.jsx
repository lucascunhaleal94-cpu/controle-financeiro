import React, { useState, useEffect, useRef } from 'react';
import { useTransactions } from '../context/TransactionsContext';
import { Bell, CheckCircle2, AlertTriangle, AlertCircle, BellOff, RotateCcw } from 'lucide-react';
import { format, parseISO, differenceInDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Notifications = () => {
  const { 
    allTransactions, 
    getEffectiveMonth, 
    paidItems, 
    togglePaidStatus, 
    settings, 
    ignoreNotification, 
    clearIgnoredNotifications 
  } = useTransactions();
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
    const ignored = settings?.ignoredNotifications || [];

    // 1. Processar Despesas Fixas Recorrentes
    const fixedExpenses = allTransactions.filter(t => t.isFixedExpense);
    fixedExpenses.forEach(fe => {
      const monthStr = fe.overrideMonth;
      const isPaid = paidItems[monthStr]?.[fe.baseId];
      const notifId = `notif-fe-${fe.baseId}-${monthStr}`;
      
      if (!isPaid && !ignored.includes(notifId)) {
        const dueDate = parseISO(fe.date);
        const diff = differenceInDays(dueDate, today);
        
        if (diff <= 2) {
          notifs.push({
            id: notifId,
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
        const notifId = `notif-card-${card}-${effMonth}`;
        
        if (!isPaid && amount > 0 && !ignored.includes(notifId)) {
          const dueDay = settings.dueDays?.overrides?.[effMonth]?.[card] 
                      ?? settings.dueDays?.default?.[card] 
                      ?? 10;
          
          const dueDayStr = String(dueDay).padStart(2, '0');
          const dueDate = parseISO(`${effMonth}-${dueDayStr}`);
          const diff = differenceInDays(dueDate, today);

          if (diff <= 2) {
            notifs.push({
              id: notifId,
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

  const handleIgnore = (e, notifId) => {
    e.stopPropagation();
    ignoreNotification(notifId);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const ignoredCount = settings?.ignoredNotifications?.length || 0;

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
          width: '360px', maxWidth: 'calc(100vw - 2rem)', background: 'var(--surface-color)',
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

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button 
                        onClick={() => handleMarkAsPaid(n.monthStr, n.itemId)}
                        className="btn" 
                        style={{ 
                          flex: 1,
                          padding: '0.45rem', fontSize: '0.8rem', 
                          background: 'transparent', border: '1px solid var(--income-color)', color: 'var(--income-color)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                          borderRadius: '6px', cursor: 'pointer'
                        }}
                      >
                        <CheckCircle2 size={16} /> Marcar como Pago
                      </button>

                      <button 
                        onClick={(e) => handleIgnore(e, n.id)}
                        className="btn btn-outline" 
                        style={{ 
                          padding: '0.45rem 0.75rem', fontSize: '0.8rem', 
                          color: 'var(--text-muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                          borderRadius: '6px', cursor: 'pointer'
                        }}
                        title="Ignorar esta notificação"
                      >
                        <BellOff size={15} /> Ignorar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {ignoredCount > 0 && (
            <div style={{
              padding: '0.65rem 1rem',
              borderTop: '1px solid var(--border-color)',
              background: 'rgba(0, 0, 0, 0.2)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>
                {ignoredCount} notificação(ões) ignorada(s)
              </span>
              <button
                onClick={clearIgnoredNotifications}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  textDecoration: 'underline',
                  padding: 0
                }}
                title="Restaurar todas as notificações ignoradas"
              >
                <RotateCcw size={12} /> Restaurar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Notifications;

