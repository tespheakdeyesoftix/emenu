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
              
                <Img :src="data?.photo" />
                {{ data.product_code }} - {{ data.product_name_en }}

                {{ data.price }}

                <div v-html="data.description"></div>
                
                

                <div v-if="data.portions">
                    <ion-text>
                        <h3>{{ t("Portion") }}</h3>
                    </ion-text>
                    <ion-list>
                        <ion-item button @click="onPortionClick(p)" lines="full" v-for="(p,index) in data.portions" :key="'portion_'+index">
                            <ion-icon slot="start" :color="p.selected?'success':''" :icon="checkmarkCircleOutline" class="ion-no-margin" style="margin-right:10px ;"></ion-icon>
                            <ion-label>
                                {{ p.portion  }} 
                            </ion-label>
                            <ion-label slot="end" color="danger">{{ p.price }}</ion-label>
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
                
                <ion-input v-model="data.note" :label="t('Note')" label-placement="stacked" fill="outline" :placeholder="t('Enter Note')"></ion-input>
<ion-button @click="onAddQuantity(-1)" :disabled="data.quantity==1">-</ion-button> {{ data.quantity }} <ion-button @click="onAddQuantity(1)">+</ion-button>
                <ion-button @click="addOrderProduct(data)">{{ t("Add to Order") }}</ion-button>
            </template>
        
            
        </ion-content>
    </ion-page>
</template>
<script setup>
import {ref,onMounted, computed} from "vue"
import {useSale} from "@/hooks/useSale.js"
const {orderDoc,addOrderProduct} = useSale()

const t = app.t;
const data =ref()
import { checkmarkCircleOutline } from 'ionicons/icons';
import ComOrderCart from "../components/ComOrderCart.vue";
 

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