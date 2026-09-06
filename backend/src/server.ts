import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db/mysql.js';
import { authenticateToken } from './middleware/auth.js';
import { signup, login, getSession, updateUser, resetPassword, changePassword, sendOtp, deleteAccount } from './controllers/authController.js';
import { createBusiness, checkCatalogHandle } from './controllers/businessController.js';
import { createInvoiceTransaction } from './controllers/invoiceController.js';
import {
  listRecords,
  insertRecord,
  upsertRecord,
  updateRecord,
  removeRecord,
} from './controllers/dbController.js';
import {
  getAdminOverviewStats,
  getAdminPlans,
  createOrUpdateAdminPlan,
  getAdminBusinesses,
  updateAdminBusiness,
  deleteAdminBusiness,
  resetMerchantPasswordAdmin,
  getAdminBulletins,
  createAdminBulletin,
  getAdminFeatureFlags,
  toggleAdminFeatureFlag,
  getAdminAuditLogs,
  getAdminBillingRequests,
  respondAdminBillingRequest,
  createBillingRequest,
  getMerchantBillingRequests,
  getAdminCoupons,
  createOrUpdateAdminCoupon,
  deleteAdminCoupon,
  validateCoupon,
  getMerchantSubscriptionQueue,
} from './controllers/adminController.js';

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

// Business Catalog Handle Check Route
app.get('/api/businesses/check-handle', checkCatalogHandle);

// Auth Routes
app.post('/api/auth/signup', signup);
app.post('/api/auth/login', login);
app.post('/api/auth/reset-password', resetPassword);
app.post('/api/auth/change-password', changePassword);
app.post('/api/auth/send-otp', sendOtp);
app.post('/api/auth/delete-account', deleteAccount);
app.get('/api/auth/session', getSession);
app.put('/api/auth/user', updateUser);

// Admin Dedicated Routes
app.get('/api/admin/stats', getAdminOverviewStats);
app.get('/api/admin/plans', getAdminPlans);
app.post('/api/admin/plans', createOrUpdateAdminPlan);
app.get('/api/admin/businesses', getAdminBusinesses);
app.put('/api/admin/businesses/:id', updateAdminBusiness);
app.delete('/api/admin/businesses/:id', deleteAdminBusiness);
app.post('/api/admin/businesses/reset-password', resetMerchantPasswordAdmin);
app.get('/api/admin/bulletins', getAdminBulletins);
app.post('/api/admin/bulletins', createAdminBulletin);
app.get('/api/admin/feature-flags', getAdminFeatureFlags);
app.post('/api/admin/feature-flags/toggle', toggleAdminFeatureFlag);
app.get('/api/admin/audit-logs', getAdminAuditLogs);
app.get('/api/admin/billing-requests', getAdminBillingRequests);
app.post('/api/admin/billing-requests/:id/respond', respondAdminBillingRequest);

// Coupon Routes
app.get('/api/admin/coupons', getAdminCoupons);
app.post('/api/admin/coupons', createOrUpdateAdminCoupon);
app.delete('/api/admin/coupons/:id', deleteAdminCoupon);
app.post('/api/coupons/validate', validateCoupon);

// Merchant Billing Upgrade Request Routes
app.post('/api/billing-requests', createBillingRequest);
app.get('/api/billing-requests/my', getMerchantBillingRequests);
app.get('/api/subscription-queue/my', getMerchantSubscriptionQueue);


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
