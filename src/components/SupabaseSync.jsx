import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTransactions } from '../context/TransactionsContext';

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

        let hasCloudData = dbTransactions && dbTransactions.length > 0;
        const forceUpload = sessionStorage.getItem('force_cloud_upload') === 'true';

        if (hasCloudData && !forceUpload) {
          // Substituir transações locais pelas da nuvem
          const localTransactions = dbTransactions.map(mapToLocal);
          
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
          
          const rawSettings = dbSettings?.settings || {};
          const { paidItems: _unused, ...cleanSettings } = rawSettings;
          if (Object.keys(cleanSettings).length > 0) {
            localStorage.setItem(getStorageKey('settings'), JSON.stringify(cleanSettings));
          }
          
          localStorage.setItem(getStorageKey('paidItems'), JSON.stringify(finalPaidItems));
          
          if (dbCategories && dbCategories.length > 0) {
            const cats = dbCategories.map(c => ({ name: c.name, limit: Number(c.color || 0) }));
            localStorage.setItem(getStorageKey('categories'), JSON.stringify(cats));
          }
          if (dbPaymentMethods && dbPaymentMethods.length > 0) {
            const methods = dbPaymentMethods.map(m => m.name);
            localStorage.setItem(getStorageKey('paymentMethods'), JSON.stringify(methods));
          }

          // Se o que temos localmente tiver dados adicionais não salvos na nuvem, atualiza a nuvem agora
          if (JSON.stringify(cloudPaidItems) !== JSON.stringify(finalPaidItems)) {
            const updatedSettings = {
              ...(cleanSettings || contextRef.current?.settings || {}),
              paidItems: finalPaidItems
            };
            await supabase.from('user_settings').upsert({ user_id: currentUser.id, settings: updatedSettings });
          }

          if (contextRef.current?.setPaidItems) {
            contextRef.current.setPaidItems(finalPaidItems);
          }

          if (contextRef.current?.updateSettings && Object.keys(cleanSettings).length > 0) {
            contextRef.current.updateSettings(cleanSettings);
          }

          const wasSynced = sessionStorage.getItem('has_synced_cloud');
          if (!wasSynced) {
            sessionStorage.setItem('has_synced_cloud', 'true');
            window.location.reload();
            return;
          }
        } else {
          // Não há dados na nuvem, ou forçamos o upload (Migração ou Importação)
          const currentCtx = contextRef.current;
          if (currentCtx?.transactions && currentCtx.transactions.length > 0) {
            console.log('Enviando dados locais para a nuvem...');
            
            try {
              if (forceUpload) {
                await supabase.from('transactions').delete().eq('user_id', currentUser.id);
              }

              const { error: txErr } = await supabase.from('transactions').upsert(currentCtx.transactions.map(mapToDB));
              if (txErr) throw new Error('Transações: ' + txErr.message);

              const settingsToPush = {
                ...(currentCtx.settings || {}),
                paidItems: currentCtx.paidItems || {}
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
      if (current.transactions && current.transactions.length > 0) {
        const toPush = current.transactions.slice(-500).map(mapToDB);
        await supabase.from('transactions').upsert(toPush);
      }
      if (current.settings || current.paidItems) {
        const settingsToPush = {
          ...(current.settings || {}),
          paidItems: current.paidItems || {}
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
  }, [context.transactions, context.settings, context.paidItems, isSynced, syncToCloud]);

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
