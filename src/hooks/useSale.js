import {ref} from "vue"
const saleDoc = ref()
const  orderDoc = ref({
   order_products:[]
})

function addOrderProduct(data){
   const canAdd = validateAddProduct(data)
   if(!canAdd) return ;

   const sp = {
      product_code:data.product_code,
      product_name:data.product_name_en,
      quantity:data.quantity,
      portion:app.sale.getPortion(data?.portions),
      modifiers:app.sale.getModifiers(data?.modifiers),
      modifiers_data:app.sale.getModifierData(data?.modifiers),
      price:app.sale.getPrice(data),
      modifier_price:app.sale.getModifierPrice(data.modifiers),
      note:data.note || ""

   }
   sp.sub_total = (sp.quanitty * sp.price) + (sp.quanitty * sp.modifier_price)
   // discount in future update

   // tax in future update

   sp.total_amount = (sp.quanitty * sp.price) + (sp.quanitty * sp.modifier_price)


   orderDoc.value.order_products.push(sp)

   app.showSuccess(app.t("Add successfully"));

}

function validateAddProduct(data){

   if(data.portions && data.portions!=""){
      
      if(!data.portions.find(x=>x.selected)) {
         app.showWarning(app.t("Please select portion"))
         return false
      }
   }
   
   if(data.modifiers){
      data.modifiers.filter(x=>x.is_required ==1).forEach(c => {
         if(!c.items.find(m=>m.selected)){
            app.showWarning(app.t("Please select modifer for ") + c.category)
         }
      });
   }
   return true;

}


async function onSubmitOrder(){
   
   if (orderDoc.value.order_products.length==0){
      app.showWarning(app.t("Please select product to your order"))
      return
   }

   const confirm = await app.onConfirm("Submit Order","Are you sure you want to submit your order?")
   if(!confirm) return;

   const l = await app.showLoading();
   const res = await app.createDoc("Online Order",orderDoc.value)
   if(res.data){
      printToKitchen()
      await l.dismiss();
      app.ionRouter.navigate('/order-success', 'forward', 'replace');
   }
  
   await l.dismiss();

} 

function printToKitchen(){
   alert("print to keitchen")
}

export function useSale() {
    return {
       saleDoc,
       orderDoc,
       addOrderProduct,
       onSubmitOrder
    };
  }
  