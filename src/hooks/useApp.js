

import {  ref } from "vue";
const canShowApp = ref(false)
const isSessionExpired = ref(false)
const isAppLoadReady = ref(false)

const products = ref([])
const emenu = ref()


const setting = ref()

async function getMenu(){
  
  const res = await app.getDoc("eMenu",app.emenu)
  
  if(res){
    emenu.value = res.data
  }

}

async function getProducts(){
 
  const res = await app.getDocList("Temp Product Menu",{
    fields:["name","product_code","product_name_en","pos_menu","photo"],//add more field here
    filters:[["pos_menu","in",emenu.value.pos_menu_selections?.map(x=>x.menu)]],
    limit:10000
  })
  if(res){
    products.value = res.data
  }

}


export function useApp() {


  return {
    products,
    emenu,
    canShowApp,
    isSessionExpired,
    isAppLoadReady,
    getProducts,
    getMenu
  };
}
