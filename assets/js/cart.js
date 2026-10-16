
window.Cart = (() => {
  let items = [];

  function add(productId) {
    const product = window.MENU.find(p => p.id === productId);
    if (!product) return;

    const existing = items.find(item => item.id === productId);

    if (existing) {
      existing.quantity++;
    } else {
      items.push({
        ...product,
        quantity: 1
      });
    }

    return items;
  }

  function changeQuantity(productId, amount) {
    const item = items.find(p => p.id === productId);
    if (!item) return;

    item.quantity += amount;

    if (item.quantity <= 0) {
      items = items.filter(p => p.id !== productId);
    }

    return items;
  }

  function getItems() {
    return items;
  }

  function getCount() {
    return items.reduce((total, item) => total + item.quantity, 0);
  }

  function getTotal() {
    return items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );
  }

  function clear() {
    items = [];
  }

  return {
    add,
    changeQuantity,
    getItems,
    getCount,
    getTotal,
    clear
  };
})();
