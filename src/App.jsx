import React, { useState } from 'react';
import { useTransactions } from './context/TransactionsContext';
import { format, parseISO, subMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, PlusCircle, LayoutDashboard, ListOrdered, Settings as SettingsIcon, LogOut } from 'lucide-react';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import Settings from './components/Settings';
import Notifications from './components/Notifications';

function App() {
  const { currentMonth, setCurrentMonth } = useTransactions();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'list', or 'settings'
  const [currentUser] = useState(() => JSON.parse(localStorage.getItem('@ControleFinanceiro:activeUser')));

  const handleLogout = () => {
    localStorage.removeItem('@ControleFinanceiro:activeUser');
    window.location.reload();
  };

  const handlePrevMonth = () => {
    const current = parseISO(`${currentMonth}-01`);
    const prev = subMonths(current, 1);
    setCurrentMonth(format(prev, 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const current = parseISO(`${currentMonth}-01`);
    const next = addMonths(current, 1);
    setCurrentMonth(format(next, 'yyyy-MM'));
  };

  const formatMonthDisplay = () => {
    const date = parseISO(`${currentMonth}-01`);
    return format(date, 'MMMM yyyy', { locale: ptBR }).toUpperCase();
  };

  const [editingData, setEditingData] = useState(null);

  const handleEdit = (transaction) => {
    setEditingData(transaction);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setEditingData(null);
    setIsFormOpen(false);
  };

  return (
    <div className="container">
      {/* Header & Navigation */}
      <header className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="flex items-center gap-4">
            <h1 style={{ fontSize: '1.5rem', color: 'var(--primary-color)' }}>Controle Financeiro</h1>
            <Notifications />
          </div>
          <div className="flex items-center gap-4" style={{ marginTop: '0.25rem' }}>
            <p className="text-muted" style={{ margin: 0 }}>{currentUser?.name}</p>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-outline" onClick={handlePrevMonth} style={{ padding: '0.5rem' }}>
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontWeight: '600', minWidth: '150px', textAlign: 'center' }}>
            {formatMonthDisplay()}
          </span>
          <button className="btn btn-outline" onClick={handleNextMonth} style={{ padding: '0.5rem' }}>
            <ChevronRight size={20} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <button 
          className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <LayoutDashboard size={18} />
          Dashboard
        </button>
        <button 
          className={`btn ${activeTab === 'list' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('list')}
        >
          <ListOrdered size={18} />
          Lançamentos
        </button>
        <button 
          className={`btn ${activeTab === 'settings' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setActiveTab('settings')}
        >
          <SettingsIcon size={18} />
          Configurações
        </button>
        <div style={{ flex: 1 }}></div>
        <button className="btn btn-primary" onClick={() => { setEditingData(null); setIsFormOpen(true); }} style={{ backgroundColor: 'var(--income-color)' }}>
          <PlusCircle size={18} />
          Nova Transação
        </button>
      </div>

      {/* Main Content */}
      <main>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'list' && <TransactionList onEdit={handleEdit} />}
        {activeTab === 'settings' && <Settings />}
      </main>

      {/* Modal / Form */}
      {isFormOpen && (
        <TransactionForm onClose={handleCloseForm} initialData={editingData} />
      )}
    </div>
  );
}

export default App;
