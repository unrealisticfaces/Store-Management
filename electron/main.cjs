const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');

let mainWindow;
let db;

function initializeDatabase() {
  // Creates store.sqlite in the user's app data folder so it persists after updates
  const dbPath = path.join(app.getPath('userData'), 'store.sqlite');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  // Create tables if they do not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory (id INTEGER PRIMARY KEY, name TEXT, price REAL, sku TEXT);
    CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, items TEXT, total REAL, timestamp TEXT);
    CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, action TEXT, details TEXT, timestamp TEXT);
  `);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // Load Vite dev server in development, or the built HTML in production
  if (process.env.NODE_ENV !== 'production' && !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  initializeDatabase();
  createWindow();

  // --- IPC Handlers (React communicates with SQLite through these) ---
  
  // Inventory
  ipcMain.handle('get-inventory', () => db.prepare('SELECT * FROM inventory').all());
  ipcMain.handle('add-product', (event, product) => {
    const stmt = db.prepare('INSERT INTO inventory (name, price, sku) VALUES (?, ?, ?)');
    const info = stmt.run(product.name, product.price, product.sku);
    return { ...product, id: info.lastInsertRowid };
  });
  ipcMain.handle('update-product', (event, product) => {
    const stmt = db.prepare('UPDATE inventory SET name = ?, price = ?, sku = ? WHERE id = ?');
    stmt.run(product.name, product.price, product.sku, product.id);
  });

  // Sales
  ipcMain.handle('get-sales', () => db.prepare('SELECT * FROM sales ORDER BY timestamp DESC').all());
  ipcMain.handle('add-sale', (event, sale) => {
    const stmt = db.prepare('INSERT INTO sales (id, items, total, timestamp) VALUES (?, ?, ?, ?)');
    stmt.run(sale.id, JSON.stringify(sale.items), sale.total, sale.timestamp);
  });

  // Logs
  ipcMain.handle('get-logs', () => db.prepare('SELECT * FROM logs ORDER BY id DESC').all());
  ipcMain.handle('add-log', (event, log) => {
    const stmt = db.prepare('INSERT INTO logs (action, details, timestamp) VALUES (?, ?, ?)');
    stmt.run(log.action, log.details, log.timestamp);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});