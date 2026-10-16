window.Checkout = (() => {
  const overlay = document.getElementById("checkoutOverlay");
  const form = document.getElementById("checkoutForm");
  const feedback = document.getElementById("orderFeedback");
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonHTML = submitButton.innerHTML;
  const nameInput = document.getElementById("customerName");
  const noteInput = document.getElementById("orderNote");
  const comandaInfo = document.getElementById("comandaInfo");
  const COMANDA_STORAGE_KEY = "jp_burguer_comanda_token";

  let currentComanda = null;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function setComandaUI(comanda) {
    currentComanda = comanda;
    if (comanda) {
      nameInput.value = comanda.customer_name || "";
      nameInput.readOnly = true;
      comandaInfo.textContent = "Você está na comanda #" + String(comanda.comanda_number).padStart(3, "0") + ". Novos pedidos serão adicionados a ela.";
      comandaInfo.hidden = false;
    } else {
      nameInput.readOnly = false;
      comandaInfo.textContent = "";
      comandaInfo.hidden = true;
    }
  }

  async function loadCurrentComanda() {
    const token = localStorage.getItem(COMANDA_STORAGE_KEY);
    if (!token) {
      setComandaUI(null);
      return;
    }

    const { data, error } = await window.supabaseClient.rpc("get_comanda", {
      p_access_token: token
    });

    if (error) {
      console.error("Não foi possível consultar a comanda:", error);
      comandaInfo.textContent = "Não foi possível verificar sua comanda. Confira sua conexão e tente novamente.";
      comandaInfo.hidden = false;
      return;
    }

    const comanda = Array.isArray(data) ? data[0] : data;
    if (!comanda || comanda.status !== "ABERTA") {
      localStorage.removeItem(COMANDA_STORAGE_KEY);
      setComandaUI(null);
      return;
    }

    setComandaUI(comanda);
  }

  async function open() {
    feedback.style.display = "none";
    feedback.innerHTML = "";
    await loadCurrentComanda();
    overlay.classList.add("show");
    if (!nameInput.readOnly) nameInput.focus();
  }

  function close() {
    overlay.classList.remove("show");
  }

  function refreshCartAfterOrder() {
    document.getElementById("cartCount").textContent = "0";
    document.getElementById("cartTotal").textContent = "R$ 0,00";
    document.getElementById("floatingCartCount").textContent = "0 itens";
    document.getElementById("floatingCartTotal").textContent = "R$ 0,00";
    document.getElementById("floatingCart").hidden = true;
    document.getElementById("checkoutButton").disabled = true;
    document.getElementById("cartItems").innerHTML = '<div class="empty-cart"><span class="empty-bag">▢</span><p>Sua sacola está vazia.</p><small>Adicione seus favoritos para começar.</small></div>';
  }

  async function ensureComanda(customerName) {
    const token = localStorage.getItem(COMANDA_STORAGE_KEY);
    if (token) {
      const { data, error } = await window.supabaseClient.rpc("get_comanda", {
        p_access_token: token
      });
      if (error) throw error;

      const existing = Array.isArray(data) ? data[0] : data;
      if (existing && existing.status === "ABERTA") {
        setComandaUI(existing);
        return token;
      }

      localStorage.removeItem(COMANDA_STORAGE_KEY);
    }

    const { data, error } = await window.supabaseClient.rpc("open_comanda", {
      p_customer_name: customerName
    });
    if (error) throw error;

    const created = Array.isArray(data) ? data[0] : data;
    if (!created?.access_token) throw new Error("Não foi possível abrir sua comanda.");

    localStorage.setItem(COMANDA_STORAGE_KEY, created.access_token);
    setComandaUI({
      comanda_number: created.comanda_number,
      customer_name: customerName,
      status: "ABERTA"
    });
    return created.access_token;
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const name = nameInput.value.trim();
    const note = noteInput.value.trim();
    const items = window.Cart.getItems();
    if (!name || !items.length) return;

    submitButton.disabled = true;
    submitButton.textContent = "ENVIANDO PEDIDO...";
    feedback.style.display = "none";
    feedback.innerHTML = "";

    try {
      const accessToken = await ensureComanda(name);
      const payload = items.map(item => ({
        product_id: item.id,
        quantity: item.quantity
      }));

      const { data: orderId, error } = await window.supabaseClient.rpc("submit_order_to_comanda", {
        p_access_token: accessToken,
        p_items: payload,
        p_note: note || null
      });
      if (error) throw error;

      const [{ data: orderNumber, error: numberError }, { data: comandaData, error: comandaError }] = await Promise.all([
        window.supabaseClient.rpc("get_order_number", { p_order_id: orderId }),
        window.supabaseClient.rpc("get_comanda", { p_access_token: accessToken })
      ]);

      const displayOrderNumber = numberError ? null : orderNumber;
      const latestComanda = !comandaError && Array.isArray(comandaData) ? comandaData[0] : null;
      if (latestComanda) setComandaUI(latestComanda);

      window.Cart.clear();
      refreshCartAfterOrder();

      feedback.innerHTML = `
        <strong>PEDIDO RECEBIDO!</strong><br>
        Obrigado, ${escapeHTML(name)}!<br><br>
        Comanda: <strong>#${String(currentComanda?.comanda_number || "").padStart(3, "0")}</strong><br>
        Pedido: <strong>#${displayOrderNumber === null ? "confirmado" : String(displayOrderNumber).padStart(3, "0")}</strong><br>
        <small>Total parcial da comanda: ${Number(currentComanda?.total || 0).toLocaleString("pt-BR", {style:"currency",currency:"BRL"})}</small><br><br>
        Aguarde seu pedido.
      `;
      feedback.style.display = "block";
      noteInput.value = "";
    } catch (error) {
      console.error("Erro ao enviar pedido:", error);
      feedback.innerHTML = `
        <strong>NÃO FOI POSSÍVEL ENVIAR.</strong><br>
        ${escapeHTML(error.message || "Ocorreu um erro ao registrar seu pedido.")}<br><br>
        Confira sua conexão e tente novamente.
      `;
      feedback.style.display = "block";
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalButtonHTML;
    }
  });

  return { open, close };
})();
