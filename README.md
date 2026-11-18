# PAUSE COFFEE — Automatic Ingredient Deduction Update

## Upgrade existing database
1. Back up your current project and MySQL database.
2. Extract this project into `C:\xampp\htdocs\pause_coffee_auto_inventory`.
3. In phpMyAdmin select your existing `pause_coffee` database, then import `database/auto_ingredient_deduction_migration.sql` **once**. Do not reimport the full schema into an existing database.
4. For a fresh installation, import `database/pause_coffee.sql` instead.
5. Open `http://localhost/pause_coffee_auto_inventory/` and log in.

## Workflow
1. Outgoing Barista submits post-shift inventory. Only one selling shift can be active at a time.
2. Incoming Barista records their own pre-shift counts. This initializes current stock balances.
3. Owner opens **Inventory & Recipes** and sets ingredient quantities for each menu product. Recipes are per one drink and use the units from inventory (g, mL, etc.).
4. The Barista processes a sale. Server validates stock and recipe completeness, saves the order, deducts ingredients and writes movement logs **in one database transaction**. Insufficient stock prevents sale.
5. At end of shift, Barista manually counts remaining ingredients and submits post-shift quantities. The manual count reconciles live stock, with a logged adjustment; incoming Barista separately verifies handover.
6. Pre-shift count corrections during an active shift adjust live stock with an audit movement. Historical corrections do not silently alter current stock.

## Important limitations
- Existing orders are **not retroactively deducted**. Configure recipes and start a new shift before processing new sales.
- Every sold product must have a recipe. Inventory units must match recipes; the system does not convert units automatically.
- Refunds **do not** automatically return ingredients (drinks may already have been prepared). Record physical stock corrections through shift counts.
- Do not edit recipes mid-shift without operational approval; edits affect subsequent orders.
- This is a development build, not production validated. Test two Baristas, sales, concurrent checkout, corrections and refunds against a backup database before real business use.
- Keep payments manually verified and account access role-based. No customer ordering, payroll, or supplier procurement.
