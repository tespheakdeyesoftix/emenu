import * as storageService    from "@/services/storage-service.ts"
import { setFrappeAppUrl,setToken } from "@/services/api-service.ts"
import {useApp} from "@/hooks/useApp.js"
import dayjs from "dayjs";
const {canShowApp,isSessionExpired,isAppLoadReady} = useApp();
export async function setup(){
        let isScanQRCode = false;
        const urlParams = new URLSearchParams(window.location.search);
        let qrcode = urlParams.get('qrcode') || "";
        if(qrcode!=""){
            // set qr scan startime for checking agist
          
            await storageService.setItem("start_time",new Date())
            isScanQRCode = true
          await storageService.setItem("qrcode",qrcode)
        }else {
          qrcode = await  storageService.getItem("qrcode") || "";
          isScanQRCode = false
        }
      
        
        qrcode = qrcode?.replace("eSTC.", "")
        qrcode = qrcode?.replace(".encrypt", "")
        qrcode = atob(atob(qrcode))
        
        
       

        const config = JSON.parse(qrcode)
        canShowApp.value = (checkConfigField(config,"api_url") && checkConfigField(config,"table_no") && checkConfigField(config,"pos_profile") && checkConfigField(config,"token"));

        if(canShowApp.value){
            setToken(config.token)
            setFrappeAppUrl(config.api_url)
             
            app.emenu = config.emenu;
            app.pos_profile = config.pos_profile;
            app.api_url = config.api_url
            app.token = config.token;
            
            // check aging to show qr session expire
            if (!isScanQRCode){
                const res = await app.getValue("eMenu",config.emenu,"qr_code_expire_duration")
                if(res.data){
                    const duration = res.data.qr_code_expire_duration;
                    const start_time = await storageService.getItem("start_time")
                    const end_time = dayjs();
                    const diff = end_time.diff(dayjs(start_time),'hour', true);
                    isSessionExpired.value = diff>duration;
                  
                }
            }
        }


        isAppLoadReady.value = true;
          
     
}


function checkConfigField(config,key){
    if (key in config && config[key] !== null && config[key] !== undefined && config[key] !== '') {
        return true
    }  
    return false;
}