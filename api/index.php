<?php

declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
ini_set('display_errors', '0');
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_set_cookie_params(['httponly' => true, 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Lax', 'path' => '/']);
    session_start();
}
require __DIR__ . '/../config/database.php';
function fail(string $message, int $status = 400): never
{
    http_response_code($status);
    echo json_encode(['error' => $message]);
    exit;
}
function out(mixed $data): never
{
    echo json_encode($data, JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function input(): array
{
    $x = json_decode(file_get_contents('php://input'), true);
    return is_array($x) ? $x : [];
}
function run(string $sql, array $args = []): PDOStatement
{
    $s = db()->prepare($sql);
    $s->execute($args);
    return $s;
}
function logEvent(int $uid, string $action, string $details): void
{
    run('INSERT INTO audit_logs (user_id,action,details) VALUES (?,?,?)', [$uid, $action, $details]);
}
function auth(): array
{
    if (empty($_SESSION['uid'])) fail('Please log in', 401);
    $u = run('SELECT id,name,username,role,active FROM users WHERE id=?', [(int)$_SESSION['uid']])->fetch();
    if (!$u || !(int)$u['active']) {
        unset($_SESSION['uid']);
        fail('Account unavailable', 401);
    }
    return $u;
}
function owner(array $u): void
{
    if ($u['role'] !== 'Owner') fail('Owner permission required', 403);
}
function fieldText(array $a, string $k, int $max = 140): string
{
    return trim(substr((string)($a[$k] ?? ''), 0, $max));
}
function positiveMoney(mixed $x): float
{
    if (!is_numeric($x) || !is_finite((float)$x) || (float)$x < 0) fail('Invalid amount');
    return round((float)$x, 2);
}
function shift(string $s): string
{
    if (!in_array($s, ['Opening', 'Closing'], true)) fail('Invalid shift');
    return $s;
}
function csrf(): void
{
    if (!hash_equals((string)($_SESSION['csrf'] ?? ''), (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) fail('Invalid security token', 403);
}
function shiftQuantity(mixed $value): float
{
    if (!is_numeric($value) || !is_finite((float)$value) || (float)$value < 0 || (float)$value > 999999999) fail('Invalid inventory quantity');
    return round((float)$value, 3);
}
function saveShiftLines(int $sid, string $phase, array $lines, int $uid): void
{
    $seen = [];
    foreach ($lines as $line) {
        if (!is_array($line)) fail('Invalid inventory line');
        $ingredient = fieldText($line, 'ingredient');
        $unit = fieldText($line, 'unit', 30);
        if (!$ingredient || !$unit) fail('Ingredient and unit required');
        $key = strtolower($ingredient . '|' . $unit);
        if (isset($seen[$key])) fail('Duplicate ingredient and unit');
        $seen[$key] = true;
        $qty = shiftQuantity($line['quantity'] ?? null);
        run('INSERT INTO inventory_shift_counts (shift_id,phase,ingredient,quantity,unit,recorded_by) VALUES (?,?,?,?,?,?)', [$sid, $phase, $ingredient, $qty, $unit, $uid]);
    }
}

function applyStockCount(int $shiftId, string $phase, array $lines, int $uid): void
{
    foreach ($lines as $line) {
        $name = fieldText($line, 'ingredient');
        $unit = fieldText($line, 'unit', 30);
        $quantity = shiftQuantity($line['quantity'] ?? null);
        $ing = run('SELECT id FROM ingredients WHERE name=? AND unit=?', [$name, $unit])->fetch();
        if (!$ing) {
            run('INSERT INTO ingredients (name,unit) VALUES (?,?)', [$name, $unit]);
            $iid = (int)db()->lastInsertId();
        } else $iid = (int)$ing['id'];
        run('INSERT IGNORE INTO ingredient_stock (ingredient_id,quantity) VALUES (?,0)', [$iid]);
        $before = (float)run('SELECT quantity FROM ingredient_stock WHERE ingredient_id=? FOR UPDATE', [$iid])->fetchColumn();
        $delta = round($quantity - $before, 3);
        run('UPDATE ingredient_stock SET quantity=? WHERE ingredient_id=?', [$quantity, $iid]);
        run('INSERT INTO ingredient_stock_movements (ingredient_id,shift_id,user_id,movement_type,quantity_change,balance_after) VALUES (?,?,?,?,?,?)', [$iid, $shiftId, $uid, $phase === 'Pre-Shift' ? 'Pre-Shift Count' : 'Post-Shift Count', $delta, $quantity]);
    }
}

$action = $_GET['action'] ?? '';
try {
    if ($action === 'setup-status') {
        out(['needs_setup' => (int)run('SELECT COUNT(*) FROM users')->fetchColumn() === 0]);
    }
    if ($action === 'setup') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required', 405);
        $d = input();
        $username = fieldText($d, 'username', 60);
        $password = (string)($d['password'] ?? '');
        $name = fieldText($d, 'name', 120);
        if (!$name || strlen($username) < 3 || strlen($password) < 10) fail('Enter name, username (3+ characters), and password (10+ characters)');
        db()->beginTransaction();
        try {
            $count = (int)run('SELECT COUNT(*) FROM users FOR UPDATE')->fetchColumn();
            if ($count !== 0) {
                db()->rollBack();
                fail('Setup already completed', 403);
            }
            run('INSERT INTO users (name,username,password_hash,role) VALUES (?,?,?,?)', [$name, $username, password_hash($password, PASSWORD_DEFAULT), 'Owner']);
            foreach ([['Iced Americano', 'Coffee', 'Classic', 'Regular', 100], ['Iced Matcha', 'Non-Coffee', 'Matcha', 'Regular', 150], ['Iced Latte', 'Coffee', 'Classic', 'Regular', 130], ['Spanish Latte', 'Coffee', 'Spanish', 'Regular', 145], ['Hot Americano', 'Coffee', 'Classic', 'Regular', 90], ['Iced Chocolate', 'Non-Coffee', 'Chocolate', 'Regular', 140]] as $p) run('INSERT INTO products (name,category,variation,size,price) VALUES (?,?,?,?,?)', $p);
            db()->commit();
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
        out(['ok' => true]);
    }
    if ($action === 'login') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('POST required', 405);
        $d = input();
        $u = run('SELECT * FROM users WHERE username=?', [fieldText($d, 'username', 60)])->fetch();
        if (!$u || !(int)$u['active'] || !password_verify((string)($d['password'] ?? ''), $u['password_hash'])) fail('Incorrect username or password', 401);
        session_regenerate_id(true);
        $_SESSION['uid'] = (int)$u['id'];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        out(['user' => ['id' => $u['id'], 'name' => $u['name'], 'role' => $u['role']], 'csrf' => $_SESSION['csrf']]);
    }
    $u = auth();
    $uid = (int)$u['id'];
    if ($action === 'session') out(['user' => $u, 'csrf' => $_SESSION['csrf'] ?? ($_SESSION['csrf'] = bin2hex(random_bytes(24)))]);
    if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $action !== 'state') fail('POST required', 405);
    if ($action === 'state') {
        $products = run('SELECT * FROM products ORDER BY active DESC,name')->fetchAll();
        $orders = run('SELECT o.*,u.name AS cashier FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.id DESC LIMIT 500')->fetchAll();
        $items = run('SELECT oi.* FROM order_items oi JOIN orders o ON o.id=oi.order_id ORDER BY oi.id DESC LIMIT 3000')->fetchAll();
        $inventory = run('SELECT i.*,u.name AS recorder FROM inventory_entries i JOIN users u ON u.id=i.recorded_by ORDER BY i.id DESC LIMIT 500')->fetchAll();
        $inventory_shifts = run('SELECT s.*,u.name AS barista FROM inventory_shifts s JOIN users u ON u.id=s.barista_id ORDER BY s.id DESC LIMIT 200')->fetchAll();
        $inventory_counts = run('SELECT c.*,u.name AS recorder FROM inventory_shift_counts c JOIN users u ON u.id=c.recorded_by ORDER BY c.id DESC LIMIT 2000')->fetchAll();
        $inventory_handovers = run('SELECT h.*,u.name AS reviewer FROM inventory_handovers h JOIN users u ON u.id=h.reviewed_by ORDER BY h.id DESC LIMIT 200')->fetchAll();
        $inventory_corrections = run('SELECT c.*,u.name AS corrected_by_name FROM inventory_count_corrections c JOIN users u ON u.id=c.corrected_by ORDER BY c.id DESC LIMIT 500')->fetchAll();
        $ingredients = run('SELECT i.id,i.name,i.unit,COALESCE(s.quantity,0) AS stock FROM ingredients i LEFT JOIN ingredient_stock s ON s.ingredient_id=i.id ORDER BY i.name')->fetchAll();
        $recipes = run('SELECT r.*,i.name AS ingredient_name,i.unit FROM product_recipes r JOIN ingredients i ON i.id=r.ingredient_id ORDER BY r.product_id,i.name')->fetchAll();
        $stock_movements = run('SELECT m.*,i.name AS ingredient_name,i.unit FROM ingredient_stock_movements m JOIN ingredients i ON i.id=m.ingredient_id ORDER BY m.id DESC LIMIT 300')->fetchAll();
        $refunds = run('SELECT r.*,u.name AS handled_by FROM refunds r JOIN users u ON u.id=r.user_id ORDER BY r.id DESC LIMIT 500')->fetchAll();
        $users = $u['role'] === 'Owner' ? run('SELECT id,name,username,role,active FROM users ORDER BY id')->fetchAll() : [];
        out(compact('products', 'orders', 'items', 'inventory', 'refunds', 'users', 'inventory_shifts', 'inventory_counts', 'inventory_handovers', 'inventory_corrections', 'ingredients', 'recipes', 'stock_movements'));
    }
    csrf();
    $d = input();
    if ($action === 'logout') {
        session_destroy();
        out(['ok' => true]);
    }
    if ($action === 'product-save') {
        owner($u);
        $name = fieldText($d, 'name');
        $category = fieldText($d, 'category', 80);
        $price = positiveMoney($d['price'] ?? -1);
        if (!$name || !$category) fail('Product name and category required');
        $args = [$name, $category, fieldText($d, 'variation', 80), fieldText($d, 'size', 50), $price];
        if (!empty($d['id'])) {
            run('UPDATE products SET name=?,category=?,variation=?,size=?,price=? WHERE id=?', [...$args, (int)$d['id']]);
            $id = (int)$d['id'];
        } else {
            run('INSERT INTO products (name,category,variation,size,price) VALUES (?,?,?,?,?)', $args);
            $id = (int)db()->lastInsertId();
        }
        logEvent($uid, 'product-save', 'Product #' . $id);
        out(['ok' => true]);
    }
    if ($action === 'product-toggle') {
        owner($u);
        $id = (int)($d['id'] ?? 0);
        run('UPDATE products SET active=1-active WHERE id=?', [$id]);
        logEvent($uid, 'product-toggle', 'Product #' . $id);
        out(['ok' => true]);
    }
    if ($action === 'recipe-save') {
        owner($u);
        $pid = (int)($d['product_id'] ?? 0);
        $lines = $d['lines'] ?? null;
        if ($pid < 1 || !run('SELECT id FROM products WHERE id=?', [$pid])->fetch() || !is_array($lines) || count($lines) > 100) fail('Invalid recipe');
        db()->beginTransaction();
        try {
            run('DELETE FROM product_recipes WHERE product_id=?', [$pid]);
            $seen = [];
            foreach ($lines as $line) {
                $iid = (int)($line['ingredient_id'] ?? 0);
                $qty = shiftQuantity($line['quantity'] ?? null);
                if ($iid < 1 || $qty <= 0 || isset($seen[$iid]) || !run('SELECT id FROM ingredients WHERE id=?', [$iid])->fetch()) fail('Invalid or duplicate recipe ingredient');
                $seen[$iid] = true;
                run('INSERT INTO product_recipes (product_id,ingredient_id,quantity_per_item) VALUES (?,?,?)', [$pid, $iid, $qty]);
            }
            logEvent($uid, 'recipe-save', 'Product #' . $pid . ' ingredient recipe updated');
            db()->commit();
            out(['ok' => true]);
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
    }
    if ($action === 'order-create') {
        $lines = $d['items'] ?? [];
        if (!is_array($lines) || !count($lines) || count($lines) > 80) fail('Cart is empty or too large');
        $method = $d['method'] ?? '';
        if (!in_array($method, ['Cash', 'Digital'], true)) fail('Invalid payment method');
        $received = $method === 'Cash' ? positiveMoney($d['received'] ?? -1) : null;
        $reference = $method === 'Digital' ? fieldText($d, 'reference') : null;
        if ($method === 'Digital' && !$reference) fail('Digital payment reference required');
        $quantities = [];
        foreach ($lines as $line) {
            $pid = (int)($line['id'] ?? 0);
            $qty = (int)($line['qty'] ?? 0);
            if ($pid < 1 || $qty < 1 || $qty > 100) fail('Invalid product quantity');
            $quantities[$pid] = ($quantities[$pid] ?? 0) + $qty;
            if ($quantities[$pid] > 100) fail('Quantity limit exceeded');
        }
        db()->beginTransaction();
        try {
            $cart = [];
            $total = 0.0;
            foreach ($quantities as $pid => $qty) {
                $p = run('SELECT * FROM products WHERE id=? AND active=1', [$pid])->fetch();
                if (!$p) fail('A product is unavailable');
                $line = round((float)$p['price'] * $qty, 2);
                $total += $line;
                $cart[] = [$pid, $p['name'], $p['variation'], $p['size'], $p['price'], $qty, $line];
            }
            $total = round($total, 2);
            if ($method === 'Cash' && $received < $total) fail('Cash received is insufficient');
            // Deduct ingredients atomically with the sale. Require a current shift and complete recipes.
            $active = run("SELECT id FROM inventory_shifts WHERE barista_id=? AND status='In Progress' ORDER BY id DESC LIMIT 1", [$uid])->fetch();
            if (!$active) fail('Record your pre-shift inventory before selling');
            $sid = (int)$active['id'];
            $needed = [];
            foreach ($quantities as $pid => $qty) {
                $recipe = run('SELECT ingredient_id,quantity_per_item FROM product_recipes WHERE product_id=?', [$pid])->fetchAll();
                if (!$recipe) fail('Product #' . $pid . ' needs an ingredient recipe before sale');
                foreach ($recipe as $r) {
                    $iid = (int)$r['ingredient_id'];
                    $needed[$iid] = round(($needed[$iid] ?? 0) + (float)$r['quantity_per_item'] * $qty, 3);
                }
            }
            ksort($needed);
            $balances = [];
            foreach ($needed as $iid => $need) {
                $row = run('SELECT quantity FROM ingredient_stock WHERE ingredient_id=? FOR UPDATE', [$iid])->fetch();
                if (!$row || (float)$row['quantity'] + 0.00001 < $need) fail('Insufficient ingredient stock #' . $iid . '; recount or restock before selling');
                $balances[$iid] = round((float)$row['quantity'] - $need, 3);
            }
            $change = $method === 'Cash' ? round($received - $total, 2) : null;
            run('INSERT INTO orders (user_id,subtotal,total,payment_method,amount_received,change_due,payment_reference,shift_label) VALUES (?,?,?,?,?,?,?,?)', [$uid, $total, $total, $method, $received, $change, $reference, shift(fieldText($d, 'shift'))]);
            $oid = (int)db()->lastInsertId();
            foreach ($cart as $line) run('INSERT INTO order_items (order_id,product_id,product_name,variation,size,unit_price,quantity,line_total) VALUES (?,?,?,?,?,?,?,?)', [$oid, ...$line]);
            foreach ($needed as $iid => $need) {
                run('UPDATE ingredient_stock SET quantity=? WHERE ingredient_id=?', [$balances[$iid], $iid]);
                run("INSERT INTO ingredient_stock_movements (ingredient_id,shift_id,order_id,user_id,movement_type,quantity_change,balance_after) VALUES (?,?,?,?,?,?,?)", [$iid, $sid, $oid, $uid, 'Sale Deduction', -$need, $balances[$iid]]);
            }
            logEvent($uid, 'order-create', 'Order #' . $oid . ' total ' . $total);
            db()->commit();
            out(['ok' => true, 'id' => $oid, 'total' => $total, 'change' => $change]);
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
    }
    if ($action === 'shift-start') {
        // Each employee starts their own shift; owner may also operate as a cashier.
        $open = run("SELECT id FROM inventory_shifts WHERE barista_id=? AND status='In Progress' LIMIT 1", [$uid])->fetch();
        if ($open) fail('Finish your current shift before starting another');
        if (run("SELECT id FROM inventory_shifts WHERE status='In Progress' LIMIT 1")->fetch()) fail('Another selling shift is active. The outgoing Barista must submit post-shift inventory first');
        $lines = $d['lines'] ?? [];
        if (!is_array($lines) || count($lines) < 1 || count($lines) > 100) fail('Record at least one pre-shift ingredient');
        db()->beginTransaction();
        try {
            run('INSERT INTO inventory_shifts (barista_id) VALUES (?)', [$uid]);
            $sid = (int)db()->lastInsertId();
            saveShiftLines($sid, 'Pre-Shift', $lines, $uid);
            applyStockCount($sid, 'Pre-Shift', $lines, $uid);
            logEvent($uid, 'shift-start', 'Shift #' . $sid . ' pre-shift count submitted');
            db()->commit();
            out(['ok' => true, 'id' => $sid]);
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
    }
    if ($action === 'shift-end') {
        $sid = (int)($d['shift_id'] ?? 0);
        $lines = $d['lines'] ?? [];
        if (!is_array($lines) || count($lines) < 1 || count($lines) > 100) fail('Record post-shift ingredients');
        db()->beginTransaction();
        try {
            $sh = run('SELECT * FROM inventory_shifts WHERE id=? FOR UPDATE', [$sid])->fetch();
            if (!$sh || $sh['status'] !== 'In Progress' || ((int)$sh['barista_id'] !== $uid && $u['role'] !== 'Owner')) fail('Shift is not open or not yours');
            $pre = run("SELECT ingredient,unit FROM inventory_shift_counts WHERE shift_id=? AND phase='Pre-Shift'", [$sid])->fetchAll();
            $expected = array_map(fn($x) => $x['ingredient'] . '|' . $x['unit'], $pre);
            $got = array_map(fn($x) => trim((string)($x['ingredient'] ?? '')) . '|' . trim((string)($x['unit'] ?? '')), $lines);
            sort($expected);
            sort($got);
            if ($expected !== $got) fail('Post-shift ingredients and units must match pre-shift entries');
            saveShiftLines($sid, 'Post-Shift', $lines, $uid);
            applyStockCount($sid, 'Post-Shift', $lines, $uid);
            run("UPDATE inventory_shifts SET status='Submitted',ended_at=CURRENT_TIMESTAMP,notes=? WHERE id=?", [fieldText($d, 'note', 500), $sid]);
            logEvent($uid, 'shift-end', 'Shift #' . $sid . ' submitted for incoming barista');
            db()->commit();
            out(['ok' => true]);
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
    }
    if ($action === 'shift-handover') {
        $outgoing = (int)($d['outgoing_shift_id'] ?? 0);
        $incoming = (int)($d['incoming_shift_id'] ?? 0);
        $decision = (string)($d['decision'] ?? '');
        $note = fieldText($d, 'note', 500);
        if (!in_array($decision, ['Approved', 'Flagged'], true)) fail('Choose Approved or Flagged');
        if ($decision === 'Flagged' && !$note) fail('Explain the issue when flagging a handover');
        db()->beginTransaction();
        try {
            $prior = run('SELECT * FROM inventory_shifts WHERE id=? FOR UPDATE', [$outgoing])->fetch();
            $next = run('SELECT * FROM inventory_shifts WHERE id=? FOR UPDATE', [$incoming])->fetch();
            if (!$prior || !$next || $prior['status'] !== 'Submitted' || (int)$prior['barista_id'] === $uid || (int)$next['barista_id'] !== $uid || $outgoing === $incoming) fail('Handover must be reviewed by a different incoming Barista');
            if ((int)$incoming <= (int)$outgoing) fail('Incoming shift must follow outgoing shift');
            if (run('SELECT id FROM inventory_handovers WHERE outgoing_shift_id=? OR incoming_shift_id=?', [$outgoing, $incoming])->fetch()) fail('A handover is already recorded for one of these shifts');
            $pre = run("SELECT COUNT(*) FROM inventory_shift_counts WHERE shift_id=? AND phase='Pre-Shift'", [$incoming])->fetchColumn();
            $post = run("SELECT COUNT(*) FROM inventory_shift_counts WHERE shift_id=? AND phase='Post-Shift'", [$outgoing])->fetchColumn();
            if (!$pre || !$post) fail('Both outgoing post-shift and incoming pre-shift counts are required');
            run('INSERT INTO inventory_handovers (outgoing_shift_id,incoming_shift_id,reviewed_by,decision,note) VALUES (?,?,?,?,?)', [$outgoing, $incoming, $uid, $decision, $note]);
            logEvent($uid, 'shift-handover', "Outgoing #$outgoing incoming #$incoming: $decision ($note)");
            db()->commit();
            out(['ok' => true]);
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
    }
    if ($action === 'shift-correct') {
        $cid = (int)($d['count_id'] ?? 0);
        $reason = fieldText($d, 'reason', 500);
        $quantity = shiftQuantity($d['quantity'] ?? null);
        if (!$reason) fail('Correction reason required');
        db()->beginTransaction();
        try {
            $count = run('SELECT c.*,s.barista_id,s.status FROM inventory_shift_counts c JOIN inventory_shifts s ON s.id=c.shift_id WHERE c.id=? FOR UPDATE', [$cid])->fetch();
            if (!$count) fail('Count not found', 404);
            if ((int)$count['barista_id'] !== $uid && $u['role'] !== 'Owner') fail('Only the recorder or Owner can correct this count', 403);
            if (run('SELECT id FROM inventory_handovers WHERE outgoing_shift_id=? OR incoming_shift_id=?', [$count['shift_id'], $count['shift_id']])->fetch()) fail('Handover is finalized. Ask Owner to document an adjustment instead');
            run('INSERT INTO inventory_count_corrections (count_id,previous_quantity,new_quantity,reason,corrected_by) VALUES (?,?,?,?,?)', [$cid, $count['quantity'], $quantity, $reason, $uid]);
            run('UPDATE inventory_shift_counts SET quantity=? WHERE id=?', [$quantity, $cid]);
            if ($count['phase'] === 'Pre-Shift' && $count['status'] === 'In Progress') {
                $ing = run('SELECT id FROM ingredients WHERE name=? AND unit=?', [$count['ingredient'], $count['unit']])->fetch();
                if ($ing) {
                    $iid = (int)$ing['id'];
                    $before = (float)run('SELECT quantity FROM ingredient_stock WHERE ingredient_id=? FOR UPDATE', [$iid])->fetchColumn();
                    $delta = round($quantity - (float)$count['quantity'], 3);
                    $after = round($before + $delta, 3);
                    if ($after < 0) fail('Correction would make live stock negative');
                    run('UPDATE ingredient_stock SET quantity=? WHERE ingredient_id=?', [$after, $iid]);
                    run('INSERT INTO ingredient_stock_movements (ingredient_id,shift_id,user_id,movement_type,quantity_change,balance_after) VALUES (?,?,?,?,?,?)', [$iid, (int)$count['shift_id'], $uid, 'Count Correction', $delta, $after]);
                }
            }
            logEvent($uid, 'shift-correction', "Count #$cid: {$count['quantity']} to $quantity ($reason)");
            db()->commit();
            out(['ok' => true]);
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
    }
    if ($action === 'inventory-save') {
        $ingredient = fieldText($d, 'ingredient');
        $unit = fieldText($d, 'unit', 30);
        $quantity = positiveMoney($d['quantity'] ?? -1);
        $date = fieldText($d, 'date', 10);
        if (!$ingredient || !$unit || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) fail('Ingredient, unit and valid date required');
        $shift = shift(fieldText($d, 'shift'));
        if (!empty($d['id'])) {
            $id = (int)$d['id'];
            $reason = fieldText($d, 'reason', 255);
            if (!$reason) fail('Correction reason required');
            $old = run('SELECT * FROM inventory_entries WHERE id=?', [$id])->fetch();
            if (!$old) fail('Inventory entry not found', 404);
            run('UPDATE inventory_entries SET ingredient=?,quantity=?,unit=?,shift_label=?,record_date=?,updated_by=?,correction_reason=? WHERE id=?', [$ingredient, $quantity, $unit, $shift, $date, $uid, $reason, $id]);
            logEvent($uid, 'inventory-correction', json_encode(['id' => $id, 'before' => $old, 'after' => $d]));
        } else {
            run('INSERT INTO inventory_entries (ingredient,quantity,unit,shift_label,record_date,recorded_by) VALUES (?,?,?,?,?,?)', [$ingredient, $quantity, $unit, $shift, $date, $uid]);
            logEvent($uid, 'inventory-create', $ingredient . ' ' . $quantity . ' ' . $unit);
        }
        out(['ok' => true]);
    }
    if ($action === 'refund-create') {
        $oid = (int)($d['order_id'] ?? 0);
        $amount = positiveMoney($d['amount'] ?? -1);
        $reason = fieldText($d, 'reason', 500);
        if ($amount <= 0 || !$reason) fail('Positive amount and reason required');
        db()->beginTransaction();
        try {
            $o = run('SELECT * FROM orders WHERE id=? FOR UPDATE', [$oid])->fetch();
            if (!$o || $o['status'] !== 'Completed') fail('Order not eligible for refund');
            $remaining = round((float)$o['total'] - (float)$o['refunded'], 2);
            if ($amount > $remaining) fail('Refund exceeds remaining balance');
            run('INSERT INTO refunds (order_id,amount,reason,user_id) VALUES (?,?,?,?)', [$oid, $amount, $reason, $uid]);
            run('UPDATE orders SET refunded=refunded+? WHERE id=?', [$amount, $oid]);
            logEvent($uid, 'refund-create', 'Order #' . $oid . ' refund ' . $amount . ' reason ' . $reason);
            db()->commit();
            out(['ok' => true]);
        } catch (Throwable $e) {
            if (db()->inTransaction()) db()->rollBack();
            throw $e;
        }
    }
    if ($action === 'user-save') {
        owner($u);
        $name = fieldText($d, 'name', 120);
        $username = fieldText($d, 'username', 60);
        $role = fieldText($d, 'role', 20);
        $password = (string)($d['password'] ?? '');
        if (!$name || strlen($username) < 3 || !in_array($role, ['Owner', 'Barista'], true)) fail('Invalid account details');
        if (!empty($d['id'])) {
            $id = (int)$d['id'];
            if ($password !== '' && strlen($password) < 10) fail('Password must be at least 10 characters');
            if ($password !== '') run('UPDATE users SET name=?,username=?,role=?,password_hash=? WHERE id=?', [$name, $username, $role, password_hash($password, PASSWORD_DEFAULT), $id]);
            else run('UPDATE users SET name=?,username=?,role=? WHERE id=?', [$name, $username, $role, $id]);
        } else {
            if (strlen($password) < 10) fail('Password must be at least 10 characters');
            run('INSERT INTO users (name,username,role,password_hash) VALUES (?,?,?,?)', [$name, $username, $role, password_hash($password, PASSWORD_DEFAULT)]);
            $id = (int)db()->lastInsertId();
        }
        logEvent($uid, 'user-save', 'Account #' . $id);
        out(['ok' => true]);
    }
    if ($action === 'user-toggle') {
        owner($u);
        $id = (int)($d['id'] ?? 0);
        if ($id === $uid) fail('You cannot deactivate your own account');
        $target = run('SELECT role,active FROM users WHERE id=?', [$id])->fetch();
        if (!$target) fail('User not found', 404);
        if ($target['role'] === 'Owner' && (int)$target['active'] === 1 && (int)run("SELECT COUNT(*) FROM users WHERE role='Owner' AND active=1")->fetchColumn() <= 1) fail('Cannot deactivate last active owner');
        run('UPDATE users SET active=1-active WHERE id=?', [$id]);
        logEvent($uid, 'user-toggle', 'Account #' . $id);
        out(['ok' => true]);
    }
    fail('Unknown action', 404);
} catch (PDOException $e) {
    error_log($e->getMessage());
    fail('Database operation failed; check setup or unique values', 500);
} catch (Throwable $e) {
    error_log($e->getMessage());
    fail('Unexpected server error', 500);
}
