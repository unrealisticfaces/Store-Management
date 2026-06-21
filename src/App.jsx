import React, { useState } from 'react';
import Barcode from 'react-barcode';
import { useBarcodeScanner } from './hooks/useBarcodeScanner'; // <-- Import our new hook!

const INITIAL_INVENTORY = [
  { id: 1, name: 'Canned Tuna', price: 2.50, sku: '750101' },
  { id: 2, name: 'Cola Soda', price: 1.25, sku: '750102' },
  { id: 3, name: 'Whole Milk', price: 3.00, sku: '750103' },
  { id: 4, name: 'Potato Chips', price: 1.99, sku: '750104' },
];

export default function App() {
  const [inventory] = useState(INITIAL_INVENTORY);
  const [cart, setCart] = useState([]); // <-- Our new cart state

  // This function runs every time the scanner finishes a scan
  const handleScan = (scannedSku) => {
    // 1. Look for the product in our database
    const product = inventory.find((item) => item.sku === scannedSku);

    if (!product) {
      alert(`Unrecognized Barcode: ${scannedSku}`);
      return;
    }

    // 2. Add it to the cart, or increase the quantity if it's already there
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.sku === scannedSku);
      if (existingItem) {
        return prevCart.map((item) =>
          item.sku === scannedSku ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prevCart, { ...product, qty: 1 }];
    });
  };

  // Turn on the scanner and pass it our handleScan function
  useBarcodeScanner(handleScan);

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-800">Store POS System</h1>
        <p className="text-slate-500">Point of Sale Terminal & Inventory</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* THE CART TERMINAL */}
        <div className="md:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-[600px] flex flex-col">
          <h2 className="text-xl font-bold text-slate-700 mb-4">🛒 Active Cart</h2>
          
          <div className="flex-grow overflow-y-auto">
            {cart.length === 0 ? (
              <p className="text-slate-400 text-center mt-10">Waiting for scan...</p>
            ) : (
              <ul className="space-y-3">
                {cart.map((item, index) => (
                  <li key={index} className="flex justify-between items-center p-3 bg-slate-50 rounded border">
                    <div>
                      <p className="font-semibold text-slate-800">{item.name}</p>
                      <p className="text-sm text-slate-500">Qty: {item.qty} x ${item.price.toFixed(2)}</p>
                    </div>
                    <p className="font-bold text-emerald-600">${(item.qty * item.price).toFixed(2)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* THE INVENTORY (Unchanged) */}
        <div className="md:col-span-2">
          <h2 className="text-xl font-bold text-slate-700 mb-4">Product Directory</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inventory.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col items-center">
                <h3 className="text-lg font-semibold text-slate-800">{item.name}</h3>
                <p className="text-emerald-600 font-bold mb-4">${item.price.toFixed(2)}</p>
                <div className="bg-white p-2 rounded">
                  <Barcode value={item.sku} width={1.5} height={40} fontSize={14} background="#ffffff" />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}