import {createClient} from "npm:@supabase/supabase-js@2";
const H={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,x-license-sync-secret","Content-Type":"application/json;charset=utf-8"};
const out=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:H});
const validStatus=new Set(["active","inactive","expired","refunded","pending"]);
Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:H});
  if(req.method!=="POST")return out({error:"Method not allowed"},405);
  const expected=Deno.env.get("LICENSE_SHEET_SYNC_SECRET")||"";
  if(!expected||req.headers.get("x-license-sync-secret")!==expected)return out({error:"Unauthorized"},401);
  const url=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const db=createClient(url,key,{auth:{persistSession:false}}),body=await req.json().catch(()=>({}));
  const{data:products,error:productError}=await db.from("license_products").select("product_code,title,active,set_size").order("title");
  if(productError)return out({error:productError.message},500);
  if(body.action==="catalog")return out({products});
  if(body.action==="pull"){
    const users:any[]=[];for(let page=1;;page++){const{data,error}=await db.auth.admin.listUsers({page,perPage:1000});if(error)return out({error:error.message},500);users.push(...data.users);if(data.users.length<1000)break;}
    const ids=users.map(u=>u.id),profiles:any[]=[];for(let i=0;i<ids.length;i+=500){const{data,error}=await db.from("member_profiles").select("id,email,display_name,account_type,active,created_at").in("id",ids.slice(i,i+500));if(error)return out({error:error.message},500);profiles.push(...data||[])}
    const{data:ents,error:entError}=await db.from("license_entitlements").select("user_id,product_code,status,starts_at,expires_at,updated_at");if(entError)return out({error:entError.message},500);
    const pm=new Map(profiles.map(p=>[p.id,p])),em=new Map<string,any[]>();for(const e of ents||[]){if(!em.has(e.user_id))em.set(e.user_id,[]);em.get(e.user_id)!.push(e)}
    return out({products,members:users.map(u=>{const p=pm.get(u.id)||{},es=em.get(u.id)||[],active=es.filter(e=>e.status==="active").map(e=>e.product_code);return{user_id:u.id,email:u.email||p.email||"",name:p.display_name||u.user_metadata?.display_name||u.user_metadata?.name||"",account_type:p.account_type||"personal",member_active:p.active!==false,created_at:u.created_at,products:active,entitlements:es}})});
  }
  if(body.action==="delete_members"){
    const ids=Array.isArray(body.user_ids)?[...new Set(body.user_ids.map(String).filter(x=>/^[0-9a-f-]{36}$/i.test(x)))]:[],results=[];
    for(const userId of ids){const{error}=await db.auth.admin.deleteUser(userId);results.push(error?{user_id:userId,ok:false,error:error.message}:{user_id:userId,ok:true})}
    return out({results});
  }
  if(body.action==="push"){
    const rows=Array.isArray(body.rows)?body.rows:[],codes=new Set((products||[]).filter(p=>p.active).map(p=>p.product_code)),results=[];
    for(const row of rows){try{let userId=String(row.user_id||"");if(!userId&&row.email){const{data}=await db.from("member_profiles").select("id").ilike("email",String(row.email)).maybeSingle();userId=data?.id||""}if(!userId)throw Error("Member not found");let wanted=Array.isArray(row.products)?row.products.map(String):[];if(wanted.includes("ALL"))wanted=[...codes];wanted=[...new Set(wanted.filter(x=>codes.has(x)))];const status=validStatus.has(String(row.status||"").toLowerCase())?String(row.status).toLowerCase():"active",starts=row.starts_at||new Date().toISOString(),expires=row.expires_at||null;for(const code of wanted){const{error}=await db.from("license_entitlements").upsert({user_id:userId,product_code:code,status,starts_at:starts,expires_at:expires,metadata:{payment:String(row.payment||""),note:String(row.note||""),source:"google_sheet"},updated_at:new Date().toISOString()},{onConflict:"user_id,product_code"});if(error)throw error}const{data:existing,error:listError}=await db.from("license_entitlements").select("product_code").eq("user_id",userId).eq("status","active");if(listError)throw listError;const removed=(existing||[]).map(e=>e.product_code).filter(code=>!wanted.includes(code));if(removed.length){const{error}=await db.from("license_entitlements").update({status:"inactive",updated_at:new Date().toISOString()}).eq("user_id",userId).in("product_code",removed);if(error)throw error}results.push({user_id:userId,ok:true,products:wanted,status})}catch(error){results.push({user_id:row.user_id||"",email:row.email||"",ok:false,error:error instanceof Error?error.message:String(error)})}}
    return out({results});
  }
  return out({error:"Unknown action"},400);
});
