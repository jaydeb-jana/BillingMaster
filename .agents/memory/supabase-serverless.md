---
name: Supabase serverless billing
description: The billing product uses Supabase directly and keeps financial invariants in PostgreSQL functions.
---

The billing app should remain a browser-to-Supabase architecture. Keep business isolation in RLS and keep invoice totals, stock validation/deduction, and payment consistency inside PostgreSQL RPCs rather than relying on client calculations.

**Why:** The product is intended for low-cost hosting and future mobile/desktop clients, and stock/payment updates must remain atomic across clients.

**How to apply:** Add new business operations as reusable Supabase SQL functions when they span multiple tables; keep the React layer as a typed UI/service client.