import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { format, parseISO, addMonths, subMonths, isBefore } from 'date-fns';
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
      initialBalance: 0,
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

  const editFixedExpense = (id, updatedExpense) => {
    updateSettings({
      fixedExpenses: (settings.fixedExpenses || []).map(e => e.id === id ? { ...e, ...updatedExpense } : e)
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

  const editTransaction = (id, updatedData) => {
    setTransactions((prev) => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          ...updatedData,
          amount: parseFloat(updatedData.amount) || t.amount
        };
      }
      return t;
    }));
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
    let mDate = subMonths(parseISO(`${settings.appStartDate || '2026-09'}-01`), 1);
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
    let accBalance = parseFloat(settings.initialBalance || 0);
    allTransactions.forEach(t => {
      const effMonth = getEffectiveMonth(t);
      if (effMonth < currentMonth && effMonth >= settings.appStartDate) {
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

  useEffect(() => {
    const imported = localStorage.getItem('@ControleFinanceiro:importedOct2026');
    if (!imported) {
      const items = [
        { desc: "VIAGEM 30 ANOS", cat: "LAZER", parcels: 4, val: 1303.58 },
        { desc: "ADAPTA (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", parcels: 4, val: 99.00 },
        { desc: "ÔMEGA GABRIELA", cat: "SAÚDE", parcels: 3, val: 112.00 },
        { desc: "CLUBE SMILES (ANA PAULA)", cat: "DÍVIDA DE TERCEIROS", parcels: 10, val: 77.90 },
        { desc: "COISAS DE CASA", cat: "CASA", parcels: 2, val: 211.80 },
        { desc: "WHEY PROTEIN", cat: "SAÚDE", parcels: 1, val: 209.94 },
        { desc: "PRESENTES CLAUDIA, ANA PAULA E PRI", cat: "PRESENTE", parcels: 1, val: 239.98 },
        { desc: "CAMISAS LUCAS", cat: "DÍVIDA DE TERCEIROS", parcels: 3, val: 74.40 },
        { desc: "LUZES GABRIELA", cat: "PRESENTE", parcels: 1, val: 469.00 },
        { desc: "REMÉDIO LAIKA", cat: "DÍVIDA DE TERCEIROS", parcels: 1, val: 124.00 },
        { desc: "OBRA (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", parcels: 1, val: 523.30 },
        { desc: "PASSAGENS (VICTOR)", cat: "DÍVIDA DE TERCEIROS", parcels: 3, val: 1025.44 },
        { desc: "PRESENTE LÚCIO (ANA PAULA)", cat: "DÍVIDA DE TERCEIROS", parcels: 1, val: 63.00 },
        { desc: "PRESENTE LUCAS", cat: "PRESENTE", parcels: 1, val: 79.90 },
        { desc: "PRESENTE DA ANA PAULA", cat: "PRESENTE", parcels: 1, val: 80.00 },
        { desc: "POTE DE MELANCIA", cat: "CASA", parcels: 1, val: 135.99 }
      ];

      const baseDate = "2026-09-15"; // Fatura fecha em 1, então 15/09 vai para fatura de Outubro
      const newTx = [];
      
      items.forEach(item => {
        const groupId = item.parcels > 1 ? uuidv4() : null;
        for (let i = 0; i < item.parcels; i++) {
          newTx.push({
            id: uuidv4(),
            groupId,
            type: 'expense',
            description: item.parcels > 1 ? `${item.desc} (${i + 1}/${item.parcels})` : item.desc,
            amount: item.val,
            originalDate: baseDate,
            date: baseDate,
            details: 'Importado de Out/2026',
            hasAttachment: false,
            attachmentKey: null,
            category: item.cat,
            paymentMethod: 'CARTÃO SANTANDER',
            source: null,
            installmentsTotal: item.parcels,
            currentInstallment: i + 1
          });
        }
      });

      setTransactions(prev => [...prev, ...newTx]);
      localStorage.setItem('@ControleFinanceiro:importedOct2026', 'true');
    }
  }, []);

  useEffect(() => {
    const importedPart2 = localStorage.getItem('@ControleFinanceiro:importedOct2026_part2');
    if (!importedPart2) {
      const items = [
        { desc: "CADERNO INTELIGENTE", cat: "EDUCAÇÃO", pay: "CARTÃO SANTANDER", parcels: 1, val: 88.79 },
        { desc: "PRESENTE MARINA E RAMON", cat: "PRESENTE", pay: "CARTÃO SANTANDER", parcels: 1, val: 75.75 },
        { desc: "PRESENTE LARISSA", cat: "PRESENTE", pay: "CARTÃO XP", parcels: 1, val: 80.96 },
        { desc: "CALÇAS DO PAULO", cat: "PRESENTE", pay: "CARTÃO XP", parcels: 1, val: 84.95 },
        { desc: "CALÇAS DO PAULO (PRI)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO XP", parcels: 1, val: 84.95 },
        { desc: "MONJOURO (LUCIO)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 2, val: 593.18 },
        { desc: "PAINEL SOLAR (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 13192.00 },
        { desc: "REMÉDIOS LUCAS", cat: "SAÚDE", pay: "CARTÃO SANTANDER", parcels: 1, val: 97.50 },
        { desc: "SEM PARAR (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 200.00 },
        { desc: "MERCADO LIVRE (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 104.98 },
        { desc: "SEM PARAR (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 200.00 },
        { desc: "UBER", cat: "CARRO", pay: "CARTÃO SANTANDER", parcels: 1, val: 16.81 },
        { desc: "BH SUPERMERCADO", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 156.43 },
        { desc: "REMÉDIO GABI", cat: "SAÚDE", pay: "CARTÃO SANTANDER", parcels: 1, val: 159.44 },
        { desc: "UBER", cat: "CARRO", pay: "CARTÃO SANTANDER", parcels: 1, val: 15.21 },
        { desc: "GASOLINA C4", cat: "CARRO", pay: "CARTÃO SANTANDER", parcels: 1, val: 258.22 }
      ];

      const baseDate = "2026-09-15"; // Fatura fecha em 1, então 15/09 vai para fatura de Outubro
      const newTx = [];
      
      items.forEach(item => {
        const groupId = item.parcels > 1 ? uuidv4() : null;
        for (let i = 0; i < item.parcels; i++) {
          newTx.push({
            id: uuidv4(),
            groupId,
            type: 'expense',
            description: item.parcels > 1 ? `${item.desc} (${i + 1}/${item.parcels})` : item.desc,
            amount: item.val,
            originalDate: baseDate,
            date: baseDate,
            details: 'Importado de Out/2026 (Parte 2)',
            hasAttachment: false,
            attachmentKey: null,
            category: item.cat,
            paymentMethod: item.pay,
            source: null,
            installmentsTotal: item.parcels,
            currentInstallment: i + 1
          });
        }
      });

      setTransactions(prev => [...prev, ...newTx]);
      localStorage.setItem('@ControleFinanceiro:importedOct2026_part2', 'true');
    }
  }, []);

  useEffect(() => {
    const importedPart3 = localStorage.getItem('@ControleFinanceiro:importedOct2026_part3');
    if (!importedPart3) {
      const items = [
        { desc: "WHEY + SUPER COFFE + OMEGA", cat: "SAÚDE", pay: "CARTÃO SANTANDER", parcels: 3, val: 470.62 },
        { desc: "FONE GABI", cat: "MESADA GABRIELA", pay: "CARTÃO SANTANDER", parcels: 1, val: 63.00 },
        { desc: "QUADRO GABI", cat: "EDUCAÇÃO", pay: "CARTÃO SANTANDER", parcels: 1, val: 74.50 },
        { desc: "SR A GRANEL", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 44.35 },
        { desc: "RELICÁRIO", cat: "MESADA GABRIELA", pay: "CARTÃO SANTANDER", parcels: 1, val: 26.00 },
        { desc: "RAÇÃO MADALENA", cat: "CACHORROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 67.90 },
        { desc: "GASOLINA C4", cat: "CARRO", pay: "CARTÃO SANTANDER", parcels: 1, val: 50.00 },
        { desc: "BH SUPERMERCADO", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 1405.54 },
        { desc: "PASTAS GABI", cat: "EDUCAÇÃO", pay: "CARTÃO SANTANDER", parcels: 1, val: 33.48 },
        { desc: "TECLADO + CANETA + MESA", cat: "EDUCAÇÃO", pay: "CARTÃO SANTANDER", parcels: 2, val: 299.69 },
        { desc: "ALMOÇO GABI E ANA PAULA", cat: "LAZER", pay: "CARTÃO SANTANDER", parcels: 1, val: 143.53 },
        { desc: "FESTA ALEMÃ", cat: "LAZER", pay: "CARTÃO SANTANDER", parcels: 1, val: 112.00 },
        { desc: "TIA NILZA (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 148.00 },
        { desc: "CASARÃO", cat: "LAZER", pay: "CARTÃO SANTANDER", parcels: 1, val: 71.06 },
        { desc: "ASSAÍ", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 183.64 },
        { desc: "IRMÃOS PEROBELI (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 47.00 }
      ];

      const baseDate = "2026-09-15"; // Fatura fecha em 1, então 15/09 vai para fatura de Outubro
      const newTx = [];
      
      items.forEach(item => {
        const groupId = item.parcels > 1 ? uuidv4() : null;
        for (let i = 0; i < item.parcels; i++) {
          newTx.push({
            id: uuidv4(),
            groupId,
            type: 'expense',
            description: item.parcels > 1 ? `${item.desc} (${i + 1}/${item.parcels})` : item.desc,
            amount: item.val,
            originalDate: baseDate,
            date: baseDate,
            details: 'Importado de Out/2026 (Parte 3)',
            hasAttachment: false,
            attachmentKey: null,
            category: item.cat,
            paymentMethod: item.pay,
            source: null,
            installmentsTotal: item.parcels,
            currentInstallment: i + 1
          });
        }
      });

      setTransactions(prev => [...prev, ...newTx]);
      localStorage.setItem('@ControleFinanceiro:importedOct2026_part3', 'true');
    }
  }, []);

  useEffect(() => {
    const importedPart4 = localStorage.getItem('@ControleFinanceiro:importedOct2026_part4');
    if (!importedPart4) {
      const items = [
        { desc: "HL PNEUS (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 6, val: 354.70 },
        { desc: "FARMÁCIA", cat: "SAÚDE", pay: "CARTÃO SANTANDER", parcels: 1, val: 15.48 },
        { desc: "LANCHE GABRIELA", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 26.00 },
        { desc: "*JIM.COM MAURICEA*", cat: "OUTROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 78.90 },
        { desc: "ASSAÍ", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 64.58 },
        { desc: "LANCHE GABRIELA", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 22.90 },
        { desc: "MEU ASSESSOR (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 12, val: 20.93 },
        { desc: "SHOPEE (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 11.56 },
        { desc: "ENGATE RÁPIDO (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 3, val: 31.94 },
        { desc: "COPO STANLEY GABI", cat: "PRESENTE", pay: "CARTÃO SANTANDER", parcels: 1, val: 101.45 },
        { desc: "SHEIN (PRESENTE GABI DE 3 ANOS)", cat: "PRESENTE", pay: "CARTÃO SANTANDER", parcels: 1, val: 363.35 },
        { desc: "ROUPAS DO FUBÁ", cat: "CACHORROS", pay: "CARTÃO SANTANDER", parcels: 2, val: 81.25 },
        { desc: "SEM PARAR (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 200.00 },
        { desc: "UBER GABI", cat: "CARRO", pay: "CARTÃO SANTANDER", parcels: 1, val: 28.91 },
        { desc: "ÓLEOS DO CAMINHÃO (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 4, val: 95.97 },
        { desc: "PALESTRA GABI", cat: "EDUCAÇÃO", pay: "CARTÃO SANTANDER", parcels: 1, val: 55.00 }
      ];

      const baseDate = "2026-09-15"; // Fatura fecha em 1, então 15/09 vai para fatura de Outubro
      const newTx = [];
      
      items.forEach(item => {
        const groupId = item.parcels > 1 ? uuidv4() : null;
        for (let i = 0; i < item.parcels; i++) {
          newTx.push({
            id: uuidv4(),
            groupId,
            type: 'expense',
            description: item.parcels > 1 ? `${item.desc} (${i + 1}/${item.parcels})` : item.desc,
            amount: item.val,
            originalDate: baseDate,
            date: baseDate,
            details: 'Importado de Out/2026 (Parte 4)',
            hasAttachment: false,
            attachmentKey: null,
            category: item.cat,
            paymentMethod: item.pay,
            source: null,
            installmentsTotal: item.parcels,
            currentInstallment: i + 1
          });
        }
      });

      setTransactions(prev => [...prev, ...newTx]);
      localStorage.setItem('@ControleFinanceiro:importedOct2026_part4', 'true');
    }
  }, []);

  useEffect(() => {
    const importedPart5 = localStorage.getItem('@ControleFinanceiro:importedOct2026_part5');
    if (!importedPart5) {
      const items = [
        { desc: "REGISTROS DOS CONTAINERS (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 2, val: 70.00 },
        { desc: "SEM PARAR (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 200.00 },
        { desc: "FRETE ZÉ DELIVERY", cat: "LAZER", pay: "CARTÃO SANTANDER", parcels: 1, val: 7.99 },
        { desc: "ANTENA TV (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 22.90 },
        { desc: "UBER GABI", cat: "CARRO", pay: "CARTÃO SANTANDER", parcels: 1, val: 32.86 },
        { desc: "LÂMPADA CAMINHÃO (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 16.00 },
        { desc: "ROLAMENTOS CAMINHÃO (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 189.99 }
      ];

      const baseDate = "2026-09-15"; // Fatura fecha em 1, então 15/09 vai para fatura de Outubro
      const newTx = [];
      
      items.forEach(item => {
        const groupId = item.parcels > 1 ? uuidv4() : null;
        for (let i = 0; i < item.parcels; i++) {
          newTx.push({
            id: uuidv4(),
            groupId,
            type: 'expense',
            description: item.parcels > 1 ? `${item.desc} (${i + 1}/${item.parcels})` : item.desc,
            amount: item.val,
            originalDate: baseDate,
            date: baseDate,
            details: 'Importado de Out/2026 (Parte 5)',
            hasAttachment: false,
            attachmentKey: null,
            category: item.cat,
            paymentMethod: item.pay,
            source: null,
            installmentsTotal: item.parcels,
            currentInstallment: i + 1
          });
        }
      });

      setTransactions(prev => [...prev, ...newTx]);
      localStorage.setItem('@ControleFinanceiro:importedOct2026_part5', 'true');
    }
  }, []);

  useEffect(() => {
    const adjustedInitialBalance = localStorage.getItem('@ControleFinanceiro:adjustedInitialBalance_Oct');
    if (!adjustedInitialBalance) {
      updateSettings({
        appStartDate: '2026-10',
        initialBalance: -3886.71
      });
      localStorage.setItem('@ControleFinanceiro:adjustedInitialBalance_Oct', 'true');
    }
  }, []);

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
        editTransaction,
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
        editFixedExpense,
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
