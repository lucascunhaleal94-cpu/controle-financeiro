import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTransactions } from '../context/TransactionsContext';

const SupabaseSync = ({ currentUser, children }) => {
  const context = useTransactions();
  const [isSynced, setIsSynced] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // Helper para mapear camelCase para snake_case
  const mapToDB = (tx) => ({
    id: tx.id,
    user_id: currentUser.id,
    group_id: tx.groupId || null,
    type: tx.type,
    description: tx.description,
    amount: tx.amount,
    date: tx.date,
    original_date: tx.originalDate,
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
          // Substituir contexto local pelos dados da nuvem
          const localTransactions = dbTransactions.map(mapToLocal);
          
          const localPaidItems = {};
          if (dbPaidItems) {
             dbPaidItems.forEach(pi => {
               localPaidItems[pi.item_id] = pi.is_paid;
             });
          }

          const getStorageKey = (key) => `@ControleFinanceiro_${currentUser.id}:${key}`;
          
          // Atualiza localStorage
          localStorage.setItem(getStorageKey('transactions'), JSON.stringify(localTransactions));
          if (dbSettings?.settings) localStorage.setItem(getStorageKey('settings'), JSON.stringify(dbSettings.settings));
          localStorage.setItem(getStorageKey('paidItems'), JSON.stringify(localPaidItems));
          
          if (dbCategories && dbCategories.length > 0) {
             const cats = dbCategories.map(c => ({ name: c.name, limit: Number(c.color || 0) })); // Reusing color field for limit as simple workaround, or mapping to original
             localStorage.setItem(getStorageKey('categories'), JSON.stringify(cats));
          }
          if (dbPaymentMethods && dbPaymentMethods.length > 0) {
             const methods = dbPaymentMethods.map(m => m.name);
             localStorage.setItem(getStorageKey('paymentMethods'), JSON.stringify(methods));
          }

          // A página precisará recarregar para pegar os dados corretos no Contexto
          // Ou podemos simplesmente usar window.location.reload()
          const wasSynced = sessionStorage.getItem('has_synced_cloud');
          if (!wasSynced) {
            sessionStorage.setItem('has_synced_cloud', 'true');
            window.location.reload();
            return;
          }
        } else {
           // Não há dados na nuvem, ou forçamos o upload (Migração ou Importação)
           if (context.transactions && context.transactions.length > 0) {
             console.log('Enviando dados locais para a nuvem...');
             
             // Limpar dados antigos da nuvem se for um import forçado para evitar duplicação (opcional mas recomendado se for import total)
             if (forceUpload) {
               await supabase.from('transactions').delete().eq('user_id', currentUser.id);
             }

             await supabase.from('transactions').upsert(context.transactions.map(mapToDB));
             await supabase.from('user_settings').upsert({ user_id: currentUser.id, settings: context.settings });
             
             const piToPush = Object.entries(context.paidItems || {}).map(([key, val]) => ({ user_id: currentUser.id, item_id: key, is_paid: val }));
             if (piToPush.length > 0) await supabase.from('paid_items').upsert(piToPush);
             
             if (forceUpload) {
               sessionStorage.removeItem('force_cloud_upload');
               sessionStorage.setItem('has_synced_cloud', 'true');
             }
           }
        }

        setIsSynced(true);
      } catch (err) {
        console.error('Erro na sincronizaǜo inicial:', err);
        setSyncError(err.message);
        setIsSynced(true); // Permite usar o app mesmo com erro
      }
    };

    fetchCloudData();
  }, [currentUser.id]);

  // Sync reativo: Quando o usuǭrio altera algo no Context, enviamos para a nuvem.
  useEffect(() => {
    if (!isSynced) return;
    
    const syncToCloud = async () => {
      try {
        if (context.transactions && context.transactions.length > 0) {
          // Na versǜo final ideal, sincronizaramos apenas a diferena.
          // Como Ǹ um projeto simples, fazemos um upsert de todos. 
          // Limitamos a 500 pra evitar bugs de payload grande (se houver muitos).
          const toPush = context.transactions.slice(-500).map(mapToDB);
          await supabase.from('transactions').upsert(toPush);
        }
        if (context.settings) {
          await supabase.from('user_settings').upsert({ user_id: currentUser.id, settings: context.settings });
        }
        if (context.paidItems) {
           const piToPush = Object.entries(context.paidItems || {}).map(([key, val]) => ({ user_id: currentUser.id, item_id: key, is_paid: val }));
           if (piToPush.length > 0) await supabase.from('paid_items').upsert(piToPush);
        }
      } catch (err) {
        console.error('Erro sincronizando alteraes com a nuvem:', err);
      }
    };

    // Usa um timeout para fazer "debounce" (nǜo enviar pra cada tecla digitada)
    const timer = setTimeout(() => {
      syncToCloud();
    }, 2000);

    return () => clearTimeout(timer);
  }, [context.transactions, context.settings, context.paidItems, isSynced, currentUser.id]);

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
