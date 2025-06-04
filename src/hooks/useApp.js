

import {  ref } from "vue";
 
const products = ref([])
const emenu = ref()


const setting = ref()

async function getMenu(){
  
  const res = await app.getDoc("eMenu",app.route.query.menu)
  
  if(res){
    emenu.value = res.data
  }

}

async function getProducts(){
 
  const res = await app.getDocList("Temp Product Menu",{
    fields:["name","product_code","product_name_en","pos_menu"],//add more field here
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
    getProducts,
    getMenu
  };
}
