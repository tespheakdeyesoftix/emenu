
import { getApi } from "@/services/api-service";

import { onMounted, ref } from "vue";
import {getItem} from "@/services/storage-service.ts"
const currentProperty = ref({ property_name: "" })

const setting = ref()
const metas = ref<any[]>([])

const currentLanguage = ref("kh")
const languages = [
  {
    lang: "en",
    icon: "/assets/en.svg",
    label: "English"
  },

  {
    lang: "kh",
    icon: "/assets/kh.svg",
    label: "ភាសារខ្មែរ"
  }
]


const saleScreenSetting = ref({
  product_text_color: "red",
  product_font_size:14,
  product_width_count:2,
  width_panel_sale:300,
  img_height:70 , 
  product_price_color: "red",
  product_price_size:14,
  show_hide_product_code:true,
  
})




async function getSetting() {

  
}

async function getMeta(doctype: string) {

  const existingDoctype = metas.value.find(r => r.name == doctype);

  if (existingDoctype) {

    return existingDoctype
  }

  const response = await getApi("ice_factory_management_system.api.utils.get_meta", {
    doctype: doctype
  });

  if (response.data) {
    metas.value.push(response.data);
    return response.data;
  }


}


async function getDoctypeDefaultFields(docType: string) {
  let fields = ["name"]
  const meta = await getMeta(docType)
  if (meta.image_field) {
    fields.push(meta.image_field)
  }

  if (meta.title_field) {
    fields.push(meta.title_field)
  }

  if (meta.search_fields) {
    fields = [...fields, ...meta.search_fields.split(",").map((item: string) => item.trim())];
  }

  return [...new Set(fields)];

}


export function useApp() {


  onMounted(async () => {

    currentLanguage.value = getItem("lang") || "en";

  })

  return {
    languages,
    currentProperty,
    currentLanguage,
    setting,
    saleScreenSetting,
    getMeta,
    getDoctypeDefaultFields,
    getSetting
  };
}
