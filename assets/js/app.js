const productGrid=document.getElementById("productGrid");
const categories=document.getElementById("categories");
const cartDrawer=document.getElementById("cartDrawer");
const cartOverlay=document.getElementById("cartOverlay");
const cartItems=document.getElementById("cartItems");
const cartCount=document.getElementById("cartCount");
const cartTotal=document.getElementById("cartTotal");
const checkoutButton=document.getElementById("checkoutButton");
const floatingCart=document.getElementById("floatingCart");
const floatingCartCount=document.getElementById("floatingCartCount");
const floatingCartTotal=document.getElementById("floatingCartTotal");
const formatMoney=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
let activeCategory="todos";

function renderCategories(list){
  const active=list.filter(c=>c.active);
  categories.innerHTML='<button class="category active" data-category="todos">Todos</button>'+active.map(c=>`<button class="category" data-category="${c.slug}">${escapeHTML(c.name)}</button>`).join("");
}
function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderProducts(category="todos"){
  const products=window.MENU.filter(p=>category==="todos"||p.category===category);
  if(!products.length){productGrid.innerHTML='<p class="menu-loading">Nenhum produto disponível nesta categoria.</p>';return;}
  productGrid.innerHTML=products.map(p=>`<article class="product-card"><div class="product-image"><img src="${escapeHTML(p.image||"")}" alt="${escapeHTML(p.name)}" loading="lazy"><span class="product-category">${escapeHTML(p.label||"JP BURGUER")}</span></div><div class="product-info"><h3>${escapeHTML(p.name)}</h3><p>${escapeHTML(p.description||"")}</p><div class="product-bottom"><span class="product-price">${formatMoney(p.price)}</span><button class="add-button" data-add="${escapeHTML(p.id)}" aria-label="Adicionar ${escapeHTML(p.name)}">+</button></div></div></article>`).join("");
}
categories.addEventListener("click",event=>{
  const button=event.target.closest("[data-category]");if(!button)return;
  document.querySelectorAll(".category").forEach(item=>item.classList.toggle("active",item===button));
  activeCategory=button.dataset.category;renderProducts(activeCategory);
});
productGrid.addEventListener("click",event=>{
  const button=event.target.closest("[data-add]");if(!button)return;
  window.Cart.add(button.dataset.add);renderCart();openCart();
});
function renderCart(){
  const items=window.Cart.getItems(),count=window.Cart.getCount(),total=window.Cart.getTotal();
  cartCount.textContent=count;cartTotal.textContent=formatMoney(total);checkoutButton.disabled=!items.length;
  floatingCartCount.textContent=count+(count===1?" item":" itens");floatingCartTotal.textContent=formatMoney(total);floatingCart.hidden=!items.length;
  if(!items.length){cartItems.innerHTML='<div class="empty-cart"><span class="empty-bag">▢</span><p>Sua sacola está vazia.</p><small>Adicione seus favoritos para começar.</small></div>';return;}
  cartItems.innerHTML=items.map(item=>`<div class="cart-item"><div><h4>${escapeHTML(item.name)}</h4><span class="cart-item-price">${formatMoney(item.price*item.quantity)}</span><div class="quantity-controls"><button data-minus="${escapeHTML(item.id)}" aria-label="Diminuir quantidade">−</button><span>${item.quantity}</span><button data-plus="${escapeHTML(item.id)}" aria-label="Aumentar quantidade">+</button></div></div></div>`).join("");
}
cartItems.addEventListener("click",event=>{
  const plus=event.target.closest("[data-plus]"),minus=event.target.closest("[data-minus]");
  if(plus)window.Cart.changeQuantity(plus.dataset.plus,1);if(minus)window.Cart.changeQuantity(minus.dataset.minus,-1);renderCart();
});
function openCart(){cartDrawer.classList.add("open");cartOverlay.classList.add("show");document.body.style.overflow="hidden";}
function closeCart(){cartDrawer.classList.remove("open");cartOverlay.classList.remove("show");document.body.style.overflow="";}
document.getElementById("openCart").addEventListener("click",openCart);
floatingCart.addEventListener("click",openCart);
document.getElementById("closeCart").addEventListener("click",closeCart);
cartOverlay.addEventListener("click",closeCart);
checkoutButton.addEventListener("click",()=>{if(!window.Cart.getItems().length)return;closeCart();window.Checkout.open();});
document.getElementById("closeCheckout").addEventListener("click",()=>window.Checkout.close());
document.getElementById("checkoutOverlay").addEventListener("click",event=>{if(event.target.id==="checkoutOverlay")window.Checkout.close();});

async function loadMenu(){
  try{
    const {data:cats,error:catError}=await window.supabaseClient.from("categories").select("id,name,slug,active,position").eq("active",true).order("position");
    const {data:rows,error:prodError}=await window.supabaseClient.from("products").select("id,name,description,price,label,image_url,active,position,category_id,categories(slug)").eq("active",true).order("position");
    if(catError||prodError)throw catError||prodError;
    renderCategories(cats||[]);
    window.MENU=(rows||[]).map(p=>({id:p.id,name:p.name,description:p.description||"",price:Number(p.price),label:p.label||"JP BURGUER",image:p.image_url||"",category:p.categories?.slug||""}));
    renderProducts(activeCategory);
  }catch(error){
    console.error("Falha ao carregar cardápio:",error);
    productGrid.innerHTML='<p class="menu-loading">Não foi possível carregar o cardápio. Tente atualizar a página.</p>';
  }
}
renderCart();loadMenu();