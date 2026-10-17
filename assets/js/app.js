const landingScreen=document.getElementById("landingScreen");
const menuApp=document.getElementById("menuApp");
document.getElementById("enterMenu").addEventListener("click",()=>{
  landingScreen.hidden=true;
  menuApp.hidden=false;
  window.scrollTo({top:0,behavior:"instant"});
});

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
let currentProductIndex=0;
let slideDirection="next";
let slideBusy=false;
let slideTimer=null;

function escapeHTML(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function productsForCategory(){
  return window.MENU.filter(p=>activeCategory==="todos"||p.category===activeCategory);
}
function renderCategories(list){
  const active=list.filter(c=>c.active);
  categories.innerHTML='<button class="category active" data-category="todos">TODOS</button>'+
    active.map(c=>`<button class="category" data-category="${escapeHTML(c.slug)}">${escapeHTML(c.name)}</button>`).join("");
}
function renderProducts(direction="next",animate=false){
  const products=productsForCategory();
  if(!products.length){
    productGrid.innerHTML='<p class="menu-loading">NENHUM PRODUTO DISPONÍVEL NESTA CATEGORIA.</p>';
    return;
  }
  currentProductIndex=(currentProductIndex+products.length)%products.length;
  const p=products[currentProductIndex];
  const previous=products.length>1;
  productGrid.innerHTML=`
    <article class="showcase-product ${animate?(direction==="next"?"slide-enter-next":"slide-enter-prev"):""}">
      <div class="showcase-visual">
        <div class="showcase-glow"></div>
        <button class="showcase-arrow showcase-prev" type="button" data-slide="prev" aria-label="Produto anterior" ${previous?"":"disabled"}>‹</button>
        <div class="showcase-photo-wrap">
          <img class="showcase-photo" src="${escapeHTML(p.image||"")}" alt="${escapeHTML(p.name)}" ${animate?"":"fetchpriority=\"high\""}>
        </div>
        <button class="showcase-arrow showcase-next" type="button" data-slide="next" aria-label="Próximo produto" ${previous?"":"disabled"}>›</button>
      </div>
      <div class="showcase-details">
        <span class="showcase-label">${escapeHTML(p.label||"JP HOUSE")}</span>
        <h2>${escapeHTML(p.name)}</h2>
        <p>${escapeHTML(p.description||"")}</p>
        <div class="showcase-buy">
          <strong>${formatMoney(p.price)}</strong>
          <button class="showcase-add" type="button" data-add="${escapeHTML(p.id)}"><span>+</span> ADICIONAR AO PEDIDO</button>
        </div>
        <div class="showcase-position"><span></span><small>${currentProductIndex+1} / ${products.length}</small></div>
      </div>
    </article>`;
  const image=productGrid.querySelector(".showcase-photo");
  if(image){
    image.addEventListener("error",()=>image.classList.add("image-unavailable"),{once:true});
  }
  slideBusy=animate;
  if(slideTimer)clearTimeout(slideTimer);
  if(animate)slideTimer=setTimeout(()=>{slideBusy=false;},620);
}
function changeSlide(direction){
  const products=productsForCategory();
  if(products.length<2||slideBusy)return;
  slideDirection=direction;
  currentProductIndex+=direction==="next"?1:-1;
  renderProducts(direction,true);
}
categories.addEventListener("click",event=>{
  const button=event.target.closest("[data-category]");
  if(!button)return;
  categories.querySelectorAll(".category").forEach(item=>item.classList.toggle("active",item===button));
  activeCategory=button.dataset.category;
  currentProductIndex=0;
  renderProducts();
});
productGrid.addEventListener("click",event=>{
  const slide=event.target.closest("[data-slide]");
  if(slide){changeSlide(slide.dataset.slide);return;}
  const button=event.target.closest("[data-add]");
  if(!button)return;
  window.Cart.add(button.dataset.add);
  renderCart();
  openCart();
});

function renderCart(){
  const items=window.Cart.getItems(),count=window.Cart.getCount(),total=window.Cart.getTotal();
  cartCount.textContent=count;cartTotal.textContent=formatMoney(total);checkoutButton.disabled=!items.length;
  floatingCartCount.textContent=count+(count===1?" ITEM":" ITENS");floatingCartTotal.textContent=formatMoney(total);floatingCart.hidden=!items.length;
  if(!items.length){cartItems.innerHTML='<div class="empty-cart"><span class="empty-bag">▢</span><p>SUA SACOLA ESTÁ VAZIA.</p><small>ADICIONE SEUS FAVORITOS PARA COMEÇAR.</small></div>';return;}
  cartItems.innerHTML=items.map(item=>`<div class="cart-item"><div><h4>${escapeHTML(item.name)}</h4><span class="cart-item-price">${formatMoney(item.price*item.quantity)}</span><div class="quantity-controls"><button data-minus="${escapeHTML(item.id)}" aria-label="Diminuir quantidade">−</button><span>${item.quantity}</span><button data-plus="${escapeHTML(item.id)}" aria-label="Aumentar quantidade">+</button></div></div></div>`).join("");
}
cartItems.addEventListener("click",event=>{
  const plus=event.target.closest("[data-plus]"),minus=event.target.closest("[data-minus]");
  if(plus)window.Cart.changeQuantity(plus.dataset.plus,1);
  if(minus)window.Cart.changeQuantity(minus.dataset.minus,-1);
  renderCart();
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
    currentProductIndex=0;
    renderProducts();
  }catch(error){
    console.error("Falha ao carregar cardápio:",error);
    productGrid.innerHTML='<p class="menu-loading">NÃO FOI POSSÍVEL CARREGAR O CARDÁPIO. TENTE ATUALIZAR A PÁGINA.</p>';
  }
}
renderCart();
loadMenu();
