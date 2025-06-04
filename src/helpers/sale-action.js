export async function onEditBill(data){
    const loading = await app.showLoading();
    const doc_res = await app.getDoc("Sale",data.name)
    if(doc_res.data){
        if(doc_res.data.sale_status == "Closed"){
            // check permission
            if(app.currentUser.user_info.edit_bill == 0){
                app.showWarningMessage("Edit Bill","You do not have permission to edit bill")
                await loading.dismiss();
                return
            }
        }
    }
    
    await loading.dismiss();
    app.ionRouter.navigate('/selling/sale/edit/' + data.name, 'forward',"push");


}

export async function onSplitBill(data){
   
    // CHECK USER PERMISSSION
    if(app.currentUser.user_info.split_bill ==0){
        app.showWarningMessage("Split Bill","You do not have permission to split bill.")
        return
    }
    // check if customer allow to split bill 
    if(!data.customer){
        app.showWarning("No Customer")
        return 
    }

    const l = await app.showLoading();
    const res = await app.getValue("Customer",data.customer,"can_split_bill")
 
    if(res.data.can_split_bill==0){
        
        await l.dismiss()
        app.showWarningMessage("Split Bill","This customer is not allow to split bill.")
    return ;
    }
     
await l.dismiss()
    app.ionRouter.navigate('/selling/split-bill/' + data.name, 'forward',"push");
}

export function getCustomerProductPrice(product,product_prices){
        let product_price = product_prices?.filter(r=>r.product_code == product.product_code && r.unit == product.unit) 
        if(product_price.length>0){
          return product_price[0].price
        }
        return product.price;
}