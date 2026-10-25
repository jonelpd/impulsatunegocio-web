import nodemailer from 'npm:nodemailer@7.0.10';
import { createClient } from 'npm:@supabase/supabase-js@2';
function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed',{status:405});
  const expected=Deno.env.get('NOTIFY_WORKER_TOKEN')||'';
  const received=req.headers.get('x-worker-token')||'';
  if(!expected || !received || received.length!==expected.length || !safeEqual(received,expected)) return new Response('Unauthorized',{status:401});
  const user=Deno.env.get('GMAIL_USER')||'';
  const pass=(Deno.env.get('GMAIL_APP_PASSWORD')||'').replace(/\s/g,'');
  const url=Deno.env.get('SUPABASE_URL')||'';
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!user||!pass||!url||!key)return new Response('Not configured',{status:503});
  const db=createClient(url,key,{auth:{persistSession:false}});
  const {data:pending,error}=await db.from('lead_email_outbox').select('lead_id,attempts').is('sent_at',null).lt('attempts',5).order('created_at').limit(10);
  if(error)return new Response('Queue unavailable',{status:503});
  const smtp=nodemailer.createTransport({host:'smtp.gmail.com',port:465,secure:true,auth:{user,pass},connectionTimeout:6000,greetingTimeout:6000,socketTimeout:6000});
  let sent=0,failed=0;
  for(const item of pending||[]){
    const {data:lead}=await db.from('leads').select('reference,name,email,business,service,budget,timing,message').eq('id',item.lead_id).maybeSingle();
    if(!lead)continue;
    try{
      await smtp.sendMail({from:user,to:user,replyTo:lead.email,subject:'Nueva solicitud web '+lead.reference,text:['Referencia: '+lead.reference,'Nombre: '+lead.name,'Correo: '+lead.email,'Empresa: '+(lead.business||''),'Servicio: '+lead.service,'Presupuesto: '+(lead.budget||''),'Plazo: '+(lead.timing||''),'Mensaje:',lead.message,'CRM: https://jonelpd.github.io/impulsatunegocio-web/crm-admin.html'].join('\n')});
      await db.from('lead_email_outbox').update({sent_at:new Date().toISOString(),attempts:item.attempts+1,last_error:null}).eq('lead_id',item.lead_id).is('sent_at',null);
      sent++;
    }catch(e){await db.from('lead_email_outbox').update({attempts:item.attempts+1,last_error:String(e instanceof Error?e.message:'SMTP failure').slice(0,200)}).eq('lead_id',item.lead_id);failed++;}
  }
  return Response.json({processed:(pending||[]).length,sent,failed});
});