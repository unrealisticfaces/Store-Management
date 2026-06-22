import React, { useState, useEffect } from 'react';
import Barcode from 'react-barcode';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const MENU_GROUPS = [
  {
    title: "CHECKOUT",
    roles: ['manager', 'cashier'],
    items: [{ id: 'terminal', label: 'TERMINAL' }]
  },
  {
    title: "INSIGHTS",
    roles: ['manager'],
    items: [
      { id: 'dashboard', label: 'DASHBOARD' },
      { id: 'sales', label: 'SALES' },
      { id: 'finance', label: 'FINANCE' }
    ]
  },
  {
    title: "MANAGEMENT",
    roles: ['manager'],
    items: [
      { id: 'inventory', label: 'INVENTORY' },
      { id: 'stocks', label: 'STOCKS REPORTS' },
      { id: 'accounts', label: 'ACCOUNTS' },
      { id: 'logs', label: 'LOGS' }
    ]
  }
];

export default function App() {
  const [activeView, setActiveView] = useState('terminal');
  const [currentUser, setCurrentUser] = useState(null);
  const [pinInput, setPinInput] = useState('');
  
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [logs, setLogs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [cart, setCart] = useState([]);
  
  const [activeShift, setActiveShift] = useState(null);
  const [floatInput, setFloatInput] = useState('');
  const [zReadingCash, setZReadingCash] = useState('');
  const [zReadingReceipt, setZReadingReceipt] = useState(null);

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', category: 'FOODS', cost: '', price: '', sku: '', stock: '' });
  const [addStockAmount, setAddStockAmount] = useState('');
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({ name: '', pin: '', role: 'cashier' });

  const [amountTendered, setAmountTendered] = useState('');
  const [printRequest, setPrintRequest] = useState(null);
  const [receiptData, setReceiptData] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [salesCashierFilter, setSalesCashierFilter] = useState('ALL');
  const [salesDateFilter, setSalesDateFilter] = useState('TODAY');
  const [salesCustomDate, setSalesCustomDate] = useState('');
  const [salesSearchQuery, setSalesSearchQuery] = useState('');

  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('ALL');
  const [stocksSearchQuery, setStocksSearchQuery] = useState('');
  const [stocksCategoryFilter, setStocksCategoryFilter] = useState('ALL');

  useEffect(() => {
    async function loadData() {
      try {
        setInventory(await window.electronAPI.getInventory() || []);
        const dbSales = await window.electronAPI.getSales() || [];
        setSales(dbSales.map(sale => ({ ...sale, items: sale.items ? JSON.parse(sale.items) : [] })));
        setLogs(await window.electronAPI.getLogs() || []);
        setActiveShift(await window.electronAPI.getActiveShift());
        setUsers(await window.electronAPI.getUsers() || []);
        setShifts(await window.electronAPI.getAllShifts() || []);
      } catch (error) {}
    }
    loadData();
  }, [activeView]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (receiptData || zReadingReceipt || printRequest) {
          e.preventDefault();
          window.print();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [receiptData, zReadingReceipt, printRequest]);

  const addLog = async (action, details) => {
    const timestamp = new Date().toLocaleString();
    await window.electronAPI.addLog({ action, details, timestamp });
  };

  const handleLogin = async () => {
    const user = await window.electronAPI.verifyPin(pinInput);
    if (user) {
      setCurrentUser(user);
      setActiveView(user.role === 'manager' ? 'dashboard' : 'terminal');
      addLog('SYSTEM LOGIN', JSON.stringify({ msg: `${user.name} LOGGED IN`, category: 'SYSTEM', qty: '-' }));
    } else {
      alert('INVALID PIN CODE');
    }
    setPinInput('');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCart([]);
    setAmountTendered('');
    setActiveView('terminal');
  };

  useBarcodeScanner((scannedSku) => {
    if (!currentUser || !activeShift || isAddingProduct || isAddingUser || printRequest || receiptData || zReadingReceipt) return;
    const product = inventory.find(p => p.sku === scannedSku);
    if (!product) return;
    handleAddToCart(product);
  });

  const handleAddToCart = (product) => {
    if (product.stock <= 0) alert(`WARNING: OUT OF STOCK`);
    setActiveView('terminal');
    setCart(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const exists = safePrev.find(item => item.sku === product.sku);
      if (exists) return safePrev.map(item => item.sku === product.sku ? { ...item, qty: (item.qty || 0) + 1 } : item);
      return [...safePrev, { ...product, qty: 1 }];
    });
    setSearchQuery('');
    setIsSearchOpen(false);
  };

  const handleUpdateCartQty = (sku, newQty) => {
    const qty = parseInt(newQty);
    if (isNaN(qty) || qty < 1) return;
    setCart(prev => prev.map(item => item.sku === sku ? { ...item, qty } : item));
  };

  const handleCheckout = async () => {
    if (!cart || cart.length === 0) return;
    const totalDue = cart.reduce((sum, item) => sum + ((Number(item.price)||0) * (Number(item.qty)||0)), 0);
    const totalProfit = cart.reduce((sum, item) => sum + (((Number(item.price)||0) - (Number(item.cost)||0)) * (Number(item.qty)||0)), 0);
    const tendered = parseFloat(amountTendered);
    
    if (isNaN(tendered) || tendered < totalDue) return;

    const timestamp = new Date().toLocaleString();
    const saleId = `INV-${Date.now()}`;
    const changeDue = tendered - totalDue;
    
    await window.electronAPI.addSale({ id: saleId, cashier: currentUser.name, items: cart, total: totalDue, profit: totalProfit, timestamp });
    setInventory(await window.electronAPI.getInventory());
    setSales(await window.electronAPI.getSales());
    setActiveShift(await window.electronAPI.getActiveShift());
    
    setReceiptData({ id: saleId, timestamp, items: [...cart], totalDue, tendered, changeDue, cashier: currentUser.name });
    setCart([]); setAmountTendered('');
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const cost = parseFloat(formData.cost) || 0;
    const price = parseFloat(formData.price) || 0;
    const added = parseInt(addStockAmount) || 0;
    const stock = editingProduct ? (parseInt(formData.stock) || 0) + added : (parseInt(formData.stock) || 0);

    if (!formData.name || !formData.sku) return;

    const duplicate = inventory.find(i => 
      (i.sku.toLowerCase() === formData.sku.toLowerCase() || i.name.toLowerCase() === formData.name.toLowerCase()) && 
      (!editingProduct || i.id !== editingProduct.id)
    );

    if (duplicate) {
      alert('ERROR: PRODUCT NAME OR SKU ALREADY EXISTS');
      return;
    }

    const logData = {
      msg: editingProduct ? (added > 0 ? `RESTOCKED ${formData.name}` : `UPDATED ${formData.name}`) : `ADDED ${formData.name}`,
      category: formData.category,
      qty: editingProduct ? (added > 0 ? `+${added}` : '-') : stock
    };

    if (editingProduct) {
      await window.electronAPI.updateProduct({ id: editingProduct.id, name: formData.name, category: formData.category, cost, price, sku: formData.sku, stock });
      addLog(added > 0 ? 'RESTOCK' : 'UPDATE PRODUCT', JSON.stringify(logData));
    } else {
      await window.electronAPI.addProduct({ name: formData.name, category: formData.category, cost, price, sku: formData.sku, stock });
      addLog('ADD PRODUCT', JSON.stringify(logData));
    }
    
    setInventory(await window.electronAPI.getInventory());
    setIsAddingProduct(false); setEditingProduct(null); setAddStockAmount(''); setFormData({ name: '', category: 'FOODS', cost: '', price: '', sku: '', stock: '' });
  };

  const handleDeleteProduct = async (id, name, category) => {
    if (window.confirm(`ARE YOU SURE YOU WANT TO DELETE ${name}?`)) {
      await window.electronAPI.deleteProduct(id);
      addLog('DELETE PRODUCT', JSON.stringify({ msg: `DELETED ${name}`, category, qty: '-' }));
      setInventory(await window.electronAPI.getInventory());
    }
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userFormData.name || !userFormData.pin) return;
    await window.electronAPI.addUser(userFormData);
    setUsers(await window.electronAPI.getUsers());
    setIsAddingUser(false); setUserFormData({ name: '', pin: '', role: 'cashier' });
  };

  const handleDeleteUser = async (id, name) => {
    if (window.confirm(`ARE YOU SURE YOU WANT TO REVOKE ACCESS FOR ${name}?`)) {
      await window.electronAPI.deleteUser(id);
      setUsers(await window.electronAPI.getUsers());
    }
  };

  const handleOpenShift = async () => {
    const float = parseFloat(floatInput);
    if (isNaN(float) || float < 0) return;
    await window.electronAPI.openShift({ id: `SHIFT-${Date.now()}`, opened_by: currentUser.name, start_time: new Date().toLocaleString(), starting_float: float });
    setActiveShift(await window.electronAPI.getActiveShift());
    setFloatInput('');
  };

  const handleCloseShift = async () => {
    const actual = parseFloat(zReadingCash);
    if (isNaN(actual) || actual < 0) return;
    const difference = actual - activeShift.expected_cash;
    const end_time = new Date().toLocaleString();
    
    await window.electronAPI.closeShift({ id: activeShift.id, actual_cash: actual, end_time });
    setZReadingReceipt({ ...activeShift, actual_cash: actual, difference, end_time });
    setActiveShift(null); setZReadingCash(''); handleLogout();
  };

  const safeTotalDue = cart.reduce((s, i) => s + ((Number(i.price)||0) * (Number(i.qty)||0)), 0);
  const parsedTendered = parseFloat(amountTendered);
  const safeChange = !isNaN(parsedTendered) ? parsedTendered - safeTotalDue : -1;

  const todaysSales = sales.filter(s => s?.timestamp?.includes(new Date().toLocaleDateString()));
  const todayRevenue = todaysSales.reduce((s, x) => s + (Number(x.total)||0), 0);
  const todayProfit = todaysSales.reduce((s, x) => s + (Number(x.profit)||0), 0);

  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    return d;
  }).reverse();

  const barData = last7Days.map(dateObj => {
    const dateStr = dateObj.toLocaleDateString();
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const daySales = sales.filter(s => s.timestamp && s.timestamp.includes(dateStr));
    const revenue = daySales.reduce((sum, s) => sum + (Number(s.total)||0), 0);
    return { name: dayName, Revenue: revenue };
  });

  const allTimeItemsCount = {};
  sales.forEach(s => Array.isArray(s.items) && s.items.forEach(i => {
    allTimeItemsCount[i.name] = (allTimeItemsCount[i.name] || 0) + (Number(i.qty)||0);
  }));
  const pieData = Object.keys(allTimeItemsCount).map(k => ({ name: k, value: allTimeItemsCount[k] })).sort((a,b) => b.value - a.value).slice(0, 5);

  const filteredTerminalInventory = searchQuery === '' 
    ? [] 
    : inventory.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        item.sku.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8);

  const filteredInventoryView = inventory.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) || item.sku.toLowerCase().includes(inventorySearchQuery.toLowerCase());
    const matchCat = inventoryCategoryFilter === 'ALL' || item.category === inventoryCategoryFilter;
    return matchSearch && matchCat;
  });

  const filteredStocksView = inventory.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(stocksSearchQuery.toLowerCase()) || item.sku.toLowerCase().includes(stocksSearchQuery.toLowerCase());
    const matchCat = stocksCategoryFilter === 'ALL' || item.category === stocksCategoryFilter;
    return matchSearch && matchCat;
  });

  const totalInventoryValue = filteredStocksView.reduce((sum, item) => sum + ((Number(item.cost) || 0) * (Number(item.stock) || 0)), 0);
  const lowStockCount = filteredStocksView.filter(i => (Number(i.stock)||0) > 0 && (Number(i.stock)||0) <= 5).length;
  const outOfStockCount = filteredStocksView.filter(i => (Number(i.stock)||0) <= 0).length;

  const lowStockAlerts = inventory.filter(i => (Number(i.stock)||0) <= 5);

  const uniqueCashiers = ['ALL', ...new Set([...users.map(u => u.name), ...sales.map(s => s.cashier)].filter(Boolean))];
  
  const isDateInRange = (timestampStr, filter, customDate) => {
    if (filter === 'ALL') return true;
    const saleDate = new Date(timestampStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (filter === 'TODAY') {
        return saleDate >= today;
    }
    if (filter === 'THIS WEEK') {
        const firstDay = new Date(today.setDate(today.getDate() - today.getDay()));
        return saleDate >= firstDay;
    }
    if (filter === 'LAST WEEK') {
        const firstDayThisWeek = new Date(today.setDate(today.getDate() - today.getDay()));
        const firstDayLastWeek = new Date(firstDayThisWeek);
        firstDayLastWeek.setDate(firstDayLastWeek.getDate() - 7);
        return saleDate >= firstDayLastWeek && saleDate < firstDayThisWeek;
    }
    if (filter === 'LAST MONTH') {
        const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return saleDate >= firstDayLastMonth && saleDate < firstDayThisMonth;
    }
    if (filter === 'CUSTOM' && customDate) {
        const custom = new Date(customDate);
        return saleDate.toLocaleDateString() === custom.toLocaleDateString();
    }
    return true;
  };

  const filteredSales = sales.filter(s => {
    const matchCashier = salesCashierFilter === 'ALL' || s.cashier === salesCashierFilter;
    const matchDate = isDateInRange(s.timestamp, salesDateFilter, salesCustomDate);
    
    let matchSearch = true;
    if (salesSearchQuery.trim() !== '') {
      const query = salesSearchQuery.toLowerCase();
      const matchId = s.id.toLowerCase().includes(query);
      const matchItems = Array.isArray(s.items) && s.items.some(item => item.name.toLowerCase().includes(query) || item.sku.toLowerCase().includes(query));
      matchSearch = matchId || matchItems;
    }

    return matchCashier && matchDate && matchSearch;
  });

  const totalFilteredSales = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  if (!currentUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="bg-white border border-slate-200 p-10 rounded-2xl shadow-2xl w-96 text-center">
          <div className="w-12 h-12 bg-indigo-600 rounded-lg mx-auto flex items-center justify-center text-white font-bold text-xl mb-6 shadow-md shadow-indigo-600/30">M</div>
          <h1 className="text-xl font-bold text-slate-900 mb-2 tracking-widest uppercase">SYSTEM SECURED</h1>
          <p className="text-xs text-slate-400 mb-8 uppercase tracking-widest">AUTHENTICATION REQUIRED</p>
          <input 
            type="password" maxLength="4" value={pinInput} onChange={(e) => setPinInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full text-center text-2xl tracking-[1rem] py-3 bg-white border border-slate-300 rounded-lg mb-6 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 text-slate-900 transition-all placeholder:text-slate-300" 
            placeholder="••••" autoFocus
          />
          <button onClick={handleLogin} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg text-[11px] font-bold uppercase tracking-widest transition-all shadow-md shadow-indigo-600/20">ACCESS</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 selection:bg-indigo-200 print:hidden">
      
      <div className="w-64 bg-white flex flex-col border-r border-slate-200 z-10 shadow-sm">
        <div className="p-6 border-b border-slate-100 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-sm shadow-md shadow-indigo-600/20">M</div>
            <h1 className="text-lg font-bold tracking-widest uppercase text-slate-900">STORE MANAGER</h1>
          </div>
          
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold uppercase border border-indigo-200">
              {currentUser.name.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-900 tracking-widest uppercase">{currentUser.name}</span>
              <span className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">{currentUser.role}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-8 overflow-y-auto scrollbar-hide">
          {MENU_GROUPS.map((group, idx) => {
            if (!group.roles.includes(currentUser.role)) return null;
            return (
              <div key={idx}>
                <p className="px-3 text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => setActiveView(item.id)} 
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                        activeView === item.id 
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 space-y-2 bg-white">
          {activeShift && currentUser.role === 'manager' && (
             <button onClick={() => setActiveView('zreading')} className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border border-red-100">
               END SHIFT
             </button>
          )}
          <button onClick={handleLogout} className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border border-slate-200">
            LOCK SYSTEM
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-50">
        <header className="bg-white border-b border-slate-200 px-8 py-5 flex justify-between items-center z-10 sticky top-0 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">
            {activeView.replace('-', ' ')}
          </h2>
          {activeShift && activeView !== 'zreading' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">REGISTER OPEN</span>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-8 relative z-0">
          
          {activeView === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-md border border-blue-400 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                  <p className="text-[10px] uppercase tracking-widest text-blue-100 font-bold mb-2">TODAY'S REVENUE</p>
                  <h3 className="text-3xl font-bold text-white tracking-tight">₱{todayRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                </div>
                <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 p-6 rounded-xl shadow-md border border-emerald-300 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-100 font-bold mb-2">TODAY'S NET PROFIT</p>
                  <h3 className="text-3xl font-bold text-white tracking-tight">₱{todayProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                </div>
                <div className="bg-gradient-to-br from-violet-500 to-violet-600 p-6 rounded-xl shadow-md border border-violet-400 relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                  <p className="text-[10px] uppercase tracking-widest text-violet-100 font-bold mb-2">TODAY'S TRANSACTIONS</p>
                  <h3 className="text-3xl font-bold text-white tracking-tight">{todaysSales.length}</h3>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-[11px] font-bold text-slate-900 mb-6 uppercase tracking-widest">TOP SELLING ITEMS</h3>
                  <div className="h-64">
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData.slice(0,5)} cx="50%" cy="50%" innerRadius={75} outerRadius={95} paddingAngle={3} dataKey="value" stroke="none">
                            {pieData.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#0f172a' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : <p className="text-center text-[10px] uppercase tracking-widest text-slate-400 py-20">AWAITING DATA</p>}
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-[11px] font-bold text-slate-900 mb-6 uppercase tracking-widest">7 DAY SALES TREND</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barData}>
                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#64748b'}} />
                        <Tooltip cursor={{fill: '#f1f5f9', radius: 4}} contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#0f172a' }} />
                        <Bar dataKey="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'sales' && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div className="flex gap-4 items-end flex-wrap">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">SEARCH</label>
                    <div className="relative">
                      <svg className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      <input 
                         type="text" 
                         placeholder="INVOICE OR ITEM..." 
                         value={salesSearchQuery} 
                         onChange={e => setSalesSearchQuery(e.target.value)} 
                         className="bg-slate-50 border border-slate-200 pl-8 pr-3 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 w-48"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">CASHIER</label>
                    <select value={salesCashierFilter} onChange={e => setSalesCashierFilter(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                      {uniqueCashiers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">DATE</label>
                    <select value={salesDateFilter} onChange={e => setSalesDateFilter(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20">
                      <option value="ALL">ALL TIME</option>
                      <option value="TODAY">TODAY</option>
                      <option value="THIS WEEK">THIS WEEK</option>
                      <option value="LAST WEEK">LAST WEEK</option>
                      <option value="LAST MONTH">LAST MONTH</option>
                      <option value="CUSTOM">CUSTOM DATE</option>
                    </select>
                  </div>
                  {salesDateFilter === 'CUSTOM' && (
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">SELECT DATE</label>
                      <input type="date" value={salesCustomDate} onChange={e => setSalesCustomDate(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  )}
                </div>
                <div className="bg-indigo-50 border border-indigo-100 px-6 py-3 rounded-lg text-right">
                  <p className="text-[9px] uppercase tracking-widest text-indigo-500 font-bold mb-1">TOTAL FILTERED SALES</p>
                  <p className="text-xl font-bold text-indigo-700">₱{totalFilteredSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">INVOICE ID</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">DATE</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">CASHIER</th>
                      <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">REVENUE</th>
                      <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">PROFIT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSales.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{s.id}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">{s.timestamp}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">{s.cashier}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-slate-900">₱{(Number(s.total)||0).toFixed(2)}</td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-emerald-600">₱{(Number(s.profit)||0).toFixed(2)}</td>
                      </tr>
                    ))}
                    {filteredSales.length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-12 text-center text-[10px] uppercase tracking-widest text-slate-400">NO SALES MATCH FILTER</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'inventory' && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              <div className="flex justify-between items-end gap-6 border-b border-slate-200 pb-6 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  {['ALL', 'FOODS', 'DRINKS', 'SUPPLIES', 'OTHER'].map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setInventoryCategoryFilter(cat)}
                      className={`px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm ${inventoryCategoryFilter === cat ? 'bg-indigo-600 text-white border border-indigo-600' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 items-center">
                  <div className="relative">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input 
                      type="text" 
                      placeholder="SEARCH INVENTORY..." 
                      value={inventorySearchQuery} 
                      onChange={e => setInventorySearchQuery(e.target.value)} 
                      className="w-64 pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all" 
                    />
                  </div>
                  <button onClick={() => setIsAddingProduct(true)} className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-colors hover:bg-indigo-700 shadow-sm whitespace-nowrap">ADD PRODUCT</button>
                </div>
              </div>
              
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">SKU</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">PRODUCT</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">CATEGORY</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">STOCK</th>
                      <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">PRICE</th>
                      <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInventoryView.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs text-slate-500 font-mono">{item.sku}</td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-900 uppercase">{item.name}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.category}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold ${(Number(item.stock)||0) <= 5 ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                            {(Number(item.stock)||0)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-bold text-slate-900">₱{(Number(item.price)||0).toFixed(2)}</td>
                        <td className="px-6 py-4 flex justify-end gap-3 items-center">
                          <button onClick={() => setPrintRequest({ product: item, qty: 1 })} title="PRINT LABEL" className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                          </button>
                          <button onClick={() => { setEditingProduct(item); setFormData(item); setAddStockAmount(''); setIsAddingProduct(true); }} title="EDIT PRODUCT" className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                          </button>
                          <button onClick={() => handleDeleteProduct(item.id, item.name, item.category)} title="DELETE PRODUCT" className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredInventoryView.length === 0 && (
                      <tr><td colSpan="6" className="px-6 py-12 text-center text-[10px] uppercase tracking-widest text-slate-400">NO PRODUCTS FOUND</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'stocks' && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">TOTAL INVENTORY VALUE</p>
                  <p className="text-xl font-bold text-indigo-600">₱{totalInventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">TOTAL UNIQUE ITEMS</p>
                  <p className="text-xl font-bold text-slate-900">{filteredStocksView.length}</p>
                </div>
                <div className="bg-red-50/50 p-4 rounded-xl border border-red-200 shadow-sm">
                  <p className="text-[9px] uppercase tracking-widest text-red-600 font-bold mb-1">OUT OF STOCK</p>
                  <p className="text-xl font-bold text-red-700">{outOfStockCount}</p>
                </div>
                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 shadow-sm">
                  <p className="text-[9px] uppercase tracking-widest text-amber-600 font-bold mb-1">LOW STOCK ALERTS</p>
                  <p className="text-xl font-bold text-amber-700">{lowStockCount}</p>
                </div>
              </div>

              <div className="flex justify-between items-end gap-4 print:hidden">
                <div className="flex gap-4 items-end flex-wrap">
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">SEARCH</label>
                    <div className="relative">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      <input 
                        type="text" 
                        placeholder="SEARCH STOCKS..." 
                        value={stocksSearchQuery} 
                        onChange={e => setStocksSearchQuery(e.target.value)} 
                        className="w-64 pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">CATEGORY</label>
                    <select value={stocksCategoryFilter} onChange={e => setStocksCategoryFilter(e.target.value)} className="bg-white border border-slate-200 px-4 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 shadow-sm transition-all">
                      <option value="ALL">ALL CATEGORIES</option>
                      <option value="FOODS">FOODS</option>
                      <option value="DRINKS">DRINKS</option>
                      <option value="SUPPLIES">SUPPLIES</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>
                </div>
                <button onClick={() => window.print()} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-[10px] uppercase tracking-widest font-bold transition-colors hover:bg-slate-800 shadow-sm whitespace-nowrap">PRINT REPORT</button>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">SKU</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">PRODUCT</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">CATEGORY</th>
                      <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">UNIT COST</th>
                      <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">STOCK</th>
                      <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">TOTAL VALUE</th>
                      <th className="px-6 py-4 text-center text-[10px] uppercase tracking-widest text-slate-500 font-bold">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStocksView.map((item) => {
                      const stock = Number(item.stock) || 0;
                      const cost = Number(item.cost) || 0;
                      const totalVal = stock * cost;
                      
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-xs text-slate-500 font-mono">{item.sku}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 uppercase">{item.name}</td>
                          <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.category}</td>
                          <td className="px-6 py-4 text-right text-xs text-slate-600 font-mono">₱{cost.toFixed(2)}</td>
                          <td className="px-6 py-4 text-right text-xs font-bold text-slate-900">{stock}</td>
                          <td className="px-6 py-4 text-right text-xs font-bold text-indigo-600">₱{totalVal.toFixed(2)}</td>
                          <td className="px-6 py-4 text-center">
                            {stock <= 0 ? (
                              <span className="bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase whitespace-nowrap">OUT OF STOCK</span>
                            ) : stock <= 5 ? (
                              <span className="bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase whitespace-nowrap">LOW STOCK</span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded-md text-[9px] font-bold tracking-widest uppercase whitespace-nowrap">IN STOCK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredStocksView.length === 0 && (
                      <tr><td colSpan="7" className="px-6 py-12 text-center text-[10px] uppercase tracking-widest text-slate-400">NO STOCKS FOUND</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'finance' && (
            <div className="max-w-6xl mx-auto space-y-10">
              <div className="space-y-4">
                <h3 className="text-[11px] font-bold text-slate-900 tracking-widest uppercase">SHIFT HISTORY</h3>
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">DATE OPENED</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">CASHIER</th>
                        <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">EXPECTED</th>
                        <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">VARIANCE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shifts.map((s) => {
                        const diff = s.actual_cash ? s.actual_cash - s.expected_cash : 0;
                        return (
                          <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-xs text-slate-500 uppercase">{s.start_time}</td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-900 uppercase">{s.opened_by}</td>
                            <td className="px-6 py-4 text-right text-xs text-slate-600">₱{s.expected_cash.toFixed(2)}</td>
                            <td className={`px-6 py-4 text-right text-xs font-bold ${diff < 0 ? 'text-red-500' : diff > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                              {s.status === 'closed' ? (diff > 0 ? `+₱${diff.toFixed(2)}` : `₱${diff.toFixed(2)}`) : 'ACTIVE'}
                            </td>
                          </tr>
                        )
                      })}
                      {shifts.length === 0 && (
                        <tr><td colSpan="4" className="px-6 py-12 text-center text-[10px] uppercase tracking-widest text-slate-400">NO SHIFT HISTORY</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeView === 'accounts' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-[11px] font-bold text-slate-900 tracking-widest uppercase">ACCOUNTS</h3>
                </div>
                <button onClick={() => setIsAddingUser(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-indigo-700 shadow-sm">ADD USER</button>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">NAME</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">ROLE</th>
                      <th className="px-6 py-4 text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-xs font-bold text-slate-900 uppercase">{u.name}</td>
                        <td className="px-6 py-4 text-[10px] text-slate-500 uppercase tracking-widest">{u.role}</td>
                        <td className="px-6 py-4 text-right text-[10px] tracking-widest">
                          <button onClick={() => handleDeleteUser(u.id, u.name)} disabled={u.role === 'manager'} className="text-red-500 font-bold hover:text-red-600 transition-colors disabled:opacity-30">REVOKE</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'logs' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <h3 className="text-[11px] font-bold text-slate-900 tracking-widest uppercase">SYSTEM LOGS</h3>
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold w-48">TIMESTAMP</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold w-48">ACTION</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">DETAILS</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">CATEGORY</th>
                      <th className="px-6 py-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">QTY ADDED</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map((log) => {
                      let parsedDetails = { msg: log.details, category: '-', qty: '-' };
                      try {
                        const parsed = JSON.parse(log.details);
                        if (parsed && typeof parsed === 'object' && parsed.msg) {
                          parsedDetails = parsed;
                        }
                      } catch (e) {}

                      return (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-[10px] tracking-widest text-slate-500 uppercase">{log.timestamp}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-700 uppercase">{log.action}</td>
                          <td className="px-6 py-4 text-xs text-slate-900 uppercase">{parsedDetails.msg}</td>
                          <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{parsedDetails.category}</td>
                          <td className="px-6 py-4 text-xs font-mono text-slate-700">{parsedDetails.qty}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'terminal' && (
            !activeShift ? (
              <div className="h-full flex items-center justify-center">
                <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 max-w-sm w-full">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center mb-6 border border-indigo-100">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-widest">OPEN REGISTER</h3>
                  <p className="text-[10px] text-slate-500 mb-8 uppercase tracking-widest">ENTER STARTING FLOAT</p>
                  
                  <div className="relative mb-6">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                    <input type="number" step="0.01" value={floatInput} onChange={(e) => setFloatInput(e.target.value)} className="w-full text-left pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 transition-all placeholder:text-slate-300" placeholder="0.00" />
                  </div>
                  
                  <button onClick={handleOpenShift} disabled={!floatInput} className="w-full bg-indigo-600 text-white py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-sm">OPEN SHIFT</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full max-w-7xl mx-auto">
                
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-visible relative">
                  
                  <div className="p-3 border-b border-slate-200 bg-white rounded-t-xl relative z-20">
                    <div className="relative">
                      <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      <input 
                        type="text" 
                        placeholder="SEARCH PRODUCT OR SKU..." 
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
                        onFocus={() => setIsSearchOpen(true)}
                        onBlur={() => setTimeout(() => setIsSearchOpen(false), 200)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-[10px] tracking-widest uppercase outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 text-slate-900 transition-all placeholder:text-slate-400"
                      />
                    </div>

                    {isSearchOpen && searchQuery && (
                      <div className="absolute top-full left-3 right-3 mt-1 bg-white border border-slate-200 shadow-xl rounded-md z-30 max-h-64 overflow-y-auto">
                        {filteredTerminalInventory.length === 0 ? (
                          <div className="p-4 text-center text-[10px] text-slate-500 uppercase tracking-widest">NO PRODUCTS FOUND</div>
                        ) : (
                          filteredTerminalInventory.map(item => (
                            <div 
                              key={item.sku} 
                              onClick={() => handleAddToCart(item)}
                              className="px-4 py-2.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                            >
                              <div>
                                <p className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">{item.name}</p>
                                <p className="text-[9px] text-slate-400 font-mono mt-1 tracking-widest">SKU: {item.sku} <span className="ml-2 text-slate-300">|</span> <span className={`ml-2 ${(Number(item.stock)||0) <= 0 ? 'text-red-500' : 'text-emerald-500'}`}>STOCK: {(Number(item.stock)||0)}</span></p>
                              </div>
                              <span className="text-[11px] font-bold text-indigo-600">₱{(Number(item.price)||0).toFixed(2)}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 grid grid-cols-5 items-center z-10">
                    <span className="col-span-2 text-[10px] uppercase tracking-widest text-slate-500 font-bold">ITEM</span>
                    <span className="text-center text-[10px] uppercase tracking-widest text-slate-500 font-bold">QTY</span>
                    <span className="text-right text-[10px] uppercase tracking-widest text-slate-500 font-bold">TOTAL</span>
                    <span></span>
                  </div>
                  <div className="flex-1 overflow-y-auto z-10 bg-white rounded-b-xl">
                    {cart.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3 pb-10">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4v16m8-8H4"></path></svg>
                        <p className="text-[10px] font-bold uppercase tracking-widest">SCAN OR SEARCH ITEM</p>
                      </div>
                    ) : (
                      <div className="p-1 space-y-0.5">
                        {cart.map((item, i) => (
                          <div key={i} className="grid grid-cols-5 px-4 py-2 items-center bg-white hover:bg-slate-50 rounded-lg transition-colors group border border-transparent hover:border-slate-100">
                            <span className="col-span-2 text-[11px] font-bold text-slate-900 uppercase tracking-widest">{item.name}</span>
                            
                            <div className="text-center">
                              <input 
                                type="number" 
                                min="1"
                                value={item.qty}
                                onChange={(e) => handleUpdateCartQty(item.sku, e.target.value)}
                                className="w-12 text-center text-[11px] font-bold border border-slate-300 rounded bg-white text-slate-900 py-1 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>

                            <span className="text-right text-[11px] font-bold text-slate-900 tracking-widest">₱{((Number(item.price)||0) * (Number(item.qty)||0)).toFixed(2)}</span>
                            <div className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setCart(prev => prev.filter(x => x.sku !== item.sku))} className="text-[9px] font-bold uppercase tracking-widest text-red-600 hover:text-red-700 bg-red-50 px-2 py-1 rounded border border-red-200 transition-colors">VOID</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col h-fit sticky top-0">
                  <div className="flex justify-between items-end mb-6 border-b border-slate-100 pb-5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">TOTAL DUE</span>
                    <span className="text-2xl font-bold text-slate-900 tracking-tight">₱{safeTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>
                  <div className="mb-6">
                    <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">CASH TENDERED</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₱</span>
                      <input 
                        type="number" 
                        min={safeTotalDue} 
                        step="0.01" 
                        value={amountTendered} 
                        onChange={(e) => setAmountTendered(e.target.value)} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && cart.length > 0 && safeChange >= 0) {
                            handleCheckout();
                          }
                        }}
                        disabled={cart.length === 0} 
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50 placeholder:text-slate-300 text-slate-900" 
                        placeholder="0.00" 
                      />
                    </div>
                    
                    <div className="flex justify-between items-center mt-5 pt-5 border-t border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">CHANGE</span>
                      <span className={`text-lg font-bold tracking-tight ${safeChange >= 0 ? 'text-emerald-600' : 'text-slate-400'}`}>₱{safeChange >= 0 ? safeChange.toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}</span>
                    </div>
                  </div>
                  <button onClick={handleCheckout} disabled={cart.length === 0 || safeChange < 0} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 transition-colors shadow-sm">CHECKOUT (ENTER)</button>
                </div>
              </div>
            )
          )}

          {isAddingProduct && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-all">
              <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-md w-full">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest">{editingProduct ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</h2>
                </div>
                <form onSubmit={handleSaveProduct} className="flex flex-col gap-4">
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 block">PRODUCT NAME</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 block">CATEGORY</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all">
                      <option value="FOODS">FOODS</option>
                      <option value="DRINKS">DRINKS</option>
                      <option value="SUPPLIES">SUPPLIES</option>
                      <option value="OTHER">OTHER</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 block">COST (₱)</label>
                      <input required type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 block">PRICE (₱)</label>
                      <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 block">SKU</label>
                      <input required type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase" />
                    </div>
                    {editingProduct ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mb-1.5 block">CURRENT</label>
                          <input type="number" value={formData.stock} disabled className="w-full bg-slate-100 border border-slate-200 px-3 py-2 rounded-md text-xs font-bold text-slate-500 outline-none cursor-not-allowed" />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase tracking-widest text-indigo-500 font-bold mb-1.5 block">ADD</label>
                          <input type="number" value={addStockAmount} onChange={e => setAddStockAmount(e.target.value)} className="w-full bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-md text-xs font-bold text-indigo-700 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" placeholder="0" />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 block">STOCK</label>
                        <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200">
                    <button type="button" onClick={() => setIsAddingProduct(false)} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors">CANCEL</button>
                    <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors">SAVE PRODUCT</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isAddingUser && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-6">ADD TEAM MEMBER</h2>
                <form onSubmit={handleSaveUser} className="space-y-4">
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 block">FULL NAME</label>
                    <input required type="text" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-xs font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all uppercase" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 block">4-DIGIT PIN</label>
                    <input required type="password" maxLength="4" value={userFormData.pin} onChange={e => setUserFormData({...userFormData, pin: e.target.value})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-xs tracking-widest font-bold text-indigo-600 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-center" placeholder="••••" />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1.5 block">ROLE</label>
                    <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-[10px] uppercase tracking-widest font-bold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all appearance-none">
                      <option value="cashier">CASHIER</option>
                      <option value="manager">MANAGER</option>
                    </select>
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
                    <button type="button" onClick={() => setIsAddingUser(false)} className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors">CANCEL</button>
                    <button type="submit" className="px-5 py-2 bg-indigo-600 text-white rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors shadow-sm">SAVE</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {printRequest && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center print:static print:bg-transparent print:block p-4 z-50">
              <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:shadow-none print:m-0 print:w-full print:border-none print:bg-white">
                <div className="flex justify-between items-center mb-6 print:hidden">
                  <h2 className="text-sm font-bold uppercase tracking-widest text-slate-900">PRINT LABELS</h2>
                  <button onClick={() => setPrintRequest(null)} className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900">CANCEL</button>
                </div>
                <div className="flex items-end gap-4 mb-8 print:hidden border-b border-slate-200 pb-8 bg-slate-50 p-6 rounded-xl">
                  <div className="flex-1">
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">PRODUCT</label>
                    <div className="text-xs font-bold text-slate-900 bg-white px-3 py-2 border border-slate-300 rounded-md uppercase">{printRequest.product?.name || ''}</div>
                  </div>
                  <div className="w-24">
                    <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">QTY</label>
                    <input type="number" min="1" max="1000" value={printRequest.qty} onChange={e => setPrintRequest({...printRequest, qty: parseInt(e.target.value) || 1})} className="w-full bg-white border border-slate-300 px-3 py-2 rounded-md text-xs font-bold text-slate-900 outline-none" />
                  </div>
                  <button onClick={() => window.print()} className="bg-indigo-600 text-white px-5 py-2 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-indigo-700">PRINT</button>
                </div>
                <div className="flex flex-wrap gap-4 print:gap-2 justify-center">
                  {Array.from({ length: printRequest.qty }).map((_, i) => (
                    <div key={i} className="border border-slate-300 p-4 w-auto min-w-[10rem] flex flex-col items-center justify-center bg-white print:border-black print:break-inside-avoid rounded-md">
                      <span className="text-[10px] font-bold text-black truncate w-full text-center mb-2 uppercase">{printRequest.product?.name || ''}</span>
                      <div className="flex justify-center w-full overflow-hidden"><Barcode value={printRequest.product?.sku || '0'} width={1.2} height={35} fontSize={10} displayValue={true} margin={0} background="transparent" /></div>
                      <span className="font-bold text-[11px] mt-2 text-black">₱{(Number(printRequest.product?.price) || 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {receiptData && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center print:static print:bg-transparent print:block p-4 z-50">
              <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:shadow-none print:m-0 print:w-full print:border-none print:bg-white">
                <div className="flex justify-between items-center mb-6 print:hidden border-b border-slate-200 pb-4">
                  <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">TRANSACTION COMPLETE</h2>
                </div>
                
                <div className="bg-white p-6 rounded-md print:p-0">
                  <div className="font-mono text-[10px] text-slate-900 print:w-[300px] print:mx-auto">
                    <div className="text-center mb-4">
                      <h1 className="text-xs font-bold uppercase tracking-widest mb-1">MyPOS Store</h1>
                      <p className="uppercase">RECEIPT: {receiptData.id}</p>
                      <p className="uppercase">{receiptData.timestamp}</p>
                      <p className="uppercase">CASHIER: {receiptData.cashier}</p>
                    </div>
                    <div className="border-t border-b border-dashed border-slate-400 py-2 mb-2">
                      <table className="w-full">
                        <tbody>
                          {receiptData.items.map((item, i) => (
                            <tr key={i} className="align-top">
                              <td className="py-1 w-6">{item.qty}X</td>
                              <td className="py-1 pr-2 font-bold uppercase">{item.name}</td>
                              <td className="py-1 text-right font-bold">₱{((Number(item.price)||0) * (Number(item.qty)||0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-between font-bold text-[11px] mb-1"><span>TOTAL</span><span>₱{(Number(receiptData.totalDue)||0).toFixed(2)}</span></div>
                    <div className="flex justify-between mb-1"><span>CASH</span><span>₱{(Number(receiptData.tendered)||0).toFixed(2)}</span></div>
                    <div className="flex justify-between mb-4 font-bold"><span>CHANGE</span><span>₱{(Number(receiptData.changeDue)||0).toFixed(2)}</span></div>
                    <div className="text-center border-t border-dashed border-slate-400 pt-3 flex flex-col items-center">
                      <p className="mb-2 uppercase tracking-widest text-[9px]">THANK YOU</p>
                      <Barcode value={receiptData.id} width={1} height={20} fontSize={9} displayValue={false} margin={0} background="transparent" />
                    </div>
                  </div>
                </div>

                <div className="mt-8 print:hidden flex gap-3">
                  <button onClick={() => window.print()} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">PRINT (ENTER)</button>
                  <button onClick={() => setReceiptData(null)} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 py-2.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors">NEW SALE</button>
                </div>
              </div>
            </div>
          )}

          {activeView === 'zreading' && activeShift && (
            <div className="max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 mt-10">
              <div className="mb-8 border-b border-slate-200 pb-6 text-center">
                <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center mx-auto mb-4 border border-red-100">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest">CLOSE REGISTER</h3>
                <p className="text-[9px] text-slate-500 mt-1 uppercase tracking-widest">COUNT PHYSICAL CASH TO COMPLETE Z-READING</p>
              </div>
              
              <div className="grid grid-cols-2 gap-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">STARTING FLOAT</p>
                  <p className="text-lg font-bold text-slate-900 tracking-tight">₱{activeShift.starting_float.toFixed(2)}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-1">SYSTEM EXPECTED</p>
                  <p className="text-lg font-bold text-indigo-600 tracking-tight">₱{activeShift.expected_cash.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="mb-8">
                <label className="block text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-2">ACTUAL CASH COUNTED (₱)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-sm">₱</span>
                  <input type="number" step="0.01" value={zReadingCash} onChange={(e) => setZReadingCash(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all shadow-sm" placeholder="0.00" autoFocus />
                </div>
              </div>
              
              {zReadingCash !== '' && (
                <div className={`p-4 rounded-lg mb-8 flex justify-between items-center shadow-sm transition-colors ${parseFloat(zReadingCash) - activeShift.expected_cash < 0 ? 'bg-red-50 text-red-600 border border-red-200' : parseFloat(zReadingCash) - activeShift.expected_cash > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-900 text-white'}`}>
                  <span className="text-[10px] uppercase tracking-widest font-bold">VARIANCE</span>
                  <span className="text-sm font-bold tracking-tight">{(parseFloat(zReadingCash) - activeShift.expected_cash) > 0 ? '+' : ''}₱{(parseFloat(zReadingCash) - activeShift.expected_cash).toFixed(2)}</span>
                </div>
              )}
              
              <button onClick={handleCloseShift} disabled={zReadingCash === ''} className="w-full bg-indigo-600 text-white py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-indigo-700 transition-colors shadow-sm">CONFIRM & END SHIFT</button>
            </div>
          )}

          {zReadingReceipt && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center print:static print:bg-transparent print:block p-4 z-50">
              <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-sm w-full max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:shadow-none print:m-0 print:w-full print:border-none print:bg-white">
                <div className="flex justify-between items-center mb-6 print:hidden border-b border-slate-200 pb-4">
                  <h2 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">END OF DAY REPORT</h2>
                </div>
                <div className="font-mono text-[10px] text-slate-900 print:w-[300px] print:mx-auto">
                  <div className="text-center mb-5"><h1 className="text-xs font-bold uppercase tracking-widest border-b border-slate-400 pb-1 inline-block">Z-READING</h1></div>
                  <div className="border-t border-dashed border-slate-400 py-2 mb-2 space-y-1 uppercase">
                    <p>SHIFT: {zReadingReceipt.id}</p>
                    <p>OPEN: {zReadingReceipt.start_time}</p>
                    <p>CLOSE: {zReadingReceipt.end_time}</p>
                    <p>BY: {currentUser.name}</p>
                  </div>
                  <div className="border-t border-b border-dashed border-slate-400 py-2 mb-2 space-y-1.5 uppercase">
                    <div className="flex justify-between"><span>FLOAT:</span><span>₱{zReadingReceipt.starting_float.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold"><span>EXPECTED:</span><span>₱{zReadingReceipt.expected_cash.toFixed(2)}</span></div>
                    <div className="flex justify-between font-bold"><span>ACTUAL:</span><span>₱{zReadingReceipt.actual_cash.toFixed(2)}</span></div>
                  </div>
                  <div className="flex justify-between font-bold text-[11px] uppercase"><span>VARIANCE:</span><span>₱{zReadingReceipt.difference.toFixed(2)}</span></div>
                </div>
                <div className="mt-8 print:hidden flex gap-3">
                  <button onClick={() => window.print()} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">PRINT (ENTER)</button>
                  <button onClick={() => { setZReadingReceipt(null); setActiveView('terminal'); }} className="flex-1 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors">DONE</button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}