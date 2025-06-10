import { handleErrorMessage } from '@/helpers/error-message';
import { FrappeApp } from 'frappe-js-sdk';

let frappe: FrappeApp | null = null;
let token ="";
export function setFrappeAppUrl(url:string){
    
    frappe = new FrappeApp(url,{
        useToken: true,
        token: getToken,
        type: "token"
    });
 
}

export function setToken(t:string){
    
    token = t;
    
 
}

function getToken(){
      
    return token;//"8f658f62283c734:15332c681cf9767";
   
}

export function logoutApi() {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const auth = frappe.auth()
    return auth
  .logout()
  .then(() => (true))
  .catch(() => (false));
}

export function getDocList(DocType: string, param: any = null) {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const db = frappe.db();
    return db.getDocList(DocType, param)
        .then((r: any) => ({ data: r, error: null }))
        .catch((error) => {
            handleErrorMessage(error);
            return { data: null, error }
        });
}
export function getCount(DocType: string, param: any = null) {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const db = frappe.db();
    return db.getCount(DocType,param,true)
    .then((count) => ({data:count,erro:null}))
    .catch((error) => {
        handleErrorMessage(error);
        return { data: null, error }
    });
}




export function getApi(api_url: string, param: any = null,) {
  
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const call = frappe.call();
      return call.get(api_url,param)
      .then((r: any) => {
        if(r.message){
            return { data: r.message, error: null }
        }else {
            return { data: r, error: null }
        }
      })
      .catch((error) => {
        handleErrorMessage(error);
        return { data: null, error }
    });
}

export function postApi(api_url: string, param: any = null) {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const call = frappe.call();
      return call.post(api_url,param)
      .then((r: any) => ({ data: r.message, error: null }))
      .catch((error) => {
        handleErrorMessage(error);
        return { data: null, error }
    });
}

export function getDoc(DocType: string,DocName:string) {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const db = frappe.db()

    return db.getDoc(DocType, DocName)
  .then((doc) =>({ data: doc, error: null }))
  .catch((error) => {
    handleErrorMessage(error);
    return { data: null, error }
  });
}
 
export function getSingleValue(DocType: string,fieldname:string) {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const db = frappe.db()

    return db.getSingleValue(DocType,fieldname)
  .then((doc) =>({ data: doc.message, error: null }))
  .catch((error) => {
    handleErrorMessage(error);
    return { data: null, error }
  });
}
 
export function getValue(DocType: string,name:string, fields:any) {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const db = frappe.db()

    return db.getValue(DocType,fields,[["name","=",name]])
  .then((doc) =>({ data: doc.message, error: null }))
  .catch((error) => {
    handleErrorMessage(error);
    return { data: null, error }
  });
}

export function createDoc(DocType: string,params:any) {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const db = frappe.db()

    return db.createDoc(DocType, params)
  .then((doc) =>({ data: doc, error: null }))
  .catch((error) => {
    handleErrorMessage(error);
    return { data: null, error }
  });
}

export function updateDoc(DocType: string,name:String,params:any) {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }
    const db = frappe.db()

    return db.updateDoc(DocType,name, params)
  .then((doc) =>({ data: doc, error: null }))
  .catch((error) => {
    handleErrorMessage(error);
    return { data: null, error }
  });
}

export async function uploadFile(
    docType:string, 
    docname:string,
    fieldname:string, 
    fileData:any,otherOption:any
) {
    if (!frappe) {
        return { data: null, error: "Frappe is not defined" };
    }

    const file = frappe.file();

  

        const fileArgs = {
            "isPrivate": false,
            "folder":"home",
            /** File URL (optional) */
            "file_url": otherOption.file_url??"",
            "doctype": docType,
            "docname": docname,
            /** Field in the document **/
            "fieldname": fieldname
          }
          const loading = await app.showLoading("Uploading...");
        return file.uploadFile(
            fileData,
            fileArgs,
            undefined,
            // (completedBytes, totalBytes) => {
            //     if(totalBytes){
            //      
            //     }
            // },
            "edoor.api.upload.upload_file"
        )
        .then(async (result:any) =>{
            await loading.dismiss()
            // Log to See Structure
 
            app.showSuccess(app.t("Upload file successfully"));
            return { data: result.data.message.file_url, error: null };
        })
        .catch(async(e) => {
            await loading.dismiss()
            handleErrorMessage(e);
            return { data: null, e }
        })
         
       
       
}




