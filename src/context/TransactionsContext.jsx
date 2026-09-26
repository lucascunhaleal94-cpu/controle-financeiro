import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, addMonths, isBefore } from 'date-fns';
import { set, del, get } from 'idb-keyval';

const TransactionsContext = createContext();

export const CATEGORIES = [
  { name: 'LAZER', limit: 1350 },
  { name: 'SAÚDE', limit: 2400 },
  { name: 'CARRO', limit: 800 },
  { name: 'MERCADO', limit: 1500 },
  { name: 'CASA', limit: 1000 },
  { name: 'VESTUÁRIO', limit: 150 },
  { name: 'CACHORROS', limit: 1000 },
  { name: 'OUTROS', limit: 100 },
  { name: 'PRESENTE', limit: 500 },
  { name: 'EDUCAÇÃO', limit: 6000 },
  { name: 'MESADA GABRIELA', limit: 800 },
  { name: 'DÍVIDA DE TERCEIROS', limit: 0 }
];

export const PAYMENT_METHODS = [
  'DINHEIRO/PIX',
  'CARTÃO SANTANDER',
  'CARTÃO NUBANK',
  'CARTÃO ITAÚ',
  'CARTÃO XP'
];

export const INCOME_SOURCES = ['LUCAS', 'GABRIELA'];

export const useTransactions = () => useContext(TransactionsContext);

export const TransactionsProvider = ({ children }) => {
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('@ControleFinanceiro:transactions');
    if (saved) return JSON.parse(saved);
    return [];
  });

  const [settings, setSettings] = useState(() => {
    const defaultSettings = {
      appStartDate: format(new Date(), 'yyyy-MM'),
      fixedIncomes: { LUCAS: 15600, GABRIELA: 0 },
      fixedExpenses: [], 
      fixedExpensesOverrides: {}, 
      closingDays: {
        default: {
          'CARTÃO SANTANDER': 1,
          'CARTÃO NUBANK': 10,
          'CARTÃO ITAÚ': 10,
          'CARTÃO XP': 1
        },
        overrides: {}
      },
      dueDays: {
        default: {
          'CARTÃO SANTANDER': 10,
          'CARTÃO NUBANK': 21,
          'CARTÃO ITAÚ': 21,
          'CARTÃO XP': 10
        },
        overrides: {}
      }
    };

    const saved = localStorage.getItem('@ControleFinanceiro:settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultSettings,
        ...parsed,
        closingDays: {
          ...defaultSettings.closingDays,
          ...(parsed.closingDays || {})
        },
        dueDays: {
          ...defaultSettings.dueDays,
          ...(parsed.dueDays || {})
        }
      };
    }
    return defaultSettings;
  });

  const [paidItems, setPaidItems] = useState(() => {
    const saved = localStorage.getItem('@ControleFinanceiro:paidItems');
    if (saved) return JSON.parse(saved);
    return {};
  });

  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    localStorage.setItem('@ControleFinanceiro:transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('@ControleFinanceiro:settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('@ControleFinanceiro:paidItems', JSON.stringify(paidItems));
  }, [paidItems]);

  const updateSettings = (newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const togglePaidStatus = (month, id) => {
    setPaidItems((prev) => {
      const monthData = prev[month] || {};
      const isCurrentlyPaid = monthData[id];
      return {
        ...prev,
        [month]: {
          ...monthData,
          [id]: !isCurrentlyPaid
        }
      };
    });
  };

  const addFixedExpense = (expense) => {
    updateSettings({
      fixedExpenses: [...(settings.fixedExpenses || []), { id: uuidv4(), ...expense }]
    });
  };

  const removeFixedExpense = (id) => {
    updateSettings({
      fixedExpenses: (settings.fixedExpenses || []).filter(e => e.id !== id)
    });
  };

  const updateFixedExpenseOverride = (baseId, month, newAmount) => {
    const currentOverrides = settings.fixedExpensesOverrides || {};
    const expenseOverrides = currentOverrides[baseId] || {};
    
    updateSettings({
      fixedExpensesOverrides: {
        ...currentOverrides,
        [baseId]: {
          ...expenseOverrides,
          [month]: newAmount
        }
      }
    });
  };

  const getEffectiveMonth = (t) => {
    const baseDate = t.originalDate || t.date;
    if (!baseDate) return currentMonth;
    
    if (t.type === 'income' || !t.paymentMethod?.startsWith('CARTÃO')) {
      return baseDate.substring(0, 7);
    }

    const originalDateObj = parseISO(baseDate);
    const purchaseMonth = format(originalDateObj, 'yyyy-MM');
    const day = originalDateObj.getDate();

    const closingDay = settings.closingDays?.overrides?.[purchaseMonth]?.[t.paymentMethod] 
                    ?? settings.closingDays?.default?.[t.paymentMethod] 
                    ?? 10;

    let effectiveDate = originalDateObj;
    if (day > closingDay) {
      effectiveDate = addMonths(originalDateObj, 1);
    }

    if (t.currentInstallment > 1) {
      effectiveDate = addMonths(effectiveDate, t.currentInstallment - 1);
    }

    return format(effectiveDate, 'yyyy-MM');
  };

  const addTransaction = (transaction) => {
    const amount = parseFloat(transaction.amount);
    const installments = parseInt(transaction.installments) || 1;
    
    const newTransactions = [];
    const groupId = installments > 1 ? uuidv4() : null;
    const parcelAmount = amount / installments;
    
    const attachmentKey = transaction.attachment ? (groupId || uuidv4()) : null;

    if (transaction.attachment && attachmentKey) {
      set(attachmentKey, {
        file: transaction.attachment,
        name: transaction.attachment.name,
        type: transaction.attachment.type
      }).catch(console.error);
    }

    for (let i = 0; i < installments; i++) {
      let description = transaction.description;
      if (installments > 1) {
        description = `${transaction.description} (${i + 1}/${installments})`;
      }

      newTransactions.push({
        id: uuidv4(),
        groupId,
        type: transaction.type,
        description,
        amount: parcelAmount,
        originalDate: transaction.date,
        date: transaction.date,
        details: transaction.details,
        hasAttachment: !!transaction.attachment,
        attachmentKey,
        category: transaction.category,
        paymentMethod: transaction.paymentMethod,
        source: transaction.source,
        installmentsTotal: installments,
        currentInstallment: i + 1
      });
    }

    setTransactions((prev) => [...prev, ...newTransactions]);
  };

  const deleteTransaction = (id) => {
    const txToDelete = transactions.find(t => t.id === id);
    if (!txToDelete) return;

    if (txToDelete.hasAttachment && txToDelete.attachmentKey) {
      del(txToDelete.attachmentKey).catch(console.error);
    }

    if (txToDelete.groupId) {
      setTransactions((prev) => prev.filter((t) => t.groupId !== txToDelete.groupId));
    } else {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const openAttachment = async (attachmentKey) => {
    try {
      const data = await get(attachmentKey);
      if (data && data.file) {
        const url = URL.createObjectURL(data.file);
        window.open(url, '_blank');
      } else {
        alert('Anexo não encontrado.');
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao carregar anexo.');
    }
  };

  const generateVirtualTransactions = () => {
    const virtuals = [];
    let mDate = parseISO(`${settings.appStartDate || '2026-09'}-01`);
    const endObj = addMonths(parseISO(`${currentMonth}-01`), 1);

    while (!isBefore(endObj, mDate)) {
      const mStr = format(mDate, 'yyyy-MM');
      
      if (settings.fixedIncomes?.LUCAS > 0) {
        virtuals.push({
          id: `fixed-lucas-${mStr}`,
          type: 'income',
          description: 'Renda Fixa (Lucas)',
          amount: parseFloat(settings.fixedIncomes.LUCAS),
          originalDate: `${mStr}-01`,
          date: `${mStr}-01`,
          source: 'LUCAS',
          isFixed: true
        });
      }
      if (settings.fixedIncomes?.GABRIELA > 0) {
        virtuals.push({
          id: `fixed-gabriela-${mStr}`,
          type: 'income',
          description: 'Renda Fixa (Gabriela)',
          amount: parseFloat(settings.fixedIncomes.GABRIELA),
          originalDate: `${mStr}-01`,
          date: `${mStr}-01`,
          source: 'GABRIELA',
          isFixed: true
        });
      }

      if (settings.fixedExpenses) {
        settings.fixedExpenses.forEach(fe => {
          const overrideAmount = settings.fixedExpensesOverrides?.[fe.id]?.[mStr];
          const finalAmount = overrideAmount !== undefined && overrideAmount !== '' 
                              ? parseFloat(overrideAmount) 
                              : parseFloat(fe.amount);

          if (finalAmount > 0) {
            const dayStr = String(fe.dueDate).padStart(2, '0');
            const originalDate = `${mStr}-${dayStr}`;

            virtuals.push({
              id: `fixed-expense-${fe.id}-${mStr}`,
              baseId: fe.id,
              overrideMonth: mStr,
              type: 'expense',
              description: fe.description + ' (Fixo)',
              amount: finalAmount,
              originalDate,
              date: originalDate,
              category: fe.category,
              paymentMethod: fe.paymentMethod,
              isFixedExpense: true
            });
          }
        });
      }

      mDate = addMonths(mDate, 1);
    }
    return virtuals;
  };

  const allTransactions = [...transactions, ...generateVirtualTransactions()];

  const currentMonthTransactions = allTransactions.filter((t) => getEffectiveMonth(t) === currentMonth);

  const incomes = currentMonthTransactions.filter((t) => t.type === 'income');
  const allExpenses = currentMonthTransactions.filter((t) => t.type === 'expense');
  
  // SEPARAR DESPESAS PESSOAIS DAS DESPESAS DE TERCEIROS
  const personalExpenses = allExpenses.filter(t => t.category !== 'DÍVIDA DE TERCEIROS');
  const thirdPartyExpenses = allExpenses.filter(t => t.category === 'DÍVIDA DE TERCEIROS');

  const totalIncome = incomes.reduce((acc, t) => acc + t.amount, 0);
  
  // TOTAL DE DESPESAS PESSOAIS APENAS (Para não interferir no Saldo Líquido)
  const totalExpense = personalExpenses.reduce((acc, t) => acc + t.amount, 0);
  
  // TOTAL DE DÍVIDAS DE TERCEIROS (Reembolsos Esperados)
  const thirdPartyDebtTotal = thirdPartyExpenses.reduce((acc, t) => acc + t.amount, 0);

  const monthNet = totalIncome - totalExpense;

  const calculateAccumulatedBalance = () => {
    let accBalance = 0;
    allTransactions.forEach(t => {
      const effMonth = getEffectiveMonth(t);
      if (effMonth < currentMonth) {
        if (t.type === 'income') accBalance += t.amount;
        if (t.type === 'expense' && t.category !== 'DÍVIDA DE TERCEIROS') accBalance -= t.amount;
      }
    });
    return accBalance;
  };

  const accumulatedBalance = calculateAccumulatedBalance();
  const finalBalance = accumulatedBalance + monthNet;

  const expensesByCategory = CATEGORIES.map((cat) => {
    const catTransactions = allExpenses.filter((t) => t.category === cat.name);
    const spent = catTransactions.reduce((acc, t) => acc + t.amount, 0);
    return {
      ...cat,
      spent,
      percentage: cat.limit > 0 ? (spent / cat.limit) * 100 : 0,
      transactions: catTransactions
    };
  });

  const expensesByPaymentMethod = PAYMENT_METHODS.map((method) => {
    // IMPORTANTE: Aqui usamos allExpenses (Pessoais + Terceiros) para que bata com a fatura real
    const spent = allExpenses
      .filter((t) => t.paymentMethod === method)
      .reduce((acc, t) => acc + t.amount, 0);
    return { method, spent };
  });

  const incomesBySource = INCOME_SOURCES.map((source) => {
    const received = incomes
      .filter((t) => t.source === source)
      .reduce((acc, t) => acc + t.amount, 0);
    return { source, received };
  });

  return (
    <TransactionsContext.Provider
      value={{
        transactions,
        allTransactions,
        currentMonthTransactions,
        currentMonth,
        setCurrentMonth,
        addTransaction,
        deleteTransaction,
        totalIncome,
        totalExpense,
        thirdPartyDebtTotal,
        monthNet,
        accumulatedBalance,
        finalBalance,
        expensesByCategory,
        expensesByPaymentMethod,
        incomesBySource,
        settings,
        updateSettings,
        addFixedExpense,
        removeFixedExpense,
        updateFixedExpenseOverride,
        paidItems,
        togglePaidStatus,
        getEffectiveMonth,
        openAttachment
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
};
