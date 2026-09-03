# BillingMaster — SYSTEM RULES

## Language Standard
- **English Only**: The entire user interface, labels, invoices, notifications, buttons, and generated content must be in English. No Bengali or other foreign language content is allowed.

## Notification Standard
- **No Native Browser Alerts**: Do NOT use browser native default popups (`alert()`, `confirm()`, `prompt()`). Use modern custom in-app toast notifications (`toast.error()`, `toast.success()`, `toast.warning()`) via `sonner` or custom modal components.
