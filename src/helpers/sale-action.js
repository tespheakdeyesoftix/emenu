
export function getPortion(portions){
    if(portions){
       const selected = portions.find(x=>x.selected);
       if(selected){
          return selected.portion;
       }
    }
    return "Normal"
 }
 
 export  function getModifiers(modifiers){
    if(!modifiers) return ""
    
    const selected =  modifiers.flatMap(group => group.items).filter(x=>x.selected);
    if(selected){
       return selected.map(x=>{
          let m = `${x.prefix} ${x.modifier}`;
          if(x.price>0){
             m = m + "-" + app.utils.formatCurrency(x.price)
          }
          return m
       }).join(",")
    }
    return ""
 
 }

 export  function getModifierPrice(modifiers){
    if(!modifiers) return 0
    
    const selected =  modifiers.flatMap(group => group.items).filter(x=>x.selected);
    if(selected){
        return selected.reduce((sum, item) => sum + item.price, 0);
    }
    return 0
 
 }

 export  function getModifierData(modifiers){
    if(!modifiers) return []
    
    const selected =  modifiers.flatMap(group => group.items).filter(x=>x.selected);
    if(selected){
       return selected.map(x=> {
        return {prefix:x.prefix, modifier:x.modifier, price:x.price}
       })
    }
    return []
 
 }
 export  function getPrice(data){
    if(!data.portions) return data.price || 0;
    const selected = data.portions.find(x=>x.selected);
    if(selected){
        return selected.price;
    }
    return 0
 }