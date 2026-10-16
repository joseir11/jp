window.Checkout = (() => {
  const overlay = document.getElementById("checkoutOverlay");
  const form = document.getElementById("checkoutForm");
  const feedback = document.getElementById("orderFeedback");
  const submitButton = form.querySelector('button[type="submit"]');
  const originalButtonHTML = submitButton.innerHTML;

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[char]));
  }

  function open() {
    feedback.style.display = "none";
    feedback.innerHTML = "";
    overlay.classList.add("show");
    document.getElementById("customerName").focus();
  }

  function close() {
    overlay.classList.remove("show");
  }

  function refreshCartAfterOrder() {
    const cartItems = document.getElementById("cartItems");
    const cartCount = document.getElementById("cartCount");
    const cartTotal = document.getElementById("cartTotal");
    const floatingCart = document.getElementById("floatingCart");
    const floatingCartCount = document.getElementById("floatingCartCount");
    const floatingCartTotal = document.getElementById("floatingCartTotal");

    cartCount.textContent = "0";
    cartTotal.textContent = "R$ 0,00";
    floatingCartCount.textContent = "0 itens";
    floatingCartTotal.textContent = "R$ 0,00";
    floatingCart.hidden = true;
    document.getElementById("checkoutButton").disabled = true;
    cartItems.innerHTML = '<div class="empty-cart"><span class="empty-bag">▢</span><p>Sua sacola está vazia.</p><small>Adicione seus favoritos para começar.</small></div>';
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const name = document.getElementById("customerName").value.trim();
    const note = document.getElementById("orderNote").value.trim();
    const items = window.Cart.getItems();

    if (!name || !items.length) return;

    submitButton.disabled = true;
    submitButton.textContent = "ENVIANDO PEDIDO...";
    feedback.style.display = "none";
    feedback.innerHTML = "";

    try {
      const payload = items.map(item => ({
        product_id: item.id,
        quantity: item.quantity
      }));

      const { data: orderId, error } = await window.supabaseClient.rpc("submit_order", {
        p_customer_name: name,
        p_items: payload,
        p_note: note || null
      });

      if (error) throw error;

      window.Cart.clear();
      refreshCartAfterOrder();

      feedback.innerHTML = `
        <strong>PEDIDO RECEBIDO!</strong><br>
        Obrigado, ${escapeHTML(name)}!<br><br>
        Seu pedido foi registrado com sucesso.<br>
        <small>Número do pedido: ${escapeHTML(orderId)}</small><br><br>
        Em breve entraremos em contato para confirmar.
      `;
      feedback.style.display = "block";
      form.reset();
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
