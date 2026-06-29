import { migrate } from './db.js';

const databasePath = migrate();
console.log(`Database ready: ${databasePath}`);
