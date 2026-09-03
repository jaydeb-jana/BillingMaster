import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/mysql.js';
import { authenticateToken } from './middleware/auth.js';
import { signup, login, getSession, updateUser } from './controllers/authController.js';
import { createBusiness } from './controllers/businessController.js';
import { createInvoiceTransaction } from './controllers/invoiceController.js';
import {
  listRecords,
  insertRecord,
  upsertRecord,
  updateRecord,
  removeRecord,
} from './controllers/dbController.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(authenticateToken);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'BillingMaster API (Node.js + Express + MySQL)', timestamp: new Date().toISOString() });
});

// Auth Routes
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.get('/api/auth/session', getSession);
app.put('/api/auth/user', updateUser);

// RPC Routes
app.post('/api/rpc/create_business', createBusiness);
app.post('/api/rpc/create_invoice_transaction', createInvoiceTransaction);

// Generic DB REST Routes
app.get('/api/db/:table', listRecords);
app.post('/api/db/:table', insertRecord);
app.put('/api/db/:table/upsert', upsertRecord);
app.put('/api/db/:table/:id', updateRecord);
app.delete('/api/db/:table/:id', removeRecord);

// Initialize DB and start server
initDb().then((connected) => {
  if (connected) {
    console.log('[Server] MySQL initialized and ready.');
  } else {
    console.log('[Server] Running with mock/local store fallbacks until MySQL database connection is established.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] BillingMaster Node.js API listening on http://0.0.0.0:${PORT}`);
  });
});
