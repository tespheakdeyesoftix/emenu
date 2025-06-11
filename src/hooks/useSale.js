import { ref, watch } from "vue"

import { useApp } from "@/hooks/useApp.js"

let printService = null
const socket =ref(null) 



const { emenu } = useApp();

const saleDoc = ref()
const orderDoc = ref({
   order_products: []
})



watch(() => orderDoc.value, async (newVal, oldVal) => {
   if (orderDoc.value.order_products.length > 0) {
      await app.storageService.setItem("order", JSON.stringify(orderDoc.value))
   } else {
      await app.storageService.removeItem("order")
   }

}, { deep: true })



initOrder();


async function initOrder() {
   const order = await app.storageService.getItem("order");
   if (order) {
      orderDoc.value = JSON.parse(order);
   }
   else {
      orderDoc.value = {
         pos_profile: app.pos_profile,
         session_id: app.session_id,
         table_id: app.table_id,
         order_products: []
      }
   }
}

async function addOrderProduct(data) {
   // let validate  = await validateAddProduct(data)
   // validate =  await Promise.allSettled(validate)
   // if(validate.length>0 && validate.filter(x=>x.status=="rejected").length>0){
   //    app.showWarning(validate.filter(x=>x.status=="rejected")[0].reason)
   //    return
   // }


   const canAdd = await validateAddProduct(data);

   if(!canAdd) return ;


   let sp = {
      product_code: data.product_code,
      product_name: data.product_name_en,
      quantity: data.quantity,
      portion: app.sale.getPortion(data?.portions),
      modifiers: app.sale.getModifiers(data?.modifiers),
      modifiers_data: app.sale.getModifierData(data?.modifiers),
      price: app.sale.getPrice(data) || 0,
      modifier_price: app.sale.getModifierPrice(data.modifiers) || 0,
      note: data.note || "",
      photo: data.photo

   }

   // check exists with product_code, portion, and modifier
   const exist_order_product = orderDoc.value.order_products.find(r => r.product_code == sp.product_code && r.portion == sp.portion && r.modifiers == sp.modifiers);
   if (exist_order_product) {
      sp = exist_order_product;
      sp.quantity = sp.quantity + data.quantity;

   } else {
      orderDoc.value.order_products.push(sp)
   }

   sp.sub_total = (sp.quantity * sp.price) + (sp.quantity * sp.modifier_price)
   // discount in future update

   // tax in future update

   sp.total_amount = (sp.quantity * sp.price) + (sp.quantity * sp.modifier_price)

   updateSaleAmount();

   app.showSuccessMessage(app.t("Add order successfully"));

}

async function validateAddProduct(data) {
  // Portion validation
  if (data.portions && data.portions !== "") {
    const selectedPortions = data.portions.filter(x => x.selected);
    if (selectedPortions.length === 0) {
      app.showWarning(app.t("Please select portion"));
      return false;
    }
  }

  // Modifier validation
  if (data.modifiers) {
    for (const c of data.modifiers.filter(x => x.is_required == 1)) {
      const selectedModifiers = c.items.filter(m => m.selected);
      if (selectedModifiers.length === 0) {
        app.showWarning(app.t("Please select modifier for ") + c.category);
        return false;
      }
    }
  }

  return true;
}

 


function onRemoveProduct(index) {
   orderDoc.value.order_products.splice(index, 1);
   updateSaleAmount();
}



function updateSaleAmount() {

   const total_amount = orderDoc.value.order_products.reduce((sum, product) => sum + product.total_amount, 0);
   orderDoc.value.total_amount = total_amount || 0



}



async function onSubmitOrder() {


   if (orderDoc.value.order_products.length == 0) {
      app.showWarning(app.t("Please select product to your order"))
      return
   }

   if (app.setting.currentLocation == null) {
      app.utils.onWarningMessage(app.t("Location"), app.t("You are not allow app to use your current location. Please shop assistant to assist your problem."))
      return
   }


   if (!app.utils.isWithinRange(
      app.setting.currentLocation,
      app.setting.predefineLocation,
      app.setting.emenu.online_order_range
   )) {
      app.showWarningMessage("Your location", "You cannot submit your order. Your location is too far from the shop location.")
      return
   }
   const confirm = await app.onConfirm("Submit Order", "Are you sure you want to submit your order?")
   if (!confirm) return;

   const l = await app.showLoading();
   const res = await app.createDoc("Online Order", orderDoc.value)
   if (res.data) {

      printToKitchen(res.data.name)
      await app.storageService.removeItem("order");

      await l.dismiss();
      app.ionRouter.navigate('/order-success', 'forward', 'replace');
      setTimeout(function () {
         initOrder();
      }, 500)

   }

   await l.dismiss();



}



async function printToKitchen(docname) {
    
 
     socket.value.emit("OnPrintReport", {order_number:docname});
     
   // const result = await app.postApi("epos_restaurant_2023.api.printing.get_mobile_order_to_kitchen_pdf", {
   //    pdf: 0,
   //    doc_name: docname
   // })

   // if (result.data) {
   //    result.data.forEach(x => {
   //       app.printService.submit({
   //          'type': x[0],//printer name
   //          'url': 'file.pdf',
   //          'file_content': x[1] //base 64 pdf
   //       });
   //    }
   //    )

   // }
}






export function useSale() {
   return {
      saleDoc,
      orderDoc,
      socket,
      addOrderProduct,
      onSubmitOrder,
      onRemoveProduct,
      printToKitchen
   };
}
