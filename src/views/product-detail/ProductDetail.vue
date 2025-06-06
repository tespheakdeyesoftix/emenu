<template>
    <ion-page>
        <ToolBar>
            {{ t("Product Detail") }}
            <template #end>
                <ComOrderCart/>
            </template>
        </ToolBar>
        <ion-content class="ion-padding">
            <template v-if="data ">
                
                <div>
                   <Img class="image-banner-style" :src="data?.photo" /> 
                </div>
                <ion-card style="margin: 0;margin-top: 10px;">
    <ion-card-header>
      <ion-card-title> {{ data.product_code }} - {{ data.product_name_en }}  </ion-card-title>
      <ion-card-subtitle v-if="data.price">{{data.price}}</ion-card-subtitle>
    </ion-card-header>

    <ion-card-content>
      <div v-html="data.description"></div>
 
                <div v-if="data.portions && data.portions.length > 0">
                    <ion-text>
                        <h3>{{ t("Portion") }}</h3>
                    </ion-text>
                    <ion-list>
                        <ion-item button @click="onPortionClick(p)" lines="full" v-for="(p,index) in data.portions" :key="'portion_'+index">
                            <ion-icon slot="start" :color="p.selected?'success':''" :icon="checkmarkCircleOutline" class="ion-no-margin" style="margin-right:10px ;"></ion-icon>
                            <ion-label>
                                {{ p.portion  }} 
                            </ion-label>
                            <ion-label slot="end" color="danger">
                              {{ p.price }}</ion-label>
                        </ion-item>
                    </ion-list>
                </div>
<!--  modifier -->
                <div v-if="data.modifiers">
                    <ion-list>
                        <template v-for="(c,cindex) in data.modifiers" :key="'c'+cindex">
                               <ion-list-header class="ion-no-padding">
                                <ion-text>
                                    <h4>{{ c.category }}</h4>
                                </ion-text>
                                <ion-text color="danger" v-if="c.is_required==1">
                                    <h4>&nbsp; * </h4>
                                </ion-text>
                               </ion-list-header> 
                               <ion-item @click="onModifierClick(c,m)" button lines="full" v-for="(m,mindex) in c.items" :key="'m'+mindex">
                                <ion-icon slot="start" :color="m.selected?'success':''" :icon="checkmarkCircleOutline" class="ion-no-margin" style="margin-right:10px ;"></ion-icon>
                                    <ion-label>{{ m.modifier }}</ion-label>
                                    <ion-label v-if="m.price>0" color="danger" slot="end">{{ m.price }}</ion-label>
                               </ion-item>
                        </template>
                    </ion-list>
                   
                </div>
                
                  </ion-card-content>
  </ion-card>
            </template>
            <div style="margin-top: 10px;">
        <!-- <ion-textarea
  label="Note"
  label-placement="stacked"
  fill="outline"
  placeholder="Enter text"
  style="min-height: 120px;"
></ion-textarea> -->




            </div>
            
            <div style="margin-top: 10px;display: flex;justify-content: space-between;">
                <ion-button @click="goBack()" color="primary" >
              <ion-icon :icon="arrowBackOutline" slot="start"></ion-icon>
            <span style="font-size: 10px;">{{ t("Back To Order") }}</span>
              
            </ion-button>
           
            </div>
         
            
        </ion-content>
        <ion-footer>
    <ion-toolbar>
      <ion-grid>
        <ion-row class="ion-align-items-center">
          <ion-col size="6">
            <ion-buttons>
              <ion-button v-if="data" color="danger" fill="outline" size="small" @click="onAddQuantity(-1)" :disabled="data.quantity==1">
                <ion-icon :icon="removeOutline"></ion-icon>
              </ion-button>
              <ion-label id="qty-display" class="ion-padding-horizontal">
{{ data?.quantity }}
              </ion-label>
              <ion-button color="success" fill="outline" size="small" @click="onAddQuantity(1)">
                <ion-icon :icon="addOutline"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-col>
          <ion-col size="6" class="ion-text-end">
            <ion-button @click="addOrderProduct(data)" color="primary" >
              <ion-icon :icon="basketOutline" slot="start"></ion-icon>
              <ion-icon name="basket-outline"></ion-icon>
              {{ t("Add to Order") }}
            </ion-button>
          </ion-col>
        </ion-row>
      </ion-grid>
    </ion-toolbar>
  </ion-footer>
    </ion-page>
</template>
<script setup>
import {ref,onMounted, computed} from "vue"
import {useSale} from "@/hooks/useSale.js"
const {orderDoc,addOrderProduct} = useSale()

const t = app.t;
const data =ref()
import { checkmarkCircleOutline , removeOutline , addOutline , basketOutline , arrowBackOutline } from 'ionicons/icons';
import ComOrderCart from "../components/ComOrderCart.vue";
import { useRouter } from 'vue-router'
 const router = useRouter()
function goBack() {
  router.back()
}
function onPortionClick(p){
    const selected = data.value.portions.find(x=>x.selected);
    if(selected){
        selected.selected  = false;
    }
    
    p.selected =    true

}

function onModifierClick(group,modifier){
    if(group.is_multiple==0){
        const selected = data.value.modifiers.flatMap(group => group.items).find(x=>x.selected);
        if(selected){
            selected.selected  = false;
        }
        modifier.selected =    true
    }else {
        modifier.selected = !modifier.selected
    }
     

}

function onAddQuantity(n){
    
    data.value.quantity = data.value.quantity  + n

}
onMounted(async ()=>{
    const l = await app.showLoading()
    const res = await app.getDoc("Temp Product Menu",app.route.params.name);
    if (res.data){
        data.value = res.data
        data.value.quantity = 1
        // set portion
        if(data.value.prices){
            data.value.portions =  JSON.parse(data.value.prices)
            if(data.value.portions.length==1){
                data.value.portions[0].selected = true
            }
        }
        
        if(data.value.modifiers){
            data.value.modifiers =  JSON.parse(data.value.modifiers)
        }

    }

    await l.dismiss()
    
})


</script>