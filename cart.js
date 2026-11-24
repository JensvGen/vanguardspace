/* ===== Geitenshop NR1 – winkelwagen =====
   De winkelwagen wordt bewaard in localStorage, zodat de mini-winkelwagen,
   de winkelwagenpagina en de checkout altijd dezelfde inhoud tonen.
   Later in PHP kun je dit vervangen door $_SESSION['cart'].            */

const PRODUCTS = {
  1: { naam: "Zuurstoffilter X-200",  icon: "🫁",   prijs: 149 },
  2: { naam: "Ruimtemaaltijd 7-pack", icon: "🥫",   prijs: 59 },
  3: { naam: "Multitool Vanguard",    icon: "🔧",   prijs: 89 },
  4: { naam: "Fusiecel Mini",         icon: "🔋",   prijs: 299 },
  5: { naam: "Ruimtepak Geit-3",      icon: "🧑‍🚀", prijs: 1299 },
  6: { naam: "Waterrecycler 20L",     icon: "💧",   prijs: 179 },
  7: { naam: "Communicatieschotel",   icon: "📡",   prijs: 449 },
  8: { naam: "Hydrocultuur-kit",      icon: "🌱",   prijs: 119 }
};

const CART_KEY = "geitenshop_cart";
const CODE_KEY = "geitenshop_code";
const VERZENDKOSTEN = 25;
const KORTINGSCODES = { GEIT10: 0.10 };   // 10% korting

/* ---------- opslag ----------
   Sommige browsers (bijv. Firefox) geven elk los geopend .html-bestand
   een eigen localStorage. Daarom gaat de winkelwagen ook mee in de URL
   (?cart=1-2.3-1&code=GEIT10) wanneer je naar een andere pagina klikt.  */
let STATE = loadState();

/* Leest de winkelwagen uit de URL én uit localStorage en kiest de nieuwste
   (op basis van tijdstempel t). Zo toont de terugknop nooit een oude versie. */
function loadState() {
  let fromUrl = null, fromStore = null;

  const params = new URLSearchParams(location.search);
  if (params.has("cart")) {
    const cart = {};
    params.get("cart").split(".").forEach(part => {
      const [id, n] = part.split("-").map(x => parseInt(x, 10));
      if (PRODUCTS[id] && n > 0) cart[id] = n;
    });
    fromUrl = { cart, code: (params.get("code") || "").toUpperCase(), t: parseInt(params.get("t"), 10) || 0 };
  }

  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY));
    if (raw && raw.cart) fromStore = { cart: raw.cart, code: raw.code || "", t: raw.t || 0 };
  } catch (e) {}

  let state = fromUrl && (!fromStore || fromUrl.t >= fromStore.t) ? fromUrl : fromStore;
  if (!state) state = { cart: {}, code: "", t: 0 };
  storeLocal(state);
  return state;
}
function storeLocal(state) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(state)); } catch (e) {}
}
function stateQuery() {
  // Ook een lege winkelwagen gaat mee ("?cart="), zodat een andere pagina
  // geen oude inhoud uit zijn eigen opslag terughaalt.
  const ids = Object.keys(STATE.cart);
  let q = "cart=" + ids.map(id => id + "-" + STATE.cart[id]).join(".");
  if (STATE.code) q += "&code=" + encodeURIComponent(STATE.code);
  q += "&t=" + STATE.t;
  return q;
}
/* Interne links krijgen de winkelwagen mee */
function updateLinks() {
  const q = stateQuery();
  document.querySelectorAll('a[href]').forEach(a => {
    const raw = a.dataset.base || a.getAttribute("href");
    if (!/^[\w-]+\.html/.test(raw)) return;          // alleen eigen pagina's
    a.dataset.base = raw;
    const [path, hash] = raw.split("#");
    a.setAttribute("href", path.split("?")[0] + "?" + q + (hash ? "#" + hash : ""));
  });
  try {
    history.replaceState(null, "", location.pathname + "?" + q + location.hash);
  } catch (e) {}
}

function getCart() { return { ...STATE.cart }; }
function saveCart(cart) {
  STATE.cart = cart;
  STATE.t = Date.now();
  storeLocal(STATE);
  renderAll();
}
function getCode() { return STATE.code; }
function setCode(code) {
  STATE.code = code;
  STATE.t = Date.now();
  storeLocal(STATE);
}

/* ---------- acties ---------- */
function addToCart(id, aantal = 1) {
  const cart = getCart();
  cart[id] = (cart[id] || 0) + aantal;
  saveCart(cart);
}
function setQty(id, aantal) {
  const cart = getCart();
  aantal = parseInt(aantal, 10);
  if (!aantal || aantal < 1) delete cart[id];
  else cart[id] = aantal;
  saveCart(cart);
}
function removeFromCart(id) {
  const cart = getCart();
  delete cart[id];
  saveCart(cart);
}
function clearCart() { saveCart({}); }

/* ---------- berekeningen ---------- */
const fmt = n => "₵ " + Math.round(n).toLocaleString("nl-NL");

function cartItems() {
  const cart = getCart();
  return Object.keys(cart)
    .filter(id => PRODUCTS[id])
    .map(id => ({ id, ...PRODUCTS[id], aantal: cart[id], subtotaal: PRODUCTS[id].prijs * cart[id] }));
}
function totals() {
  const items = cartItems();
  const subtotaal = items.reduce((s, i) => s + i.subtotaal, 0);
  const pct = KORTINGSCODES[getCode()] || 0;
  const korting = subtotaal * pct;
  const verzend = items.length ? VERZENDKOSTEN : 0;
  return { items, subtotaal, korting, verzend, totaal: subtotaal - korting + verzend,
           aantal: items.reduce((s, i) => s + i.aantal, 0) };
}

/* ---------- weergave ---------- */
function renderBadges() {
  const { aantal } = totals();
  document.querySelectorAll(".cart-badge").forEach(b => {
    b.textContent = aantal;
    b.style.display = aantal ? "inline-block" : "none";
  });
}

/* Mini-winkelwagen (index) */
function renderMiniCart() {
  const box = document.getElementById("mini-cart-items");
  if (!box) return;
  const t = totals();
  if (!t.items.length) {
    box.innerHTML = '<p class="empty">Je laadruim is leeg. 🛰️</p>';
  } else {
    box.innerHTML = t.items.map(i => `
      <div class="mini-item">
        <span class="icon">${i.icon}</span>
        <div class="info">
          <strong>${i.naam}</strong>
          <span>${fmt(i.prijs)}</span>
          <div class="qty">
            <button type="button" onclick="setQty(${i.id}, ${i.aantal - 1})">−</button>
            <span>${i.aantal}</span>
            <button type="button" onclick="setQty(${i.id}, ${i.aantal + 1})">+</button>
          </div>
        </div>
        <button type="button" class="remove" title="Verwijderen" onclick="removeFromCart(${i.id})">✕</button>
      </div>`).join("");
  }
  document.getElementById("mini-cart-total").textContent = fmt(t.subtotaal - t.korting);
  document.querySelectorAll(".mini-cart .btn").forEach(b => b.classList.toggle("disabled", !t.items.length));
}

/* Winkelwagenpagina */
function renderCartPage() {
  const body = document.getElementById("cart-body");
  if (!body) return;
  const t = totals();
  if (!t.items.length) {
    body.innerHTML = '<tr><td colspan="5" class="empty">Je laadruim is leeg. <a href="index.html">Ga terug naar de producten</a>.</td></tr>';
  } else {
    body.innerHTML = t.items.map(i => `
      <tr>
        <td><div class="item"><span class="icon">${i.icon}</span> ${i.naam}</div></td>
        <td>${fmt(i.prijs)}</td>
        <td><input type="number" min="1" value="${i.aantal}" onchange="setQty(${i.id}, this.value)"></td>
        <td>${fmt(i.subtotaal)}</td>
        <td><button type="button" class="remove" title="Verwijderen" onclick="removeFromCart(${i.id})">✕</button></td>
      </tr>`).join("");
  }
  renderSummary();
  const btn = document.getElementById("to-checkout");
  if (btn) btn.classList.toggle("disabled", !t.items.length);
}

/* Overzicht (winkelwagen + checkout) */
function renderSummary() {
  const box = document.getElementById("summary");
  if (!box) return;
  const t = totals();
  const regels = document.body.dataset.page === "checkout"
    ? t.items.map(i => `<div class="summary-line"><span>${i.aantal}× ${i.naam}</span><span>${fmt(i.subtotaal)}</span></div>`).join("")
    : `<div class="summary-line"><span>Subtotaal (${t.aantal} ${t.aantal === 1 ? "item" : "items"})</span><span>${fmt(t.subtotaal)}</span></div>`;
  box.innerHTML = (t.items.length ? regels : '<p class="empty">Geen producten in je bestelling.</p>') + `
    <div class="summary-line"><span>Transport naar koepel</span><span>${fmt(t.verzend)}</span></div>
    ${t.korting ? `<div class="summary-line"><span>Korting (${getCode()})</span><span>– ${fmt(t.korting)}</span></div>` : ""}
    <div class="summary-line total"><span>Totaal</span><span>${fmt(t.totaal)}</span></div>`;
}

function renderAll() {
  updateLinks();
  renderBadges();
  renderMiniCart();
  renderCartPage();
  renderSummary();
}

/* ---------- mini-winkelwagen openen/sluiten ---------- */
function openMiniCart() {
  document.body.classList.add("mini-open");
}
function closeMiniCart() {
  document.body.classList.remove("mini-open");
}

/* Korte melding na toevoegen */
function toast(tekst) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = tekst;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------- koppelen ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // "In winkelwagen"-knoppen
  document.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.add;
      addToCart(id);
      toast(`${PRODUCTS[id].icon} ${PRODUCTS[id].naam} toegevoegd aan je laadruim`);
    });
  });

  // Kortingscode
  const codeForm = document.getElementById("code-form");
  if (codeForm) {
    const input = codeForm.querySelector("input");
    const msg = document.getElementById("code-msg");
    input.value = getCode();
    codeForm.addEventListener("submit", e => {
      e.preventDefault();
      const code = input.value.trim().toUpperCase();
      if (!code || KORTINGSCODES[code]) {
        setCode(code);
        msg.textContent = code ? "Kortingscode toegepast." : "";
        msg.className = "code-msg ok";
      } else {
        setCode("");
        msg.textContent = "Onbekende kortingscode.";
        msg.className = "code-msg err";
      }
      renderAll();
    });
  }

  // Escape sluit mini-winkelwagen
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeMiniCart(); });

  // Categoriefilter (productpagina)
  const filters = document.querySelectorAll("[data-filter]");
  filters.forEach(btn => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.filter;
      filters.forEach(f => f.classList.toggle("active", f === btn));
      document.querySelectorAll(".card[data-cat]").forEach(card => {
        card.style.display = (cat === "alles" || card.dataset.cat === cat) ? "" : "none";
      });
    });
  });

  renderAll();
});

/* Terugknop / vorige pagina: winkelwagen opnieuw inlezen */
function refreshState() {
  STATE = loadState();
  renderAll();
}
window.addEventListener("pageshow", refreshState);
window.addEventListener("storage", refreshState);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshState(); });
