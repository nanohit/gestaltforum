import { error, json } from './kit.ts';
import { requireRole, CONTENT_ROLES } from '../server/lib/server/permissions.js';
import { consumeRateLimit } from './rate-limit.ts';
export async function upload({request, locals}: any) {
  const user = requireRole(locals.user, CONTENT_ROLES);
  if(!await consumeRateLimit(`upload:${user.id}`,{capacity:10,refillPerMinute:2}))error(429,'Слишком много загрузок');
  const data = await request.formData();
  const file = data.get('image');
  if(!(file instanceof File))error(400,'Файл не выбран');
  if(file.size > 10*1024*1024)error(413,'Файл больше 10 МБ');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const png = bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71;
  const jpeg = bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  const webp = new TextDecoder().decode(bytes.slice(0,4))==='RIFF' && new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
  const ext = png ? 'png' : jpeg ? 'jpg' : webp ? 'webp' : null;
  if(!ext)error(415,'Поддерживаются JPEG, PNG и WebP');
  const type = png ? 'image/png' : jpeg ? 'image/jpeg' : 'image/webp';
  const name = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const url = `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/gestalt-uploads/${name}`;
  const response = await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,apikey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, 'content-type':type},body:bytes});
  if(!response.ok){console.error('Storage upload error',response.status);error(502,'Не удалось сохранить изображение');}
  return json({ok:true,name,url:`${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/gestalt-uploads/${name}`, originalSize:file.size,size:bytes.length},{status:201});
}
