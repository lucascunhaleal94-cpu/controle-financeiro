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

const DEFAULT_PAYMENT_METHODS = [
  'DINHEIRO/PIX',
  'CARTÃO SANTANDER',
  'CARTÃO NUBANK',
  'CARTÃO ITAÚ',
  'CARTÃO XP'
];

export const INCOME_SOURCES = ['LUCAS', 'GABRIELA'];

export const useTransactions = () => useContext(TransactionsContext);

export const TransactionsProvider = ({ children, currentUser }) => {
  const getStorageKey = (key) => `@ControleFinanceiro_${currentUser.id}:${key}`;
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem(getStorageKey('transactions'));
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

    const saved = localStorage.getItem(getStorageKey('settings'));
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
    const saved = localStorage.getItem(getStorageKey('paidItems'));
    if (saved) return JSON.parse(saved);
    return {};
  });

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem(getStorageKey('categories'));
    if (saved) return JSON.parse(saved);
    return CATEGORIES;
  });

  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));

  const [paymentMethods, setPaymentMethods] = useState(() => {
    const saved = localStorage.getItem(getStorageKey('paymentMethods'));
    if (saved) return JSON.parse(saved);
    return DEFAULT_PAYMENT_METHODS;
  });

  useEffect(() => {
    localStorage.setItem(getStorageKey('paymentMethods'), JSON.stringify(paymentMethods));
  }, [paymentMethods]);

  const addPaymentMethod = (method) => {
    setPaymentMethods(prev => [...prev, method.toUpperCase()]);
  };

  const updatePaymentMethod = (oldName, newName) => {
    const formattedNewName = newName.toUpperCase();
    setPaymentMethods(prev => prev.map(m => m === oldName ? formattedNewName : m));
    
    setTransactions(prev => prev.map(t => t.paymentMethod === oldName ? { ...t, paymentMethod: formattedNewName } : t));
    
    setSettings(prev => {
       let newSettings = JSON.parse(JSON.stringify(prev));
       
       if (newSettings.closingDays?.default?.[oldName]) {
         newSettings.closingDays.default[formattedNewName] = newSettings.closingDays.default[oldName];
         delete newSettings.closingDays.default[oldName];
       }
       if (newSettings.closingDays?.overrides) {
         Object.keys(newSettings.closingDays.overrides).forEach(month => {
           if (newSettings.closingDays.overrides[month]?.[oldName]) {
             newSettings.closingDays.overrides[month][formattedNewName] = newSettings.closingDays.overrides[month][oldName];
             delete newSettings.closingDays.overrides[month][oldName];
           }
         });
       }

       if (newSettings.dueDays?.default?.[oldName]) {
         newSettings.dueDays.default[formattedNewName] = newSettings.dueDays.default[oldName];
         delete newSettings.dueDays.default[oldName];
       }
       if (newSettings.dueDays?.overrides) {
         Object.keys(newSettings.dueDays.overrides).forEach(month => {
           if (newSettings.dueDays.overrides[month]?.[oldName]) {
             newSettings.dueDays.overrides[month][formattedNewName] = newSettings.dueDays.overrides[month][oldName];
             delete newSettings.dueDays.overrides[month][oldName];
           }
         });
       }

       if (newSettings.fixedExpenses) {
         newSettings.fixedExpenses = newSettings.fixedExpenses.map(fe => 
           fe.paymentMethod === oldName ? { ...fe, paymentMethod: formattedNewName } : fe
         );
       }
       
       return newSettings;
    });
  };

  const deletePaymentMethod = (method, action = 'migrate', targetMethod = null) => {
    if (action === 'delete') {
      setTransactions(prev => prev.filter(t => t.paymentMethod !== method));
      setSettings(prev => ({
        ...prev,
        fixedExpenses: (prev.fixedExpenses || []).filter(fe => fe.paymentMethod !== method)
      }));
    } else if (action === 'migrate' && targetMethod) {
      setTransactions(prev => prev.map(t => t.paymentMethod === method ? { ...t, paymentMethod: targetMethod } : t));
      setSettings(prev => ({
        ...prev,
        fixedExpenses: (prev.fixedExpenses || []).map(fe => fe.paymentMethod === method ? { ...fe, paymentMethod: targetMethod } : fe)
      }));
    }
    
    setPaymentMethods(prev => prev.filter(m => m !== method));
    
    setSettings(prev => {
       let newSettings = JSON.parse(JSON.stringify(prev));
       if (newSettings.closingDays?.default) delete newSettings.closingDays.default[method];
       if (newSettings.dueDays?.default) delete newSettings.dueDays.default[method];
       if (newSettings.closingDays?.overrides) {
         Object.keys(newSettings.closingDays.overrides).forEach(month => {
           if (newSettings.closingDays.overrides[month]) delete newSettings.closingDays.overrides[month][method];
         });
       }
       if (newSettings.dueDays?.overrides) {
         Object.keys(newSettings.dueDays.overrides).forEach(month => {
           if (newSettings.dueDays.overrides[month]) delete newSettings.dueDays.overrides[month][method];
         });
       }
       return newSettings;
    });
  };


  useEffect(() => {
    localStorage.setItem(getStorageKey('transactions'), JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('categories'), JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('settings'), JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(getStorageKey('paidItems'), JSON.stringify(paidItems));
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

  const addCategory = (categoryData) => {
    setCategories(prev => [...prev, { name: categoryData.name.toUpperCase(), limit: parseFloat(categoryData.limit) || 0 }]);
  };

  const updateCategory = (oldName, newName, newLimit) => {
    const formattedNewName = newName.toUpperCase();
    setCategories(prev => prev.map(c => c.name === oldName ? { name: formattedNewName, limit: parseFloat(newLimit) || 0 } : c));
    
    if (oldName !== formattedNewName) {
      setTransactions(prev => prev.map(t => t.category === oldName ? { ...t, category: formattedNewName } : t));
      
      // Update fixed expenses categories
      setSettings(prev => ({
        ...prev,
        fixedExpenses: (prev.fixedExpenses || []).map(fe => fe.category === oldName ? { ...fe, category: formattedNewName } : fe)
      }));
    }
  };

  const deleteCategory = (name, substituteCategoryName = null) => {
    if (substituteCategoryName) {
      setTransactions(prev => prev.map(t => t.category === name ? { ...t, category: substituteCategoryName } : t));
      
      // Update fixed expenses categories
      setSettings(prev => ({
        ...prev,
        fixedExpenses: (prev.fixedExpenses || []).map(fe => fe.category === name ? { ...fe, category: substituteCategoryName } : fe)
      }));
    } else {
      setTransactions(prev => prev.filter(t => t.category !== name));
      
      // Delete fixed expenses tied to this category
      setSettings(prev => ({
        ...prev,
        fixedExpenses: (prev.fixedExpenses || []).filter(fe => fe.category !== name)
      }));
    }
    setCategories(prev => prev.filter(c => c.name !== name));
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

  const updateFixedExpenseOverride = (baseId, month, overrideData) => {
    const currentOverrides = settings.fixedExpensesOverrides || {};
    const expenseOverrides = currentOverrides[baseId] || {};
    
    let updatedMonthData;
    if (typeof overrideData === 'object') {
      const existing = expenseOverrides[month];
      updatedMonthData = {
        ...(typeof existing === 'object' ? existing : { amount: existing }),
        ...overrideData
      };
    } else {
      updatedMonthData = overrideData;
    }

    updateSettings({
      fixedExpensesOverrides: {
        ...currentOverrides,
        [baseId]: {
          ...expenseOverrides,
          [month]: updatedMonthData
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

  const deleteTransaction = (id, mode = 'all') => {
    const txToDelete = transactions.find(t => t.id === id);
    if (!txToDelete) return;

    if (txToDelete.hasAttachment && txToDelete.attachmentKey && mode === 'all') {
      del(txToDelete.attachmentKey).catch(console.error);
    }

    if (txToDelete.groupId) {
      if (mode === 'single') {
        setTransactions((prev) => prev.filter((t) => t.id !== id));
      } else if (mode === 'subsequent') {
        setTransactions((prev) => prev.filter((t) => !(t.groupId === txToDelete.groupId && t.currentInstallment >= txToDelete.currentInstallment)));
      } else {
        setTransactions((prev) => prev.filter((t) => t.groupId !== txToDelete.groupId));
      }
    } else {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    }
  };

  const editTransaction = (id, updatedData, mode = 'single') => {
    const txToEdit = transactions.find(t => t.id === id);
    if (!txToEdit) return;

    setTransactions((prev) => prev.map(t => {
      // Current transaction
      if (t.id === id) {
        return {
          ...t,
          ...updatedData,
          amount: parseFloat(updatedData.amount) || t.amount
        };
      }
      
      // Subsequent or all transactions in the same group
      if (txToEdit.groupId && t.groupId === txToEdit.groupId) {
        if (mode === 'all' || (mode === 'subsequent' && t.currentInstallment > txToEdit.currentInstallment)) {
          const cleanDesc = updatedData.description ? updatedData.description.replace(/\s\(\d+\/\d+\)$/, '') : t.description;
          return {
            ...t,
            ...updatedData,
            id: t.id,
            amount: parseFloat(updatedData.amount) || t.amount,
            currentInstallment: t.currentInstallment,
            installmentsTotal: t.installmentsTotal,
            description: `${cleanDesc} (${t.currentInstallment}/${t.installmentsTotal})`
          };
        }
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
          const override = settings.fixedExpensesOverrides?.[fe.id]?.[mStr];
          const isObj = override !== null && typeof override === 'object';
          
          let overrideAmount = isObj ? override.amount : override;
          const finalAmount = overrideAmount !== undefined && overrideAmount !== '' 
                              ? parseFloat(overrideAmount) 
                              : parseFloat(fe.amount);

          if (finalAmount > 0) {
            const dayStr = String(fe.dueDate).padStart(2, '0');
            const defaultDate = `${mStr}-${dayStr}`;
            
            const originalDate = isObj && override.date ? override.date : defaultDate;
            const finalDesc = isObj && override.description ? override.description : fe.description + ' (Fixo)';
            const finalCat = isObj && override.category ? override.category : fe.category;
            const finalPay = isObj && override.paymentMethod ? override.paymentMethod : fe.paymentMethod;

            virtuals.push({
              id: `fixed-expense-${fe.id}-${mStr}`,
              baseId: fe.id,
              overrideMonth: mStr,
              type: 'expense',
              description: finalDesc,
              amount: finalAmount,
              originalDate,
              date: originalDate,
              category: finalCat,
              paymentMethod: finalPay,
              source: null,
              isFixedExpense: true,
              hasAttachment: false,
              installmentsTotal: 1,
              currentInstallment: 1
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

  const expensesByCategory = categories.map((cat) => {
    const catTransactions = allExpenses.filter((t) => t.category === cat.name);
    const spent = catTransactions.reduce((acc, t) => acc + t.amount, 0);
    return {
      ...cat,
      spent,
      percentage: cat.limit > 0 ? (spent / cat.limit) * 100 : 0,
      transactions: catTransactions
    };
  });

  const expensesByPaymentMethod = paymentMethods.map((method) => {
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
    if (currentUser?.email !== 'lucas@admin.com') return;
    const imported = localStorage.getItem(getStorageKey('importedOct2026'));
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
      localStorage.setItem(getStorageKey('importedOct2026'), 'true');
    }
  }, []);

  useEffect(() => {
    if (currentUser?.email !== 'lucas@admin.com') return;
    const importedPart2 = localStorage.getItem(getStorageKey('importedOct2026_part2'));
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
      localStorage.setItem(getStorageKey('importedOct2026_part2'), 'true');
    }
  }, []);

  useEffect(() => {
    if (currentUser?.email !== 'lucas@admin.com') return;
    const importedPart3 = localStorage.getItem(getStorageKey('importedOct2026_part3'));
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
      localStorage.setItem(getStorageKey('importedOct2026_part3'), 'true');
    }
  }, []);

  useEffect(() => {
    if (currentUser?.email !== 'lucas@admin.com') return;
    const importedPart4 = localStorage.getItem(getStorageKey('importedOct2026_part4'));
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
      localStorage.setItem(getStorageKey('importedOct2026_part4'), 'true');
    }
  }, []);

  useEffect(() => {
    if (currentUser?.email !== 'lucas@admin.com') return;
    const importedPart5 = localStorage.getItem(getStorageKey('importedOct2026_part5'));
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
      localStorage.setItem(getStorageKey('importedOct2026_part5'), 'true');
    }
  }, []);

  useEffect(() => {
    if (currentUser?.email !== 'lucas@admin.com') return;
    const adjustedInitialBalance = localStorage.getItem(getStorageKey('adjustedInitialBalance_Oct'));
    if (!adjustedInitialBalance) {
      updateSettings({
        appStartDate: '2026-10',
        initialBalance: -3886.71
      });
      localStorage.setItem(getStorageKey('adjustedInitialBalance_Oct'), 'true');
    }
  }, []);

  useEffect(() => {
    if (currentUser?.email !== 'lucas@admin.com') return;
    const importedPart6 = localStorage.getItem(getStorageKey('importedOct2026_part6'));
    if (!importedPart6) {
      const items = [
        { desc: "ROLAMENTOS CAMINHÃO (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 3, val: 63.33 },
        { desc: "FARMÁCIA", cat: "SAÚDE", pay: "CARTÃO SANTANDER", parcels: 1, val: 15.48 },
        { desc: "GASOLINA POLO (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 100.00 },
        { desc: "ASSAÍ", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 36.97 },
        { desc: "CHIMARRON", cat: "LAZER", pay: "CARTÃO SANTANDER", parcels: 1, val: 364.21 },
        { desc: "OPEN AI (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 96.99 },
        { desc: "SEM PARAR (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 200.00 },
        { desc: "MERCADO LIVRE (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 208.00 },
        { desc: "CAMISAS ESCRITÓRIO (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 3, val: 106.60 },
        { desc: "AÇAÍ", cat: "LAZER", pay: "CARTÃO SANTANDER", parcels: 1, val: 55.90 },
        { desc: "ACEITE", cat: "LAZER", pay: "CARTÃO SANTANDER", parcels: 1, val: 115.26 },
        { desc: "VERMÍFUGO", cat: "CACHORROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 19.60 },
        { desc: "SR A GRANEL", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 10.66 },
        { desc: "CAÇULA", cat: "EDUCAÇÃO", pay: "CARTÃO SANTANDER", parcels: 1, val: 9.03 },
        { desc: "SALSA PARRILHA", cat: "MESADA GABRIELA", pay: "CARTÃO SANTANDER", parcels: 1, val: 58.19 },
        { desc: "PADARIA", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 7.56 }
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
            details: 'Importado de Out/2026 (Parte 6)',
            hasAttachment: false,
            attachmentKey: null,
            category: item.cat,
            paymentMethod: item.pay,
            source: '',
            installmentsTotal: item.parcels,
            currentInstallment: i + 1
          });
        }
      });

      setTransactions(prev => [...prev, ...newTx]);
      localStorage.setItem(getStorageKey('importedOct2026_part6'), 'true');
    }
  }, []);

  useEffect(() => {
    if (currentUser?.email !== 'lucas@admin.com') return;
    const importedPart7 = localStorage.getItem(getStorageKey('importedOct2026_part7'));
    if (!importedPart7) {
      const items = [
        { desc: "ANUIDADE DO MY CAPITAL (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 252.90 },
        { desc: "SEM PARAR (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 200.00 },
        { desc: "VENTILADORES (ACQUARELA)", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 989.90 },
        { desc: "GASOLINA C4", cat: "CARRO", pay: "CARTÃO SANTANDER", parcels: 1, val: 100.00 },
        { desc: "SORVETE SOL & NEVE", cat: "MESADA GABRIELA", pay: "CARTÃO SANTANDER", parcels: 1, val: 16.75 },
        { desc: "ALMOÇO GABRIELA", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 21.00 },
        { desc: "SEGURO C4", cat: "CARRO", pay: "CARTÃO SANTANDER", parcels: 1, val: 299.55 },
        { desc: "ACADEMIA GABRIELA", cat: "SAÚDE", pay: "CARTÃO SANTANDER", parcels: 1, val: 129.90 },
        { desc: "ACADEMIA LUCAS", cat: "SAÚDE", pay: "CARTÃO SANTANDER", parcels: 1, val: 149.90 },
        { desc: "MEMÓRIA CELULAR", cat: "OUTROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 19.90 },
        { desc: "TERRA BOA", cat: "MERCADO", pay: "CARTÃO SANTANDER", parcels: 1, val: 39.90 },
        { desc: "CENTRAL GENERICOS", cat: "SAÚDE", pay: "CARTÃO SANTANDER", parcels: 1, val: 30.85 }
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
            details: 'Importado de Out/2026 (Parte 7)',
            hasAttachment: false,
            attachmentKey: null,
            category: item.cat,
            paymentMethod: item.pay,
            source: '',
            installmentsTotal: item.parcels,
            currentInstallment: i + 1
          });
        }
      });

      setTransactions(prev => [...prev, ...newTx]);
      localStorage.setItem(getStorageKey('importedOct2026_part7'), 'true');
    }
  }, []);

  const exportBackup = () => {
    const backup = {
      transactions,
      settings,
      paidItems,
      categories,
      paymentMethods
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_controle_financeiro_${format(new Date(), 'yyyy-MM-dd')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importBackup = (jsonData) => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.transactions) localStorage.setItem(getStorageKey('transactions'), JSON.stringify(parsed.transactions));
      if (parsed.settings) localStorage.setItem(getStorageKey('settings'), JSON.stringify(parsed.settings));
      if (parsed.paidItems) localStorage.setItem(getStorageKey('paidItems'), JSON.stringify(parsed.paidItems));
      if (parsed.categories) localStorage.setItem(getStorageKey('categories'), JSON.stringify(parsed.categories));
      if (parsed.paymentMethods) localStorage.setItem(getStorageKey('paymentMethods'), JSON.stringify(parsed.paymentMethods));
      sessionStorage.setItem('force_cloud_upload', 'true');
      alert('Backup importado com sucesso! A página será recarregada.');
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Erro ao importar backup. Verifique se o arquivo é válido.');
    }
  };

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
        openAttachment,
        categories,
        addCategory,
        updateCategory,
        deleteCategory,
        paymentMethods,
        addPaymentMethod,
        updatePaymentMethod,
        deletePaymentMethod,
        exportBackup,
        importBackup
      }}
    >
      {children}
    </TransactionsContext.Provider>
  );
};
