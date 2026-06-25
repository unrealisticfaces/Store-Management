const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loginUser: (creds) => ipcRenderer.invoke('login-user', creds),
  getUsers: () => ipcRenderer.invoke('get-users'),
  addUser: (user) => ipcRenderer.invoke('add-user', user),
  deleteUser: (id) => ipcRenderer.invoke('delete-user', id),
  getInventory: () => ipcRenderer.invoke('get-inventory'),
  addProduct: (product) => ipcRenderer.invoke('add-product', product),
  updateProduct: (product) => ipcRenderer.invoke('update-product', product),
  deleteProduct: (id) => ipcRenderer.invoke('delete-product', id),
  getSales: () => ipcRenderer.invoke('get-sales'),
  addSale: (sale) => ipcRenderer.invoke('add-sale', sale),
  getLogs: () => ipcRenderer.invoke('get-logs'),
  addLog: (log) => ipcRenderer.invoke('add-log', log),
  getActiveShift: () => ipcRenderer.invoke('get-active-shift'),
  getAllShifts: () => ipcRenderer.invoke('get-all-shifts'),
  openShift: (shift) => ipcRenderer.invoke('open-shift', shift),
  closeShift: (req) => ipcRenderer.invoke('close-shift', req),
  adjustShiftCash: (req) => ipcRenderer.invoke('adjust-shift-cash', req),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printSilent: (printerName) => ipcRenderer.invoke('print-silent', printerName),
  triggerCashDrawer: (printerName) => ipcRenderer.invoke('trigger-cash-drawer', printerName)
});