import { search } from './runtime/search.ts';
import { routes } from './routes.ts';
import { getUserFromToken, SESSION_COOKIE } from './server/lib/server/auth.js';
import { HttpError, Redirect, error } from './runtime/kit.ts';
import { pool } from './runtime/db.ts';
import { upload } from './runtime/uploads.ts';
import { isSafeBackupName } from './runtime/backup.ts';
import { requireRole } from './server/lib/server/permissions.js';

const allowedOrigins = new Set(['https://nanohit.github.io','https://gestalt.forum','https://www.gestalt.forum','http://localhost:4173','http://127.0.0.1:4173']);
function match(pattern: string, path: string): Record<string,string> | null {
  if(pattern==='/[info=info]')return /^\/(editors|submission)$/.test(path)?{info:path.slice(1)}:null;
  const names: string[]=[];
  const regex=pattern.replace(/\[([^\]]+)\]/g,(_,name)=>{names.push(name);return '([^/]+)';});
  const match=path.match(new RegExp('^'+regex+'$'));
  return match?Object.fromEntries(names.map((name,index)=>[name,decodeURIComponent(match[index+1])])):null;
}
function normalize(value: unknown): unknown {
  if(typeof value==='string' && value.startsWith('/uploads/'))return `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/gestalt-uploads/${value.slice(9)}`;
  if(Array.isArray(value))return value.map(normalize);
  if(value && typeof value==='object' && !(value instanceof Uint8Array))return Object.fromEntries(Object.entries(value).map(([key,value])=>[key,normalize(value)]));
  return value;
}
Deno.serve(async (request: Request) => {
  const origin=request.headers.get('origin');
  const cors = new Headers({
    'access-control-allow-methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers':'authorization, apikey, content-type, x-session-token',
    'access-control-max-age':'86400', 'vary':'Origin', 'cache-control':'no-store', 'x-content-type-options':'nosniff'
  });
  if(origin && allowedOrigins.has(origin))cors.set('access-control-allow-origin',origin);
  if(origin && !allowedOrigins.has(origin))return Response.json({message:'Недопустимый источник запроса'},{status:403,headers:cors});
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  let sessionToken: string | null | undefined;
  function reply(data: any,status=200){return Response.json(normalize({...data,...(sessionToken!==undefined?{_session:sessionToken}:{})}),{status,headers:cors});}
  try {
    const incoming=new URL(request.url);
    const mode=incoming.searchParams.get('_mode')||'endpoint';
    let path=(incoming.searchParams.get('_path')||'/healthz').replace(/\/$/,'')||'/';
    if(!path.startsWith('/')||path.startsWith('//'))error(400,'Некорректный путь');
    const url=new URL(path,origin||'https://gestalt.forum');
    for(const [key,value] of incoming.searchParams)if(!['_mode','_path'].includes(key))url.searchParams.append(key,value);
    const token=request.headers.get('x-session-token')||undefined;
    const session=await getUserFromToken(token);
    const event:any={request,url,params:{},locals:{user:session?.user??null,sessionId:session?.sessionId??null},
      cookies:{get:(key:string)=>key===SESSION_COOKIE?token:undefined,set:(key:string,value:string)=>{if(key===SESSION_COOKIE)sessionToken=value;},delete:()=>{sessionToken=null;}},
      setHeaders:()=>{},getClientAddress:()=>request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown'};
    if(mode==='layout'){
      const route=routes.find(r=>r.path==='/'&&r.kind==='layout')!;
      return reply({data:await route.module.load(event)});
    }
    if(mode==='load' && path==='/materials')return reply({data:await search(url)});
    if(path==='/api/admin/uploads'&&request.method==='POST'){
      const response=await upload(event);return reply(await response.json(),response.status);
    }
    if(path.startsWith('/admin/backups/')&&request.method==='GET'){
      requireRole(event.locals.user,['admin','chief_editor']);
      const name=path.slice('/admin/backups/'.length);
      if(!isSafeBackupName(name))error(400,'Некорректное имя копии');
      const [row]=await pool`SELECT body FROM backups WHERE name=${name}`;
      if(!row)error(404,'Копия не найдена');
      cors.set('content-type','application/gzip');cors.set('content-disposition',`attachment; filename="${name}"`);
      return new Response(row.body,{headers:cors});
    }
    const kind=mode==='endpoint'?'endpoint':'page';
    for(const route of routes){
      if(route.kind!==kind)continue;
      const params=match(route.path,path);if(!params)continue;event.params=params;
      if(mode==='load')return reply({data:await route.module.load?.(event)??{}});
      if(mode==='action'){
        const action=url.searchParams.get('_action')||'default';
        const handler=route.module.actions?.[action];if(!handler)error(404,'Действие не найдено');
        const data=await handler(event);
        if(data?.__failure)return reply({form:data.data},data.status);
        return reply({form:data??{}});
      }
      const handler=route.module[request.method];if(!handler)error(405,'Метод не поддерживается');
      const response=await handler(event);
      return reply(await response.json(),response.status);
    }
    error(404,'Страница не найдена');
  }catch(e){
    if(e instanceof Redirect)return reply({redirect:e.location,status:e.status});
    if(e instanceof HttpError)return reply({message:e.message},e.status);
    console.error('Gestalt API error',e);
    return reply({message:'Сервис временно недоступен. Попробуйте ещё раз.'},500);
  }
});
