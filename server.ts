import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';

const JWT_SECRET = process.env.JWT_SECRET || 'neurox_secret_key_2026';
const PORT = Number(process.env.PORT) || 3000;

console.time('Server Startup');

// Multer setup for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

let db: any;

async function initDb() {
  console.time('DB Init');
  db = await open({
    filename: './neurox.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      login_time DATETIME NOT NULL,
      logout_time DATETIME,
      cases_handled INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES Users(id)
    );

    CREATE TABLE IF NOT EXISTS Cases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uploaded_by INTEGER NOT NULL,
      patient_name TEXT NOT NULL,
      image_path TEXT,
      mask_path TEXT,
      findings TEXT,
      confidence REAL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (uploaded_by) REFERENCES Users(id)
    );

    CREATE TABLE IF NOT EXISTS CaseTransfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      case_id INTEGER NOT NULL,
      sent_by INTEGER NOT NULL,
      sent_to INTEGER NOT NULL,
      notes TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (case_id) REFERENCES Cases(id),
      FOREIGN KEY (sent_by) REFERENCES Users(id),
      FOREIGN KEY (sent_to) REFERENCES Users(id)
    );
  `);

  // Seed default users if empty
  const userCount = await db.get('SELECT COUNT(*) as count FROM Users');
  if (userCount.count === 0) {
    const hashedPassword = await bcrypt.hash('password123', 10);
    await db.run('INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)', 
      ['Dr. Alice', 'radiologist@neurox.com', hashedPassword, 'Radiologist']);
    await db.run('INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)', 
      ['Dr. Bob', 'doctor@neurox.com', hashedPassword, 'Doctor']);
    await db.run('INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)', 
      ['Dr. Charlie', 'anesthesiologist@neurox.com', hashedPassword, 'Anesthesiologist']);
  }
  console.timeEnd('DB Init');
}

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // Ensure uploads directory exists
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    console.log('Creating uploads directory...');
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use('/uploads', express.static('uploads'));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', initialized: !!db });
  });

  // Start listening IMMEDIATELY to satisfy platform checks
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`NeuroX Server listening on port ${PORT}`);
  });

  server.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use`);
    } else {
      console.error('Server error:', error);
    }
    process.exit(1);
  });

  // Auth Middleware
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---
  
  // Register
  app.post('/api/register', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { name, email, password, role } = req.body;
      
      const existingUser = await db.get('SELECT * FROM Users WHERE email = ?', [email]);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await db.run('INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)', 
        [name, email, hashedPassword, role]);
      
      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Login
  app.post('/api/login', async (req, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { email, password } = req.body;
      const user = await db.get('SELECT * FROM Users WHERE email = ?', [email]);
      
      if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
        
        // Start shift
        const shift = await db.run('INSERT INTO Shifts (user_id, login_time) VALUES (?, ?)', 
          [user.id, new Date().toISOString()]);
        
        res.json({ 
          token, 
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
          shiftId: shift.lastID
        });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Logout
  app.post('/api/logout', authenticateToken, async (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      await db.run('UPDATE Shifts SET logout_time = ? WHERE user_id = ? AND logout_time IS NULL', 
        [new Date().toISOString(), req.user.id]);
      res.json({ message: 'Logged out' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get Users (for transferring cases)
  app.get('/api/users', authenticateToken, async (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const users = await db.all('SELECT id, name, role FROM Users WHERE id != ?', [req.user.id]);
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get Shift Stats
  app.get('/api/shift-stats', authenticateToken, async (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const stats = await db.get(`
        SELECT login_time, cases_handled 
        FROM Shifts 
        WHERE user_id = ? AND logout_time IS NULL 
        ORDER BY id DESC LIMIT 1
      `, [req.user.id]);
      res.json(stats || { login_time: null, cases_handled: 0 });
    } catch (error) {
      console.error('Get shift stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Upload Case
  app.post('/api/cases', authenticateToken, upload.single('image'), async (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { patientName, findings, confidence } = req.body;
      const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
      
      const result = await db.run(`
        INSERT INTO Cases (uploaded_by, patient_name, image_path, findings, confidence, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [req.user.id, patientName, imagePath, findings, confidence, 'pending']);

      // Update shift case count
      await db.run('UPDATE Shifts SET cases_handled = cases_handled + 1 WHERE user_id = ? AND logout_time IS NULL', [req.user.id]);

      res.json({ id: result.lastID, imagePath });
    } catch (error) {
      console.error('Upload case error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Transfer Case
  app.post('/api/cases/transfer', authenticateToken, async (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { caseId, sentTo, notes } = req.body;
      
      await db.run(`
        INSERT INTO CaseTransfers (case_id, sent_by, sent_to, notes)
        VALUES (?, ?, ?, ?)
      `, [caseId, req.user.id, sentTo, notes]);

      await db.run('UPDATE Cases SET status = ? WHERE id = ?', ['transferred', caseId]);
      
      res.json({ message: 'Case transferred successfully' });
    } catch (error) {
      console.error('Transfer case error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get Cases (Radiologist)
  app.get('/api/cases/radiologist', authenticateToken, async (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const cases = await db.all(`
        SELECT c.*, ct.sent_to, u.name as sent_to_name
        FROM Cases c
        LEFT JOIN CaseTransfers ct ON c.id = ct.case_id
        LEFT JOIN Users u ON ct.sent_to = u.id
        WHERE c.uploaded_by = ?
        ORDER BY c.created_at DESC
      `, [req.user.id]);
      res.json(cases);
    } catch (error) {
      console.error('Get radiologist cases error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get Cases (Doctor/Anesthesiologist)
  app.get('/api/cases/specialist', authenticateToken, async (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const cases = await db.all(`
        SELECT c.*, ct.notes, u.name as radiologist_name
        FROM Cases c
        JOIN CaseTransfers ct ON c.id = ct.case_id
        JOIN Users u ON c.uploaded_by = u.id
        WHERE ct.sent_to = ?
        ORDER BY ct.timestamp DESC
      `, [req.user.id]);
      res.json(cases);
    } catch (error) {
      console.error('Get specialist cases error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update Case Status
  app.patch('/api/cases/:id/status', authenticateToken, async (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { status } = req.body;
      await db.run('UPDATE Cases SET status = ? WHERE id = ?', [status, req.params.id]);
      res.json({ message: 'Status updated' });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // --- Startup Sequence ---
  try {
    console.log('--- NeuroX Terminal Initialization ---');
    
    console.log('Step 1: Initializing Database...');
    await initDb();
    console.log('Database Initialized.');

    if (process.env.NODE_ENV !== 'production') {
      console.log('Step 2: Initializing Vite Middleware...');
      try {
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: 'spa',
        });
        app.use(vite.middlewares);
        console.log('Vite Middleware Ready.');
      } catch (viteError) {
        console.error('Vite initialization failed:', viteError);
        process.exit(1);
      }
    } else {
      console.log('Step 2: Serving Production Assets...');
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        console.warn('dist directory not found. Production build may be missing.');
      }
    }
    console.timeEnd('Server Startup');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

startServer();
