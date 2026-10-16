(() => {
  const TOKEN_KEY = "jp_burguer_comanda_token";
  const overlay = document.getElementById("comandaOverlay");
  const content = document.getElementById("comandaContent");
  const subtitle = document.getElementById("comandaSubtitle");
  const openButton = document.getElementById("openComanda");
  const closeButton = document.getElementById("closeComanda");
  let refreshTimer = null;
  let loading = false;

  const money = value => Number(value || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
  const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
  const dateTime = value => {
    if (!value) return "";
    return new Date(value).toLocaleString("pt-BR", {dateStyle:"short",timeStyle:"short"});
  };
  const statusLabel = value => ({
    NOVO:"Recebido",
    "EM PREPARO":"Em preparo",
    PRONTO:"Pronto",
    ENTREGUE:"Entregue"
  }[value] || value || "Recebido");

  function showMessage(message) {
    content.innerHTML = '<p class="comanda-empty">' + safe(message) + '</p>';
  }

  async function refresh() {
    if (loading || !overlay.classList.contains("show")) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      showMessage("Sua comanda ainda não foi aberta. Faça seu primeiro pedido pelo cardápio e ela aparecerá aqui.");
      subtitle.textContent = "Sua comanda será criada no primeiro pedido.";
      return;
    }

    loading = true;
    try {
      const {data, error} = await window.supabaseClient.rpc("get_comanda_details", {
        p_access_token: token
      });
      if (error) throw error;
      if (!data) {
        localStorage.removeItem(TOKEN_KEY);
        showMessage("Não encontramos sua comanda. Faça um novo pedido para abrir outra.");
        return;
      }

      const orders = Array.isArray(data.orders) ? data.orders : [];
      subtitle.textContent = "Comanda #" + String(data.comanda_number).padStart(3,"0") + " · " + safe(data.customer_name);
      const ordersHTML = orders.length ? orders.map(order => {
        const items = Array.isArray(order.items) ? order.items : [];
        return '<article class="comanda-order">' +
          '<div class="comanda-order-head"><div><strong>Pedido #' + String(order.order_number).padStart(3,"0") + '</strong><small>' + safe(dateTime(order.created_at)) + '</small></div>' +
          '<span class="comanda-order-status">' + safe(statusLabel(order.status)) + '</span></div>' +
          items.map(item => '<div class="comanda-line"><span>' + safe(item.quantity) + 'x ' + safe(item.product_name) + '</span><strong>' + money(item.subtotal) + '</strong></div>').join("") +
          (order.notes ? '<small style="display:block;margin-top:8px;color:#999">Obs.: ' + safe(order.notes) + '</small>' : '') +
          '<div class="comanda-order-total"><span>Total deste pedido</span><strong>' + money(order.total) + '</strong></div></article>';
      }).join("") : '<p class="comanda-empty">Ainda não há pedidos registrados nesta comanda.</p>';

      content.innerHTML =
        '<div class="comanda-summary"><div><small>COMANDA</small><strong>#' + String(data.comanda_number).padStart(3,"0") + '</strong></div>' +
        '<div class="comanda-total"><small>TOTAL ACUMULADO</small><strong>' + money(data.total) + '</strong></div></div>' +
        ordersHTML +
        (data.status === "FECHADA" ? '<div class="comanda-closed">Esta comanda foi fechada. Para fazer novos pedidos, uma nova comanda será aberta automaticamente.</div>' : '');
    } catch (error) {
      console.error("Erro ao consultar comanda:", error);
      showMessage("Não foi possível atualizar sua comanda. Verifique sua conexão e tente novamente.");
    } finally {
      loading = false;
    }
  }

  function open() {
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden","false");
    refresh();
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(refresh, 5000);
  }
  function close() {
    overlay.classList.remove("show");
    overlay.setAttribute("aria-hidden","true");
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = null;
  }

  openButton.addEventListener("click", open);
  closeButton.addEventListener("click", close);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) close();
  });
})();
