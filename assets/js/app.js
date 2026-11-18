"use strict";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  peso = (v) =>
    "₱" +
    Number(v || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  dateNow = () => new Date().toLocaleDateString("en-CA"),
  dateOnly = (v) => String(v || "").slice(0, 10);
let user = null,
  token = "",
  state = {
    products: [],
    orders: [],
    items: [],
    inventory: [],
    refunds: [],
    users: [],
    inventory_shifts: [],
    inventory_counts: [],
    inventory_handovers: [],
    inventory_corrections: [],
    ingredients: [],
    recipes: [],
    stock_movements: [],
  },
  page = "dashboard",
  cart = [],
  method = "Cash",
  shift = "Opening",
  search = "",
  dateFilter = "",
  shiftFilter = "";
async function api(action, data) {
  let options = { credentials: "same-origin", headers: {} };
  if (data !== undefined) {
    options.method = "POST";
    options.headers = {
      "Content-Type": "application/json",
      "X-CSRF-Token": token,
    };
    options.body = JSON.stringify(data);
  }
  let r = await fetch(
    "api/index.php?action=" + encodeURIComponent(action),
    options,
  );
  let j;
  try {
    j = await r.json();
  } catch {
    throw Error("Server unavailable. Start Apache and import the database.");
  }
  if (!r.ok) throw Error(j.error || "Request failed");
  return j;
}
function notify(s) {
  let e = $("#toast");
  e.textContent = s;
  e.style.display = "block";
  setTimeout(() => (e.style.display = "none"), 3500);
}
function modal(title, body) {
  let d = document.createElement("div");
  d.className = "modalbg";
  d.id = "dialog";
  d.innerHTML = `<div class="modal"><div class="modalheader"><h2>${esc(title)}</h2><button class="btn alt" onclick="closeModal()">✕</button></div>${body}</div>`;
  document.body.append(d);
}
function closeModal() {
  $("#dialog")?.remove();
}
async function submit(action, data, success = "Saved") {
  try {
    await api(action, data);
    closeModal();
    await refresh();
    notify(success);
  } catch (e) {
    notify(e.message);
  }
}
async function refresh() {
  state = await api("state");
  render();
}
async function boot() {
  try {
    let s = await api("setup-status");
    if (s.needs_setup) {
      setupView();
      return;
    }
    let x = await api("session");
    user = x.user;
    token = x.csrf;
    await refresh();
  } catch (e) {
    if (e.message === "Please log in") {
      landing();
      return;
    }
    if (e.message.includes("Database") || e.message.includes("Server")) {
      $("#app").innerHTML =
        `<div class="center"><div class="auth"><h2>Database setup needed</h2><p>${esc(e.message)}</p><p>Import <code>database/pause_coffee.sql</code> in phpMyAdmin and verify <code>config/database.php</code>, then reload.</p></div></div>`;
    } else landing();
  }
}
function setupView() {
  $("#app").innerHTML =
    `<div class="center"><form class="auth" id="setupform"><h1>☕ PAUSE COFFEE</h1><p>Create the first Owner account</p><div class="field"><label>Owner name</label><input name="name" required></div><div class="field"><label>Username</label><input name="username" minlength="3" required></div><div class="field"><label>Password (10+ characters)</label><input type="password" name="password" minlength="10" required></div><button class="btn" style="width:100%">Initialize System</button><p class="muted">Run this once after importing the SQL database. Sample beverage products will be added.</p></form></div>`;
  $("#setupform").onsubmit = async (e) => {
    e.preventDefault();
    let d = Object.fromEntries(new FormData(e.target));
    try {
      await api("setup", d);
      notify("Owner account created");
      loginView();
    } catch (x) {
      notify(x.message);
    }
  };
}
function landing() {
  $("#app").innerHTML =
    `<header class="top"><div class="brand">☕ PAUSE COFFEE<small>POS – Sales Management System</small></div><nav class="topnav"><a href="#features">Features</a><a href="#about">About</a><button class="btn" onclick="loginView()">Login to System →</button></nav></header><section class="hero"><div><small>YOUR CAFÉ. YOUR WORKFLOW.</small><h1>PAUSE<br>COFFEE.</h1><h2>POS – Sales Management System</h2><p>A web-based system for the Owner and Barista to manage customer orders, payments, recipe-based inventory, products and sales reports.</p><div class="actions"><button class="btn" onclick="loginView()">Login to System</button><a class="btn alt" href="#features">Explore Modules</a></div></div><div class="mock"><h3>☕ Dashboard preview</h3><div class="cards"><div class="card tint"><small>Today's Sales</small><strong class="value">₱8,450</strong></div><div class="card tint"><small>Transactions</small><strong class="value">42</strong></div><div class="card tint"><small>Cash</small><strong class="value">₱5,250</strong></div><div class="card tint"><small>Digital</small><strong class="value">₱3,200</strong></div></div><p class="muted">Illustrative figures only</p></div></section><section class="section" id="features"><h2>System Modules</h2><div class="modules">${[
      ["▦", "Dashboard"],
      ["☕", "Product / Menu"],
      ["🛒", "Orders & Sales"],
      ["▣", "Payment Recording"],
      ["▤", "Shift Inventory + Auto Deductions"],
      ["▥", "Sales Reports"],
      ["↶", "Cancellations & Refunds"],
      ["♙", "User Accounts"],
    ]
      .map(
        (x) =>
          `<div class="module"><span style="font-size:27px">${x[0]}</span><b>${x[1]}</b><p>Designed for Pause Coffee's approved research workflow.</p></div>`,
      )
      .join(
        "",
      )}</div></section><section class="section" id="about" style="text-align:center;background:var(--cream)"><h2>Built for in-store café operations</h2><p>Pre/post-shift inventory with automatic recipe deductions, manually confirmed digital payments, and accountable transaction records.</p></section><footer class="footer"><b>☕ PAUSE COFFEE</b><span>POS – Sales Management System</span></footer>`;
}
function loginView() {
  $("#app").innerHTML =
    `<div class="center"><form class="auth" id="loginform"><h1>☕ Welcome back</h1><p class="muted">PAUSE COFFEE · Owner / Barista Login</p><div class="field"><label>Username</label><input name="username" autocomplete="username" required></div><div class="field"><label>Password</label><input type="password" name="password" autocomplete="current-password" required></div><button class="btn" style="width:100%">Sign in</button><p><button type="button" class="btn alt" style="width:100%" onclick="landing()">← Back to home</button></p></form></div>`;
  $("#loginform").onsubmit = async (e) => {
    e.preventDefault();
    try {
      let x = await api("login", Object.fromEntries(new FormData(e.target)));
      user = x.user;
      token = x.csrf;
      page = "dashboard";
      await refresh();
    } catch (x) {
      notify(x.message);
    }
  };
}
async function logout() {
  try {
    await api("logout", {});
  } catch {}
  user = null;
  token = "";
  cart = [];
  landing();
}
const nav = [
  ["dashboard", "▦", "Dashboard"],
  ["products", "☕", "Product / Menu"],
  ["orders", "🛒", "Orders & Sales"],
  ["payments", "▣", "Payment Recording"],
  ["inventory", "▤", "Inventory & Recipes"],
  ["reports", "▥", "Sales History & Reports"],
  ["refunds", "↶", "Cancellations & Refunds"],
  ["users", "♙", "User Accounts"],
];
function go(p) {
  page = p;
  search = "";
  dateFilter = "";
  shiftFilter = "";
  render();
}
function render() {
  if (!user) {
    landing();
    return;
  }
  if (page === "users" && user.role !== "Owner") page = "dashboard";
  $("#app").innerHTML =
    `<div class="app"><aside class="side"><div class="brand">☕ PAUSE COFFEE<small>POS – Sales Management System</small></div><nav class="nav">${nav
      .filter((n) => n[0] !== "users" || user.role === "Owner")
      .map(
        (n) =>
          `<button class="${page === n[0] ? "active" : ""}" onclick="go('${n[0]}')">${n[1]} &nbsp;${n[2]}</button>`,
      )
      .join(
        "",
      )}</nav></aside><div class="main"><header class="bar"><b>PAUSE COFFEE</b><div>${esc(user.name)} · <span class="pill">${esc(user.role)}</span> <button
    id="themeToggle"
    class="btn alt small theme-toggle"
    onclick="toggleTheme()"
>
    🌙 Dark Mode
</button>
<button class="btn alt small" onclick="logout()">Logout</button></div></header><main class="content" id="view"></main></div></div>`;
  (
    ({
      dashboard: dashboardView,
      products: productsView,
      orders: ordersView,
      payments: paymentsView,
      inventory: inventoryView,
      reports: reportsView,
      refunds: refundsView,
      users: usersView,
    })[page] || dashboardView
  )();
}
function header(t, sub, action = "") {
  return `<div class="heading"><div><h1>${t}</h1><div class="muted">${sub}</div></div>${action}</div>`;
}
function orders() {
  return state.orders.filter((o) => o.status === "Completed");
}
function net(o) {
  return Number(o.total) - Number(o.refunded || 0);
}
function rowOrders(arr) {
  return `<div class="tablewrap"><table><thead><tr><th>Order</th><th>Date / Shift</th><th>Barista</th><th>Payment</th><th>Total</th><th>Refunded</th><th>Net</th></tr></thead><tbody>${arr.length ? arr.map((o) => `<tr><td>#${o.id}</td><td>${esc(o.created_at)}<br><small>${esc(o.shift_label)}</small></td><td>${esc(o.cashier)}</td><td>${esc(o.payment_method)}</td><td>${peso(o.total)}</td><td>${peso(o.refunded)}</td><td>${peso(net(o))}</td></tr>`).join("") : '<tr><td colspan="7" class="empty">No transactions yet</td></tr>'}</tbody></table></div>`;
}
function dashboardView() {
  let d = orders().filter((o) => dateOnly(o.created_at) === dateNow()),
    sum = d.reduce((a, o) => a + net(o), 0),
    cash = d
      .filter((o) => o.payment_method === "Cash")
      .reduce((a, o) => a + net(o), 0),
    digital = sum - cash;
  $("#view").innerHTML =
    header("Dashboard", "Today’s sales overview") +
    `<div class="cards">${[
      ["Today’s Sales", peso(sum)],
      ["Transactions", d.length],
      ["Cash Payments", peso(cash)],
      ["Digital Payments", peso(digital)],
    ]
      .map(
        (x) =>
          `<div class="card tint"><small>${x[0]}</small><strong class="value">${x[1]}</strong></div>`,
      )
      .join(
        "",
      )}</div><div class="panel"><h3>Recent Transactions</h3>${rowOrders(orders().slice(0, 8))}</div>`;
}
function productsView() {
  $("#view").innerHTML =
    header(
      "Product / Menu Management",
      "Owner manages menu products",
      user.role === "Owner"
        ? '<button class="btn" onclick="productForm()">+ Add Product</button>'
        : "",
    ) +
    `<div class="panel"><input class="search" placeholder="Search products" value="${esc(search)}" oninput="search=this.value;productsTable()"><div id="productsTable"></div></div>`;
  productsTable();
}
function productsTable() {
  let a = state.products.filter((p) =>
    (p.name + " " + p.category + " " + p.variation)
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  $("#productsTable").innerHTML =
    `<div class="tablewrap"><table><tr><th>Product</th><th>Category</th><th>Variation / Size</th><th>Price</th><th>Status</th><th>Actions</th></tr>${a.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${esc(p.variation)} / ${esc(p.size)}</td><td>${peso(p.price)}</td><td><span class="pill ${Number(p.active) ? "good" : "bad"}">${Number(p.active) ? "Available" : "Inactive"}</span></td><td>${user.role === "Owner" ? `<button class="btn alt small" onclick="productForm(${p.id})">Edit</button><button class="btn soft small" onclick="toggleProduct(${p.id})">${Number(p.active) ? "Deactivate" : "Activate"}</button>` : ""}</td></tr>`).join("")}</table></div>`;
}
function productForm(id) {
  if (user.role !== "Owner") return;
  let p = state.products.find((x) => Number(x.id) === Number(id)) || {};
  modal(
    id ? "Edit Product" : "Add Product",
    `<form id="productform"><div class="formgrid">${[
      ["name", "Product Name"],
      ["category", "Category"],
      ["variation", "Flavor / Variation"],
      ["size", "Size"],
      ["price", "Price (₱)"],
    ]
      .map(
        ([k, l]) =>
          `<div class="field"><label>${l}</label><input name="${k}" ${k === "price" ? 'type="number" step="0.01" min="0"' : ""} value="${esc(p[k] ?? "")}" ${["name", "category", "price"].includes(k) ? "required" : ""}></div>`,
      )
      .join("")}</div><button class="btn">Save Product</button></form>`,
  );
  $("#productform").onsubmit = (e) => {
    e.preventDefault();
    submit(
      "product-save",
      { ...Object.fromEntries(new FormData(e.target)), id: id || undefined },
      "Product saved",
    );
  };
}
function toggleProduct(id) {
  if (confirm("Change product availability?"))
    submit("product-toggle", { id }, "Product updated");
}
function ordersView() {
  $("#view").innerHTML =
    header("Orders & Sales Transactions", "In-store cashier checkout") +
    `<div class="split"><div><div class="panel"><input class="search" placeholder="Search drinks" oninput="search=this.value;productTiles()"><div class="products" id="tiles" style="margin-top:15px"></div></div></div><div class="panel"><h3>Current Cart</h3><div id="cart"></div></div></div>`;
  productTiles();
  cartView();
}
function productTiles() {
  let ps = state.products.filter(
    (p) =>
      Number(p.active) &&
      (p.name + " " + p.category).toLowerCase().includes(search.toLowerCase()),
  );
  $("#tiles").innerHTML = ps.length
    ? ps
        .map(
          (p) =>
            `<button class="product" onclick="addCart(${p.id})"><span style="font-size:27px">☕</span><b>${esc(p.name)}</b><small>${esc(p.variation)} · ${esc(p.size)}</small><strong>${peso(p.price)}</strong></button>`,
        )
        .join("")
    : '<div class="empty">No available products</div>';
}
function addCart(id) {
  let p = state.products.find((x) => Number(x.id) === id);
  if (!p || !Number(p.active)) return;
  let x = cart.find((i) => i.id === id);
  if (x) x.qty++;
  else cart.push({ id, qty: 1 });
  cartView();
}
function cartQty(id, n) {
  let x = cart.find((i) => i.id === id);
  if (!x) return;
  x.qty = Math.max(0, x.qty + n);
  cart = cart.filter((i) => i.qty > 0);
  cartView();
}
function cartTotal() {
  return cart.reduce(
    (s, x) =>
      s +
      Number(state.products.find((p) => Number(p.id) === x.id)?.price || 0) *
        x.qty,
    0,
  );
}
function cartView() {
  let e = $("#cart");
  if (!e) return;
  e.innerHTML = cart.length
    ? cart
        .map((x) => {
          let p = state.products.find((y) => Number(y.id) === x.id);
          return `<div class="cartline"><div><b>${esc(p?.name || "Product")}</b><small>${peso(p?.price)} × ${x.qty}</small></div><div><button class="btn alt small" onclick="cartQty(${x.id},-1)">−</button> ${x.qty} <button class="btn alt small" onclick="cartQty(${x.id},1)">+</button></div></div>`;
        })
        .join("")
    : '<div class="empty">No items selected</div>';
  e.innerHTML += `<div class="total"><span>Total</span><span>${peso(cartTotal())}</span></div><button class="btn" style="width:100%" ${!cart.length ? "disabled" : ""} onclick="checkout()">Proceed to Payment</button><p><button class="btn alt" style="width:100%" ${!cart.length ? "disabled" : ""} onclick="cancelCart()">Cancel Draft Order</button></p>`;
}
function cancelCart() {
  let reason = prompt("Reason for cancelling draft order?");
  if (reason === null) return;
  if (!reason.trim()) {
    notify("Reason required");
    return;
  }
  cart = [];
  cartView();
  notify("Unpaid draft discarded; no sale was recorded");
}
function checkout() {
  if (!cart.length) return;
  modal(
    "Payment Recording",
    `<p>Order total: <strong>${peso(cartTotal())}</strong></p><form id="payform"><div class="field"><label>Payment method</label><select name="method" onchange="payFields()"><option>Cash</option><option>Digital</option></select></div><div class="field"><label>Shift</label><select name="shift"><option>Opening</option><option>Closing</option></select></div><div id="paymentfields"></div><button class="btn" style="width:100%">Confirm Payment & Save Sale</button></form>`,
  );
  payFields();
  $("#payform").onsubmit = async (e) => {
    e.preventDefault();
    let d = Object.fromEntries(new FormData(e.target));
    if (!confirm("Confirm payment was received and complete this sale?"))
      return;
    try {
      let x = await api("order-create", { ...d, items: cart });
      cart = [];
      closeModal();
      await refresh();
      notify("Transaction #" + x.id + " saved");
      receipt(x.id);
    } catch (err) {
      notify(err.message);
    }
  };
}
function payFields() {
  let f = $("#payform"),
    v = f?.elements.method.value;
  if (!f) return;
  $("#paymentfields").innerHTML =
    v === "Cash"
      ? `<div class="field"><label>Amount received (₱)</label><input name="received" type="number" step="0.01" min="0" required oninput="changePreview(this.value)"></div><div id="changeview"></div>`
      : `<div class="field"><label>Payment reference (manually verified)</label><input name="reference" required maxlength="140"></div><p class="muted">Barista must verify the payment outside this system before confirming.</p>`;
}
function changePreview(v) {
  $("#changeview").textContent =
    "Change: " + peso(Math.max(0, Number(v) - cartTotal()));
}
function receipt(id) {
  let o = state.orders.find((x) => Number(x.id) === Number(id)),
    items = state.items.filter((i) => Number(i.order_id) === Number(id));
  if (!o) return;
  modal(
    "Receipt · Order #" + id,
    `<div id="receipt"><h2>☕ PAUSE COFFEE</h2><p>${esc(o.created_at)} · ${esc(o.cashier)}</p><table>${items.map((i) => `<tr><td>${esc(i.product_name)} × ${i.quantity}</td><td>${peso(i.line_total)}</td></tr>`).join("")}</table><h3>Total: ${peso(o.total)}</h3><p>${esc(o.payment_method)}${o.payment_method === "Cash" ? " · Received " + peso(o.amount_received) + " · Change " + peso(o.change_due) : " · Reference " + esc(o.payment_reference)}</p><p>Thank you!</p></div><button class="btn" onclick="window.print()">Print Receipt</button>`,
  );
}
function paymentsView() {
  $("#view").innerHTML =
    header("Payment Recording", "Cash and manually verified digital payments") +
    `<div class="panel">${rowOrders(orders().slice(0, 100))}<p class="muted">Payment is recorded when a cashier completes an order. No automatic e-wallet verification is performed.</p></div>`;
}
function shiftCounts(id, phase) {
  return state.inventory_counts.filter(
    (x) => Number(x.shift_id) === Number(id) && x.phase === phase,
  );
}
function inventoryView() {
  let shifts = state.inventory_shifts || [],
    handovers = state.inventory_handovers || [];
  let active = shifts.find(
    (s) =>
      Number(s.barista_id) === Number(user.id) && s.status === "In Progress",
  );
  let pending = shifts.filter(
    (s) =>
      s.status === "Submitted" &&
      Number(s.barista_id) !== Number(user.id) &&
      !handovers.some((h) => Number(h.outgoing_shift_id) === Number(s.id)),
  );
  $("#view").innerHTML =
    header(
      "Manual Shift Inventory",
      "Pre/post-shift counts, incoming Barista approval, and automatic sale deductions",
      active
        ? `<button class="btn" onclick="shiftEndForm(${active.id})">Submit Post-Shift Count</button>`
        : `<button class="btn" onclick="shiftStartForm()">+ Start Shift / Pre-Shift Count</button>`,
    ) +
    `<div class="panel"><h3>Live Ingredient Stock (Auto-Deducted)</h3><p class="muted">Pre-shift counts initialize stock; each paid sale deducts recipe ingredients. Post-shift counts reconcile actual quantities.</p><div class="tablewrap"><table><tr><th>Ingredient</th><th>Current Stock</th></tr>${(state.ingredients || []).map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.stock)} ${esc(i.unit)}</td></tr>`).join("")}</table></div></div>` +
    `<div class="panel"><h3>Recipe Management (Owner)</h3>${
      user.role === "Owner"
        ? (state.products || [])
            .map(
              (p) =>
                `<div style="margin:8px 0"><b>${esc(p.name)}</b> · ${
                  (state.recipes || [])
                    .filter((r) => Number(r.product_id) === Number(p.id))
                    .map(
                      (r) =>
                        esc(r.ingredient_name) +
                        " " +
                        esc(r.quantity_per_item) +
                        " " +
                        esc(r.unit),
                    )
                    .join(", ") || "No recipe configured"
                } <button class="btn alt small" onclick="recipeForm(${Number(p.id)})">Edit Recipe</button></div>`,
            )
            .join("")
        : "Only Owner can change ingredient recipes."
    }</div>` +
    `<div class="panel"><h3>Automatic Deduction History</h3><div class="tablewrap"><table><tr><th>Ingredient</th><th>Type</th><th>Change</th><th>Balance</th><th>Order</th></tr>${(
      state.stock_movements || []
    )
      .slice(0, 50)
      .map(
        (m) =>
          `<tr><td>${esc(m.ingredient_name)}</td><td>${esc(m.movement_type)}</td><td>${esc(m.quantity_change)} ${esc(m.unit)}</td><td>${esc(m.balance_after)}</td><td>${m.order_id ? "#" + Number(m.order_id) : "—"}</td></tr>`,
      )
      .join("")}</table></div></div>` +
    `<div class="panel"><h3>Your Shift</h3><p>${active ? `Shift #${active.id} · In Progress · Started ${esc(active.started_at)}` : "No active shift. Record your own pre-shift inventory to begin."}</p><p class="muted">Each Barista submits their own counts. The next Barista records their pre-shift count before reviewing the outgoing Barista’s post-shift record.</p></div>` +
    `<div class="panel"><h3>Pending Handover Reviews</h3>${pending.length ? pending.map((s) => `<div class="panel"><b>Outgoing: ${esc(s.barista)} · Shift #${s.id}</b><p>Submitted: ${esc(s.ended_at)}</p>${countTable(s.id, "Post-Shift")}<button class="btn alt" onclick="handoverForm(${s.id})">Review Handover</button></div>`).join("") : '<p class="muted">No pending handovers from other Baristas.</p>'}</div>` +
    `<div class="panel"><h3>Shift History — Owner & Barista</h3><div class="tablewrap"><table><tr><th>Shift</th><th>Barista</th><th>Status</th><th>Pre-Shift</th><th>Post-Shift</th><th>Handover</th></tr>${shifts
      .map((s) => {
        let h = handovers.find(
          (x) => Number(x.outgoing_shift_id) === Number(s.id),
        );
        return `<tr><td>#${s.id}<br><small>${esc(s.started_at)}</small></td><td>${esc(s.barista)}</td><td>${esc(s.status)}</td><td>${countTable(s.id, "Pre-Shift")}</td><td>${countTable(s.id, "Post-Shift")}</td><td>${h ? esc(h.decision) + " by " + esc(h.reviewer) + "<br>" + esc(h.note || "") : s.status === "Submitted" ? "Awaiting incoming Barista" : "—"}</td></tr>`;
      })
      .join("")}</table></div></div>` +
    `<div class="panel"><h3>Correction Audit History</h3><div class="tablewrap"><table><tr><th>Count ID</th><th>Previous</th><th>New</th><th>Reason</th><th>Corrected By</th><th>Time</th></tr>${(state.inventory_corrections || []).map((c) => `<tr><td>#${c.count_id}</td><td>${esc(c.previous_quantity)}</td><td>${esc(c.new_quantity)}</td><td>${esc(c.reason)}</td><td>${esc(c.corrected_by_name)}</td><td>${esc(c.corrected_at)}</td></tr>`).join("")}</table></div></div>`;
}
function countTable(id, phase) {
  let lines = shiftCounts(id, phase);
  if (!lines.length) return "—";
  return lines
    .map(
      (c) =>
        `<div style="margin:4px 0">${esc(c.ingredient)}: <b>${esc(c.quantity)} ${esc(c.unit)}</b> <button class="btn alt small" onclick="countCorrectionForm(${c.id})">Correct</button></div>`,
    )
    .join("");
}
function lineEditor(lines) {
  return `<div id="countlines">${lines.map((l, i) => `<div class="formgrid countline" style="margin-bottom:10px"><div class="field"><label>Ingredient</label><input name="ingredient" value="${esc(l.ingredient)}" required ${l.locked ? "readonly" : ""}></div><div class="field"><label>Quantity</label><input name="quantity" type="number" min="0" step="0.001" value="${esc(l.quantity ?? "")}" required></div><div class="field"><label>Unit</label><input name="unit" value="${esc(l.unit)}" required ${l.locked ? "readonly" : ""}></div></div>`).join("")}</div>`;
}
function collectLines() {
  return [...document.querySelectorAll(".countline")].map((r) => ({
    ingredient: r.querySelector("[name=ingredient]").value.trim(),
    quantity: r.querySelector("[name=quantity]").value,
    unit: r.querySelector("[name=unit]").value.trim(),
  }));
}
function shiftStartForm() {
  let defaults = [
    { ingredient: "Coffee Beans", quantity: "", unit: "g" },
    { ingredient: "Fresh Milk", quantity: "", unit: "mL" },
    { ingredient: "Matcha Powder", quantity: "", unit: "g" },
  ];
  modal(
    "Record Pre-Shift Inventory",
    `<p>Count the actual ingredients before starting sales. Edit the ingredient names as needed.</p><form id="shiftform">${lineEditor(defaults)}<button type="button" class="btn alt" onclick="addCountLine()">+ Ingredient</button> <button class="btn">Start Shift & Save Count</button></form>`,
  );
  $("#shiftform").onsubmit = async (e) => {
    e.preventDefault();
    await submit(
      "shift-start",
      { lines: collectLines() },
      "Pre-shift count saved",
    );
  };
}
function addCountLine() {
  let d = document.createElement("div");
  d.className = "formgrid countline";
  d.style.marginBottom = "10px";
  d.innerHTML =
    '<div class="field"><label>Ingredient</label><input name="ingredient" required></div><div class="field"><label>Quantity</label><input name="quantity" type="number" min="0" step="0.001" required></div><div class="field"><label>Unit</label><input name="unit" required></div>';
  $("#countlines").append(d);
}
function shiftEndForm(id) {
  let lines = shiftCounts(id, "Pre-Shift").map((c) => ({
    ingredient: c.ingredient,
    unit: c.unit,
    quantity: "",
    locked: true,
  }));
  modal(
    "Record Post-Shift Inventory",
    `<p>Count the remaining ingredients before leaving your shift. This count will be reviewed by the incoming Barista.</p><form id="shiftform">${lineEditor(lines)}<div class="field"><label>Shift notes (optional)</label><textarea name="note" maxlength="500"></textarea></div><button class="btn">Submit Post-Shift Inventory</button></form>`,
  );
  $("#shiftform").onsubmit = (e) => {
    e.preventDefault();
    submit(
      "shift-end",
      {
        shift_id: id,
        lines: collectLines(),
        note: e.target.elements.note.value,
      },
      "Post-shift inventory submitted",
    );
  };
}
function handoverForm(id) {
  let incoming = (state.inventory_shifts || []).find(
    (s) =>
      Number(s.barista_id) === Number(user.id) && Number(s.id) > Number(id),
  );
  if (!incoming) {
    notify(
      "First record your own pre-shift inventory before reviewing this handover",
    );
    return;
  }
  modal(
    "Review Previous Barista Handover",
    `<p><b>Outgoing shift #${id}</b> — independently compare these counts with your own pre-shift count. The system does not automatically detect discrepancies.</p><h3>Outgoing Post-Shift</h3>${countTable(id, "Post-Shift")}<h3>Your Pre-Shift (Shift #${incoming.id})</h3>${countTable(incoming.id, "Pre-Shift")}<form id="handoverform"><div class="field"><label>Decision</label><select name="decision"><option>Approved</option><option>Flagged</option></select></div><div class="field"><label>Review notes / issue details</label><textarea name="note" maxlength="500"></textarea></div><button class="btn">Record Handover Decision</button></form>`,
  );
  $("#handoverform").onsubmit = (e) => {
    e.preventDefault();
    let d = Object.fromEntries(new FormData(e.target));
    if (confirm("Confirm your handover review? This decision is final."))
      submit(
        "shift-handover",
        { ...d, outgoing_shift_id: id, incoming_shift_id: incoming.id },
        "Handover review saved",
      );
  };
}
function countCorrectionForm(id) {
  let c = state.inventory_counts.find((x) => Number(x.id) === Number(id));
  if (!c) return;
  modal(
    "Correct Inventory Count",
    `<p>${esc(c.ingredient)} · ${esc(c.phase)} · Recorded ${esc(c.quantity)} ${esc(c.unit)}</p><form id="correctform"><div class="field"><label>Correct quantity</label><input name="quantity" type="number" min="0" step="0.001" value="${esc(c.quantity)}" required></div><div class="field"><label>Reason for correction</label><textarea name="reason" required maxlength="500"></textarea></div><button class="btn">Save Audited Correction</button></form>`,
  );
  $("#correctform").onsubmit = (e) => {
    e.preventDefault();
    submit(
      "shift-correct",
      { count_id: id, ...Object.fromEntries(new FormData(e.target)) },
      "Correction saved to audit history",
    );
  };
}
function filtered() {
  return orders().filter(
    (o) =>
      (!dateFilter || dateOnly(o.created_at) === dateFilter) &&
      (!shiftFilter || o.shift_label === shiftFilter),
  );
}
function reportsView() {
  $("#view").innerHTML =
    header(
      "Sales History & Reports",
      "Filter completed transactions by date or shift",
    ) +
    `<div class="panel"><div class="filters"><div class="field"><label>Date</label><input type="date" onchange="dateFilter=this.value;reportsTable()"></div><div class="field"><label>Shift</label><select onchange="shiftFilter=this.value;reportsTable()"><option value="">All shifts</option><option>Opening</option><option>Closing</option></select></div><button class="btn alt" onclick="exportCSV()">Export CSV</button></div><div id="reportTable"></div></div>`;
  reportsTable();
}
function reportsTable() {
  let a = filtered(),
    sum = a.reduce((s, o) => s + net(o), 0);
  $("#reportTable").innerHTML =
    `<h3>${a.length} transactions · Net sales ${peso(sum)}</h3>${rowOrders(a)}`;
}
function exportCSV() {
  let a = filtered(),
    rows = [
      [
        "Order",
        "Date",
        "Shift",
        "Cashier",
        "Method",
        "Total",
        "Refunded",
        "Net",
      ],
      ...a.map((o) => [
        o.id,
        o.created_at,
        o.shift_label,
        o.cashier,
        o.payment_method,
        o.total,
        o.refunded,
        net(o),
      ]),
    ],
    csv = rows
      .map((r) =>
        r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","),
      )
      .join("\r\n"),
    blob = new Blob([csv], { type: "text/csv;charset=utf-8" }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "pause-coffee-sales.csv";
  link.click();
  URL.revokeObjectURL(url);
}
function refundsView() {
  $("#view").innerHTML =
    header(
      "Cancellations & Refunds",
      "Authorized refunds with reasons and accountability",
      '<button class="btn" onclick="refundForm()">+ Record Refund</button>',
    ) +
    `<div class="panel"><h3>Refund History</h3><div class="tablewrap"><table><tr><th>Order</th><th>Amount</th><th>Reason</th><th>Responsible user</th><th>Date</th></tr>${state.refunds.map((r) => `<tr><td>#${r.order_id}</td><td>${peso(r.amount)}</td><td>${esc(r.reason)}</td><td>${esc(r.handled_by)}</td><td>${esc(r.created_at)}</td></tr>`).join("")}</table></div></div><div class="panel"><h3>Completed Orders</h3>${rowOrders(orders().slice(0, 50))}</div>`;
}
function refundForm() {
  let eligible = orders().filter((o) => net(o) > 0);
  modal(
    "Record Authorized Refund",
    `<form id="refundform"><div class="field"><label>Order</label><select name="order_id" required>${eligible.map((o) => `<option value="${o.id}">#${o.id} · Remaining ${peso(net(o))}</option>`).join("")}</select></div><div class="field"><label>Refund amount (₱)</label><input name="amount" type="number" step="0.01" min="0.01" required></div><div class="field"><label>Reason</label><textarea name="reason" required></textarea></div><button class="btn red" ${!eligible.length ? "disabled" : ""}>Record Refund</button></form>`,
  );
  $("#refundform").onsubmit = (e) => {
    e.preventDefault();
    if (confirm("Confirm this refund was authorized and processed?"))
      submit(
        "refund-create",
        Object.fromEntries(new FormData(e.target)),
        "Refund recorded",
      );
  };
}
function usersView() {
  if (user.role !== "Owner") return;
  $("#view").innerHTML =
    header(
      "User Accounts & Role-Based Access",
      "Owner manages staff accounts",
      '<button class="btn" onclick="userForm()">+ Add User</button>',
    ) +
    `<div class="panel tablewrap"><table><tr><th>Name</th><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr>${state.users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${esc(u.role)}</td><td>${Number(u.active) ? "Active" : "Inactive"}</td><td><button class="btn alt small" onclick="userForm(${u.id})">Edit</button> <button class="btn soft small" onclick="toggleUser(${u.id})">${Number(u.active) ? "Deactivate" : "Activate"}</button></td></tr>`).join("")}</table></div>`;
}
function userForm(id) {
  let u = state.users.find((x) => Number(x.id) === Number(id)) || {};
  modal(
    id ? "Edit User" : "Add User",
    `<form id="userform"><div class="field"><label>Name</label><input name="name" value="${esc(u.name || "")}" required></div><div class="field"><label>Username</label><input name="username" value="${esc(u.username || "")}" minlength="3" required></div><div class="field"><label>Role</label><select name="role"><option ${u.role === "Owner" ? "selected" : ""}>Owner</option><option ${u.role === "Barista" ? "selected" : ""}>Barista</option></select></div><div class="field"><label>Password ${id ? "(leave blank to keep current)" : "(10+ characters)"}</label><input type="password" name="password" ${id ? "" : 'required minlength="10"'}></div><button class="btn">Save Account</button></form>`,
  );
  $("#userform").onsubmit = (e) => {
    e.preventDefault();
    submit(
      "user-save",
      { ...Object.fromEntries(new FormData(e.target)), id: id || undefined },
      "User saved",
    );
  };
}
function toggleUser(id) {
  if (confirm("Change this account status?"))
    submit("user-toggle", { id }, "Account status updated");
}
boot();

function recipeForm(pid) {
  if (user.role !== "Owner") return;
  const product = state.products.find((p) => Number(p.id) === pid);
  const existing = (state.recipes || []).filter(
    (r) => Number(r.product_id) === pid,
  );
  const ingredients = state.ingredients || [];
  if (!ingredients.length) {
    notify("Start a shift and record ingredient counts before setting recipes");
    return;
  }
  const opts = ingredients
    .map(
      (i) =>
        `<option value="${Number(i.id)}">${esc(i.name)} (${esc(i.unit)})</option>`,
    )
    .join("");
  const row = (r) =>
    `<div class="formgrid recipe-row"><div class="field"><label>Ingredient</label><select name="ingredient_id">${opts}</select></div><div class="field"><label>Amount per drink (ingredient unit)</label><input name="quantity" type="number" min="0.001" step="0.001" value="${r ? esc(r.quantity_per_item) : ""}" required></div><button class="btn alt small" type="button" onclick="this.closest('.recipe-row').remove()">Remove</button></div>`;
  modal(
    "Recipe — " + product.name,
    `<p>Define ingredient amounts for ONE sale of this product. An order of 2 drinks deducts twice these amounts.</p><form id="recipeform"><div id="recipeRows">${existing.map(row).join("")}</div><button type="button" class="btn alt" id="addRecipe">+ Ingredient</button> <button class="btn">Save Recipe</button></form>`,
  );
  document
    .querySelectorAll("#recipeRows .recipe-row")
    .forEach(
      (el, k) =>
        (el.querySelector("select").value = String(existing[k].ingredient_id)),
    );
  $("#addRecipe").onclick = () => {
    $("#recipeRows").insertAdjacentHTML("beforeend", row(null));
  };
  $("#recipeform").onsubmit = (e) => {
    e.preventDefault();
    let lines = [...document.querySelectorAll("#recipeRows .recipe-row")].map(
      (el) => ({
        ingredient_id: Number(el.querySelector("select").value),
        quantity: el.querySelector("input").value,
      }),
    );
    submit("recipe-save", { product_id: pid, lines }, "Recipe saved");
  };
}
