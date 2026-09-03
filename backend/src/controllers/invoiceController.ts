import { Response } from 'express';
import crypto from 'node:crypto';
import { pool } from '../db/mysql.js';
import { AuthRequest } from '../middleware/auth.js';

export async function createInvoiceTransaction(req: AuthRequest, res: Response) {
  if (!req.user || !req.user.business_id) {
    res.status(401).json({ error: 'Business membership required' });
    return;
  }

  const { invoice_data, line_items, initial_payment } = req.body;

  if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
    res.status(400).json({ error: 'Invoice must contain at least one item' });
    return;
  }

  const businessId = req.user.business_id;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Get tax rate and prefix settings
    const [settingRows]: any = await connection.query(
      'SELECT tax_rate, invoice_prefix FROM settings WHERE business_id = ? LIMIT 1',
      [businessId]
    );

    let defaultTaxRate = 0;
    let prefix = 'INV';

    if (Array.isArray(settingRows) && settingRows.length > 0) {
      defaultTaxRate = Number(settingRows[0].tax_rate) || 0;
      prefix = settingRows[0].invoice_prefix || 'INV';
    }

    const taxRate = invoice_data?.tax_rate !== undefined ? Number(invoice_data.tax_rate) : defaultTaxRate;

    // 2. Validate products and calculate subtotal
    let subtotal = 0;
    const validatedItems: Array<{
      product_id: string;
      product_name: string;
      quantity: number;
      unit_price: number;
      cost: number;
      total: number;
    }> = [];

    for (const item of line_items) {
      const productId = item.product_id;
      const quantity = Number(item.quantity) || 0;
      if (quantity <= 0) {
        throw new Error('Quantity must be positive');
      }

      const [pRows]: any = await connection.query(
        'SELECT * FROM products WHERE id = ? AND business_id = ? FOR UPDATE',
        [productId, businessId]
      );

      if (!Array.isArray(pRows) || pRows.length === 0) {
        throw new Error('Product is unavailable');
      }

      const product = pRows[0];
      if (!product.is_active) {
        throw new Error(`Product ${product.name} is inactive`);
      }

      if (Number(product.stock_quantity) < quantity) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      const unitPrice = item.unit_price !== undefined ? Number(item.unit_price) : Number(product.price);
      const cost = Number(product.cost) || 0;
      const lineTotal = Math.round(quantity * unitPrice * 100) / 100;

      subtotal += lineTotal;

      validatedItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        unit_price: unitPrice,
        cost,
        total: lineTotal,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    const taxAmount = Math.round((subtotal * taxRate / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const initialPayAmount = initial_payment?.amount ? Number(initial_payment.amount) : 0;
    if (initialPayAmount < 0 || initialPayAmount > totalAmount) {
      throw new Error('Payment exceeds invoice total');
    }

    let status = 'sent';
    if (initialPayAmount >= totalAmount) {
      status = 'paid';
    } else if (initialPayAmount > 0) {
      status = 'partially_paid';
    }

    const nowStr = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
    const invoiceNumber = invoice_data?.invoice_number || `${prefix}-${nowStr}`;
    const invoiceId = crypto.randomUUID();
    const customerId = invoice_data.customer_id;
    const issueDate = invoice_data.issue_date || new Date().toISOString().slice(0, 10);
    const dueDate = invoice_data.due_date || null;
    const balance = Math.round((totalAmount - initialPayAmount) * 100) / 100;
    const notes = invoice_data.notes || null;

    // 3. Insert Invoice
    await connection.query(
      `INSERT INTO invoices 
       (id, business_id, customer_id, invoice_number, status, issue_date, due_date, subtotal, tax, total, paid_amount, balance, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceId,
        businessId,
        customerId,
        invoiceNumber,
        status,
        issueDate,
        dueDate,
        subtotal,
        taxAmount,
        totalAmount,
        initialPayAmount,
        balance,
        notes,
        req.user.id,
      ]
    );

    // 4. Insert Items, Update Stock, Insert Stock Transactions
    for (const item of validatedItems) {
      const itemId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price, cost, total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, invoiceId, item.product_id, item.product_name, item.quantity, item.unit_price, item.cost, item.total]
      );

      await connection.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );

      const stId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO stock_transactions (id, business_id, product_id, type, quantity, reference, created_by)
         VALUES (?, ?, ?, 'sale', ?, ?, ?)`,
        [stId, businessId, item.product_id, -item.quantity, invoiceNumber, req.user.id]
      );
    }

    // 5. Initial Payment if provided
    if (initialPayAmount > 0) {
      const payId = crypto.randomUUID();
      await connection.query(
        `INSERT INTO payments (id, business_id, invoice_id, customer_id, amount, method, reference, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payId,
          businessId,
          invoiceId,
          customerId,
          initialPayAmount,
          initial_payment?.method || 'cash',
          initial_payment?.reference || null,
          req.user.id,
        ]
      );
    }

    await connection.commit();
    connection.release();

    const [invRows]: any = await pool.query('SELECT * FROM invoices WHERE id = ? LIMIT 1', [invoiceId]);
    const createdInvoice = Array.isArray(invRows) && invRows.length > 0 ? invRows[0] : { id: invoiceId, invoice_number: invoiceNumber };

    // Auto-send email if enabled
    try {
      const { getEmailConfig, sendInvoiceEmail } = await import('../services/emailService.js');
      const emailConfig = await getEmailConfig(businessId);
      if (emailConfig.auto_send_invoice) {
        sendInvoiceEmail(businessId, invoiceId).catch((emailErr) => {
          console.warn('[InvoiceController] Auto-send email warning:', emailErr?.message || emailErr);
        });
      }
    } catch (e) {}

    res.json(createdInvoice);
  } catch (err: any) {
    await connection.rollback();
    connection.release();
    console.error('Invoice transaction error:', err);
    res.status(400).json({ error: err.message || 'Invoice transaction failed' });
  }
}
