# BillingMaster — AGENT INSTRUCTIONS & RULES

## Language & Content Rule (MANDATORY)
- **STRICTLY ENGLISH ONLY**: All user interface text, labels, button titles, table headers, placeholders, tooltips, dialogs, invoices, receipts, SMS/WhatsApp templates, error messages, and system prompts must be written exclusively in **English**.
- **NO BENGALI / NON-ENGLISH CONTENT**: Do not use Bengali (or any other non-English script/language) anywhere in the application.

## UI & Notification Rule (MANDATORY)
- **STRICTLY NO NATIVE BROWSER ALERTS**: Do NOT use native browser popups like `alert()`, `confirm()`, or `prompt()`. All notifications, validations, warnings, errors, and success feedback MUST be presented using custom in-app toast notifications (`toast.error()`, `toast.success()`, `toast.warning()`, `toast.info()`) via `sonner` or custom modal/inline UI popups.

## Core Application Standard
- Application Name: **BillingMaster**
- Visual Identity: **Orange + White + Black** with refined neutrals
- Stack: React + Node.js + Express + MySQL (TypeScript, Tailwind CSS)
- Maintain production-quality code, high responsiveness, clean typographic hierarchy, and robust error handling.
