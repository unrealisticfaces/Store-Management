const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getInventory: () => ipcRenderer.invoke('get-inventory'),
  addProduct: (product) => ipcRenderer.invoke('add-product', product),
  updateProduct: (product) => ipcRenderer.invoke('update-product', product),
  
  getSales: () => ipcRenderer.invoke('get-sales'),
  addSale: (sale) => ipcRenderer.invoke('add-sale', sale),
  
  getLogs: () => ipcRenderer.invoke('get-logs'),
  addLog: (log) => ipcRenderer.invoke('add-log', log)
});