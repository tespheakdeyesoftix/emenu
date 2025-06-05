<template>
    <ion-page>
        <ToolBar>
            {{ t("Product Detail") }}
        </ToolBar>
        <ion-content class="ion-padding">
            <template v-if="data ">
                <Img :src="data?.photo" />
                {{ data.product_code }} - {{ data.product_name_en }}

                {{ data.price }}

                <div v-html="data.description"></div>
                
                

                <div v-if="portions">
                    <ion-text>
                        <h3>{{ t("Portion") }}</h3>
                    </ion-text>
                    <ion-list>
                        <ion-item button @click="onPortionClick(p)" lines="full" v-for="(p,index) in portions" :key="'portion_'+index">
                            <ion-icon slot="start" :color="p.selected?'success':''" :icon="checkmarkCircleOutline" class="ion-no-margin" style="margin-right:10px ;"></ion-icon>
                            <ion-label>
                                {{ p.portion  }} 
                            </ion-label>
                            <ion-label slot="end" color="danger">{{ p.price }}</ion-label>
                        </ion-item>
                    </ion-list>
                </div>
<!--  modifier -->
                <div v-if="modifiers">
                    <ion-list>
                        <template v-for="(c,cindex) in modifiers" :key="'c'+cindex">
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
                    {{ modifiers }}
                </div>
              
            </template>
        
            
        </ion-content>
    </ion-page>
</template>
<script setup>
import {ref,onMounted, computed} from "vue"
import {useSale} from "@/hooks/useSale.js"
const {orderDoc} = useSale()

const t = app.t;
const data =ref()
import { checkmarkCircleOutline } from 'ionicons/icons';
const portions = ref([])
const modifiers = ref([])

function onPortionClick(p){
    const selected = portions.value.find(x=>x.selected);
    if(selected){
        selected.selected  = false;
    }
    
    p.selected =    true

}

function onModifierClick(group,modifier){
    if(group.is_multiple==0){
        const selected = modifiers.value.flatMap(group => group.items).find(x=>x.selected);
        if(selected){
            selected.selected  = false;
        }
        modifier.selected =    true
    }else {
        modifier.selected = !modifier.selected
    }
    
   

   

}

onMounted(async ()=>{
    const l = await app.showLoading()
    const res = await app.getDoc("Temp Product Menu",app.route.params.name);
    if (res.data){
        data.value = res.data

        // set portion
        if(data.value.prices){
            portions.value =  JSON.parse(data.value.prices)
        }
        
        if(data.value.modifiers){
            modifiers.value =  JSON.parse(data.value.modifiers)
        }

    }

    await l.dismiss()
    
})


</script>