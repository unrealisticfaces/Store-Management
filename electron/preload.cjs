const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth & Users
  verifyPin: (pin) => ipcRenderer.invoke('verify-pin', pin),
  getUsers: () => ipcRenderer.invoke('get-users'),
  addUser: (user) => ipcRenderer.invoke('add-user', user),
  deleteUser: (id) => ipcRenderer.invoke('delete-user', id),

  // Inventory
  getInventory: () => ipcRenderer.invoke('get-inventory'),
  addProduct: (product) => ipcRenderer.invoke('add-product', product),
  updateProduct: (product) => ipcRenderer.invoke('update-product', product),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
  
  // Sales
  getSales: () => ipcRenderer.invoke('get-sales'),
  addSale: (sale) => ipcRenderer.invoke('add-sale', sale),
  
  // Logs
  getLogs: () => ipcRenderer.invoke('get-logs'),
  addLog: (log) => ipcRenderer.invoke('add-log', log),

  // Shifts
  getActiveShift: () => ipcRenderer.invoke('get-active-shift'),
  getAllShifts: () => ipcRenderer.invoke('get-all-shifts'),
  openShift: (shiftData) => ipcRenderer.invoke('open-shift', shiftData),
  closeShift: (closingData) => ipcRenderer.invoke('close-shift', closingData)
});