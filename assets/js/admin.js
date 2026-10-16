const db = window.supabaseClient;
const $ = id => document.getElementById(id);
let categories = [];
let products = [];
let orders = [];
let editingImageUrl = "";
let ordersChannel = null;
let knownOrderIds = new Set();
let unseenOrders = 0;

const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const money = value => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const slugify = value => value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const orderStatuses = ["NOVO","EM PREPARO","PRONTO","ENTREGUE"];

function message(id,text,isError=true){$(id).textContent=text;$(id).style.color=isError?"#b34c25":"#347344";}

async function checkSession(){
  const {data:{session}} = await db.auth.getSession();
  if(session){
    $("loginPanel").hidden=true;
    $("dashboard").hidden=false;
    $("logoutButton").hidden=false;
    await loadData();
    await loadOrders();
    subscribeToOrders();
  }
}
$("loginForm").addEventListener("submit",async event=>{
  event.preventDefault();message("loginMessage","Verificando acesso...");
  const {error}=await db.auth.signInWithPassword({email:$("adminEmail").value.trim(),password:$("adminPassword").value});
  if(error){message("loginMessage","Não foi possível entrar. Confira e-mail e senha.");return;}
  $("loginPanel").hidden=true;$("dashboard").hidden=false;$("logoutButton").hidden=false;
  await loadData();await loadOrders();subscribeToOrders();
});
$("logoutButton").addEventListener("click",async()=>{
  if(ordersChannel)await db.removeChannel(ordersChannel);
  await db.auth.signOut();location.reload();
});

async function loadData(){
  const [catRes,prodRes]=await Promise.all([
    db.from("categories").select("*").order("position"),
    db.from("products").select("*, categories(name)").order("position").order("created_at",{ascending:false})
  ]);
  if(catRes.error||prodRes.error){alert("Erro ao carregar dados do Supabase. Verifique as permissões e tente novamente.");return;}
  categories=catRes.data||[];products=prodRes.data||[];
  renderCategories();renderProducts();fillCategorySelect();
}
function renderProducts(){
  $("productList").innerHTML=products.length?products.map(p=>`
    <article class="admin-product-row ${p.active?"":"admin-inactive"}">
      <img src="${safe(p.image_url||"https://placehold.co/100x100?text=JP")}" alt="">
      <div class="admin-product-data"><strong>${safe(p.name)}</strong><small>${money(p.price)} · ${safe(p.categories?.name||"Sem categoria")} · ${p.active?"Visível":"Oculto"}</small></div>
      <div class="admin-product-actions"><button data-edit="${p.id}">EDITAR</button><button data-toggle="${p.id}">${p.active?"OCULTAR":"ATIVAR"}</button><button data-delete="${p.id}">EXCLUIR</button></div>
    </article>`).join(""):'<p class="admin-empty">Nenhum produto cadastrado ainda.</p>';
}
function renderCategories(){
  $("categoryList").innerHTML=categories.map(c=>`<div class="admin-category-row"><span>${safe(c.name)}</span><small>${c.active?"ATIVA":"INATIVA"}</small><button data-cat-toggle="${c.id}">${c.active?"DESATIVAR":"ATIVAR"}</button></div>`).join("");
}
function fillCategorySelect(){
  $("productCategory").innerHTML=categories.filter(c=>c.active).map(c=>`<option value="${c.id}">${safe(c.name)}</option>`).join("");
}

document.querySelectorAll(".admin-tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".admin-tab").forEach(b=>b.classList.toggle("active",b===btn));
  $("productsPanel").hidden=btn.dataset.tab!=="products";
  $("ordersPanel").hidden=btn.dataset.tab!=="orders";
  $("categoriesPanel").hidden=btn.dataset.tab!=="categories";
  if(btn.dataset.tab==="orders"){unseenOrders=0;updateOrderBadge();}
}));
$("refreshOrdersButton").addEventListener("click",loadOrders);

async function loadOrders(){
  message("ordersMessage","Buscando pedidos...",false);
  const {data,error}=await db.from("orders")
    .select("id,customer_name,notes,status,total,created_at,order_items(id,product_name,unit_price,quantity,subtotal)")
    .order("created_at",{ascending:false});
  if(error){
    message("ordersMessage","Não foi possível carregar os pedidos: "+error.message);
    $("ordersList").innerHTML='<p class="admin-empty">Verifique a conexão e as permissões do banco.</p>';
    return;
  }
  orders=data||[];
  if(!knownOrderIds.size){knownOrderIds=new Set(orders.map(o=>o.id));}
  renderOrders();
  message("ordersMessage",orders.length?orders.length+" pedido(s) no histórico.":"Nenhum pedido recebido ainda.",false);
}
function renderOrders(){
  if(!orders.length){
    $("ordersList").innerHTML='<div class="admin-orders-empty"><strong>Nenhum pedido por enquanto.</strong><span>Quando um cliente confirmar o pedido, ele aparecerá aqui.</span></div>';
    return;
  }
  $("ordersList").innerHTML=orders.map(order=>{
    const items=order.order_items||[];
    const date=new Date(order.created_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
    const status=orderStatuses.includes(order.status)?order.status:"NOVO";
    return `
      <article class="admin-order-card">
        <div class="admin-order-top">
          <div><span class="admin-order-date">${safe(date)}</span><h3>${safe(order.customer_name)}</h3></div>
          <strong class="admin-order-total">${money(order.total)}</strong>
        </div>
        <div class="admin-order-id">PEDIDO #${safe(order.id.slice(0,8).toUpperCase())}</div>
        <div class="admin-order-items">
          ${items.map(item=>`<div class="admin-order-item"><span><b>${Number(item.quantity)}×</b> ${safe(item.product_name)}</span><strong>${money(item.subtotal)}</strong></div>`).join("")}
        </div>
        ${order.notes? `<div class="admin-order-note"><b>OBSERVAÇÃO:</b> ${safe(order.notes)}</div>`:""}
        <div class="admin-order-bottom">
          <label for="status-${order.id}">STATUS DO PEDIDO</label>
          <select id="status-${order.id}" data-order-status="${order.id}">
            ${orderStatuses.map(s=>`<option value="${s}" ${s===status?"selected":""}>${s}</option>`).join("")}
          </select>
        </div>
      </article>`;
  }).join("");
}
$("ordersList").addEventListener("change",async event=>{
  const select=event.target.closest("[data-order-status]");
  if(!select)return;
  const orderId=select.dataset.orderStatus;
  const newStatus=select.value;
  select.disabled=true;
  const {error}=await db.from("orders").update({status:newStatus}).eq("id",orderId);
  select.disabled=false;
  if(error){alert("Não foi possível atualizar o status: "+error.message);await loadOrders();return;}
  const order=orders.find(o=>o.id===orderId);
  if(order)order.status=newStatus;
});
function updateOrderBadge(){
  const badge=$("newOrderCount");
  badge.textContent=String(unseenOrders);
  badge.hidden=unseenOrders===0;
}
function subscribeToOrders(){
  if(ordersChannel)db.removeChannel(ordersChannel);
  ordersChannel=db.channel("jp-admin-orders")
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"orders"},payload=>{
      if(!knownOrderIds.has(payload.new.id)){
        knownOrderIds.add(payload.new.id);
        const ordersTab=document.querySelector('.admin-tab[data-tab="orders"]');
        if(!ordersTab.classList.contains("active")){unseenOrders++;updateOrderBadge();}
      }
      loadOrders();
    })
    .on("postgres_changes",{event:"UPDATE",schema:"public",table:"orders"},()=>loadOrders())
    .subscribe(status=>{
      if(status==="SUBSCRIBED")message("ordersMessage","Pedidos conectados em tempo real.",false);
      if(status==="CHANNEL_ERROR"||status==="TIMED_OUT")message("ordersMessage","Tempo real indisponível. Use ATUALIZAR para consultar os pedidos.");
    });
}

$("newProductButton").addEventListener("click",()=>openProduct());
$("closeProductModal").addEventListener("click",()=>{$("productModal").hidden=true;});
function openProduct(product=null){
  $("productForm").reset();$("productId").value=product?.id||"";editingImageUrl=product?.image_url||"";
  $("productModalTitle").innerHTML=product?"Editar produto<span>.</span>":"Novo produto<span>.</span>";
  $("productName").value=product?.name||"";$("productDescription").value=product?.description||"";
  $("productPrice").value=product?.price??"";$("productCategory").value=product?.category_id||categories.find(c=>c.active)?.id||"";
  $("productLabel").value=product?.label||"";$("productActive").checked=product?product.active:true;
  $("imagePreview").innerHTML=editingImageUrl?`<img src="${safe(editingImageUrl)}" alt="Foto atual">`:"";
  message("productMessage","",false);$("productModal").hidden=false;
}
$("productList").addEventListener("click",async event=>{
  const edit=event.target.closest("[data-edit]"),toggle=event.target.closest("[data-toggle]"),del=event.target.closest("[data-delete]");
  if(edit){openProduct(products.find(p=>p.id===edit.dataset.edit));return;}
  if(toggle){const p=products.find(x=>x.id===toggle.dataset.toggle);const {error}=await db.from("products").update({active:!p.active}).eq("id",p.id);if(error)alert("Não foi possível atualizar o produto.");else await loadData();return;}
  if(del){const p=products.find(x=>x.id===del.dataset.delete);if(!confirm("Excluir definitivamente "+p.name+"?"))return;const {error}=await db.from("products").delete().eq("id",p.id);if(error)alert("Não foi possível excluir o produto.");else await loadData();}
});
$("categoryList").addEventListener("click",async event=>{
  const btn=event.target.closest("[data-cat-toggle]");if(!btn)return;
  const c=categories.find(x=>x.id===btn.dataset.catToggle);
  const {error}=await db.from("categories").update({active:!c.active}).eq("id",c.id);
  if(error)alert("Não foi possível atualizar a categoria.");else await loadData();
});
$("categoryForm").addEventListener("submit",async event=>{
  event.preventDefault();const name=$("categoryName").value.trim();if(!name)return;
  const {error}=await db.from("categories").insert({name,slug:slugify(name),position:categories.length+1,active:true});
  if(error){alert("Não foi possível cadastrar. Talvez já exista uma categoria com esse nome.");return;}
  $("categoryName").value="";await loadData();
});
$("productImage").addEventListener("change",()=>{
  const file=$("productImage").files[0];if(file)$("imagePreview").innerHTML=`<span>Imagem selecionada: ${safe(file.name)}</span>`;
});
$("productForm").addEventListener("submit",async event=>{
  event.preventDefault();const button=$("saveProductButton");button.disabled=true;message("productMessage","Salvando produto...",false);
  try{
    let imageUrl=editingImageUrl;const file=$("productImage").files[0];
    if(file){
      if(!file.type.startsWith("image/"))throw new Error("Selecione um arquivo de imagem.");
      if(file.size>5*1024*1024)throw new Error("A imagem deve ter no máximo 5 MB.");
      const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
      const path=`${crypto.randomUUID()}.${ext}`;
      const {error:uploadError}=await db.storage.from("produtos").upload(path,file,{upsert:false,contentType:file.type});
      if(uploadError)throw uploadError;
      imageUrl=db.storage.from("produtos").getPublicUrl(path).data.publicUrl;
    }
    const payload={name:$("productName").value.trim(),description:$("productDescription").value.trim(),price:Number($("productPrice").value),category_id:$("productCategory").value,label:$("productLabel").value.trim()||null,image_url:imageUrl||null,active:$("productActive").checked};
    const id=$("productId").value;
    const result=id?await db.from("products").update(payload).eq("id",id):await db.from("products").insert(payload);
    if(result.error)throw result.error;
    $("productModal").hidden=true;await loadData();
  }catch(error){message("productMessage",error.message||"Erro ao salvar produto.");}
  finally{button.disabled=false;}
});
checkSession();
