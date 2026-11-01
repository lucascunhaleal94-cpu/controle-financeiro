import React, { useEffect, useState, useRef, useCallback } from 'react';
import { v5 as uuidv5 } from 'uuid';
import { supabase } from '../lib/supabase';
import { useTransactions } from '../context/TransactionsContext';

const IMPORT_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const SupabaseSync = ({ currentUser, children }) => {
  const context = useTransactions();
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState(null);
  const contextRef = useRef(context);
  contextRef.current = context;

  const getStorageKey = (key) => `@ControleFinanceiro_${currentUser.id}:${key}`;

  // Helper para mapear camelCase para snake_case
  const mapToDB = (tx) => ({
    id: tx.id,
    user_id: currentUser.id,
    group_id: tx.groupId || null,
    type: tx.type,
    description: tx.description,
    amount: tx.amount,
    date: tx.date,
    original_date: tx.originalDate || tx.date,
    details: tx.details || '',
    category: tx.category || null,
    payment_method: tx.paymentMethod || null,
    installments_total: tx.installmentsTotal || null,
    current_installment: tx.currentInstallment || null,
    source: tx.source || ''
  });

  // Helper para mapear snake_case para camelCase
  const mapToLocal = (tx) => ({
    id: tx.id,
    groupId: tx.group_id,
    type: tx.type,
    description: tx.description,
    amount: Number(tx.amount),
    date: tx.date,
    originalDate: tx.original_date,
    details: tx.details,
    category: tx.category,
    paymentMethod: tx.payment_method,
    installmentsTotal: tx.installments_total,
    currentInstallment: tx.current_installment,
    source: tx.source,
    hasAttachment: false,
    attachmentKey: null
  });

  // Carregamento Inicial
  useEffect(() => {
    const fetchCloudData = async () => {
      try {
        // 1. Tentar puxar dados da nuvem
        const { data: dbSettings } = await supabase.from('user_settings').select('*').eq('user_id', currentUser.id).single();
        const { data: dbTransactions } = await supabase.from('transactions').select('*').eq('user_id', currentUser.id);
        const { data: dbPaidItems } = await supabase.from('paid_items').select('*').eq('user_id', currentUser.id);
        const { data: dbCategories } = await supabase.from('categories').select('*').eq('user_id', currentUser.id);
        const { data: dbPaymentMethods } = await supabase.from('payment_methods').select('*').eq('user_id', currentUser.id);

        // Limpar pendências de exclusão locais que não chegaram na nuvem antes do reload
        let pendingDeletes = [];
        try {
          const rawPending = localStorage.getItem(getStorageKey('pendingDeletes'));
          if (rawPending) pendingDeletes = JSON.parse(rawPending);
        } catch (e) {
          console.error('Erro ao ler pendingDeletes:', e);
        }

        if (Array.isArray(pendingDeletes) && pendingDeletes.length > 0) {
          const { error: delErr } = await supabase
            .from('transactions')
            .delete()
            .eq('user_id', currentUser.id)
            .in('id', pendingDeletes);
          if (!delErr) {
            localStorage.removeItem(getStorageKey('pendingDeletes'));
          }
        }

        const pendingSet = new Set(Array.isArray(pendingDeletes) ? pendingDeletes : []);
        const filteredDbTransactions = (dbTransactions || []).filter(tx => !pendingSet.has(tx.id));

        const rawSettings = dbSettings?.settings || {};
        const importedKeys = rawSettings.importedKeys || [];
        const newlyImportedKeys = [];
        let extraImportedTx = [];

        if (currentUser?.email?.toLowerCase() === 'claudiacunhaleal28@gmail.com') {
          if (!importedKeys.includes('importedNov2026_PauloClaudia_v1') && !localStorage.getItem(getStorageKey('importedNov2026_PauloClaudia_v1'))) {
            const items = [
              { desc: "Revista Oeste Paulo", cat: "LAZER", pay: "CARTÃO SANTANDER", parcels: 6, val: 39.90 },
              { desc: "Zerezes óculos Pri", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 172.90 },
              { desc: "Shopee - Claudia", cat: "OUTROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 145.14 },
              { desc: "Yelumeg-Claudia", cat: "VESTUÁRIO", pay: "CARTÃO SANTANDER", parcels: 1, val: 224.22 },
              { desc: "Presente Lucas-Claudia", cat: "PRESENTE", pay: "CARTÃO SANTANDER", parcels: 2, val: 90.62 },
              { desc: "Shopee Claudia", cat: "OUTROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 145.14 },
              { desc: "Passagem Portugal-Claudia", cat: "LAZER", pay: "CARTÃO SANTANDER", parcels: 6, val: 660.32 },
              { desc: "Revisão Polo", cat: "CARRO", pay: "CARTÃO SANTANDER", parcels: 2, val: 249.86 },
              { desc: "beleza na Web", cat: "OUTROS", pay: "CARTÃO SANTANDER", parcels: 1, val: 86.64 },
              { desc: "Brasil Paralelo", cat: "LAZER", pay: "CARTÃO INTER PAULO", parcels: 4, val: 129.00 },
              { desc: "Drogaria Souza", cat: "SAÚDE", pay: "CARTÃO INTER PAULO", parcels: 1, val: 110.50 },
              { desc: "Central Genéricos", cat: "SAÚDE", pay: "CARTÃO INTER PAULO", parcels: 1, val: 49.99 },
              { desc: "Allianz Seguro", cat: "CARRO", pay: "CARTÃO INTER CLAUDIA", parcels: 7, val: 248.30 },
              { desc: "San Raphael - Meg", cat: "CACHORROS", pay: "CARTÃO INTER CLAUDIA", parcels: 5, val: 329.33 }
            ];

            const baseDate = "2026-11-01";
            items.forEach((item, idx) => {
              const groupId = item.parcels > 1 ? uuidv5(`pc-nov26-grp-${idx}`, IMPORT_NAMESPACE) : null;
              for (let i = 0; i < item.parcels; i++) {
                extraImportedTx.push({
                  id: uuidv5(`pc-nov26-tx-${idx}-${i + 1}`, IMPORT_NAMESPACE),
                  groupId,
                  type: 'expense',
                  description: item.parcels > 1 ? `${item.desc} (${i + 1}/${item.parcels})` : item.desc,
                  amount: item.val,
                  originalDate: baseDate,
                  date: baseDate,
                  details: 'Importado de Nov/2026',
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
            localStorage.setItem(getStorageKey('importedNov2026_PauloClaudia_v1'), 'true');
            newlyImportedKeys.push('importedNov2026_PauloClaudia_v1');
          }

          if (!importedKeys.includes('importedNov2026_PauloClaudia_v2') && !localStorage.getItem(getStorageKey('importedNov2026_PauloClaudia_v2'))) {
            const itemsV2 = [
              { desc: "2 Iphones paulo/Claudia", cat: "OUTROS", pay: "CARTÃO INTER CLAUDIA", parcels: 3, val: 1197.78 },
              { desc: "Duo Gourmet", cat: "LAZER", pay: "CARTÃO INTER CLAUDIA", parcels: 6, val: 59.00 },
              { desc: "Shopee", cat: "OUTROS", pay: "CARTÃO INTER CLAUDIA", parcels: 3, val: 100.27 },
              { desc: "Superm.BH Claudia", cat: "MERCADO", pay: "CARTÃO INTER CLAUDIA", parcels: 1, val: 105.85 },
              { desc: "Superm.BH Claudia", cat: "MERCADO", pay: "CARTÃO INTER CLAUDIA", parcels: 1, val: 84.26 },
              { desc: "C.Bahia-filtro Pri", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO CARREFOUR", parcels: 3, val: 65.64 },
              { desc: "Anuidade", cat: "OUTROS", pay: "CARTÃO CARREFOUR", parcels: 5, val: 16.99 },
              { desc: "San Raphael - Meg", cat: "CACHORROS", pay: "CARTÃO CARREFOUR", parcels: 3, val: 418.08 },
              { desc: "Superm.BH Claudia", cat: "MERCADO", pay: "CARTÃO INTER CLAUDIA", parcels: 1, val: 121.67 },
              { desc: "Lojas Duque", cat: "CASA", pay: "CARTÃO INTER PAULO", parcels: 1, val: 118.38 },
              { desc: "Lizie - Pri", cat: "DÍVIDA DE TERCEIROS", pay: "CARTÃO SANTANDER", parcels: 4, val: 166.50 }
            ];

            const baseDate = "2026-11-01";
            itemsV2.forEach((item, idx) => {
              const groupId = item.parcels > 1 ? uuidv5(`pc-nov26-v2-grp-${idx}`, IMPORT_NAMESPACE) : null;
              for (let i = 0; i < item.parcels; i++) {
                extraImportedTx.push({
                  id: uuidv5(`pc-nov26-v2-tx-${idx}-${i + 1}`, IMPORT_NAMESPACE),
                  groupId,
                  type: 'expense',
                  description: item.parcels > 1 ? `${item.desc} (${i + 1}/${item.parcels})` : item.desc,
                  amount: item.val,
                  originalDate: baseDate,
                  date: baseDate,
                  details: 'Importado de Nov/2026 (Parte 2)',
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
            localStorage.setItem(getStorageKey('importedNov2026_PauloClaudia_v2'), 'true');
            newlyImportedKeys.push('importedNov2026_PauloClaudia_v2');
          }
        }

        let hasCloudData = filteredDbTransactions.length > 0 || !!dbSettings;
        const forceUpload = sessionStorage.getItem('force_cloud_upload') === 'true';

        if (hasCloudData && !forceUpload) {
          // Substituir transações locais pelas da nuvem (já sem os itens excluídos)
          const existingIds = new Set(filteredDbTransactions.map(t => t.id));
          const mergedNewTx = extraImportedTx.filter(t => !existingIds.has(t.id));
          const localTransactions = [...filteredDbTransactions.map(mapToLocal), ...mergedNewTx];

          if (mergedNewTx.length > 0) {
            await supabase.from('transactions').upsert(mergedNewTx.map(mapToDB));
          }
          
          // Recuperar paidItems da nuvem:
          // 1º Prioridade: dbSettings.settings.paidItems (formato JSON seguro que suporta qualquer estrutura e mês)
          let cloudPaidItems = {};
          if (dbSettings?.settings?.paidItems && typeof dbSettings.settings.paidItems === 'object') {
            cloudPaidItems = { ...dbSettings.settings.paidItems };
          }

          // 2º Mesclar com registros legados de dbPaidItems (caso existam)
          if (dbPaidItems && Array.isArray(dbPaidItems) && dbPaidItems.length > 0) {
            dbPaidItems.forEach(pi => {
              if (pi.item_id && pi.item_id.includes(':::')) {
                const [month, id] = pi.item_id.split(':::');
                if (!cloudPaidItems[month]) cloudPaidItems[month] = {};
                cloudPaidItems[month][id] = pi.is_paid;
              } else if (pi.item_id && pi.month) {
                if (!cloudPaidItems[pi.month]) cloudPaidItems[pi.month] = {};
                cloudPaidItems[pi.month][pi.item_id] = pi.is_paid;
              }
            });
          }

          // 3º Ler o que está gravado localmente no localStorage
          let savedLocalPaid = {};
          try {
            const raw = localStorage.getItem(getStorageKey('paidItems'));
            if (raw) savedLocalPaid = JSON.parse(raw);
          } catch (e) {
            console.error('Erro ao ler paidItems local:', e);
          }

          // 4º Fazer merge inteligente:
          // Começa com o que o usuário marcou localmente (para nunca perder cliques recentes / offline)
          // E complementa com os dados da nuvem
          const finalPaidItems = { ...savedLocalPaid };
          Object.entries(cloudPaidItems).forEach(([month, items]) => {
            if (items && typeof items === 'object') {
              finalPaidItems[month] = {
                ...(finalPaidItems[month] || {}),
                ...items
              };
            }
          });

          // Atualiza localStorage
          localStorage.setItem(getStorageKey('transactions'), JSON.stringify(localTransactions));
          
          const { paidItems: _unused, categories: cloudCats, paymentMethods: cloudMethods, ...cleanSettings } = rawSettings;
          if (newlyImportedKeys.length > 0) {
            cleanSettings.importedKeys = Array.from(new Set([...(cleanSettings.importedKeys || []), ...newlyImportedKeys]));
          }
          if (Object.keys(cleanSettings).length > 0) {
            localStorage.setItem(getStorageKey('settings'), JSON.stringify(cleanSettings));
          }
          
          localStorage.setItem(getStorageKey('paidItems'), JSON.stringify(finalPaidItems));
          
          let finalCategories = null;
          if (Array.isArray(cloudCats) && cloudCats.length > 0) {
            finalCategories = cloudCats;
          } else if (dbCategories && dbCategories.length > 0) {
            finalCategories = dbCategories.map(c => ({ name: c.name, limit: Number(c.color || 0) }));
          }
          if (finalCategories) {
            localStorage.setItem(getStorageKey('categories'), JSON.stringify(finalCategories));
          }

          let finalPaymentMethods = null;
          if (Array.isArray(cloudMethods) && cloudMethods.length > 0) {
            finalPaymentMethods = cloudMethods;
          } else if (dbPaymentMethods && dbPaymentMethods.length > 0) {
            finalPaymentMethods = dbPaymentMethods.map(m => m.name);
          }
          if (extraImportedTx.length > 0) {
            const baseMethods = finalPaymentMethods || contextRef.current?.paymentMethods || [];
            const importedMethods = Array.from(new Set(extraImportedTx.map(t => t.paymentMethod).filter(Boolean)));
            finalPaymentMethods = Array.from(new Set([...baseMethods, ...importedMethods]));
          }
          if (finalPaymentMethods) {
            localStorage.setItem(getStorageKey('paymentMethods'), JSON.stringify(finalPaymentMethods));
          }

          // Se o que temos localmente tiver dados adicionais não salvos na nuvem, atualiza a nuvem agora
          if (JSON.stringify(cloudPaidItems) !== JSON.stringify(finalPaidItems) || extraImportedTx.length > 0) {
            const updatedSettings = {
              ...(cleanSettings || contextRef.current?.settings || {}),
              paidItems: finalPaidItems,
              categories: finalCategories || contextRef.current?.categories,
              paymentMethods: finalPaymentMethods || contextRef.current?.paymentMethods
            };
            await supabase.from('user_settings').upsert({ user_id: currentUser.id, settings: updatedSettings });
          }

          if (contextRef.current?.setTransactions) {
            contextRef.current.setTransactions(localTransactions);
          }

          if (contextRef.current?.setPaidItems) {
            contextRef.current.setPaidItems(finalPaidItems);
          }

          if (contextRef.current?.updateSettings && Object.keys(cleanSettings).length > 0) {
            contextRef.current.updateSettings(cleanSettings);
          }

          if (contextRef.current?.setCategories && finalCategories) {
            contextRef.current.setCategories(finalCategories);
          }

          if (contextRef.current?.setPaymentMethods && finalPaymentMethods) {
            contextRef.current.setPaymentMethods(finalPaymentMethods);
          }

          sessionStorage.setItem('has_synced_cloud', 'true');
        } else {
          // Não há dados na nuvem, ou forçamos o upload (Migração ou Importação)
          const currentCtx = contextRef.current;
          const allLocalTx = [...(currentCtx?.transactions || []), ...extraImportedTx];
          if (extraImportedTx.length > 0 && currentCtx?.setTransactions) {
            currentCtx.setTransactions(allLocalTx);
            localStorage.setItem(getStorageKey('transactions'), JSON.stringify(allLocalTx));
          }
          if (allLocalTx.length > 0 || forceUpload) {
            console.log('Enviando dados locais para a nuvem...');
            
            try {
              if (forceUpload) {
                await supabase.from('transactions').delete().eq('user_id', currentUser.id);
              }

              if (allLocalTx.length > 0) {
                const { error: txErr } = await supabase.from('transactions').upsert(allLocalTx.map(mapToDB));
                if (txErr) throw new Error('Transações: ' + txErr.message);
              }

              const baseMethods = currentCtx.paymentMethods || [];
              const importedMethods = Array.from(new Set(extraImportedTx.map(t => t.paymentMethod).filter(Boolean)));
              const mergedMethods = Array.from(new Set([...baseMethods, ...importedMethods]));
              if (extraImportedTx.length > 0 && currentCtx?.setPaymentMethods) {
                currentCtx.setPaymentMethods(mergedMethods);
                localStorage.setItem(getStorageKey('paymentMethods'), JSON.stringify(mergedMethods));
              }

              const settingsToPush = {
                ...(currentCtx.settings || {}),
                ...(newlyImportedKeys.length > 0 ? { importedKeys: Array.from(new Set([...(currentCtx.settings?.importedKeys || []), ...newlyImportedKeys])) } : {}),
                paidItems: currentCtx.paidItems || {},
                categories: currentCtx.categories || [],
                paymentMethods: mergedMethods
              };
              const { error: stgErr } = await supabase.from('user_settings').upsert({ user_id: currentUser.id, settings: settingsToPush });
              if (stgErr) throw new Error('Settings: ' + stgErr.message);
              
              if (forceUpload) {
                sessionStorage.removeItem('force_cloud_upload');
                sessionStorage.setItem('has_synced_cloud', 'true');
                alert('Nuvem atualizada com sucesso com o seu backup!');
              }
            } catch (err) {
              console.error('Erro forçando upload:', err);
              alert('Erro ao enviar para a nuvem: ' + err.message);
            }
          }
        }

        setIsSynced(true);
      } catch (err) {
        console.error('Erro na sincronização inicial:', err);
        setSyncError(err.message);
        setIsSynced(true);
      }
    };

    fetchCloudData();
  }, [currentUser.id]);

  // Função centralizada para envio reativo à nuvem
  const syncToCloud = useCallback(async () => {
    const current = contextRef.current;
    if (!current) return;
    try {
      const currentIds = (current.transactions || []).map(t => t.id);

      if (current.transactions && current.transactions.length > 0) {
        const toPush = current.transactions.slice(-500).map(mapToDB);
        await supabase.from('transactions').upsert(toPush);
      }

      // Garantir que transações excluídas localmente também sejam removidas da nuvem
      const { data: cloudTxIds } = await supabase
        .from('transactions')
        .select('id')
        .eq('user_id', currentUser.id);

      if (cloudTxIds && cloudTxIds.length > 0) {
        const currentIdsSet = new Set(currentIds);
        const idsToRemove = cloudTxIds
          .map(row => row.id)
          .filter(id => !currentIdsSet.has(id));

        if (idsToRemove.length > 0) {
          await supabase.from('transactions').delete().eq('user_id', currentUser.id).in('id', idsToRemove);
        }
      }

      if (current.settings || current.paidItems || current.categories || current.paymentMethods) {
        const settingsToPush = {
          ...(current.settings || {}),
          paidItems: current.paidItems || {},
          categories: current.categories || [],
          paymentMethods: current.paymentMethods || []
        };
        await supabase.from('user_settings').upsert({ user_id: currentUser.id, settings: settingsToPush });
      }
    } catch (err) {
      console.error('Erro sincronizando alterações com a nuvem:', err);
    }
  }, [currentUser.id]);

  // Sync reativo com debounce ágil (400ms)
  useEffect(() => {
    if (!isSynced) return;
    const timer = setTimeout(() => {
      syncToCloud();
    }, 400);

    return () => clearTimeout(timer);
  }, [context.transactions, context.settings, context.paidItems, context.categories, context.paymentMethods, isSynced, syncToCloud]);

  // Garantir sincronização se a janela/aba estiver sendo fechada
  useEffect(() => {
    const handleBeforeUnload = () => {
      syncToCloud();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [syncToCloud]);

  if (syncError) {
    return <div style={{ padding: '1rem', background: '#fee2e2', color: '#dc2626', textAlign: 'center' }}>Erro de sincronização: {syncError}</div>;
  }

  if (!isSynced) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', color: 'var(--text-main)' }}>
        <h2>Sincronizando com a nuvem... ☁️</h2>
      </div>
    );
  }

  return children;
};

export default SupabaseSync;
