const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'packages', 'db', 'prisma', 'dev.db');
console.log('Checking database at:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
});

db.get("SELECT email, passwordHash, substr(passwordHash, 1, 10) as prefix FROM User WHERE email='admin@example.com'", [], (err, row) => {
  if (err) {
    console.error('Error querying:', err);
    process.exit(1);
  }
  console.log('User found:', row);
  db.close();
});
