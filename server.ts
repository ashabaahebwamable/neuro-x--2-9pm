import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
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
let app: any;

function initDb() {
  console.time('DB Init');
  db = new Database('./neurox.db');

  db.exec(`
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
  const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get() as { count: number };
  if (userCount.count === 0) {
    const hashedPassword = bcrypt.hashSync('password123', 10);
    const insertUser = db.prepare('INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)');
    insertUser.run('Dr. Alice', 'radiologist@neurox.com', hashedPassword, 'Radiologist');
    insertUser.run('Dr. Bob', 'doctor@neurox.com', hashedPassword, 'Doctor');
    insertUser.run('Dr. Charlie', 'anesthesiologist@neurox.com', hashedPassword, 'Anesthesiologist');
  }
  console.timeEnd('DB Init');
}

function startServer() {
  app = express();
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
  app.post('/api/register', (req, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { name, email, password, role } = req.body;
      
      const existingUser = db.prepare('SELECT * FROM Users WHERE email = ?').get(email);
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const hashedPassword = bcrypt.hashSync(password, 10);
      db.prepare('INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
        name, email, hashedPassword, role);
      
      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Login
  app.post('/api/login', (req, res) => {
    try {
      console.log('Login request body:', req.body);
      console.log('Login request headers:', req.headers);
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { email, password } = req.body;
      const user = db.prepare('SELECT * FROM Users WHERE email = ?').get(email) as any;
      
      if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET);
        
        // Start shift
        const shiftResult = db.prepare('INSERT INTO Shifts (user_id, login_time) VALUES (?, ?)').run(
          user.id, new Date().toISOString());
        
        res.json({ 
          token, 
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
          shiftId: shiftResult.lastInsertRowid
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
  app.post('/api/logout', authenticateToken, (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      db.prepare('UPDATE Shifts SET logout_time = ? WHERE user_id = ? AND logout_time IS NULL').run(
        new Date().toISOString(), req.user.id);
      res.json({ message: 'Logged out' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get Users (for transferring cases)
  app.get('/api/users', authenticateToken, (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const users = db.prepare('SELECT id, name, role FROM Users WHERE id != ?').all(req.user.id);
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get Shift Stats
  app.get('/api/shift-stats', authenticateToken, (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const stats = db.prepare(`
        SELECT login_time, cases_handled 
        FROM Shifts 
        WHERE user_id = ? AND logout_time IS NULL 
        ORDER BY id DESC LIMIT 1
      `).get(req.user.id);
      res.json(stats || { login_time: null, cases_handled: 0 });
    } catch (error) {
      console.error('Get shift stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Upload Case
  app.post('/api/cases', authenticateToken, upload.single('image'), (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { patientName, findings, confidence } = req.body;
      const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
      
      const result = db.prepare(`
        INSERT INTO Cases (uploaded_by, patient_name, image_path, findings, confidence, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(req.user.id, patientName, imagePath, findings, confidence, 'pending');

      // Update shift case count
      db.prepare('UPDATE Shifts SET cases_handled = cases_handled + 1 WHERE user_id = ? AND logout_time IS NULL').run(req.user.id);

      res.json({ id: result.lastInsertRowid, imagePath });
    } catch (error) {
      console.error('Upload case error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Transfer Case
  app.post('/api/cases/transfer', authenticateToken, (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { caseId, sentTo, notes } = req.body;
      
      db.prepare(`
        INSERT INTO CaseTransfers (case_id, sent_by, sent_to, notes)
        VALUES (?, ?, ?, ?)
      `).run(caseId, req.user.id, sentTo, notes);

      db.prepare('UPDATE Cases SET status = ? WHERE id = ?').run('transferred', caseId);
      
      res.json({ message: 'Case transferred successfully' });
    } catch (error) {
      console.error('Transfer case error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get Cases (Radiologist)
  app.get('/api/cases/radiologist', authenticateToken, (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const cases = db.prepare(`
        SELECT c.*, ct.sent_to, u.name as sent_to_name
        FROM Cases c
        LEFT JOIN CaseTransfers ct ON c.id = ct.case_id
        LEFT JOIN Users u ON ct.sent_to = u.id
        WHERE c.uploaded_by = ?
        ORDER BY c.created_at DESC
      `).all(req.user.id);
      res.json(cases);
    } catch (error) {
      console.error('Get radiologist cases error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get Cases (Doctor/Anesthesiologist)
  app.get('/api/cases/specialist', authenticateToken, (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const cases = db.prepare(`
        SELECT c.*, ct.notes, u.name as radiologist_name
        FROM Cases c
        JOIN CaseTransfers ct ON c.id = ct.case_id
        JOIN Users u ON c.uploaded_by = u.id
        WHERE ct.sent_to = ?
        ORDER BY ct.timestamp DESC
      `).all(req.user.id);
      res.json(cases);
    } catch (error) {
      console.error('Get specialist cases error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update Case Status
  app.patch('/api/cases/:id/status', authenticateToken, (req: any, res) => {
    try {
      if (!db) return res.status(503).json({ message: 'Database initializing' });
      const { status } = req.body;
      db.prepare('UPDATE Cases SET status = ? WHERE id = ?').run(status, req.params.id);
      res.json({ message: 'Status updated' });
    } catch (error) {
      console.error('Update status error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // --- Startup Sequence ---
  initializeServer();
}

async function initializeServer() {
  try {
    console.log('--- NeuroX Terminal Initialization ---');
    
    console.log('Step 1: Initializing Database...');
    initDb();
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
