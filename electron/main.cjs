const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

let mainWindow;
let db;

function initializeDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'store.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY, name TEXT, category TEXT, cost REAL, price REAL, sku TEXT, stock INTEGER);
    CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, cashier TEXT, items TEXT, total REAL, profit REAL, timestamp TEXT);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, action TEXT, details TEXT, timestamp TEXT);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, name TEXT, password TEXT, role TEXT);
    CREATE TABLE IF NOT EXISTS shifts (id TEXT PRIMARY KEY, opened_by TEXT, start_time TEXT, end_time TEXT, starting_float REAL, expected_cash REAL, actual_cash REAL, status TEXT);
  `);

  try { db.exec('ALTER TABLE inventory ADD COLUMN category TEXT DEFAULT "OTHER"'); } catch(e) {}
  try { db.exec('ALTER TABLE sales ADD COLUMN cashier TEXT DEFAULT "UNKNOWN"'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN username TEXT'); } catch(e) {}
  try { db.exec('ALTER TABLE users ADD COLUMN password TEXT'); } catch(e) {}

  const adminCount = db.prepare('SELECT count(*) as count FROM users').get().count;
  if (adminCount === 0) {
    try {
      db.prepare('INSERT INTO users (username, name, password, role) VALUES (?, ?, ?, ?)').run('admin', 'System Admin', 'admin123', 'manager');
    } catch(e) {}
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
    return db.prepare('SELECT id, username, name, role FROM users WHERE lower(username) = lower(?) AND password = ?').get(username, password) || null;
  });
  ipcMain.handle('get-users', () => db.prepare('SELECT id, username, name, role FROM users').all());
  ipcMain.handle('add-user', (event, u) => {
    try {
      db.prepare('INSERT INTO users (username, name, password, role) VALUES (?, ?, ?, ?)').run(u.username, u.name, u.password, u.role);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Username may already exist' };
    }
  });
  ipcMain.handle('delete-user', (event, id) => db.prepare('DELETE FROM users WHERE id = ?').run(id));
  ipcMain.handle('update-user-password', (event, { id, newPassword }) => {
    try {
      db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, id);
      return { success: true };
    } catch (error) {
      return { success: false };
    }
  });
  
  ipcMain.handle('get-inventory', () => db.prepare('SELECT * FROM inventory').all());
  ipcMain.handle('add-product', (event, p) => {
    const info = db.prepare('INSERT INTO inventory (name, category, cost, price, sku, stock) VALUES (?, ?, ?, ?, ?, ?)').run(p.name, p.category, p.cost, p.price, p.sku, p.stock);
    return { ...p, id: info.lastInsertRowid };
  });
  ipcMain.handle('update-product', (event, p) => db.prepare('UPDATE inventory SET name=?, category=?, cost=?, price=?, sku=?, stock=? WHERE id=?').run(p.name, p.category, p.cost, p.price, p.sku, p.stock, p.id));
  ipcMain.handle('delete-product', (event, id) => db.prepare('DELETE FROM inventory WHERE id = ?').run(id));
  
  ipcMain.handle('get-sales', () => db.prepare('SELECT * FROM sales ORDER BY timestamp DESC').all());
  ipcMain.handle('add-sale', (event, sale) => {
    db.prepare('INSERT INTO sales (id, cashier, items, total, profit, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(sale.id, sale.cashier, JSON.stringify(sale.items), sale.total, sale.profit, sale.timestamp);
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
  ipcMain.handle('adjust-shift-cash', (event, req) => db.prepare("UPDATE shifts SET expected_cash = expected_cash + ? WHERE status = 'active'").run(req.amount));
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });