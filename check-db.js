import Database from 'better-sqlite3';
const db = new Database('./neurox.db');
const users = db.prepare('SELECT id, name, email, role FROM Users').all();
console.log('Users:', users);
db.close();