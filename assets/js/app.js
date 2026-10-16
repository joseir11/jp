const productGrid = document.getElementById("productGrid");
const categories = document.getElementById("categories");
const cartDrawer = document.getElementById("cartDrawer");
const cartOverlay = document.getElementById("cartOverlay");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const checkoutButton = document.getElementById("checkoutButton");
const floatingCart = document.getElementById("floatingCart");
const floatingCartCount = document.getElementById("floatingCartCount");
const floatingCartTotal = document.getElementById("floatingCartTotal");

const formatMoney = value => value.toLocaleString("pt-BR", {
  style: "currency",
  currency: "BRL"
});

function renderProducts(category = "todos") {
  const products = window.MENU.filter(product =>
    category === "todos" || product.category === category
  );

  productGrid.innerHTML = products.map(product => `
    <article class="product-card">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy">
        <span class="product-category">${product.label}</span>
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.description}</p>
        <div class="product-bottom">
          <span class="product-price">${formatMoney(product.price)}</span>
          <button class="add-button" data-add="${product.id}" aria-label="Adicionar ${product.name}">+</button>
        </div>
      </div>
    </article>
  `).join("");
}

categories.addEventListener("click", event => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  document.querySelectorAll(".category").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  renderProducts(button.dataset.category);
});

productGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  window.Cart.add(Number(button.dataset.add));
  renderCart();
  openCart();
});

function renderCart() {
  const items = window.Cart.getItems();
  const count = window.Cart.getCount();
  const total = window.Cart.getTotal();

  cartCount.textContent = count;
  cartTotal.textContent = formatMoney(total);
  checkoutButton.disabled = items.length === 0;
  floatingCartCount.textContent = count + (count === 1 ? " item" : " itens");
  floatingCartTotal.textContent = formatMoney(total);
  floatingCart.hidden = items.length === 0;

  if (!items.length) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <span class="empty-bag">▢</span>
        <p>Sua sacola está vazia.</p>
        <small>Adicione seus favoritos para começar.</small>
      </div>`;
    return;
  }

  cartItems.innerHTML = items.map(item => `
    <div class="cart-item">
      <div>
        <h4>${item.name}</h4>
        <span class="cart-item-price">${formatMoney(item.price * item.quantity)}</span>
        <div class="quantity-controls">
          <button data-minus="${item.id}" aria-label="Diminuir quantidade">−</button>
          <span>${item.quantity}</span>
          <button data-plus="${item.id}" aria-label="Aumentar quantidade">+</button>
        </div>
      </div>
    </div>`).join("");
}

cartItems.addEventListener("click", event => {
  const plus = event.target.closest("[data-plus]");
  const minus = event.target.closest("[data-minus]");
  if (plus) window.Cart.changeQuantity(Number(plus.dataset.plus), 1);
  if (minus) window.Cart.changeQuantity(Number(minus.dataset.minus), -1);
  renderCart();
});

function openCart() {
  cartDrawer.classList.add("open");
  cartOverlay.classList.add("show");
  document.body.style.overflow = "hidden";
}
function closeCart() {
  cartDrawer.classList.remove("open");
  cartOverlay.classList.remove("show");
  document.body.style.overflow = "";
}

document.getElementById("openCart").addEventListener("click", openCart);
floatingCart.addEventListener("click", openCart);
document.getElementById("closeCart").addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);
checkoutButton.addEventListener("click", () => {
  if (!window.Cart.getItems().length) return;
  closeCart();
  window.Checkout.open();
});
document.getElementById("closeCheckout").addEventListener("click", () => window.Checkout.close());
document.getElementById("checkoutOverlay").addEventListener("click", event => {
  if (event.target.id === "checkoutOverlay") window.Checkout.close();
});

renderProducts();
renderCart();
