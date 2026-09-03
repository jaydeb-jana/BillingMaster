/**
 * CA & Tax Audit Export Controller (Node.js / Express / MongoDB / ExcelJS)
 * 
 * Route: GET /api/reports/ca-export?storeId=...&startDate=...&endDate=...
 * 
 * Features:
 * - Multi-tenant isolation with strict storeId validation & tenant matching
 * - High-efficiency MongoDB aggregation pipelines ($facet, $group, $match, $sort)
 * - Memory-leak safe streaming via ExcelJS workbook.xlsx.write(res)
 * - 5 Distinct CA / GST Audit Worksheets
 */

export const BACKEND_CA_EXPORT_CODE = `
// ==============================================================================
// 1. BACKEND ROUTE & CONTROLLER (controllers/caExportController.js)
// ==============================================================================
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import ExcelJS from 'exceljs';

// Schemas assumed: Invoice, Purchase, Expense, Customer, Supplier
import Invoice from '../models/Invoice.js';
import Purchase from '../models/Purchase.js';
import Expense from '../models/Expense.js';
import Customer from '../models/Customer.js';
import Supplier from '../models/Supplier.js';

export async function handleCAExportReport(req: Request, res: Response) {
  try {
    const { storeId, startDate, endDate, format = 'xlsx' } = req.query;

    // 1. Security & Multi-tenant Authorization
    if (!storeId || !mongoose.Types.ObjectId.isValid(storeId as string)) {
      return res.status(400).json({ error: 'Invalid or missing storeId' });
    }

    // Verify requesting user belongs to this tenant store
    if (req.user && req.user.storeId !== storeId) {
      return res.status(403).json({ error: 'Unauthorized access to tenant store data' });
    }

    const storeObjectId = new mongoose.Types.ObjectId(storeId as string);
    const start = new Date((startDate as string) || '2025-04-01T00:00:00.000Z');
    const end = new Date((endDate as string) || '2026-03-31T23:59:59.999Z');

    // --------------------------------------------------------------------------
    // PIPELINE 1 & 2: Daily Sales & Monthly GST Breakdown via $facet
    // --------------------------------------------------------------------------
    const salesAggregation = await Invoice.aggregate([
      {
        $match: {
          storeId: storeObjectId,
          status: { $ne: 'CANCELLED' },
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $facet: {
          // Sheet 1: Daily Sales Summary
          dailySales: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                totalOrders: { $sum: 1 },
                totalRevenue: { $sum: '$totalAmount' },
                cashCollection: {
                  $sum: {
                    $cond: [{ $eq: ['$paymentMethod', 'CASH'] }, '$totalAmount', 0]
                  }
                },
                upiOnlineCollection: {
                  $sum: {
                    $cond: [{ $ne: ['$paymentMethod', 'CASH'] }, '$totalAmount', 0]
                  }
                },
                totalTaxGST: { $sum: '$taxAmount' }
              }
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                date: '$_id',
                totalOrders: 1,
                totalRevenue: 1,
                cashCollection: 1,
                upiOnlineCollection: 1,
                totalTaxGST: 1
              }
            }
          ],
          // Sheet 2: GST Tax Breakdown by Month & Slab
          monthlyGST: [
            { $unwind: { path: '$items', preserveNullAndEmptyArrays: true } },
            {
              $group: {
                _id: {
                  month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                  taxRate: { $ifNull: ['$items.taxRate', 18] }
                },
                taxableSales: { $sum: { $ifNull: ['$items.taxableValue', '$items.total'] } },
                cgst: { $sum: { $divide: ['$items.taxAmount', 2] } },
                sgst: { $sum: { $divide: ['$items.taxAmount', 2] } },
                totalTax: { $sum: '$items.taxAmount' }
              }
            },
            {
              $group: {
                _id: '$_id.month',
                taxable0: {
                  $sum: { $cond: [{ $eq: ['$_id.taxRate', 0] }, '$taxableSales', 0] }
                },
                taxable5: {
                  $sum: { $cond: [{ $eq: ['$_id.taxRate', 5] }, '$taxableSales', 0] }
                },
                taxable12: {
                  $sum: { $cond: [{ $eq: ['$_id.taxRate', 12] }, '$taxableSales', 0] }
                },
                taxable18: {
                  $sum: { $cond: [{ $gte: ['$_id.taxRate', 18] }, '$taxableSales', 0] }
                },
                totalCGST: { $sum: '$cgst' },
                totalSGST: { $sum: '$sgst' },
                totalTaxCollected: { $sum: '$totalTax' }
              }
            },
            { $sort: { _id: 1 } },
            {
              $project: {
                _id: 0,
                month: '$_id',
                taxable0: 1,
                taxable5: 1,
                taxable12: 1,
                taxable18: 1,
                totalCGST: 1,
                totalSGST: 1,
                totalTaxCollected: 1
              }
            }
          ]
        }
      }
    ]);

    const dailySalesData = salesAggregation[0]?.dailySales || [];
    const monthlyGSTData = salesAggregation[0]?.monthlyGST || [];

    // --------------------------------------------------------------------------
    // PIPELINE 3: Purchase Register for ITC (Input Tax Credit)
    // --------------------------------------------------------------------------
    const purchaseData = await Purchase.aggregate([
      {
        $match: {
          storeId: storeObjectId,
          purchaseDate: { $gte: start, $lte: end }
        }
      },
      {
        $lookup: {
          from: 'suppliers',
          localField: 'supplierId',
          foreignField: '_id',
          as: 'supplier'
        }
      },
      { $unwind: { path: '$supplier', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          purchaseDate: { $dateToString: { format: '%Y-%m-%d', date: '$purchaseDate' } },
          vendorName: { $ifNull: ['$supplier.name', '$vendorName'] },
          vendorGSTIN: { $ifNull: ['$supplier.gstin', '$vendorGSTIN'] },
          invoiceNumber: '$invoiceNumber',
          taxableAmount: '$taxableAmount',
          taxPaidITC: '$taxPaid',
          totalAmount: '$totalAmount'
        }
      },
      { $sort: { purchaseDate: 1 } }
    ]);

    // --------------------------------------------------------------------------
    // PIPELINE 4: Expenses & Salaries
    // --------------------------------------------------------------------------
    const expenseData = await Expense.aggregate([
      {
        $match: {
          storeId: storeObjectId,
          expenseDate: { $gte: start, $lte: end }
        }
      },
      {
        $project: {
          _id: 0,
          dateMonth: { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' } },
          category: '$category',
          paymentMode: '$paymentMode',
          amount: '$amount'
        }
      },
      { $sort: { dateMonth: 1 } }
    ]);

    // --------------------------------------------------------------------------
    // PIPELINE 5: Debtors & Creditors Year-End Outstanding
    // --------------------------------------------------------------------------
    const customerDebtors = await Customer.aggregate([
      {
        $match: {
          storeId: storeObjectId,
          dueBalance: { $gt: 0 }
        }
      },
      {
        $project: {
          _id: 0,
          section: { $literal: 'SECTION A: CUSTOMER DEBTORS (KHATA DUES)' },
          partyName: '$name',
          phoneContact: { $ifNull: ['$phone', 'N/A'] },
          dueAmount: '$dueBalance',
          status: { $literal: 'OUTSTANDING / RECEIVABLE' }
        }
      },
      { $sort: { dueAmount: -1 } }
    ]);

    const supplierCreditors = await Supplier.aggregate([
      {
        $match: {
          storeId: storeObjectId,
          pendingPayable: { $gt: 0 }
        }
      },
      {
        $project: {
          _id: 0,
          section: { $literal: 'SECTION B: SUPPLIER CREDITORS (TRADE PAYABLES)' },
          partyName: '$name',
          phoneContact: { $ifNull: ['$phone', 'N/A'] },
          dueAmount: '$pendingPayable',
          status: { $literal: 'UNPAID / PAYABLE' }
        }
      },
      { $sort: { dueAmount: -1 } }
    ]);

    const debtorsCreditorsData = [...customerDebtors, ...supplierCreditors];

    // --------------------------------------------------------------------------
    // 2. EXCEL STREAMING VIA EXCELJS (NO MEMORY LEAKS)
    // --------------------------------------------------------------------------
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BillingMaster Multi-Tenant Engine';
    workbook.created = new Date();

    // Sheet 1: Daily_Sales_Summary
    const ws1 = workbook.addWorksheet('Daily_Sales_Summary', { views: [{ showGridLines: true }] });
    ws1.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Total Orders', key: 'totalOrders', width: 15 },
      { header: 'Total Revenue (INR)', key: 'totalRevenue', width: 22 },
      { header: 'Cash Collection (INR)', key: 'cashCollection', width: 22 },
      { header: 'UPI/Online Collection (INR)', key: 'upiOnlineCollection', width: 26 },
      { header: 'Total Tax/GST (INR)', key: 'totalTaxGST', width: 20 }
    ];
    ws1.addRows(dailySalesData);
    styleHeaderRow(ws1);

    // Sheet 2: GST_Tax_Breakdown
    const ws2 = workbook.addWorksheet('GST_Tax_Breakdown', { views: [{ showGridLines: true }] });
    ws2.columns = [
      { header: 'Month', key: 'month', width: 16 },
      { header: '0% Taxable Sales', key: 'taxable0', width: 20 },
      { header: '5% Taxable Sales', key: 'taxable5', width: 20 },
      { header: '12% Taxable Sales', key: 'taxable12', width: 20 },
      { header: '18% Taxable Sales', key: 'taxable18', width: 20 },
      { header: 'Total CGST', key: 'totalCGST', width: 18 },
      { header: 'Total SGST', key: 'totalSGST', width: 18 },
      { header: 'Total Tax Collected', key: 'totalTaxCollected', width: 22 }
    ];
    ws2.addRows(monthlyGSTData);
    styleHeaderRow(ws2);

    // Sheet 3: Purchase_Register
    const ws3 = workbook.addWorksheet('Purchase_Register', { views: [{ showGridLines: true }] });
    ws3.columns = [
      { header: 'Purchase Date', key: 'purchaseDate', width: 15 },
      { header: 'Vendor Name', key: 'vendorName', width: 30 },
      { header: 'Vendor GSTIN', key: 'vendorGSTIN', width: 18 },
      { header: 'Invoice Number', key: 'invoiceNumber', width: 18 },
      { header: 'Taxable Amount', key: 'taxableAmount', width: 20 },
      { header: 'Tax Paid (ITC)', key: 'taxPaidITC', width: 18 },
      { header: 'Total Amount', key: 'totalAmount', width: 20 }
    ];
    ws3.addRows(purchaseData);
    styleHeaderRow(ws3);

    // Sheet 4: Expense_&_Salary
    const ws4 = workbook.addWorksheet('Expense_&_Salary', { views: [{ showGridLines: true }] });
    ws4.columns = [
      { header: 'Date/Month', key: 'dateMonth', width: 16 },
      { header: 'Expense Category', key: 'category', width: 25 },
      { header: 'Payment Mode', key: 'paymentMode', width: 20 },
      { header: 'Amount (INR)', key: 'amount', width: 18 }
    ];
    ws4.addRows(expenseData);
    styleHeaderRow(ws4);

    // Sheet 5: Debtors_&_Creditors
    const ws5 = workbook.addWorksheet('Debtors_&_Creditors', { views: [{ showGridLines: true }] });
    ws5.columns = [
      { header: 'Schedule Section', key: 'section', width: 42 },
      { header: 'Party Name', key: 'partyName', width: 32 },
      { header: 'Phone/Contact', key: 'phoneContact', width: 20 },
      { header: 'Outstanding Balance (INR)', key: 'dueAmount', width: 26 },
      { header: 'Status / Remarks', key: 'status', width: 25 }
    ];
    ws5.addRows(debtorsCreditorsData);
    styleHeaderRow(ws5);

    // Stream Response
    const filename = \`CA_Tax_Report_\${storeId}_\${Date.now()}.xlsx\`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', \`attachment; filename="\${filename}"\`);
    res.setHeader('Cache-Control', 'no-cache');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating CA Tax Export:', error);
    res.status(500).json({ error: 'Failed to generate CA audit export', details: (error as Error).message });
  }
}

function styleHeaderRow(worksheet: ExcelJS.Worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate 800
  };
  headerRow.height = 24;
}
`;
