import React, { useState, useEffect } from 'react';
import Barcode from 'react-barcode';
import { useBarcodeScanner } from './hooks/useBarcodeScanner';

export default function App() {
  const [activeView, setActiveView] = useState('terminal');
  
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [logs, setLogs] = useState([]);
  const [cart, setCart] = useState([]);

  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({ name: '', price: '', sku: '', printQty: 5 });
  const [labelsToPrint, setLabelsToPrint] = useState([]);

  // --- NATIVE DATABASE INITIALIZATION ---
  useEffect(() => {
    async function loadData() {
      // These call the secure contextBridge to fetch from SQLite
      const dbInventory = await window.electronAPI.getInventory();
      const dbSales = await window.electronAPI.getSales();
      const dbLogs = await window.electronAPI.getLogs();
      
      // Parse JSON string stored in SQLite back into an array for the UI
      const parsedSales = dbSales.map(sale => ({ ...sale, items: JSON.parse(sale.items) }));

      setInventory(dbInventory);
      setSales(parsedSales);
      setLogs(dbLogs);
    }
    loadData();
  }, []);

  const addLog = async (action, details) => {
    const timestamp = new Date().toLocaleString();
    await window.electronAPI.addLog({ action, details, timestamp });
    setLogs(await window.electronAPI.getLogs());
  };

  useBarcodeScanner((scannedSku) => {
    const product = inventory.find(p => p.sku === scannedSku);
    if (!product) {
      addLog('Scan Error', `Unrecognized SKU: ${scannedSku}`);
      alert(`SKU ${scannedSku} not found.`);
      return;
    }

    setActiveView('terminal');
    setCart(prev => {
      const exists = prev.find(item => item.sku === scannedSku);
      if (exists) return prev.map(item => item.sku === scannedSku ? { ...item, qty: item.qty + 1 } : item);
      return [...prev, { ...product, qty: 1 }];
    });
  });

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    const price = parseFloat(formData.price);
    if (!formData.name || isNaN(price) || !formData.sku) return alert('Invalid form data');

    if (editingProduct) {
      await window.electronAPI.updateProduct({ id: editingProduct.id, name: formData.name, price, sku: formData.sku });
      addLog('Edit Product', `Updated ${formData.name} (SKU: ${formData.sku})`);
    } else {
      const newProduct = await window.electronAPI.addProduct({ name: formData.name, price, sku: formData.sku });
      addLog('Add Product', `Created ${formData.name} (SKU: ${formData.sku})`);
      
      const labels = Array.from({ length: parseInt(formData.printQty) || 1 }).fill(newProduct);
      setLabelsToPrint(labels);
    }

    setInventory(await window.electronAPI.getInventory()); // Refresh UI from DB
    setIsAddingProduct(false);
    setEditingProduct(null);
    setFormData({ name: '', price: '', sku: '', printQty: 5 });
  };

  const openEdit = (product) => {
    setEditingProduct(product);
    setFormData({ name: product.name, price: product.price, sku: product.sku, printQty: 0 });
    setIsAddingProduct(true);
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const timestamp = new Date().toLocaleString();
    const saleId = `INV-${Date.now()}`;
    
    await window.electronAPI.addSale({ id: saleId, items: cart, total, timestamp });
    addLog('Sale Completed', `Invoice ${saleId} for $${total.toFixed(2)}`);
    
    setSales(await window.electronAPI.getSales()); // Refresh UI from DB
    setCart([]);
  };
}
