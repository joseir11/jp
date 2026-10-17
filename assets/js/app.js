const landingScreen=document.getElementById("landingScreen");
const menuApp=document.getElementById("menuApp");
document.getElementById("enterMenu").addEventListener("click",()=>{
  landingScreen.hidden=true;
  menuApp.hidden=false;
  window.scrollTo({top:0,behavior:"instant"});
});

const productGrid=document.getElementById("productGrid");
const categories=document.getElementById("categories");
const formatMoney=value=>Number(value||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
let activeCategory="todos";
let currentProductIndex=0;
let slideBusy=false;
let slideTimer=null;
window.MENU=[];

function escapeHTML(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function productsForCategory(){
  return window.MENU.filter(p=>activeCategory==="todos"||p.category===activeCategory);
}
function renderCategories(list){
  categories.innerHTML='<button class="category active" data-category="todos">TODOS</button>'+
    list.filter(c=>c.active).map(c=>`<button class="category" data-category="${escapeHTML(c.slug)}">${escapeHTML(c.name)}</button>`).join("");
}
function renderProducts(direction="next",animate=false){
  const products=productsForCategory();
  if(!products.length){
    productGrid.innerHTML='<p class="menu-loading">NENHUM PRODUTO DISPONÍVEL NESTA CATEGORIA.</p>';
    return;
  }
  currentProductIndex=(currentProductIndex+products.length)%products.length;
  const p=products[currentProductIndex];
  const multiple=products.length>1;
  productGrid.innerHTML=`
    <article class="showcase-product ${animate?(direction==="next"?"slide-enter-next":"slide-enter-prev"):""}">
      <div class="showcase-visual">
        <div class="showcase-glow"></div>
        <button class="showcase-arrow showcase-prev" type="button" data-slide="prev" aria-label="Produto anterior" ${multiple?"":"disabled"}>‹</button>
        <div class="showcase-photo-wrap">
          ${p.image? `<img class="showcase-photo" src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}">`:'<div class="showcase-no-photo">JP HOUSE</div>'}
        </div>
        <button class="showcase-arrow showcase-next" type="button" data-slide="next" aria-label="Próximo produto" ${multiple?"":"disabled"}>›</button>
      </div>
      <div class="showcase-details">
        <span class="showcase-label">${escapeHTML(p.label||"JP HOUSE")}</span>
        <h2>${escapeHTML(p.name)}</h2>
        <p>${escapeHTML(p.description||"")}</p>
        <div class="showcase-price"><strong>${formatMoney(p.price)}</strong></div>
        <div class="showcase-position"><span></span><small>${currentProductIndex+1} / ${products.length}</small></div>
      </div>
    </article>`;
  const image=productGrid.querySelector(".showcase-photo");
  if(image)image.addEventListener("error",()=>image.classList.add("image-unavailable"),{once:true});
  slideBusy=animate;
  if(slideTimer)clearTimeout(slideTimer);
  if(animate)slideTimer=setTimeout(()=>{slideBusy=false;},650);
}
function changeSlide(direction){
  const products=productsForCategory();
  if(products.length<2||slideBusy)return;
  slideBusy=true;
  const current=productGrid.querySelector(".showcase-product");
  if(current)current.classList.add(direction==="next"?"slide-exit-next":"slide-exit-prev");
  setTimeout(()=>{
    currentProductIndex+=direction==="next"?1:-1;
    renderProducts(direction,true);
  },180);
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
  const arrow=event.target.closest("[data-slide]");
  if(arrow)changeSlide(arrow.dataset.slide);
});

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
loadMenu();
