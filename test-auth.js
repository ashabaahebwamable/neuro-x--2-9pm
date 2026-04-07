import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';

const db = new Database('./neurox.db');
const user = db.prepare('SELECT * FROM Users WHERE email = ?').get('radiologist@neurox.com');
console.log('User found:', !!user);
if (user) {
  console.log('Password hash:', user.password);
  const isValid = bcrypt.compareSync('password123', user.password);
  console.log('Password valid:', isValid);
}
db.close();