
import supabase  from "@/services/supabase-client";


export async function getPropertyInformation(propertyCode:string) {
    
    const { data, error } = await supabase
        .from('business_information')
        .select('property_code, app_url')
        .eq("property_code", propertyCode)
        .single();

    if (error) {
        
        return { data: null, error };
    }

    return { data, error:null };
}

  