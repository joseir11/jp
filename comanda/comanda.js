(() => {
  const db = window.supabaseClient;
  const $ = id => document.getElementById(id);
  const money = value => Number(value || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  const safe = value => String(value ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const STORAGE_KEY = "jp_house_current_comanda";
  let comandaId = sessionStorage.getItem(STORAGE_KEY);
  let comanda = null;
  let categories = [];
  let products = [];
  let activeCategory = "todos";
  let draft = new Map();
  let channel = null;
  let busy = false;

  function message(id,text,error=true){$(id).textContent=text;$(id).style.color=error?"#f2a17b":"#8ac99b";}
  function showOpen(){ $("openScreen").hidden=false; $("comandaScreen").hidden=true; refreshOpenComandas(); }
  function showComanda(){ $("openScreen").hidden=true; $("comandaScreen").hidden=false; }

  async function refreshOpenComandas(){
    const host=$("openComandasList");
    if(!host)return;
    host.innerHTML='<p class="empty">Carregando comandas abertas...</p>';
    const {data,error}=await db.rpc("list_open_comandas");
    if(error){host.innerHTML='<p class="empty">Não foi possível carregar as comandas.</p>';return;}
    const rows=data||[];
    host.innerHTML=rows.length?rows.map(c=>'<article class="open-comanda-row"><button class="open-comanda-select" type="button" data-open-comanda="'+c.id+'"><span><b>COMANDA #'+String(c.comanda_number).padStart(3,"0")+'</b><small>'+safe(c.customer_name)+'</small></span><strong>'+money(c.total)+'</strong></button><button class="delete-comanda" type="button" data-delete-comanda="'+c.id+'" aria-label="Excluir comanda">EXCLUIR</button></article>').join(""):'<p class="empty">Nenhuma comanda aberta no momento.</p>';
  }

  async function selectComanda(id){
    if(channel)db.removeChannel(channel);
    comandaId=id;sessionStorage.setItem(STORAGE_KEY,id);draft.clear();renderDraft();
    await loadComanda();subscribe();
  }

  async function openComanda(name){
    message("openMessage","Abrindo comanda...",false);
    const {data,error}=await db.rpc("open_comanda_public",{p_customer_name:name.trim()});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    if(!row?.comanda_id)throw new Error("Não foi possível criar a comanda.");
    comandaId=row.comanda_id;
    sessionStorage.setItem(STORAGE_KEY,comandaId);
    await loadComanda();
    subscribe();
  }

  async function loadCatalog(){
    const [catRes,prodRes]=await Promise.all([
      db.from("categories").select("id,name,slug,position,active").eq("active",true).order("position"),
      db.from("products").select("id,name,description,price,image_url,category_id,active,position").eq("active",true).order("position").order("created_at",{ascending:false})
    ]);
    if(catRes.error)throw catRes.error;
    if(prodRes.error)throw prodRes.error;
    categories=catRes.data||[];
    products=prodRes.data||[];
    renderFilters();
    renderProducts();
  }

  function renderFilters(){
    const all=[{slug:"todos",name:"TODOS"},...categories];
    $("categoryFilters").innerHTML=all.map(c=>'<button class="filter '+(activeCategory===c.slug?"active":"")+'" data-filter="'+safe(c.slug)+'">'+safe(c.name)+'</button>').join("");
  }
  function renderProducts(){
    const list=products.filter(p=>activeCategory==="todos"||categories.find(c=>c.id===p.category_id)?.slug===activeCategory);
    $("productCount").textContent=list.length+" produtos";
    $("productList").innerHTML=list.length?list.map(p=>'<article class="product-card">'+
      (p.image_url?'<img src="'+safe(p.image_url)+'" alt="">':'<div class="product-placeholder">JP</div>')+
      '<div class="product-info"><strong>'+safe(p.name)+'</strong><small>'+money(p.price)+'</small><button class="add-button" type="button" data-add="'+p.id+'">+ ADICIONAR</button></div></article>'
    ).join(""):'<p class="empty">Nenhum produto disponível nesta categoria.</p>';
  }

  function renderDraft(){
    const items=[...draft.values()];
    $("draftCount").textContent=String(items.reduce((sum,item)=>sum+item.quantity,0));
    $("draftList").innerHTML=items.length?items.map(item=>'<div class="draft-row"><div><div class="draft-name">'+safe(item.name)+'</div><div class="draft-price">'+money(item.price)+' cada · '+money(item.price*item.quantity)+'</div></div><div class="qty-controls"><button type="button" data-dec="'+item.id+'" aria-label="Diminuir">−</button><b>'+item.quantity+'</b><button type="button" data-inc="'+item.id+'" aria-label="Aumentar">+</button><button class="remove" type="button" data-remove="'+item.id+'" aria-label="Excluir">×</button></div></div>').join(""):'<p class="empty">Selecione produtos no cardápio.</p>';
    const total=items.reduce((sum,item)=>sum+item.price*item.quantity,0);
    $("draftTotal").textContent=money(total);
    $("sendOrderButton").disabled=!items.length||busy;
  }

  function renderComanda(){
    if(!comanda)return;
    $("comandaTitle").innerHTML='COMANDA <span>#'+String(comanda.comanda_number).padStart(3,"0")+'</span>';
    $("customerLabel").textContent=comanda.customer_name;
    $("grandTotal").textContent=money(comanda.total);
    const orders=Array.isArray(comanda.orders)?comanda.orders:[];
    $("orderCount").textContent=orders.length+" pedido(s)";
    $("ordersList").innerHTML=orders.length?orders.map(order=>'<article class="order-history"><div class="order-history-head"><span>PEDIDO #'+String(order.order_number).padStart(3,"0")+'</span><strong>'+money(order.total)+'</strong></div><small>'+new Date(order.created_at).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})+'</small>'+
      (order.items||[]).map(item=>'<div class="order-history-line"><span>'+safe(item.product_name)+'</span><div class="saved-item-controls"><button type="button" data-item-dec="'+item.item_id+'" data-qty="'+item.quantity+'" aria-label="Diminuir">−</button><b>'+Number(item.quantity)+'×</b><button type="button" data-item-inc="'+item.item_id+'" data-qty="'+item.quantity+'" aria-label="Aumentar">+</button><strong>'+money(item.subtotal)+'</strong><button type="button" class="saved-item-remove" data-item-delete="'+item.item_id+'" aria-label="Excluir item">×</button></div></div>').join("")+
      (order.notes?'<small>OBS.: '+safe(order.notes)+'</small>':"")+'</article>').join(""):'<p class="empty">Nenhum pedido lançado.</p>';
    const closed=comanda.status!=="ABERTA";
    $("closedNotice").hidden=!closed;
    $("closeComandaButton").disabled=closed;
    $("closeComandaButton").textContent=closed?"COMANDA FECHADA":"FECHAR COMANDA";
    $("sendOrderButton").disabled=closed||draft.size===0||busy;
    document.querySelectorAll(".catalog button,.draft-card button,.draft-card textarea").forEach(el=>{if(el.id!=="newComandaButton")el.disabled=closed;});
  }

  async function loadComanda(){
    const {data,error}=await db.rpc("get_comanda_details_by_id",{p_comanda_id:comandaId});
    if(error)throw error;
    if(!data)throw new Error("Comanda não encontrada.");
    comanda=data;
    showComanda();
    renderComanda();
  }

  function subscribe(){
    if(channel)db.removeChannel(channel);
    channel=db.channel("jp-comanda-"+comandaId)
      .on("postgres_changes",{event:"*",schema:"public",table:"orders",filter:"comanda_id=eq."+comandaId},()=>loadComanda())
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"comandas",filter:"id=eq."+comandaId},()=>loadComanda())
      .subscribe();
  }

  $("refreshComandasButton").addEventListener("click",refreshOpenComandas);

  $("openForm").addEventListener("submit",async event=>{
    event.preventDefault();
    const button=event.submitter;
    button.disabled=true;
    try{await openComanda($("customerName").value);message("openMessage","Comanda aberta!",false);}
    catch(error){message("openMessage",error.message||"Erro ao abrir comanda.");}
    finally{button.disabled=false;}
  });

  $("openComandasList").addEventListener("click",async event=>{
    const openBtn=event.target.closest("[data-open-comanda]");
    const delBtn=event.target.closest("[data-delete-comanda]");
    if(openBtn){try{await selectComanda(openBtn.dataset.openComanda);}catch(error){alert(error.message||"Não foi possível abrir a comanda.");}return;}
    if(delBtn){
      if(!confirm("Excluir definitivamente esta comanda aberta e todos os pedidos e itens vinculados? Esta ação não poderá ser desfeita."))return;
      delBtn.disabled=true;
      const {error}=await db.rpc("delete_open_comanda",{p_comanda_id:delBtn.dataset.deleteComanda});
      if(error){alert(error.message||"Não foi possível excluir a comanda.");delBtn.disabled=false;return;}
      if(comandaId===delBtn.dataset.deleteComanda){sessionStorage.removeItem(STORAGE_KEY);comandaId=null;comanda=null;draft.clear();if(channel)db.removeChannel(channel);}
      refreshOpenComandas();
    }
  });

  $("ordersList").addEventListener("click",async event=>{
    const btn=event.target.closest("[data-item-inc],[data-item-dec],[data-item-delete]");
    if(!btn||comanda?.status!=="ABERTA")return;
    const itemId=btn.dataset.itemInc||btn.dataset.itemDec||btn.dataset.itemDelete;
    const current=Number(btn.dataset.qty||0);
    let rpc,args;
    if(btn.dataset.itemDelete!==undefined){rpc="delete_comanda_item";args={p_item_id:itemId};}
    else {const qty=current+(btn.dataset.itemInc!==undefined?1:-1);if(qty<1){rpc="delete_comanda_item";args={p_item_id:itemId};}else{rpc="update_comanda_item_quantity";args={p_item_id:itemId,p_quantity:qty};}}
    btn.disabled=true;
    const {error}=await db.rpc(rpc,args);
    if(error){alert(error.message||"Não foi possível atualizar o item.");btn.disabled=false;return;}
    await loadComanda();refreshOpenComandas();
  });

  $("categoryFilters").addEventListener("click",event=>{
    const button=event.target.closest("[data-filter]");
    if(!button)return;
    activeCategory=button.dataset.filter;
    renderFilters();renderProducts();
  });
  $("productList").addEventListener("click",event=>{
    const button=event.target.closest("[data-add]");
    if(!button)return;
    const p=products.find(item=>item.id===button.dataset.add);
    if(!p)return;
    const item=draft.get(p.id)||{id:p.id,name:p.name,price:Number(p.price),quantity:0};
    if(item.quantity>=50)return;
    item.quantity++;
    draft.set(p.id,item);
    renderDraft();
  });
  $("draftList").addEventListener("click",event=>{
    const button=event.target.closest("button");
    if(!button)return;
    const id=button.dataset.inc||button.dataset.dec||button.dataset.remove;
    const item=draft.get(id);
    if(!item)return;
    if(button.dataset.remove!==undefined||button.dataset.dec!==undefined&&item.quantity===1)draft.delete(id);
    else if(button.dataset.inc!==undefined&&item.quantity<50)item.quantity++;
    else if(button.dataset.dec!==undefined)item.quantity--;
    renderDraft();
  });

  $("sendOrderButton").addEventListener("click",async()=>{
    if(busy||!draft.size||comanda?.status!=="ABERTA")return;
    busy=true;renderDraft();message("draftMessage","Registrando pedido...",false);
    const items=[...draft.values()].map(item=>({product_id:item.id,quantity:item.quantity}));
    try{
      const {error}=await db.rpc("submit_order_to_comanda_by_id",{
        p_comanda_id:comandaId,p_items:items,p_note:$("orderNote").value.trim()||null
      });
      if(error)throw error;
      draft.clear();$("orderNote").value="";
      await loadComanda();
      refreshOpenComandas();
      message("draftMessage","Pedido adicionado à comanda.",false);
    }catch(error){message("draftMessage",error.message||"Não foi possível registrar o pedido.");}
    finally{busy=false;renderDraft();renderComanda();}
  });

  $("closeComandaButton").addEventListener("click",async()=>{
    if(!comandaId||comanda?.status!=="ABERTA")return;
    if(!confirm("Deseja realmente fechar esta comanda? Depois disso, não será possível adicionar novos pedidos."))return;
    const button=$("closeComandaButton");button.disabled=true;
    try{
      const {error}=await db.rpc("close_comanda_public",{p_comanda_id:comandaId});
      if(error)throw error;
      await loadComanda();
      refreshOpenComandas();
    }catch(error){alert(error.message||"Não foi possível fechar a comanda.");button.disabled=false;}
  });

  $("newComandaButton").addEventListener("click",()=>{
    if(comanda?.status==="ABERTA"&&!confirm("Esta comanda ainda está aberta. Deseja sair e abrir outra?"))return;
    if(channel)db.removeChannel(channel);
    sessionStorage.removeItem(STORAGE_KEY);
    comandaId=null;comanda=null;draft.clear();$("openForm").reset();$("orderNote").value="";
    showOpen();
  });

  async function init(){
    try{await loadCatalog();}
    catch(error){console.error(error);$("productList").innerHTML='<p class="empty">Não foi possível carregar os produtos. Verifique a conexão.</p>';}
    if(comandaId){
      try{await loadComanda();subscribe();}
      catch(error){console.warn(error);sessionStorage.removeItem(STORAGE_KEY);comandaId=null;showOpen();}
    }else showOpen();
    renderDraft();
  }
  init();
})();