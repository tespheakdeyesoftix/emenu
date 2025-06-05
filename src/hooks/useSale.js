import {ref} from "vue"
const saleDoc = ref()
const  orderDoc = ref()

export function useSale() {
    return {
       saleDoc,
       orderDoc
    };
  }
  