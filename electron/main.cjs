const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const crypto = require('crypto');

let mainWindow;
let db;

const hashString = (str) => crypto.createHash('sha256').update(str).digest('hex');

function initializeDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'store_v3.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY, name TEXT, category TEXT, cost REAL, price REAL, sku TEXT, stock INTEGER);
    CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, cashier TEXT, items TEXT, subtotal REAL, discount REAL, total REAL, profit REAL, timestamp TEXT);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, action TEXT, details TEXT, timestamp TEXT);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, name TEXT, password TEXT, role TEXT);
    CREATE TABLE IF NOT EXISTS shifts (id TEXT PRIMARY KEY, opened_by TEXT, start_time TEXT, end_time TEXT, starting_float REAL, expected_cash REAL, actual_cash REAL, status TEXT);
  `);

  const adminCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (adminCount === 0) {
    db.prepare('INSERT INTO users (username, name, password, role) VALUES (?, ?, ?, ?)').run('admin', 'System Admin', hashString('admin123'), 'manager');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.setMenu(null);
  mainWindow.maximize();
  if (process.env.NODE_ENV !== 'production' && !app.isPackaged) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  ipcMain.handle('login-user', (event, { username, password }) => {
    const hashed = hashString(password);
    return db.prepare('SELECT id, username, name, role FROM users WHERE username = ? AND password = ?').get(username, hashed) || null;
  });
  ipcMain.handle('get-users', () => db.prepare('SELECT id, username, name, role FROM users').all());
  ipcMain.handle('add-user', (event, u) => {
    try {
      const info = db.prepare('INSERT INTO users (username, name, password, role) VALUES (?, ?, ?, ?)').run(u.username, u.name, hashString(u.password), u.role);
      return { success: true, id: info.lastInsertRowid };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  ipcMain.handle('delete-user', (event, id) => db.prepare('DELETE FROM users WHERE id = ?').run(id));

  ipcMain.handle('get-inventory', () => db.prepare('SELECT * FROM inventory').all());
  ipcMain.handle('add-product', (event, p) => {
    const info = db.prepare('INSERT INTO inventory (name, category, cost, price, sku, stock) VALUES (?, ?, ?, ?, ?, ?)').run(p.name, p.category, p.cost, p.price, p.sku, p.stock);
    return { ...p, id: info.lastInsertRowid };
  });
  ipcMain.handle('update-product', (event, p) => db.prepare('UPDATE inventory SET name=?, category=?, cost=?, price=?, sku=?, stock=? WHERE id=?').run(p.name, p.category, p.cost, p.price, p.sku, p.stock, p.id));
  ipcMain.handle('delete-product', (event, id) => db.prepare('DELETE FROM inventory WHERE id = ?').run(id));

  ipcMain.handle('get-sales', () => db.prepare('SELECT * FROM sales ORDER BY timestamp DESC').all());
  ipcMain.handle('add-sale', (event, sale) => {
    db.prepare('INSERT INTO sales (id, cashier, items, subtotal, discount, total, profit, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(sale.id, sale.cashier, JSON.stringify(sale.items), sale.subtotal, sale.discount, sale.total, sale.profit, sale.timestamp);
    const updateStock = db.prepare('UPDATE inventory SET stock = stock - ? WHERE sku = ?');
    const updateShift = db.prepare("UPDATE shifts SET expected_cash = expected_cash + ? WHERE status = 'active'");
    db.transaction((items) => {
      for (const item of items) updateStock.run(item.qty, item.sku);
      updateShift.run(sale.total);
    })(sale.items);
  });

  ipcMain.handle('get-logs', () => db.prepare('SELECT * FROM logs ORDER BY id DESC').all());
  ipcMain.handle('add-log', (event, log) => db.prepare('INSERT INTO logs (action, details, timestamp) VALUES (?, ?, ?)').run(log.action, log.details, log.timestamp));
  
  ipcMain.handle('get-active-shift', () => db.prepare("SELECT * FROM shifts WHERE status = 'active' LIMIT 1").get() || null);
  ipcMain.handle('get-all-shifts', () => db.prepare('SELECT * FROM shifts ORDER BY start_time DESC').all());
  ipcMain.handle('open-shift', (event, shift) => db.prepare('INSERT INTO shifts (id, opened_by, start_time, starting_float, expected_cash, status) VALUES (?, ?, ?, ?, ?, ?)').run(shift.id, shift.opened_by, shift.start_time, shift.starting_float, shift.starting_float, 'active'));
  ipcMain.handle('close-shift', (event, req) => db.prepare("UPDATE shifts SET end_time=?, actual_cash=?, status='closed' WHERE id=?").run(req.end_time, req.actual_cash, req.id));
  ipcMain.handle('adjust-shift-cash', (event, req) => {
    const shift = db.prepare("SELECT * FROM shifts WHERE status = 'active' LIMIT 1").get();
    if (shift) {
      db.prepare("UPDATE shifts SET expected_cash = expected_cash + ? WHERE id = ?").run(req.amount, shift.id);
      db.prepare('INSERT INTO logs (action, details, timestamp) VALUES (?, ?, ?)').run(req.amount > 0 ? 'CASH DROP IN' : 'PAYOUT', JSON.stringify({ msg: req.reason, category: 'FINANCE', qty: req.amount }), new Date().toLocaleString());
    }
  });

  ipcMain.handle('get-printers', async () => {
    if (mainWindow && mainWindow.webContents) return await mainWindow.webContents.getPrintersAsync();
    return [];
  });
  ipcMain.handle('print-silent', async (event, printerName) => {
    if (mainWindow) {
      mainWindow.webContents.print({ silent: true, deviceName: printerName, margins: { marginType: 'none' }, color: false, copies: 1 }, (success, failureReason) => {});
    }
  });
  ipcMain.handle('trigger-cash-drawer', async (event, printerName) => {
    if (mainWindow) mainWindow.webContents.print({ silent: true, deviceName: printerName, margins: { marginType: 'none' } });
  });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });