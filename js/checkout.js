
window.Checkout = (() => {
  const overlay = document.getElementById("checkoutOverlay");
  const form = document.getElementById("checkoutForm");
  const feedback = document.getElementById("orderFeedback");

  function open() {
    feedback.style.display = "none";
    overlay.classList.add("show");
    document.getElementById("customerName").focus();
  }

  function close() {
    overlay.classList.remove("show");
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const name = document.getElementById("customerName").value.trim();
    const note = document.getElementById("orderNote").value.trim();

    if (!name) return;

    feedback.innerHTML = `
      <strong>PRÓXIMA ETAPA!</strong><br>
      Olá, ${name.replace(/[&<>"']/g, "")}!<br><br>
      Sua identificação foi preenchida corretamente.
      O envio real dos pedidos será habilitado
      quando conectarmos o sistema ao banco de dados
      e ao WhatsApp.
    `;

    feedback.style.display = "block";

    console.log("Cliente:", name);
    console.log("Observações:", note);
    console.log("Itens:", window.Cart.getItems());
    console.log("Total:", window.Cart.getTotal());
  });

  return {
    open,
    close
  };
})();
