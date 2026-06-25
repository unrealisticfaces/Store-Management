import React, { useState, useEffect, useRef } from 'react';
import Barcode from 'react-barcode';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';
import { ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, Tooltip, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

if (typeof window !== 'undefined' && !window.electronAPI) {
  window.electronAPI = {
    getInventory: async () => JSON.parse(localStorage.getItem('pos_inv') || '[]'),
    addProduct: async (p) => {
      const inv = JSON.parse(localStorage.getItem('pos_inv') || '[]');
      const newItem = { ...p, id: Date.now() };
      localStorage.setItem('pos_inv', JSON.stringify([...inv, newItem]));
      return newItem;
    },
    updateProduct: async (p) => {
      const inv = JSON.parse(localStorage.getItem('pos_inv') || '[]');
      localStorage.setItem('pos_inv', JSON.stringify(inv.map(i => i.id === p.id ? p : i)));
    },
    deleteProduct: async (id) => {
      const inv = JSON.parse(localStorage.getItem('pos_inv') || '[]');
      localStorage.setItem('pos_inv', JSON.stringify(inv.filter(i => i.id !== id)));
    },
    getSales: async () => JSON.parse(localStorage.getItem('pos_sales') || '[]'),
    addSale: async (s) => {
      const sales = JSON.parse(localStorage.getItem('pos_sales') || '[]');
      localStorage.setItem('pos_sales', JSON.stringify([...sales, s]));
    },
    getLogs: async () => JSON.parse(localStorage.getItem('pos_logs') || '[]'),
    addLog: async (l) => {
      const logs = JSON.parse(localStorage.getItem('pos_logs') || '[]');
      localStorage.setItem('pos_logs', JSON.stringify([{ ...l, id: Date.now() }, ...logs]));
    },
    getUsers: async () => JSON.parse(localStorage.getItem('pos_users') || '[{"id":1,"username":"admin","name":"System Admin","role":"manager","password":"admin123"}]'),
    addUser: async (u) => {
      const users = JSON.parse(localStorage.getItem('pos_users') || '[{"id":1,"username":"admin","name":"System Admin","role":"manager","password":"admin123"}]');
      localStorage.setItem('pos_users', JSON.stringify([...users, { ...u, id: Date.now() }]));
      return { success: true };
    },
    deleteUser: async (id) => {
      const users = JSON.parse(localStorage.getItem('pos_users') || '[{"id":1,"username":"admin","name":"System Admin","role":"manager","password":"admin123"}]');
      localStorage.setItem('pos_users', JSON.stringify(users.filter(i => i.id !== id)));
    },
    updateUserPassword: async (id, newPassword) => {
      const users = JSON.parse(localStorage.getItem('pos_users') || '[{"id":1,"username":"admin","name":"System Admin","role":"manager","password":"admin123"}]');
      localStorage.setItem('pos_users', JSON.stringify(users.map(u => u.id === id ? { ...u, password: newPassword } : u)));
      return { success: true };
    },
    loginUser: async ({ username, password }) => {
      const users = JSON.parse(localStorage.getItem('pos_users') || '[{"id":1,"username":"admin","name":"System Admin","role":"manager","password":"admin123"}]');
      return users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password) || null;
    },
    getActiveShift: async () => JSON.parse(localStorage.getItem('pos_shift') || 'null'),
    openShift: async (s) => localStorage.setItem('pos_shift', JSON.stringify(s)),
    closeShift: async (s) => {
      const shifts = JSON.parse(localStorage.getItem('pos_shifts') || '[]');
      localStorage.setItem('pos_shifts', JSON.stringify([{...s, id: s.id || Date.now()}, ...shifts]));
      localStorage.removeItem('pos_shift');
    },
    getAllShifts: async () => JSON.parse(localStorage.getItem('pos_shifts') || '[]'),
    adjustShiftCash: async (req) => {
      const shift = JSON.parse(localStorage.getItem('pos_shift') || 'null');
      if (shift) {
        shift.expected_cash += req.amount;
        localStorage.setItem('pos_shift', JSON.stringify(shift));
      }
    },
    getPrinters: async () => [],
    printSilent: async () => { window.print(); },
    triggerCashDrawer: async () => {}
  };
}

const CHART_COLORS = ['#f59e0b', '#d97706', '#b45309', '#fcd34d', '#fef3c7'];
const ITEMS_PER_PAGE = 15;

const MENU_GROUPS = [
  {
    title: "MAIN MENU",
    roles: ['manager', 'cashier'],
    items: [
      { id: 'terminal', label: 'TERMINAL', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' }
    ]
  },
  {
    title: "GENERAL",
    roles: ['manager'],
    items: [
      { id: 'dashboard', label: 'DASHBOARD', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
      { id: 'sales', label: 'TRANSACTIONS', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
      { id: 'finance', label: 'BALANCES', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'inventory', label: 'PRODUCTS', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { id: 'stocks', label: 'STOCK REPORTS', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { id: 'accounts', label: 'ACCOUNTS', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' }
    ]
  },
  {
    title: "UPDATES",
    roles: ['manager'],
    items: [
      { id: 'logs', label: 'AUDIT LOGS', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'settings', label: 'SETTINGS', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
    ]
  }
];

export default function App() {
  const [activeView, setActiveView] = useState('terminal');
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [logs, setLogs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  
  const [cart, setCart] = useState([]);
  const [selectedCartSku, setSelectedCartSku] = useState(null);
  const [heldCarts, setHeldCarts] = useState([]);
  
  const [activeShift, setActiveShift] = useState(null);
  const [floatInput, setFloatInput] = useState('');
  const [zReadingCash, setZReadingCash] = useState('');
  const [zReadingReceipt, setZReadingReceipt] = useState(null);

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', category: 'FOODS', cost: '', price: '', sku: '', stock: '' });
  const [addStockAmount, setAddStockAmount] = useState('');
  const [stockAdjustmentReason, setStockAdjustmentReason] = useState('RESTOCK');
  
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [userFormData, setUserFormData] = useState({ username: '', name: '', password: '', role: 'cashier' });
  const [showAddUserPassword, setShowAddUserPassword] = useState(false);

  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState(null);
  const [resetPasswordData, setResetPasswordData] = useState({ newPassword: '', confirmPassword: '' });
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  
  const [confirmDialog, setConfirmDialog] = useState(null);

  const [amountTendered, setAmountTendered] = useState('');
  const [printRequest, setPrintRequest] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printLabelData, setPrintLabelData] = useState({ sku: '', qty: 1 });
  const [printSearchQuery, setPrintSearchQuery] = useState('');
  const [printCategoryFilter, setPrintCategoryFilter] = useState('ALL');

  const [searchQuery, setSearchQuery] = useState('');
  const [terminalCategory, setTerminalCategory] = useState('ALL');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);

  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashDropData, setCashDropData] = useState({ amount: '', type: 'OUT', reason: '' });

  const [salesCashierFilter, setSalesCashierFilter] = useState('ALL');
  const [salesDateFilter, setSalesDateFilter] = useState('TODAY');
  const [salesCustomDate, setSalesCustomDate] = useState('');
  const [salesSearchQuery, setSalesSearchQuery] = useState('');

  const [inventorySearchQuery, setInventorySearchQuery] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('ALL');
  const [stocksSearchQuery, setStocksSearchQuery] = useState('');
  const [stocksCategoryFilter, setStocksCategoryFilter] = useState('ALL');
  const [logFilter, setLogFilter] = useState('ALL');

  const [salesPage, setSalesPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [stocksPage, setStocksPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  const [notification, setNotification] = useState(null);
  const [systemPrinters, setSystemPrinters] = useState([]);
  const [theme, setTheme] = useState(() => localStorage.getItem('pos_theme') || 'dark');

  const searchInputRef = useRef(null);
  const amountInputRef = useRef(null);

  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('pos_settings');
    return saved ? JSON.parse(saved) : { 
      storeName: 'ProjectX', 
      storeAddress: '123 Innovation Drive',
      contactNumber: '+1 (555) 019-2834',
      vatRate: 12,
      currencySymbol: '₱',
      lowStockThreshold: 5,
      printerName: 'NONE',
      autoPrint: false,
      kickDrawer: false,
      receiptFooter: 'THANK YOU FOR YOUR BUSINESS'
    };
  });

  useEffect(() => { localStorage.setItem('pos_settings', JSON.stringify(settings)); }, [settings]);
  
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('pos_theme', theme);
  }, [theme]);

  useEffect(() => { setSalesPage(1); }, [salesSearchQuery, salesCashierFilter, salesDateFilter, salesCustomDate]);
  useEffect(() => { setInventoryPage(1); }, [inventorySearchQuery, inventoryCategoryFilter]);
  useEffect(() => { setStocksPage(1); }, [stocksSearchQuery, stocksCategoryFilter]);
  useEffect(() => { setLogsPage(1); }, [logFilter]);

  useEffect(() => {
    async function loadData() {
      try {
        setInventory(await window.electronAPI.getInventory() || []);
        const dbSales = await window.electronAPI.getSales() || [];
        setSales(dbSales.map(sale => ({ ...sale, items: sale.items ? (typeof sale.items === 'string' ? JSON.parse(sale.items) : sale.items) : [] })));
        setLogs(await window.electronAPI.getLogs() || []);
        setActiveShift(await window.electronAPI.getActiveShift() || null);
        setUsers(await window.electronAPI.getUsers() || []);
        setShifts(await window.electronAPI.getAllShifts() || []);
        if (window.electronAPI.getPrinters) setSystemPrinters(await window.electronAPI.getPrinters() || []);
      } catch (error) {}
    }
    loadData();
  }, [activeView, notification]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Enter') {
        if (receiptData || zReadingReceipt || printRequest) {
          e.preventDefault();
          executePrint();
        }
      }
      if (e.key === 'F1') {
        e.preventDefault();
        if (activeView === 'terminal' && searchInputRef.current) searchInputRef.current.focus();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        if (activeView === 'terminal' && amountInputRef.current) amountInputRef.current.focus();
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (activeView === 'terminal' && cart.length > 0) handleHoldCart();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  });

  useEffect(() => {
    if (receiptData && !receiptData.isReprint && settings.autoPrint && settings.printerName !== 'NONE') {
      const timer = setTimeout(() => {
        executePrint();
        setReceiptData(null);
        showNotification('RECEIPT PROCESSED', 'success');
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [receiptData, settings.autoPrint]);

  const executePrint = () => {
    if (settings.autoPrint && settings.printerName !== 'NONE' && window.electronAPI) {
      try {
        if (settings.kickDrawer && window.electronAPI.triggerCashDrawer) window.electronAPI.triggerCashDrawer(settings.printerName);
        if (window.electronAPI.printSilent) window.electronAPI.printSilent(settings.printerName);
        else window.print();
      } catch (err) { window.print(); }
    } else {
      window.print();
    }
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const addLog = async (action, details) => {
    try {
      const timestamp = new Date().toLocaleString();
      await window.electronAPI.addLog({ action, details, timestamp });
    } catch (e) {}
  };

  const handleLogin = async () => {
    try {
      const user = await window.electronAPI.loginUser({ username: loginUsername, password: loginPassword });
      if (user) {
        const currentShift = await window.electronAPI.getActiveShift();
        if (currentShift && currentShift.opened_by !== user.name && user.role !== 'manager') {
          showNotification(`SHIFT IN USE BY ${currentShift.opened_by.toUpperCase()}.`, 'error');
          return;
        }
        setCurrentUser(user);
        setActiveView(user.role === 'manager' ? 'dashboard' : 'terminal');
        addLog('SYSTEM LOGIN', JSON.stringify({ msg: `${user.name} AUTHENTICATED`, category: 'SYSTEM', qty: '-' }));
      } else {
        showNotification('INVALID CREDENTIALS', 'error');
      }
      setLoginPassword('');
    } catch (e) {
      showNotification('SERVICE OFFLINE', 'error');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginUsername(''); setLoginPassword(''); setCart([]); setHeldCarts([]);
    setAmountTendered(''); setSelectedCartSku(null); setTerminalCategory('ALL'); setActiveView('terminal');
  };

  useBarcodeScanner((scannedSku) => {
    if (!currentUser || !activeShift || isAddingProduct || isAddingUser || printRequest || isPrintModalOpen || isResetPasswordModalOpen || receiptData || zReadingReceipt || isResumeOpen || isCashModalOpen || confirmDialog) return;
    const product = inventory.find(p => p.sku === scannedSku);
    if (!product) { showNotification(`SKU ${scannedSku} NOT FOUND`, 'error'); return; }
    handleAddToCart(product);
  });

  const handleAddToCart = (product) => {
    if (product.stock <= 0) {
      showNotification(`${product.name.toUpperCase()} OUT OF STOCK`, 'warning');
      return;
    }
    setActiveView('terminal');
    setCart(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const exists = safePrev.find(item => item.sku === product.sku);
      if (exists) return safePrev.map(item => item.sku === product.sku ? { ...item, qty: (item.qty || 0) + 1 } : item);
      return [...safePrev, { ...product, qty: 1 }];
    });
    setSelectedCartSku(product.sku);
    setSearchQuery(''); setIsSearchOpen(false);
  };

  const handleUpdateCartQty = (sku, newQty) => {
    if (newQty === '') {
      setCart(prev => prev.map(item => item.sku === sku ? { ...item, qty: '' } : item));
      return;
    }
    let qty = parseInt(newQty);
    if (isNaN(qty) || qty < 1) return;
    setCart(prev => prev.map(item => item.sku === sku ? { ...item, qty } : item));
  };

  const handleVoidCartItem = (sku, name) => {
    setCart(prev => prev.filter(x => x.sku !== sku));
    if (selectedCartSku === sku) setSelectedCartSku(null);
    addLog('CART ITEM VOID', JSON.stringify({ msg: `VOIDED ${name} BY ${currentUser.name}`, category: 'SECURITY', qty: '-' }));
  };

  const handleHoldCart = () => {
    if (cart.length === 0) return;
    if (cart.some(item => !item.qty || item.qty < 1)) {
      showNotification('INVALID QUANTITY IN CART', 'error');
      return;
    }
    setHeldCarts([...heldCarts, { id: Date.now(), cart }]);
    setCart([]); setAmountTendered(''); setSelectedCartSku(null);
    showNotification('CART SUSPENDED', 'success');
  };

  const handleResumeCart = (index) => {
    if (cart.length > 0) { showNotification('CLEAR CURRENT CART FIRST', 'warning'); return; }
    const target = heldCarts[index];
    setCart(target.cart);
    setHeldCarts(heldCarts.filter((_, i) => i !== index));
    setIsResumeOpen(false);
  };

  const handleCashAdjustmentSubmit = async (e) => {
    e.preventDefault();
    const amount = parseFloat(cashDropData.amount);
    if (isNaN(amount) || amount <= 0 || !cashDropData.reason) return;
    try {
      const adjustment = cashDropData.type === 'OUT' ? -amount : amount;
      await window.electronAPI.adjustShiftCash({ amount: adjustment, reason: cashDropData.reason });
      setActiveShift(await window.electronAPI.getActiveShift() || activeShift);
      setLogs(await window.electronAPI.getLogs() || logs);
      setIsCashModalOpen(false); setCashDropData({ amount: '', type: 'OUT', reason: '' });
      showNotification('DRAWER LOG UPDATED', 'success');
    } catch (err) { showNotification('UPDATE FAILED', 'error'); }
  };

  const handleCheckout = async () => {
    try {
      if (!cart || cart.length === 0) return;
      if (cart.some(item => !item.qty || item.qty < 1)) {
        showNotification('INVALID QUANTITY IN CART', 'error');
        return;
      }

      const totalDue = cart.reduce((sum, item) => sum + ((Number(item.price)||0) * (Number(item.qty)||0)), 0);
      const vatMultiplier = 1 + (settings.vatRate / 100);
      const vatableSales = totalDue / vatMultiplier;
      const vatAmount = totalDue - vatableSales;
      const totalCost = cart.reduce((sum, item) => sum + ((Number(item.cost)||0) * (Number(item.qty)||0)), 0);
      const totalProfit = totalDue - totalCost;
      let tendered = parseFloat(amountTendered);
      let changeDue = 0;

      if (totalDue > 0) {
        if (isNaN(tendered) || tendered < totalDue) { showNotification('INSUFFICIENT TENDER', 'error'); return; }
        changeDue = tendered - totalDue;
      } else { tendered = totalDue; changeDue = 0; }

      const timestamp = new Date().toLocaleString();
      const saleId = `INV-${Date.now()}`;
      
      await window.electronAPI.addSale({ id: saleId, cashier: currentUser.name, items: cart, subtotal: totalDue, discount: 0, total: totalDue, profit: totalProfit, timestamp });
      setInventory(await window.electronAPI.getInventory() || inventory);
      setSales(await window.electronAPI.getSales() || sales);
      setActiveShift(await window.electronAPI.getActiveShift() || activeShift);
      
      setReceiptData({ id: saleId, timestamp, items: [...cart], subtotal: totalDue, discountValue: 0, totalDue, vatableSales, vatAmount, tendered, changeDue, cashier: currentUser.name, isReprint: false });
      setCart([]); setAmountTendered(''); setSelectedCartSku(null); setTerminalCategory('ALL');
      if (!settings.autoPrint) showNotification('TRANSACTION SUCCESSFUL', 'success');
    } catch (e) { showNotification('TRANSACTION ERROR', 'error'); }
  };

  const handleReprintReceipt = (sale) => {
    try {
      const parsedItems = Array.isArray(sale.items) ? sale.items : JSON.parse(sale.items);
      const totalDue = sale.total || 0;
      const vatMultiplier = 1 + (settings.vatRate / 100);
      const vatableSales = totalDue / vatMultiplier;
      const vatAmount = totalDue - vatableSales;
      setReceiptData({ id: sale.id, timestamp: sale.timestamp, cashier: sale.cashier || 'UNKNOWN', items: parsedItems, subtotal: sale.subtotal, discountValue: 0, totalDue, vatableSales, vatAmount, tendered: totalDue, changeDue: 0, isReprint: true });
    } catch (err) { showNotification('RECEIPT FORMAT ERROR', 'error'); }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      const cost = parseFloat(formData.cost) || 0;
      const price = parseFloat(formData.price) || 0;
      const added = parseInt(addStockAmount) || 0;
      const stock = editingProduct ? (parseInt(formData.stock) || 0) + added : (parseInt(formData.stock) || 0);

      if (!formData.name || !formData.sku) return;
      const duplicate = inventory.find(i => (i.sku.toLowerCase() === formData.sku.toLowerCase() || i.name.toLowerCase() === formData.name.toLowerCase()) && (!editingProduct || i.id !== editingProduct.id));
      if (duplicate) { showNotification('SKU/NAME CONFLICT', 'error'); return; }

      const logData = {
        msg: editingProduct ? (added !== 0 ? `STOCK [${stockAdjustmentReason}] FOR ${formData.name}` : `UPDATED ${formData.name}`) : `CREATED ${formData.name}`,
        category: formData.category,
        qty: editingProduct ? (added !== 0 ? (added > 0 ? `+${added}` : `${added}`) : '-') : stock
      };

      if (editingProduct) {
        await window.electronAPI.updateProduct({ id: editingProduct.id, name: formData.name, category: formData.category, cost, price, sku: formData.sku, stock });
        addLog(added !== 0 ? 'STOCK ADJUSTMENT' : 'UPDATE PRODUCT', JSON.stringify(logData));
        showNotification('SAVED', 'success');
      } else {
        await window.electronAPI.addProduct({ name: formData.name, category: formData.category, cost, price, sku: formData.sku, stock });
        addLog('ADD PRODUCT', JSON.stringify(logData));
        showNotification('CREATED', 'success');
      }
      setInventory(await window.electronAPI.getInventory() || inventory);
      setIsAddingProduct(false); setEditingProduct(null); setAddStockAmount(''); setStockAdjustmentReason('RESTOCK'); setFormData({ name: '', category: 'FOODS', cost: '', price: '', sku: '', stock: '' });
    } catch (e) { showNotification('DATABASE ERROR', 'error'); }
  };

  const handleDeleteProduct = (id, name, category) => {
    setConfirmDialog({
      message: `PERMANENTLY DELETE ${name.toUpperCase()}?`,
      onConfirm: async () => {
        await window.electronAPI.deleteProduct(id);
        addLog('DELETE PRODUCT', JSON.stringify({ msg: `DELETED ${name}`, category, qty: '-' }));
        setInventory(await window.electronAPI.getInventory() || inventory);
        showNotification('PRODUCT DELETED', 'info');
        setConfirmDialog(null);
      }
    });
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    try {
      if (!userFormData.username || !userFormData.password || !userFormData.name) return;
      const res = await window.electronAPI.addUser({ ...userFormData, username: userFormData.username.toLowerCase() });
      if (res && !res.success) { showNotification('USERNAME TAKEN', 'error'); return; }
      setUsers(await window.electronAPI.getUsers() || users);
      setIsAddingUser(false); setUserFormData({ username: '', name: '', password: '', role: 'cashier' });
      showNotification('ACCOUNT GENERATED', 'success');
    } catch (e) {}
  };

  const handleDeleteUser = (id, name) => {
    setConfirmDialog({
      message: `REVOKE ALL ACCESS FOR ${name.toUpperCase()}?`,
      onConfirm: async () => {
        await window.electronAPI.deleteUser(id);
        setUsers(await window.electronAPI.getUsers() || users);
        showNotification('ACCESS REVOKED', 'info');
        setConfirmDialog(null);
      }
    });
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      showNotification('PASSWORDS DO NOT MATCH', 'error');
      return;
    }
    if (resetPasswordData.newPassword.length < 4) {
      showNotification('PASSWORD TOO SHORT', 'warning');
      return;
    }
    try {
      if (window.electronAPI.updateUserPassword) {
        await window.electronAPI.updateUserPassword(resetTargetUser.id, resetPasswordData.newPassword);
        setUsers(await window.electronAPI.getUsers() || users);
        showNotification('PASSWORD UPDATED', 'success');
      }
      setIsResetPasswordModalOpen(false);
      setResetTargetUser(null);
      setResetPasswordData({ newPassword: '', confirmPassword: '' });
      setShowResetNewPassword(false);
      setShowResetConfirmPassword(false);
    } catch (e) { showNotification('FAILED TO UPDATE PASSWORD', 'error'); }
  };

  const handleOpenShift = async () => {
    try {
      const float = parseFloat(floatInput);
      if (isNaN(float) || float < 0) return;
      await window.electronAPI.openShift({ id: `SHIFT-${Date.now()}`, opened_by: currentUser.name, start_time: new Date().toLocaleString(), starting_float: float });
      setActiveShift(await window.electronAPI.getActiveShift() || activeShift);
      setFloatInput('');
      showNotification('REGISTER OPENED', 'success');
    } catch (e) {}
  };

  const handleCloseShift = async () => {
    try {
      const actual = parseFloat(zReadingCash);
      if (isNaN(actual) || actual < 0) return;
      const difference = actual - activeShift.expected_cash;
      const end_time = new Date().toLocaleString();
      await window.electronAPI.closeShift({ id: activeShift.id, actual_cash: actual, end_time });
      setZReadingReceipt({ ...activeShift, actual_cash: actual, difference, end_time });
      setActiveShift(null); setZReadingCash(''); handleLogout();
    } catch (e) {}
  };

  const downloadCSV = (data, headers, filename) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        let val = row[h];
        if (val === null || val === undefined) val = '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click();
    addLog('EXPORT DATA', JSON.stringify({ msg: `EXPORTED ${filename}`, category: 'SYSTEM', qty: '-' }));
  };

  const generatePrintLabels = (e) => {
    e.preventDefault();
    const product = inventory.find(p => p.sku === printLabelData.sku);
    if (!product) { showNotification('PLEASE SELECT A VALID PRODUCT', 'error'); return; }
    setPrintRequest({ product, qty: printLabelData.qty });
    setIsPrintModalOpen(false);
    setPrintLabelData({ sku: '', qty: 1 });
  };

  const cartSubtotal = cart.reduce((s, i) => s + ((Number(i.price)||0) * (Number(i.qty)||0)), 0);
  const safeTotalDue = cartSubtotal;
  const parsedTendered = parseFloat(amountTendered);
  const safeChange = !isNaN(parsedTendered) ? parsedTendered - safeTotalDue : -1;

  const todaysSales = sales.filter(s => s?.timestamp?.includes(new Date().toLocaleDateString()));
  const todayRevenue = todaysSales.reduce((s, x) => s + (Number(x.total)||0), 0);
  const todayProfit = todaysSales.reduce((s, x) => s + (Number(x.profit)||0), 0);

  const getMonToSun = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    
    return Array.from({length: 7}).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  };

  const weekDays = getMonToSun();
  
  const barData = weekDays.map(dateObj => {
    const dateStr = dateObj.toLocaleDateString();
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const daySales = sales.filter(s => s.timestamp && s.timestamp.includes(dateStr));
    const revenue = daySales.reduce((sum, s) => sum + (Number(s.total)||0), 0);
    return { name: dayName.toUpperCase(), Revenue: revenue };
  });

  const weekSales = sales.filter(s => {
    if (!s.timestamp) return false;
    const sd = new Date(s.timestamp);
    const firstDay = new Date(weekDays[0]);
    firstDay.setHours(0,0,0,0);
    const lastDay = new Date(weekDays[6]);
    lastDay.setHours(23,59,59,999);
    return sd >= firstDay && sd <= lastDay;
  });

  const cashierSalesAggregate = {};
  weekSales.forEach(s => {
    cashierSalesAggregate[s.cashier] = (cashierSalesAggregate[s.cashier] || 0) + (Number(s.total) || 0);
  });
  const cashierData = Object.keys(cashierSalesAggregate)
    .map(k => ({ name: k, Revenue: cashierSalesAggregate[k] }))
    .sort((a, b) => b.Revenue - a.Revenue);
  
  const topCashiers = cashierData.slice(0, 2).map(c => c.name);

  const dailyCashierData = weekDays.map(dateObj => {
    const dateStr = dateObj.toLocaleDateString();
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const obj = { name: dayName.toUpperCase() };
    topCashiers.forEach(c => {
      const daySales = weekSales.filter(s => s.cashier === c && s.timestamp && s.timestamp.includes(dateStr));
      obj[c] = daySales.reduce((sum, s) => sum + (Number(s.total)||0), 0);
    });
    return obj;
  });

  const allTimeCategoryCount = {};
  sales.forEach(s => Array.isArray(s.items) && s.items.forEach(i => { 
    const cat = i.category || 'OTHER';
    allTimeCategoryCount[cat] = (allTimeCategoryCount[cat] || 0) + (Number(i.qty)||0); 
  }));
  const pieData = Object.keys(allTimeCategoryCount).map(k => ({ name: k, value: allTimeCategoryCount[k] })).sort((a,b) => b.value - a.value);

  const filteredPrintLabelsList = inventory.filter(item => {
    const matchSearch = printSearchQuery === '' || item.name.toLowerCase().includes(printSearchQuery.toLowerCase()) || item.sku.toLowerCase().includes(printSearchQuery.toLowerCase());
    const matchCat = printCategoryFilter === 'ALL' || item.category === printCategoryFilter;
    return matchSearch && matchCat;
  }).slice(0, 50);

  const uniqueCashiers = ['ALL', ...new Set([...users.map(u => u.name), ...sales.map(s => s.cashier)].filter(Boolean))];
  
  const isDateInRange = (timestampStr, filter, customDate) => {
    if (filter === 'ALL') return true;
    const saleDate = new Date(timestampStr);
    const today = new Date(); today.setHours(0,0,0,0);
    if (filter === 'TODAY') return saleDate >= today;
    if (filter === 'THIS WEEK') return saleDate >= new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
    if (filter === 'LAST WEEK') {
        const firstDayThisWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
        const firstDayLastWeek = new Date(firstDayThisWeek); firstDayLastWeek.setDate(firstDayLastWeek.getDate() - 7);
        return saleDate >= firstDayLastWeek && saleDate < firstDayThisWeek;
    }
    if (filter === 'LAST MONTH') {
        const firstDayThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return saleDate >= firstDayLastMonth && saleDate < firstDayThisMonth;
    }
    if (filter === 'CUSTOM' && customDate) return saleDate.toLocaleDateString() === new Date(customDate).toLocaleDateString();
    return true;
  };

  const filteredSales = sales.filter(s => {
    const matchCashier = salesCashierFilter === 'ALL' || s.cashier === salesCashierFilter;
    const matchDate = isDateInRange(s.timestamp, salesDateFilter, salesCustomDate);
    let matchSearch = true;
    if (salesSearchQuery.trim() !== '') {
      const query = salesSearchQuery.toLowerCase();
      const matchId = (s.id || '').toLowerCase().includes(query);
      const matchItems = Array.isArray(s.items) && s.items.some(item => (item.name || '').toLowerCase().includes(query) || (item.sku || '').toLowerCase().includes(query));
      matchSearch = matchId || matchItems;
    }
    return matchCashier && matchDate && matchSearch;
  });
  const salesTotalPages = Math.ceil(filteredSales.length / ITEMS_PER_PAGE) || 1;
  const paginatedSales = filteredSales.slice((salesPage - 1) * ITEMS_PER_PAGE, salesPage * ITEMS_PER_PAGE);
  const totalFilteredSales = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0);
  
  const filteredLogs = logs.filter(log => {
    if (logFilter === 'ALL') return true;
    if (logFilter === 'SYSTEM') return log.action.includes('SYSTEM');
    if (logFilter === 'ADD') return log.action.includes('ADD PRODUCT');
    if (logFilter === 'EDIT') return log.action.includes('UPDATE PRODUCT') || log.action.includes('STOCK ADJUSTMENT');
    if (logFilter === 'DELETE') return log.action.includes('DELETE PRODUCT');
    return true;
  });
  const logsTotalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE) || 1;
  const paginatedLogs = filteredLogs.slice((logsPage - 1) * ITEMS_PER_PAGE, logsPage * ITEMS_PER_PAGE);

  const filteredTerminalInventory = inventory.filter(item => {
    const matchSearch = searchQuery === '' || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = terminalCategory === 'ALL' || item.category === terminalCategory;
    return matchSearch && matchCat;
  });

  const filteredInventoryView = inventory.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(inventorySearchQuery.toLowerCase()) || item.sku.toLowerCase().includes(inventorySearchQuery.toLowerCase());
    const matchCat = inventoryCategoryFilter === 'ALL' || item.category === inventoryCategoryFilter;
    return matchSearch && matchCat;
  });
  const invTotalPages = Math.ceil(filteredInventoryView.length / ITEMS_PER_PAGE) || 1;
  const paginatedInventory = filteredInventoryView.slice((inventoryPage - 1) * ITEMS_PER_PAGE, inventoryPage * ITEMS_PER_PAGE);

  const filteredStocksView = inventory.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(stocksSearchQuery.toLowerCase()) || item.sku.toLowerCase().includes(stocksSearchQuery.toLowerCase());
    const matchCat = stocksCategoryFilter === 'ALL' || item.category === stocksCategoryFilter;
    return matchSearch && matchCat;
  });
  const stocksTotalPages = Math.ceil(filteredStocksView.length / ITEMS_PER_PAGE) || 1;
  const paginatedStocks = filteredStocksView.slice((stocksPage - 1) * ITEMS_PER_PAGE, stocksPage * ITEMS_PER_PAGE);

  const totalInventoryValue = filteredStocksView.reduce((sum, item) => sum + ((Number(item.cost) || 0) * (Number(item.stock) || 0)), 0);
  const outOfStockItems = inventory.filter(i => (Number(i.stock)||0) <= 0);
  const lowStockItems = inventory.filter(i => (Number(i.stock)||0) > 0 && (Number(i.stock)||0) <= settings.lowStockThreshold);
  const outOfStockCount = outOfStockItems.length;
  const lowStockCount = lowStockItems.length;
  const notificationElement = notification && (
    <div className={`fixed bottom-6 right-6 z-50 px-6 py-4 rounded-xl shadow-lg border text-[10px] uppercase font-bold tracking-widest flex items-center gap-3 transition-opacity duration-300 transform ${
      notification.type === 'success' ? 'bg-white dark:bg-zinc-900 border-green-500/50 text-green-500 dark:text-green-400' :
      notification.type === 'error' ? 'bg-white dark:bg-zinc-900 border-red-500/50 text-red-500 dark:text-red-400' :
      notification.type === 'warning' ? 'bg-white dark:bg-zinc-900 border-amber-500/50 text-amber-500 dark:text-amber-400' :
      'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
    }`}>
      <span className={`w-2 h-2 rounded-full ${notification.type === 'success' ? 'bg-green-500' : notification.type === 'error' ? 'bg-red-500' : notification.type === 'warning' ? 'bg-amber-500' : 'bg-zinc-500'}`}></span>
      {notification.message}
    </div>
  );

  if (!currentUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 font-sans relative overflow-hidden">
        {notificationElement}
        <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-10 rounded-2xl shadow-2xl w-[400px] z-10 flex flex-col items-center">
          <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center text-zinc-950 font-bold text-xl mb-6 shadow-sm">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <h1 className="text-[15px] font-bold text-zinc-900 dark:text-zinc-100 mb-1 uppercase tracking-widest text-center">{settings.storeName}</h1>
          <p className="text-[10px] font-bold text-zinc-500 mb-8 uppercase tracking-widest text-center">AUTHENTICATION REQUIRED</p>
          
          <div className="space-y-4 mb-8 w-full">
            <div>
              <input 
                type="text" 
                value={loginUsername} 
                onChange={(e) => setLoginUsername(e.target.value)} 
                className="w-full text-[10px] font-bold py-2.5 px-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 transition-colors uppercase tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm" 
                placeholder="USERNAME" autoFocus
              />
            </div>
            <div className="relative w-full">
              <input 
                type={showLoginPassword ? "text" : "password"}
                value={loginPassword} 
                onChange={(e) => setLoginPassword(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className={`w-full pl-4 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 transition-colors placeholder:text-[10px] placeholder:font-bold placeholder:tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm ${showLoginPassword ? 'text-[10px] font-bold font-sans' : 'text-lg tracking-[0.2em] font-medium'}`} 
                placeholder="PASSWORD"
              />
              <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showLoginPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-2.29c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </button>
            </div>
          </div>
          
          <button type="button" onClick={handleLogin} className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">SIGN IN</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 selection:bg-amber-500/30 print:hidden relative overflow-hidden">
      
      {notificationElement}

      {confirmDialog && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60] transition-opacity">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full text-center">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
               <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h2 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 mb-6 uppercase tracking-widest leading-relaxed">{confirmDialog.message}</h2>
            <div className="flex justify-center gap-3">
              <button type="button" onClick={() => setConfirmDialog(null)} className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm">CANCEL</button>
              <button type="button" onClick={confirmDialog.onConfirm} className="px-6 py-2.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-500/20 transition-colors shadow-sm">CONFIRM</button>
            </div>
          </div>
        </div>
      )}

      {isAddingProduct && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-zinc-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full">
            <h2 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 mb-6 tracking-widest uppercase">{editingProduct ? 'EDIT PRODUCT' : 'NEW PRODUCT'}</h2>
            <form onSubmit={handleSaveProduct} className="flex flex-col gap-5">
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">PRODUCT NAME</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors" placeholder="E.G. PREMIUM COFFEE" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">CATEGORY</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors cursor-pointer">
                  <option value="FOODS">FOODS</option>
                  <option value="DRINKS">DRINKS</option>
                  <option value="SUPPLIES">SUPPLIES</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">COST ({settings.currencySymbol})</label>
                  <input required type="number" step="0.01" value={formData.cost} onChange={e => setFormData({...formData, cost: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors" placeholder="0.00" />
                </div>
                <div>
                  <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">PRICE ({settings.currencySymbol})</label>
                  <input required type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">SKU / BARCODE</label>
                  <input required type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors" placeholder="SCAN OR TYPE" />
                </div>
                {editingProduct ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">CURRENT</label>
                      <input type="number" value={formData.stock} disabled className="w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-500 outline-none cursor-not-allowed" />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-amber-500 mb-2 block uppercase tracking-widest">ADD STOCK</label>
                      <input type="number" value={addStockAmount} onChange={e => setAddStockAmount(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-amber-500 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-sm" placeholder="0" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">INITIAL STOCK</label>
                    <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors" placeholder="0" />
                  </div>
                )}
              </div>
              {editingProduct && parseInt(addStockAmount) > 0 && (
                <div>
                  <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">REASON</label>
                  <select value={stockAdjustmentReason} onChange={e => setStockAdjustmentReason(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors cursor-pointer">
                    <option value="RESTOCK">SUPPLIER RESTOCK</option>
                    <option value="DAMAGE">DAMAGED / SPOILED</option>
                    <option value="DISCREPANCY">AUDIT CORRECTION</option>
                    <option value="INTERNAL">INTERNAL USE</option>
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 mt-2 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => setIsAddingProduct(false)} className="px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors shadow-sm">CANCEL</button>
                <button type="submit" className="px-6 py-2.5 bg-amber-500 text-zinc-950 rounded-lg text-[10px] uppercase tracking-widest font-bold hover:bg-amber-400 transition-colors shadow-sm">SAVE PRODUCT</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddingUser && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full">
            <h2 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase mb-6">ADD TEAM MEMBER</h2>
            <form onSubmit={handleSaveUser} className="space-y-5">
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">USERNAME</label>
                <input required type="text" value={userFormData.username} onChange={e => setUserFormData({...userFormData, username: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors" placeholder="JOHNDOE" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">FULL NAME</label>
                <input required type="text" value={userFormData.name} onChange={e => setUserFormData({...userFormData, name: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors" placeholder="JOHN DOE" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">PASSWORD</label>
                <div className="relative w-full">
                  <input 
                    required 
                    type={showAddUserPassword ? "text" : "password"} 
                    value={userFormData.password} 
                    onChange={e => setUserFormData({...userFormData, password: e.target.value})} 
                    className={`w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 pl-4 pr-10 py-2.5 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 transition-colors placeholder:text-[10px] placeholder:font-bold placeholder:tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm ${showAddUserPassword ? 'text-[10px] font-bold font-sans' : 'text-lg tracking-[0.2em] font-medium'}`} 
                    placeholder="CREATE PASSWORD" 
                  />
                  <button type="button" onClick={() => setShowAddUserPassword(!showAddUserPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showAddUserPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-2.29c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">ROLE LEVEL</label>
                <select value={userFormData.role} onChange={e => setUserFormData({...userFormData, role: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] uppercase tracking-widest font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors cursor-pointer">
                  <option value="cashier">CASHIER</option>
                  <option value="manager">STORE MANAGER</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => { setIsAddingUser(false); setShowAddUserPassword(false); }} className="px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors shadow-sm">CANCEL</button>
                <button type="submit" className="px-6 py-2.5 bg-amber-500 text-zinc-950 rounded-lg text-[10px] uppercase tracking-widest font-bold hover:bg-amber-400 transition-colors shadow-sm">CREATE USER</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isResetPasswordModalOpen && resetTargetUser && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full">
            <h2 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase mb-2">RESET PASSWORD</h2>
            <p className="text-[10px] font-medium text-zinc-500 mb-6 uppercase tracking-widest">UPDATING CREDENTIALS FOR <span className="text-zinc-900 dark:text-zinc-100 font-bold">{resetTargetUser.name}</span></p>
            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">NEW PASSWORD</label>
                <div className="relative w-full">
                  <input 
                    required 
                    type={showResetNewPassword ? "text" : "password"} 
                    value={resetPasswordData.newPassword} 
                    onChange={e => setResetPasswordData({...resetPasswordData, newPassword: e.target.value})} 
                    className={`w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 pl-4 pr-10 py-2.5 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 transition-colors placeholder:text-[10px] placeholder:font-bold placeholder:tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm ${showResetNewPassword ? 'text-[10px] font-bold font-sans' : 'text-lg tracking-[0.2em] font-medium'}`} 
                    placeholder="••••••••" 
                    autoFocus 
                  />
                  <button type="button" onClick={() => setShowResetNewPassword(!showResetNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showResetNewPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-2.29c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">CONFIRM PASSWORD</label>
                <div className="relative w-full">
                  <input 
                    required 
                    type={showResetConfirmPassword ? "text" : "password"} 
                    value={resetPasswordData.confirmPassword} 
                    onChange={e => setResetPasswordData({...resetPasswordData, confirmPassword: e.target.value})} 
                    className={`w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 pl-4 pr-10 py-2.5 rounded-lg outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 transition-colors placeholder:text-[10px] placeholder:font-bold placeholder:tracking-widest placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm ${showResetConfirmPassword ? 'text-[10px] font-bold font-sans' : 'text-lg tracking-[0.2em] font-medium'}`} 
                    placeholder="••••••••" 
                  />
                  <button type="button" onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {showResetConfirmPassword ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0a10.05 10.05 0 015.71-2.29c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0l-3.29-3.29" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      )}
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={() => { setIsResetPasswordModalOpen(false); setResetTargetUser(null); setResetPasswordData({newPassword:'', confirmPassword:''}); setShowResetNewPassword(false); setShowResetConfirmPassword(false); }} className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors shadow-sm">CANCEL</button>
                <button type="submit" className="px-6 py-2.5 bg-amber-500 text-zinc-950 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-amber-400 transition-colors shadow-sm">CONFIRM</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity print:hidden">
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase">PRINT BARCODES</h2>
              <button type="button" onClick={() => setIsPrintModalOpen(false)} className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">CLOSE</button>
            </div>
            <form onSubmit={generatePrintLabels} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">SEARCH CATALOG</label>
                  <input type="text" value={printSearchQuery} onChange={e => setPrintSearchQuery(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors" placeholder="SEARCH BY NAME OR SKU..." />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">CATEGORY FILTER</label>
                  <select value={printCategoryFilter} onChange={e => setPrintCategoryFilter(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors cursor-pointer">
                    <option value="ALL">ALL CATEGORIES</option>
                    <option value="FOODS">FOODS</option>
                    <option value="DRINKS">DRINKS</option>
                    <option value="SUPPLIES">SUPPLIES</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">SELECT PRODUCT TO PRINT</label>
                <select required value={printLabelData.sku} onChange={e => setPrintLabelData({...printLabelData, sku: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors cursor-pointer">
                  <option value="" disabled>-- CHOOSE AN ITEM --</option>
                  {filteredPrintLabelsList.map(item => (
                    <option key={item.sku} value={item.sku}>{item.name} - {item.sku}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-zinc-500 mb-2 block uppercase tracking-widest">LABELS QUANTITY (SHEET MODE)</label>
                <input required type="number" min="1" max="1000" value={printLabelData.qty} onChange={e => setPrintLabelData({...printLabelData, qty: parseInt(e.target.value)||1})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors" />
              </div>
              <div className="flex justify-end pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <button type="submit" className="px-6 py-3 bg-amber-500 text-zinc-950 rounded-lg text-[10px] uppercase tracking-widest font-bold hover:bg-amber-400 transition-colors shadow-sm w-full">GENERATE SHEET</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printRequest && (
        <div className="fixed inset-0 bg-white dark:bg-zinc-950 z-50 overflow-y-auto print:bg-white print:block">
          <div className="p-8 print:p-0 max-w-5xl mx-auto print:bg-white print:text-black">
            <div className="flex justify-between items-center mb-8 print:hidden">
              <h2 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase">SHEET GENERATED</h2>
              <div className="flex gap-3">
                <button type="button" onClick={() => setPrintRequest(null)} className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] uppercase tracking-widest font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shadow-sm">CANCEL</button>
                <button type="button" onClick={() => window.print()} className="px-6 py-2.5 bg-amber-500 text-zinc-950 rounded-lg text-[10px] uppercase tracking-widest font-bold hover:bg-amber-400 transition-colors shadow-sm">PRINT SHEET</button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:grid-cols-4 print:gap-2 justify-items-center">
              {Array.from({ length: printRequest.qty }).map((_, i) => (
                <div key={i} className="border border-dashed border-zinc-300 dark:border-zinc-700 print:border-black p-3 w-[150px] flex flex-col items-center justify-center bg-white print:break-inside-avoid">
                  <span className="text-[10px] font-bold text-black truncate w-full text-center mb-1 uppercase tracking-widest">{printRequest.product?.name || ''}</span>
                  <div className="flex justify-center w-full overflow-hidden scale-[0.8] origin-top"><Barcode value={printRequest.product?.sku || '0'} width={1.5} height={40} fontSize={12} displayValue={true} margin={0} background="transparent" /></div>
                  <span className="font-bold text-[10px] mt-1 text-black uppercase tracking-widest">{settings.currencySymbol}{(Number(printRequest.product?.price) || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {receiptData && (
        <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center print:static print:bg-transparent print:block p-4 z-50 transition-opacity">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:shadow-none print:m-0 print:w-full print:border-none print:bg-white custom-scrollbar">
            <div className="flex justify-between items-center mb-5 print:hidden border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                TRANSACTION COMPLETE
              </h2>
            </div>
            
            <div className="bg-white rounded-lg print:p-0">
              <div className="font-mono text-[11px] text-black print:w-[300px] print:mx-auto leading-relaxed">
                <div className="text-center mb-4">
                  <h1 className="text-sm font-bold uppercase tracking-wider mb-1">{settings.storeName}</h1>
                  <p className="uppercase text-[9px] mb-0.5 text-zinc-700 tracking-widest">{settings.storeAddress}</p>
                  <p className="uppercase text-[9px] mb-3 text-zinc-700 tracking-widest">TEL: {settings.contactNumber}</p>
                  
                  {receiptData.isReprint && <div className="inline-block px-2 py-0.5 border border-black rounded-md font-bold uppercase text-[9px] mb-2 tracking-widest">REPRINTED COPY</div>}
                  
                  <div className="flex justify-between text-[10px] mt-1 font-bold tracking-widest">
                    <span className="uppercase text-zinc-600">RCPT:</span>
                    <span>{receiptData.id}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold tracking-widest">
                    <span className="uppercase text-zinc-600">DATE:</span>
                    <span>{receiptData.timestamp}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold tracking-widest">
                    <span className="uppercase text-zinc-600">CASHIER:</span>
                    <span className="uppercase">{receiptData.cashier}</span>
                  </div>
                </div>

                <div className="border-t border-b border-black py-2 mb-2">
                  <table className="w-full text-[10px]">
                    <tbody>
                      {receiptData.items.map((item, i) => (
                        <tr key={i} className="align-top pb-1 block w-full mb-1">
                          <td className="w-full block font-bold uppercase tracking-widest">{item.name}</td>
                          <td className="w-full flex justify-between text-[10px] text-zinc-600 tracking-widest">
                            <span className="font-bold">{item.qty} X {settings.currencySymbol}{(Number(item.price)||0).toFixed(2)}</span>
                            <span className="font-bold text-black">{settings.currencySymbol}{((Number(item.price)||0) * (Number(item.qty)||0)).toFixed(2)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-0.5 mb-3 text-[10px] tracking-widest">
                  <div className="flex justify-between"><span className="uppercase font-bold text-zinc-600">SUBTOTAL</span><span className="font-bold">{settings.currencySymbol}{(Number(receiptData.subtotal)||0).toFixed(2)}</span></div>
                  <div className="flex justify-between text-[11px] font-bold pt-1 border-t border-zinc-200 mt-1"><span className="uppercase">TOTAL DUE</span><span>{settings.currencySymbol}{(Number(receiptData.totalDue)||0).toFixed(2)}</span></div>
                </div>

                <div className="space-y-0.5 mb-3 text-[10px] tracking-widest">
                  <div className="flex justify-between text-zinc-600"><span className="uppercase font-bold">CASH TENDERED</span><span className="font-bold text-black">{settings.currencySymbol}{(Number(receiptData.tendered)||0).toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold"><span className="uppercase">CHANGE</span><span>{settings.currencySymbol}{(Number(receiptData.changeDue)||0).toFixed(2)}</span></div>
                </div>
                
                <div className="space-y-0.5 text-[9px] text-zinc-500 pt-2 border-t border-zinc-200 font-bold tracking-widest">
                  <div className="flex justify-between"><span className="uppercase">VATABLE SALES</span><span>{settings.currencySymbol}{(Number(receiptData.vatableSales)||0).toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="uppercase">VAT ({settings.vatRate}%)</span><span>{settings.currencySymbol}{(Number(receiptData.vatAmount)||0).toFixed(2)}</span></div>
                </div>

                <div className="text-center mt-6 flex flex-col items-center">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-wider">{settings.receiptFooter}</p>
                  <Barcode value={receiptData.id} width={1.2} height={30} fontSize={10} displayValue={false} margin={0} background="transparent" />
                </div>
              </div>
            </div>

            <div className="mt-6 print:hidden flex gap-2">
              <button type="button" onClick={() => executePrint()} className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">PRINT COPY</button>
              <button type="button" onClick={() => setReceiptData(null)} className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">NEW SALE</button>
            </div>
          </div>
        </div>
      )}

      <div className="w-64 bg-white dark:bg-zinc-950 flex flex-col border-r border-zinc-200 dark:border-zinc-800 z-10 shadow-sm">
        <div className="px-6 py-6 flex items-center gap-3 border-b border-zinc-200 dark:border-zinc-900">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-zinc-950 font-bold shrink-0 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
          </div>
          <h1 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase truncate" title={settings.storeName}>{settings.storeName}</h1>
        </div>
        
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-900 flex items-center gap-3 bg-white dark:bg-zinc-950">
          <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-900 dark:text-zinc-100 text-[11px] font-bold uppercase shrink-0 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            {currentUser.name.charAt(0)}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold text-zinc-900 dark:text-zinc-100 uppercase truncate tracking-widest">{currentUser.name}</span>
            <span className="text-[9px] text-amber-500 font-bold uppercase tracking-widest truncate">{currentUser.role}</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-6 overflow-y-auto custom-scrollbar bg-white dark:bg-zinc-950">
          {MENU_GROUPS.map((group, idx) => {
            if (!group.roles.includes(currentUser.role)) return null;
            return (
              <div key={idx}>
                <p className="px-3 text-[10px] uppercase tracking-widest text-zinc-500 dark:text-zinc-600 font-bold mb-2">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map(item => (
                    <button 
                      type="button"
                      key={item.id} 
                      onClick={() => setActiveView(item.id)} 
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2.5 ${
                        activeView === item.id 
                        ? 'bg-amber-500/10 text-amber-500 shadow-sm border border-amber-500/20' 
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-100 border border-transparent'
                      }`}
                    >
                      <svg className={`w-4 h-4 ${activeView === item.id ? 'text-amber-500' : 'text-zinc-400 dark:text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path></svg>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-900 space-y-2 bg-white dark:bg-zinc-950">
          {activeShift && currentUser.role === 'manager' && (
             <button type="button" onClick={() => setActiveView('zreading')} className="w-full py-2.5 bg-zinc-50 dark:bg-zinc-900 hover:bg-red-500/10 text-red-500 dark:text-red-400 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border border-red-500/20 shadow-sm">
               END SHIFT (Z-READ)
             </button>
          )}
          <button type="button" onClick={handleLogout} disabled={activeShift && activeShift.opened_by !== currentUser.name && currentUser.role !== 'manager'} className="w-full py-2.5 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border border-zinc-200 dark:border-zinc-800 shadow-sm disabled:opacity-50">
            LOCK SYSTEM
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative z-10 bg-zinc-50 dark:bg-zinc-950">
        <header className="bg-white dark:bg-zinc-900 px-8 py-5 flex justify-between items-end z-10 sticky top-0 border-b border-zinc-200 dark:border-zinc-800 shadow-sm">
          <h2 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-widest">
            {MENU_GROUPS.flatMap(g => g.items).find(i => i.id === activeView)?.label || activeView}
          </h2>
          {activeShift && activeView !== 'zreading' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-500/10 border border-green-500/20 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-green-500 dark:text-green-400">REGISTER OPEN</span>
            </div>
          )}
        </header>

        <main className="flex-1 overflow-y-auto px-8 relative z-0 custom-scrollbar pb-16 pt-6">
          
          {activeView === 'dashboard' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">GROSS REVENUE</p>
                  <h3 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{settings.currencySymbol}{todayRevenue.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                </div>
                
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">NET PROFIT</p>
                  <h3 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{settings.currencySymbol}{todayProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}</h3>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">TOTAL TRANSACTIONS</p>
                  <h3 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{todaysSales.length}</h3>
                </div>

              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 mb-6">REVENUE TREND (CURRENT WEEK)</h3>
                  <div className="w-full h-full min-h-[300px]">
                    {barData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={barData} margin={{top:10, right:10, left:-20, bottom:20}}>
                          <defs>
                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5}/>
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#27272a" : "#e4e4e7"} />
                          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#a1a1aa', fontWeight: 500}} dy={10} />
                          <Tooltip cursor={{stroke: theme === 'dark' ? '#3f3f46' : '#e4e4e7', strokeWidth: 1}} contentStyle={{ backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', borderRadius: '8px', border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: theme === 'dark' ? '#f4f4f5' : '#18181b', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                          <Area type="monotone" dataKey="Revenue" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-600">
                        <p className="text-[10px] font-bold uppercase tracking-widest">AWAITING DATA</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 mb-6">WEEKLY CASHIER PERFORMANCE</h3>
                  <div className="w-full h-full min-h-[300px]">
                    {dailyCashierData.length > 0 && topCashiers.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyCashierData} margin={{top:10, right:10, left:-20, bottom:20}}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? "#27272a" : "#e4e4e7"} />
                          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{fill: '#a1a1aa', fontWeight: 500}} dy={10} />
                          <Tooltip 
                            cursor={{fill: theme === 'dark' ? '#27272a' : '#f4f4f5'}} 
                            contentStyle={{ backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', borderRadius: '8px', border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #e4e4e7', color: theme === 'dark' ? '#f4f4f5' : '#18181b', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} 
                          />
                          <Bar dataKey={topCashiers[0]} fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          {topCashiers[1] && <Bar dataKey={topCashiers[1]} fill="#52525b" radius={[4, 4, 0, 0]} maxBarSize={40} />}
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-600">
                        <p className="text-[10px] font-bold uppercase tracking-widest">AWAITING DATA</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 mb-6">TOP SELLING CATEGORIES (ALL TIME)</h3>
                  <div className="w-full h-full min-h-[300px]">
                    {pieData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieData.slice(0,5)} cx="50%" cy="50%" innerRadius={80} outerRadius={120} paddingAngle={2} dataKey="value" stroke="none">
                            {pieData.map((e, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                          </Pie>
                          <Tooltip cursor={false} contentStyle={{ backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff', borderRadius: '8px', border: theme === 'dark' ? '1px solid #3f3f46' : '1px solid #e4e4e7', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', color: theme === 'dark' ? '#f4f4f5' : '#18181b', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-600">
                        <p className="text-[10px] font-bold uppercase tracking-widest">AWAITING DATA</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeView === 'settings' && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <svg className="w-4 h-4 text-zinc-900 dark:text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">APPEARANCE</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">SYSTEM THEME</label>
                    <select 
                      value={theme} 
                      onChange={e => setTheme(e.target.value)} 
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-3 rounded-lg text-[10px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors cursor-pointer uppercase tracking-widest shadow-sm"
                    >
                      <option value="dark">DARK MODE</option>
                      <option value="light">LIGHT MODE</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <svg className="w-4 h-4 text-zinc-900 dark:text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">BUSINESS PROFILE</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">STORE NAME</label>
                      <input 
                        type="text" 
                        value={settings.storeName} 
                        onChange={e => setSettings({...settings, storeName: e.target.value})} 
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors uppercase tracking-widest shadow-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">STORE ADDRESS</label>
                      <input 
                        type="text" 
                        value={settings.storeAddress} 
                        onChange={e => setSettings({...settings, storeAddress: e.target.value})} 
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors uppercase tracking-widest shadow-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">CONTACT NUMBER</label>
                      <input 
                        type="text" 
                        value={settings.contactNumber} 
                        onChange={e => setSettings({...settings, contactNumber: e.target.value})} 
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors uppercase tracking-widest shadow-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">RECEIPT FOOTER MESSAGE</label>
                      <input 
                        type="text" 
                        value={settings.receiptFooter} 
                        onChange={e => setSettings({...settings, receiptFooter: e.target.value})} 
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors uppercase tracking-widest shadow-sm" 
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">CURRENCY</label>
                        <select 
                          value={settings.currencySymbol} 
                          onChange={e => setSettings({...settings, currencySymbol: e.target.value})} 
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors cursor-pointer uppercase tracking-widest shadow-sm"
                        >
                          <option value="₱">PHP (₱)</option>
                          <option value="$">USD ($)</option>
                          <option value="€">EUR (€)</option>
                          <option value="£">GBP (£)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">VAT RATE (%)</label>
                        <input 
                          type="number" 
                          min="0"
                          max="100"
                          value={settings.vatRate} 
                          onChange={e => setSettings({...settings, vatRate: Number(e.target.value)})} 
                          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-sm" 
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">LOW STOCK ALERT THRESHOLD</label>
                      <input 
                        type="number" 
                        min="1"
                        value={settings.lowStockThreshold} 
                        onChange={e => setSettings({...settings, lowStockThreshold: Number(e.target.value)})} 
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-sm" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 shadow-sm">
                <div className="flex items-center gap-2 mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                  <svg className="w-4 h-4 text-zinc-900 dark:text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">HARDWARE INTEGRATION</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">BARCODE SCANNER</label>
                      <div className="w-full bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-green-600 dark:text-green-400">KEYBOARD EMULATION</span>
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">CASH DRAWER KICK</label>
                      <button 
                        type="button"
                        onClick={() => setSettings({...settings, kickDrawer: !settings.kickDrawer})}
                        className={`w-full px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border flex justify-between items-center shadow-sm ${settings.kickDrawer ? 'bg-amber-500 border-amber-500 text-zinc-950' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                      >
                        {settings.kickDrawer ? 'ENABLED (VIA PRINTER)' : 'DISABLED'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">RECEIPT PRINTER DEVICE</label>
                      <select 
                        value={settings.printerName} 
                        onChange={e => setSettings({...settings, printerName: e.target.value})} 
                        className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-3 rounded-lg text-[10px] font-medium text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors cursor-pointer uppercase tracking-widest shadow-sm"
                      >
                        <option value="NONE">NO PRINTER CONFIGURED</option>
                        {systemPrinters.map(p => (
                          <option key={p.name} value={p.name}>{p.name.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-2">AUTO-PRINT RECEIPTS</label>
                      <button 
                        type="button"
                        onClick={() => setSettings({...settings, autoPrint: !settings.autoPrint})}
                        className={`w-full px-4 py-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border flex justify-between items-center shadow-sm ${settings.autoPrint ? 'bg-amber-500 border-amber-500 text-zinc-950' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}
                        disabled={settings.printerName === 'NONE'}
                      >
                        {settings.autoPrint ? 'SILENT PRINTING ACTIVE' : 'SYSTEM DEFAULT PRINT DIALOG'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'inventory' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex justify-between items-end gap-6 mb-6 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  {['ALL', 'FOODS', 'DRINKS', 'SUPPLIES', 'OTHER'].map(cat => (
                    <button 
                      type="button"
                      key={cat}
                      onClick={() => setInventoryCategoryFilter(cat)}
                      className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border ${inventoryCategoryFilter === cat ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-sm' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-sm'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 items-center">
                  <div className="relative">
                    <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                    <input 
                      type="text" 
                      placeholder="SEARCH CATALOG..." 
                      value={inventorySearchQuery} 
                      onChange={e => setInventorySearchQuery(e.target.value)} 
                      className="w-64 pl-9 pr-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-medium uppercase tracking-widest outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 transition-colors shadow-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600" 
                    />
                  </div>
                  <button type="button" onClick={() => setIsPrintModalOpen(true)} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700 whitespace-nowrap shadow-sm">PRINT BARCODES</button>
                  <button type="button" onClick={() => setIsAddingProduct(true)} className="bg-amber-500 text-zinc-950 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-amber-400 whitespace-nowrap shadow-sm">ADD PRODUCT</button>
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">SKU</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PRODUCT NAME</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">CATEGORY</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">STOCK</th>
                        <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PRICE</th>
                        <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {paginatedInventory.map((item) => (
                        <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{item.sku}</td>
                          <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{item.name}</td>
                          <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{item.category}</td>
                          <td className="px-6 py-3">
                            <span className={`px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-widest border ${(Number(item.stock)||0) <= settings.lowStockThreshold ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20' : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'}`}>
                              {(Number(item.stock)||0)}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{settings.currencySymbol}{(Number(item.price)||0).toFixed(2)}</td>
                          <td className="px-6 py-3 flex justify-end gap-3">
                            <button type="button" onClick={() => { setEditingProduct(item); setFormData(item); setIsAddingProduct(true); }} className="text-zinc-500 hover:text-amber-500 transition-colors p-1" title="Edit">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button type="button" onClick={() => handleDeleteProduct(item.id, item.name, item.category)} className="text-zinc-500 hover:text-red-500 transition-colors p-1" title="Delete">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {paginatedInventory.length === 0 && (
                        <tr><td colSpan="6" className="px-6 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">NO PRODUCTS FOUND.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {invTotalPages > 1 && (
                  <div className="flex justify-between items-center px-6 py-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">PAGE {inventoryPage} OF {invTotalPages}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={inventoryPage === 1} onClick={() => setInventoryPage(inventoryPage - 1)} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">PREV</button>
                      <button type="button" disabled={inventoryPage === invTotalPages} onClick={() => setInventoryPage(inventoryPage + 1)} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">NEXT</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'stocks' && (
            <div className="flex gap-6 h-full max-w-[1400px] mx-auto pb-10">
              
              <div className="flex-1 flex flex-col space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">TOTAL VALUE</p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{settings.currencySymbol}{totalInventoryValue.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">UNIQUE ITEMS</p>
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{filteredStocksView.length}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-1">OUT OF STOCK</p>
                    <p className="text-xl font-bold text-red-600 dark:text-red-400 tracking-tight">{outOfStockCount}</p>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">LOW STOCK</p>
                    <p className="text-xl font-bold text-amber-500 dark:text-amber-400 tracking-tight">{lowStockCount}</p>
                  </div>
                </div>

                <div className="flex justify-between items-end gap-4 print:hidden">
                  <div className="flex gap-4 items-end flex-wrap">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">SEARCH</label>
                      <div className="relative">
                        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                        <input 
                          type="text" 
                          placeholder="SEARCH STOCKS..." 
                          value={stocksSearchQuery} 
                          onChange={e => setStocksSearchQuery(e.target.value)} 
                          className="w-64 pl-9 pr-3 py-2 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-medium uppercase tracking-widest outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 transition-colors shadow-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">CATEGORY</label>
                      <div className="flex gap-2">
                        {['ALL', 'FOODS', 'DRINKS', 'SUPPLIES', 'OTHER'].map(cat => (
                          <button 
                            type="button"
                            key={cat}
                            onClick={() => setStocksCategoryFilter(cat)}
                            className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border ${stocksCategoryFilter === cat ? 'bg-amber-500 text-zinc-950 border-amber-500 shadow-sm' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100 shadow-sm'}`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => downloadCSV(filteredStocksView, ['sku', 'name', 'category', 'cost', 'price', 'stock'], 'Inventory_Stocks_Report.csv')} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700 whitespace-nowrap shadow-sm">EXPORT CSV</button>
                    <button type="button" onClick={() => window.print()} className="bg-amber-500 text-zinc-950 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-amber-400 whitespace-nowrap shadow-sm">PRINT REPORT</button>
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col flex-1">
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">SKU</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PRODUCT NAME</th>
                          <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">CATEGORY</th>
                          <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">UNIT COST</th>
                          <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">STOCK</th>
                          <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">TOTAL VALUE</th>
                          <th className="px-6 py-3 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {paginatedStocks.map((item) => {
                          const stock = Number(item.stock) || 0;
                          const cost = Number(item.cost) || 0;
                          const totalVal = stock * cost;
                          return (
                            <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                              <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{item.sku}</td>
                              <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{item.name}</td>
                              <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{item.category}</td>
                              <td className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{settings.currencySymbol}{cost.toFixed(2)}</td>
                              <td className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{stock}</td>
                              <td className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{settings.currencySymbol}{totalVal.toFixed(2)}</td>
                              <td className="px-6 py-3 flex justify-center">
                                {stock <= 0 ? (
                                  <span className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border border-red-200 dark:border-red-500/20">OUT OF STOCK</span>
                                ) : stock <= settings.lowStockThreshold ? (
                                  <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border border-amber-200 dark:border-amber-500/20">LOW STOCK</span>
                                ) : (
                                  <span className="bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest border border-green-200 dark:border-green-500/20">IN STOCK</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {paginatedStocks.length === 0 && (
                          <tr><td colSpan="7" className="px-6 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">NO STOCK RECORDS FOUND.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {stocksTotalPages > 1 && (
                    <div className="flex justify-between items-center px-6 py-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">PAGE {stocksPage} OF {stocksTotalPages}</span>
                      <div className="flex gap-2">
                        <button type="button" disabled={stocksPage === 1} onClick={() => setStocksPage(stocksPage - 1)} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">PREV</button>
                        <button type="button" disabled={stocksPage === stocksTotalPages} onClick={() => setStocksPage(stocksPage + 1)} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">NEXT</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-72 flex flex-col space-y-6 shrink-0">
                
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-5 flex flex-col max-h-[40vh]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-3 border-b border-zinc-200 dark:border-zinc-800 pb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    OUT OF STOCK ({outOfStockCount})
                  </h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                    {outOfStockItems.length === 0 ? (
                       <div className="text-center text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-widest pt-4">NO ALERTS</div>
                    ) : (
                      outOfStockItems.map(item => (
                        <div key={item.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg flex flex-col gap-1">
                          <p className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100 uppercase tracking-widest truncate">{item.name}</p>
                          <div className="flex justify-between items-center">
                             <p className="text-[10px] text-zinc-500 font-mono tracking-widest">{item.sku}</p>
                             <span className="text-[9px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">OUT</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm p-5 flex flex-col max-h-[40vh]">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-3 border-b border-zinc-200 dark:border-zinc-800 pb-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    LOW STOCK ({lowStockCount})
                  </h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-2">
                    {lowStockItems.length === 0 ? (
                       <div className="text-center text-[10px] font-bold text-zinc-500 dark:text-zinc-600 uppercase tracking-widest pt-4">NO ALERTS</div>
                    ) : (
                      lowStockItems.map(item => (
                        <div key={item.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-lg flex flex-col gap-1">
                          <p className="text-[10px] font-medium text-zinc-900 dark:text-zinc-100 uppercase tracking-widest truncate">{item.name}</p>
                          <div className="flex justify-between items-center">
                             <p className="text-[10px] text-zinc-500 font-mono tracking-widest">{item.sku}</p>
                             <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-widest whitespace-nowrap">LOW: {item.stock}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {activeView === 'sales' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div className="flex gap-3 items-end flex-wrap">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">SEARCH</label>
                    <div className="relative">
                      <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      <input 
                         type="text" 
                         placeholder="INVOICE OR ITEM..." 
                         value={salesSearchQuery} 
                         onChange={e => setSalesSearchQuery(e.target.value)} 
                         className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 pl-8 pr-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 w-48 text-zinc-900 dark:text-zinc-100 transition-colors shadow-sm placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">CASHIER</label>
                    <select value={salesCashierFilter} onChange={e => setSalesCashierFilter(e.target.value)} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 cursor-pointer transition-colors shadow-sm appearance-none">
                      {uniqueCashiers.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">DATE FILTER</label>
                    <select value={salesDateFilter} onChange={e => setSalesDateFilter(e.target.value)} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 cursor-pointer transition-colors shadow-sm appearance-none">
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
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">SELECT DATE</label>
                      <input type="date" value={salesCustomDate} onChange={e => setSalesCustomDate(e.target.value)} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-2 rounded-lg text-[10px] font-medium uppercase tracking-widest outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 transition-colors shadow-sm" />
                    </div>
                  )}
                  <button type="button" onClick={() => downloadCSV(filteredSales, ['id', 'timestamp', 'cashier', 'subtotal', 'discount', 'total', 'profit'], 'Sales_Report.csv')} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-sm h-fit">EXPORT CSV</button>
                </div>
                <div className="bg-amber-50 dark:bg-amber-500/10 px-5 py-3 rounded-xl text-right shadow-sm border border-amber-200 dark:border-amber-500/20">
                  <p className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-widest mb-0.5">FILTERED REVENUE</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-500 tracking-tight">{settings.currencySymbol}{totalFilteredSales.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">INVOICE ID</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">DATE & TIME</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">CASHIER</th>
                        <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">REVENUE</th>
                        <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">PROFIT</th>
                        <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {paginatedSales.map(s => (
                        <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                            {s.id}
                          </td>
                          <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{s.timestamp}</td>
                          <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{s.cashier}</td>
                          <td className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{settings.currencySymbol}{(Number(s.total)||0).toFixed(2)}</td>
                          <td className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-widest text-green-600 dark:text-green-500">{settings.currencySymbol}{(Number(s.profit)||0).toFixed(2)}</td>
                          <td className="px-6 py-3 text-right">
                            <button type="button" onClick={() => handleReprintReceipt(s)} className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500 hover:text-amber-500 dark:hover:text-amber-400 transition-colors bg-white dark:bg-zinc-800 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-sm">VIEW</button>
                          </td>
                        </tr>
                      ))}
                      {paginatedSales.length === 0 && (
                        <tr><td colSpan="6" className="px-6 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">NO SALES MATCH CURRENT FILTERS.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {salesTotalPages > 1 && (
                  <div className="flex justify-between items-center px-6 py-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">PAGE {salesPage} OF {salesTotalPages}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={salesPage === 1} onClick={() => setSalesPage(salesPage - 1)} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">PREV</button>
                      <button type="button" disabled={salesPage === salesTotalPages} onClick={() => setSalesPage(salesPage + 1)} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">NEXT</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'finance' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase">SHIFT RECONCILIATIONS</h3>
                <button type="button" onClick={() => downloadCSV(shifts, ['id', 'start_time', 'end_time', 'opened_by', 'starting_float', 'expected_cash', 'actual_cash', 'status'], 'Shifts_Report.csv')} className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-sm">EXPORT DATA</button>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">START SHIFT</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">MANAGER / CASHIER</th>
                      <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">EXPECTED REGISTER</th>
                      <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">END VARIANCE</th>
                      <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">END SHIFT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {shifts.map((s) => {
                      const diff = s.actual_cash ? s.actual_cash - s.expected_cash : 0;
                      return (
                        <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{s.start_time}</td>
                          <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{s.opened_by}</td>
                          <td className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{settings.currencySymbol}{s.expected_cash.toFixed(2)}</td>
                          <td className={`px-6 py-3 text-right text-[10px] font-medium uppercase tracking-widest ${diff < 0 ? 'text-red-600 dark:text-red-400' : diff > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                            {s.status === 'closed' ? (diff > 0 ? `+${settings.currencySymbol}${diff.toFixed(2)}` : `${settings.currencySymbol}${diff.toFixed(2)}`) : 'ACTIVE'}
                          </td>
                          <td className="px-6 py-3 text-right text-[10px] font-medium uppercase tracking-widest text-zinc-500">{s.end_time || 'ACTIVE'}</td>
                        </tr>
                      )
                    })}
                    {shifts.length === 0 && (
                      <tr><td colSpan="5" className="px-6 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">NO SHIFT RECORDS EXIST YET.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeView === 'accounts' && (
            <div className="max-w-4xl mx-auto space-y-6">
              
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase">TEAM ACCESS</h3>
                <button type="button" onClick={() => setIsAddingUser(true)} className="bg-amber-500 text-zinc-950 px-5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-amber-400 shadow-sm">ADD MEMBER</button>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">FULL NAME</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">USERNAME</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ACCESS LEVEL</th>
                      <th className="px-6 py-3 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-widest">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{u.name}</td>
                        <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">{u.username}</td>
                        <td className="px-6 py-3">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${u.role === 'manager' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-200 dark:border-amber-500/20' : 'bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'}`}>{u.role}</span>
                        </td>
                        <td className="px-6 py-3 flex justify-end gap-3">
                          <button type="button" onClick={() => { setResetTargetUser(u); setIsResetPasswordModalOpen(true); }} className="text-zinc-500 hover:text-blue-500 transition-colors p-1" title="Change Password">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                          </button>
                          <button type="button" onClick={() => handleDeleteUser(u.id, u.name)} disabled={u.role === 'manager'} className="text-zinc-500 hover:text-red-500 transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed" title="Revoke Access">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
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
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase">SECURITY AUDIT LOGS</h3>
                <div className="flex gap-1 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 shadow-sm">
                  {['ALL', 'SYSTEM', 'ADD', 'EDIT', 'DELETE'].map(f => (
                    <button key={f} onClick={() => setLogFilter(f)} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors ${logFilter === f ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>{f}</button>
                  ))}
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest w-48">DATE & TIME</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest w-40">EVENT TYPE</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">DETAILS</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">CATEGORY</th>
                        <th className="px-6 py-3 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">STOCK CHANGE (+/-)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {paginatedLogs.map((log) => {
                        let parsedDetails = { msg: log.details, category: '-', qty: '-' };
                        try {
                          const parsed = JSON.parse(log.details);
                          if (parsed && typeof parsed === 'object' && parsed.msg) parsedDetails = parsed;
                        } catch (e) {}

                        return (
                          <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400">{log.timestamp}</td>
                            <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-700 dark:text-zinc-300">{log.action}</td>
                            <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-900 dark:text-zinc-100">{parsedDetails.msg}</td>
                            <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-500">{parsedDetails.category}</td>
                            <td className="px-6 py-3 text-[10px] font-medium uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-mono">{parsedDetails.qty}</td>
                          </tr>
                        );
                      })}
                      {paginatedLogs.length === 0 && (
                        <tr><td colSpan="5" className="px-6 py-12 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">NO SYSTEM EVENTS LOGGED MATCHING FILTER.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {logsTotalPages > 1 && (
                  <div className="flex justify-between items-center px-6 py-3 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">PAGE {logsPage} OF {logsTotalPages}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={logsPage === 1} onClick={() => setLogsPage(logsPage - 1)} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">PREV</button>
                      <button type="button" disabled={logsPage === logsTotalPages} onClick={() => setLogsPage(logsPage + 1)} className="px-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-sm">NEXT</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeView === 'terminal' && (
            !activeShift ? (
              <div className="h-full flex items-center justify-center pb-20 z-10 relative">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-10 rounded-xl shadow-sm max-w-sm w-full text-center">
                  <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg flex items-center justify-center mb-6 mx-auto shadow-sm">
                    <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                  </div>
                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2 tracking-widest uppercase">INITIALIZE REGISTER</h3>
                  <p className="text-[10px] text-zinc-500 mb-8 font-bold uppercase tracking-widest">VERIFY STARTING FLOAT</p>
                  
                  <div className="relative mb-8 text-left">
                    <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">STARTING CASH</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-lg">{settings.currencySymbol}</span>
                      <input type="number" step="0.01" value={floatInput} onChange={(e) => setFloatInput(e.target.value)} className="w-full text-left pl-10 pr-4 py-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-lg font-bold outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 text-zinc-900 dark:text-zinc-100 transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm" placeholder="0.00" autoFocus />
                    </div>
                  </div>
                  
                  <button type="button" onClick={handleOpenShift} disabled={!floatInput} className="w-full bg-amber-500 text-zinc-950 py-3.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-amber-400 shadow-sm disabled:opacity-50">START SHIFT</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-6 h-full max-w-[1400px] mx-auto z-10 relative">
                
                <div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden">
                  
                  <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 relative z-20 flex flex-col gap-4">
                    <div className="flex gap-2 flex-wrap">
                      {['ALL', 'FOODS', 'DRINKS', 'SUPPLIES', 'OTHER'].map(cat => (
                        <button 
                          type="button"
                          key={cat}
                          onClick={() => setTerminalCategory(cat)}
                          className={`px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors border shadow-sm ${terminalCategory === cat ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-200 dark:border-amber-500/20' : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                      <input 
                        ref={searchInputRef}
                        type="text" 
                        placeholder="SEARCH PRODUCTS OR SCAN BARCODE (F1)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm bg-white dark:bg-zinc-900 focus:border-amber-500 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-amber-500/50"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto z-10 transition-colors custom-scrollbar bg-white dark:bg-zinc-950 p-4">
                    {filteredTerminalInventory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4 pb-10">
                        <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-zinc-400 dark:text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest">NO PRODUCTS FOUND.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredTerminalInventory.map(item => (
                          <button 
                            type="button"
                            key={item.sku} 
                            onClick={() => handleAddToCart(item)}
                            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:border-amber-500/50 hover:shadow-sm transition-colors"
                          >
                            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">{item.name}</span>
                            <span className="text-[10px] font-bold tracking-widest text-zinc-600 dark:text-zinc-400">{settings.currencySymbol}{(Number(item.price)||0).toFixed(2)}</span>
                            {Number(item.stock) <= 0 ? (
                              <span className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-red-200 dark:border-red-500/20 mt-1 w-full">OUT OF STOCK</span>
                            ) : Number(item.stock) <= settings.lowStockThreshold ? (
                              <span className="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-amber-200 dark:border-amber-500/20 mt-1 w-full">LOW: {item.stock}</span>
                            ) : (
                              <span className="bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-500 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 mt-1 w-full">STOCK: {item.stock}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="w-[380px] rounded-xl shadow-sm border p-5 flex flex-col h-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shrink-0">
                  
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
                    <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-900 dark:text-zinc-100">CURRENT ORDER</h3>
                    <span className="text-[10px] font-bold text-zinc-500 tracking-widest">{cart.length} ITEMS</span>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar mb-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg">
                    {cart.length === 0 ? (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-600">CART IS EMPTY.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800 p-2">
                        {cart.map((item, i) => (
                          <div key={i} className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-sm mb-2 last:mb-0">
                            <div className="flex justify-between items-start mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest line-clamp-2 pr-2 leading-tight text-zinc-900 dark:text-zinc-100">{item.name}</span>
                              <span className="text-[10px] font-bold tracking-widest shrink-0 text-zinc-900 dark:text-zinc-100">{settings.currencySymbol}{((Number(item.price)||0) * (Number(item.qty)||0)).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded">
                                <button type="button" onClick={() => handleUpdateCartQty(item.sku, item.qty - 1)} className="w-7 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-bold hover:bg-zinc-100 dark:bg-zinc-800 rounded-l transition-colors">-</button>
                                <input type="number" value={item.qty} onChange={(e) => handleUpdateCartQty(item.sku, e.target.value)} className="w-10 text-center text-[10px] font-bold bg-transparent outline-none text-zinc-900 dark:text-zinc-100" />
                                <button type="button" onClick={() => handleUpdateCartQty(item.sku, item.qty + 1)} className="w-7 h-6 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-bold hover:bg-zinc-100 dark:bg-zinc-800 rounded-r transition-colors">+</button>
                              </div>
                              <button type="button" onClick={() => handleVoidCartItem(item.sku, item.name)} className="text-zinc-500 hover:text-red-500 transition-colors p-1" title="Remove Item">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between items-end mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">TOTAL DUE</span>
                    <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">{settings.currencySymbol}{safeTotalDue.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                  </div>

                  <div className="mb-6">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">CASH TENDERED <span className="ml-1 text-[8px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700">F4</span></label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 font-bold text-lg">{settings.currencySymbol}</span>
                      <input 
                        ref={amountInputRef}
                        type="number" 
                        min={safeTotalDue > 0 ? safeTotalDue : undefined} 
                        step="0.01" 
                        value={amountTendered} 
                        onChange={(e) => setAmountTendered(e.target.value)} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && cart.length > 0 && safeChange >= 0) {
                            handleCheckout();
                          }
                        }}
                        disabled={cart.length === 0} 
                        className="w-full pl-10 pr-3 py-3 rounded-lg text-lg font-bold outline-none transition-colors placeholder:text-zinc-400 dark:placeholder:text-zinc-600 shadow-sm bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 text-zinc-900 dark:text-zinc-100 focus:ring-1 focus:ring-amber-500/50 disabled:opacity-50"
                        placeholder="0.00" 
                      />
                    </div>
                    
                    <div className="flex justify-between items-center mt-5 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">CHANGE</span>
                      <span className={`text-xl font-bold tracking-tight ${safeChange >= 0 ? 'text-green-500' : 'text-zinc-400 dark:text-zinc-600'}`}>{settings.currencySymbol}{safeChange >= 0 ? safeChange.toLocaleString(undefined, {minimumFractionDigits: 2}) : '0.00'}</span>
                    </div>
                  </div>
                  
                  <button type="button" onClick={handleCheckout} disabled={cart.length === 0 || safeChange < 0} className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 py-3.5 rounded-lg text-[11px] font-bold uppercase tracking-widest disabled:opacity-50 transition-colors shadow-sm">
                    CHECKOUT (ENTER)
                  </button>
                  
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button type="button" onClick={handleHoldCart} disabled={cart.length === 0} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest disabled:opacity-50 transition-colors shadow-sm flex flex-col items-center justify-center gap-1">
                      HOLD 
                      <span className="text-[8px] bg-zinc-100 dark:bg-zinc-800 px-1 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 font-sans font-bold">F8</span>
                    </button>
                    <button type="button" onClick={() => setIsResumeOpen(true)} disabled={heldCarts.length === 0} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-amber-600 dark:text-amber-500 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest disabled:opacity-50 transition-colors shadow-sm relative flex flex-col items-center justify-center gap-1">
                      RESUME
                      {heldCarts.length > 0 && <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-zinc-950 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm">{heldCarts.length}</span>}
                    </button>
                    <button type="button" onClick={() => setIsCashModalOpen(true)} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 py-2.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-colors shadow-sm flex flex-col items-center justify-center gap-1">
                      DRAWER I/O
                    </button>
                  </div>
                </div>
              </div>
            )
          )}

          {isCashModalOpen && (
            <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-sm w-full">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase">DRAWER OPERATION</h2>
                </div>
                <form onSubmit={handleCashAdjustmentSubmit} className="space-y-5">
                  <div className="flex gap-2 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                    <button type="button" onClick={() => setCashDropData({...cashDropData, type: 'IN'})} className={`flex-1 py-2.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors border ${cashDropData.type === 'IN' ? 'bg-white dark:bg-zinc-800 text-amber-500 border-zinc-200 dark:border-zinc-700 shadow-sm' : 'bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 border-transparent shadow-none'}`}>CASH IN</button>
                    <button type="button" onClick={() => setCashDropData({...cashDropData, type: 'OUT'})} className={`flex-1 py-2.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors border ${cashDropData.type === 'OUT' ? 'bg-white dark:bg-zinc-800 text-amber-500 border-zinc-200 dark:border-zinc-700 shadow-sm' : 'bg-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 border-transparent shadow-none'}`}>PAYOUT</button>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block">AMOUNT ({settings.currencySymbol})</label>
                    <input required type="number" step="0.01" value={cashDropData.amount} onChange={e => setCashDropData({...cashDropData, amount: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2 block">REASON / REFERENCE</label>
                    <input required type="text" value={cashDropData.reason} onChange={e => setCashDropData({...cashDropData, reason: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-4 py-2 rounded-lg text-[10px] font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors uppercase shadow-sm" placeholder="E.G. WATER DELIVERY" />
                  </div>
                  <div className="flex justify-end gap-3 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                    <button type="button" onClick={() => setIsCashModalOpen(false)} className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors shadow-sm">CANCEL</button>
                    <button type="submit" className="px-6 py-2.5 bg-amber-500 text-zinc-950 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-amber-400 transition-colors shadow-sm">CONFIRM</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {isResumeOpen && (
            <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 max-w-lg w-full">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tracking-widest uppercase">SUSPENDED CARTS</h2>
                  <button type="button" onClick={() => setIsResumeOpen(false)} className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">CLOSE</button>
                </div>
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {heldCarts.map((h, i) => (
                    <div key={h.id} className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl flex justify-between items-center hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">CART #{i + 1}</p>
                          <span className="bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-500 px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono font-bold tracking-widest">{new Date(h.id).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{h.cart.length} ITEM{h.cart.length !== 1 && 'S'} • {settings.currencySymbol}{h.cart.reduce((s, c) => s + ((Number(c.price)||0) * (Number(c.qty)||0)), 0).toFixed(2)}</p>
                      </div>
                      <button type="button" onClick={() => handleResumeCart(i)} className="bg-amber-500 text-zinc-950 px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-amber-400 transition-colors shadow-sm">RESUME</button>
                    </div>
                  ))}
                  {heldCarts.length === 0 && (
                    <div className="py-12 flex flex-col items-center justify-center text-zinc-500 dark:text-zinc-600">
                      <svg className="w-12 h-12 mb-3 text-zinc-400 dark:text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                      <p className="text-[10px] font-bold uppercase tracking-widest">NO SUSPENDED CARTS.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeView === 'zreading' && activeShift && (
            <div className="max-w-md mx-auto bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-10 mt-10">
              <div className="mb-8 border-b border-zinc-200 dark:border-zinc-800 pb-8 text-center">
                <div className="w-12 h-12 bg-red-50 dark:bg-red-500/10 rounded-lg flex items-center justify-center mx-auto mb-6 border border-red-200 dark:border-red-500/20 shadow-sm">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </div>
                <h3 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 mb-2 tracking-widest uppercase">CLOSE REGISTER</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">COUNT PHYSICAL CASH TO COMPLETE SHIFT.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">STARTING FLOAT</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{settings.currencySymbol}{activeShift.starting_float.toFixed(2)}</p>
                </div>
                <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">SYSTEM EXPECTED</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-500 tracking-tight">{settings.currencySymbol}{activeShift.expected_cash.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="mb-8">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">ACTUAL CASH COUNTED ({settings.currencySymbol})</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 font-bold text-xl">{settings.currencySymbol}</span>
                  <input type="number" step="0.01" value={zReadingCash} onChange={(e) => setZReadingCash(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg text-lg font-bold text-zinc-900 dark:text-zinc-100 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors shadow-sm" placeholder="0.00" autoFocus />
                </div>
              </div>
              
              {zReadingCash !== '' && (
                <div className={`p-5 rounded-lg mb-8 flex justify-between items-center shadow-sm transition-colors border ${parseFloat(zReadingCash) - activeShift.expected_cash < 0 ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20' : parseFloat(zReadingCash) - activeShift.expected_cash > 0 ? 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-500/20' : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800'}`}>
                  <span className="text-[10px] uppercase tracking-widest font-bold">VARIANCE</span>
                  <span className="text-xl font-bold tracking-tight">{(parseFloat(zReadingCash) - activeShift.expected_cash) > 0 ? '+' : ''}{settings.currencySymbol}{(parseFloat(zReadingCash) - activeShift.expected_cash).toFixed(2)}</span>
                </div>
              )}
              
              <button type="button" onClick={handleCloseShift} disabled={zReadingCash === ''} className="w-full bg-amber-500 text-zinc-950 py-3.5 rounded-lg text-[11px] font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-amber-400 transition-colors shadow-sm">CONFIRM & END SHIFT</button>
            </div>
          )}

          {zReadingReceipt && (
            <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm flex items-center justify-center print:static print:bg-transparent print:block p-4 z-50 transition-opacity">
              <div className="bg-white p-8 rounded-xl shadow-2xl border border-zinc-200 max-w-sm w-full max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0 print:shadow-none print:m-0 print:w-full print:border-none print:bg-white custom-scrollbar">
                <div className="flex justify-between items-center mb-6 print:hidden border-b border-gray-100 pb-4">
                  <h2 className="text-[11px] font-bold text-zinc-900 uppercase tracking-widest">END OF DAY REPORT</h2>
                </div>

                <div className="bg-white rounded-lg print:p-0">
                  <div className="font-mono text-sm text-black print:w-[300px] print:mx-auto leading-relaxed">
                    <div className="text-center mb-6">
                      <h1 className="text-lg font-bold uppercase tracking-wider mb-2">{settings.storeName}</h1>
                      <h2 className="text-[10px] font-bold uppercase tracking-widest border-b border-black pb-1 inline-block">Z-READING</h2>
                    </div>
                    <div className="border-t border-dashed border-black py-3 mb-3 space-y-2 uppercase">
                      <p className="flex justify-between"><span className="text-gray-600">SHIFT:</span> <span className="font-bold">{zReadingReceipt.id}</span></p>
                      <p className="flex justify-between"><span className="text-gray-600">OPEN:</span> <span className="font-bold">{zReadingReceipt.start_time}</span></p>
                      <p className="flex justify-between"><span className="text-gray-600">CLOSE:</span> <span className="font-bold">{zReadingReceipt.end_time}</span></p>
                      <p className="flex justify-between"><span className="text-gray-600">BY:</span> <span className="font-bold">{currentUser.name}</span></p>
                    </div>
                    <div className="border-t border-b border-dashed border-black py-3 mb-3 space-y-2 uppercase">
                      <div className="flex justify-between text-gray-600"><span>FLOAT:</span><span>{settings.currencySymbol}{zReadingReceipt.starting_float.toFixed(2)}</span></div>
                      <div className="flex justify-between font-bold"><span>EXPECTED:</span><span>{settings.currencySymbol}{zReadingReceipt.expected_cash.toFixed(2)}</span></div>
                      <div className="flex justify-between font-bold"><span>ACTUAL:</span><span>{settings.currencySymbol}{zReadingReceipt.actual_cash.toFixed(2)}</span></div>
                    </div>
                    <div className="flex justify-between font-bold text-base uppercase mt-3"><span>VARIANCE:</span><span>{settings.currencySymbol}{zReadingReceipt.difference.toFixed(2)}</span></div>
                  </div>
                </div>

                <div className="mt-8 print:hidden flex gap-3">
                  <button type="button" onClick={() => executePrint()} className="flex-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">PRINT</button>
                  <button type="button" onClick={() => { setZReadingReceipt(null); setActiveView('terminal'); }} className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-zinc-100 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm">DONE</button>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}