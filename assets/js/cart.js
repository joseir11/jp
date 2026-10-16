window.Cart=(()=>{
  let items=[];
  function add(productId){
    const product=window.MENU.find(p=>String(p.id)===String(productId));if(!product)return;
    const existing=items.find(item=>String(item.id)===String(productId));
    if(existing)existing.quantity++;else items.push({...product,quantity:1});
    return items;
  }
  function changeQuantity(productId,amount){
    const item=items.find(p=>String(p.id)===String(productId));if(!item)return;
    item.quantity+=amount;if(item.quantity<=0)items=items.filter(p=>String(p.id)!==String(productId));return items;
  }
  const getItems=()=>items;
  const getCount=()=>items.reduce((total,item)=>total+item.quantity,0);
  const getTotal=()=>items.reduce((total,item)=>total+item.price*item.quantity,0);
  function clear(){items=[];}
  return {add,changeQuantity,getItems,getCount,getTotal,clear};
})();