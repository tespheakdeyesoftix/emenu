import { ref } from "vue"
import WebSocketPrinter from "@/helpers/websocket-printer.js"
import {useApp} from "@/hooks/useApp.js"
const {emenu} = useApp();

const saleDoc = ref()
const orderDoc = ref({
   order_products: []
})

const printService = new WebSocketPrinter();


initOrder();


function initOrder() {
   orderDoc.value = {
      pos_profile: app.pos_profile,
      session_id: app.session_id,
      table_id: app.table_id,
      order_products: []
   }
}

function addOrderProduct(data) {
   const canAdd = validateAddProduct(data)
   if (!canAdd) return;

   const sp = {
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
   sp.sub_total = (sp.quantity * sp.price) + (sp.quantity * sp.modifier_price)
   // discount in future update

   // tax in future update

   sp.total_amount = (sp.quantity * sp.price) + (sp.quantity * sp.modifier_price)


   orderDoc.value.order_products.push(sp)


   updateSaleAmount();

   app.showSuccessMessage(app.t("Add order successfully"));

}

function validateAddProduct(data) {

   if (data.portions && data.portions != "") {

      if (!data.portions.find(x => x.selected)) {
         app.showWarning(app.t("Please select portion"))
         return false
      }
   }

   if (data.modifiers) {
      data.modifiers.filter(x => x.is_required == 1).forEach(c => {
         if (!c.items.find(m => m.selected)) {
            app.showWarning(app.t("Please select modifer for ") + c.category)
         }
      });
   }
   return true;

}


function onRemoveProduct(index) {
   orderDoc.value.order_products.splice(index, 1);
updateSaleAmount();
}



function updateSaleAmount(){
  
  const total_amount = orderDoc.value.order_products.reduce((sum, product) => sum + product.total_amount, 0);
  orderDoc.value.total_amount = total_amount || 0

 
 
}



async function onSubmitOrder() {

   if (orderDoc.value.order_products.length == 0) {
      app.showWarning(app.t("Please select product to your order"))
      return
   }
   navigator.geolocation.getCurrentPosition(
      async (position) => {
        
         if(!app.utils.isWithinRange(
            {lat:position.coords.latitude,long:position.coords.longitude },
            app.predefinePosition,
            emenu.value.online_order_range
         ))
         {
            app.showWarningMessage("Your location","You cannot submit your order. Your location is too far from the shop location.")
            return
         }
         const confirm = await app.onConfirm("Submit Order", "Are you sure you want to submit your order?")
         if (!confirm) return;

         const l = await app.showLoading();
         const res = await app.createDoc("Online Order", orderDoc.value)
         if (res.data) {
            initOrder();
            printToKitchen(res.data.name)
            await l.dismiss();
            app.ionRouter.navigate('/order-success', 'forward', 'replace');
         }

         await l.dismiss();
      },
      (error) => {
      // ❌ Handle error or denial
      switch (error.code) {
        case error.PERMISSION_DENIED:
          app.showWarningMessage(app.t("You need to allow location access to continue."));
          break;
        case error.POSITION_UNAVAILABLE:
          app.showWarningMessage("Location information is unavailable.");
          break;
        case error.TIMEOUT:
          app.showWarningMessage("The request to get user location timed out.");
          break;
        default:
          app.showWarningMessage("An unknown error occurred.");
          break;
      }
 
    }
  
   )






}



async function printToKitchen(docname) {

   const result = await app.postApi("epos_restaurant_2023.api.printing.get_mobile_order_to_kitchen_pdf", {
      pdf: 0,
      doc_name: docname
   })

   if (result.data) {
      result.data.forEach(x => {
         printService.submit({
            'type': x[0],//printer name
            'url': 'file.pdf',
            'file_content': x[1] //base 64 pdf
         });
      }
      )

   }
}






export function useSale() {
   return {
      saleDoc,
      orderDoc,
      addOrderProduct,
      onSubmitOrder,
      onRemoveProduct,
      printToKitchen
   };
}
