import { base } from '$app/paths';
import { goto, invalidateAll } from '$app/navigation';
import { error, redirect } from '@sveltejs/kit';
import { sitePath } from './site-path';

const api = import.meta.env.VITE_GESTALT_API_URL || '';
const tokenKey = 'gestalt_session';
export const actionState = $state<{ form: any; pending: boolean }>({ form: null, pending: false });
function apiUrl(path: string, mode = 'endpoint') {
  const local = new URL(path, 'https://gestalt.forum');
  const url = new URL(api);
  url.search = local.search;
  url.searchParams.set('_mode', mode);
  url.searchParams.set('_path', local.pathname);
  return url;
}
async function normalizeUpload(init: RequestInit) {
  const form = init.body;
  if(!(form instanceof FormData))return;
  const file=form.get('image');
  if(!(file instanceof File)||!file.type.startsWith('image/'))return;
  if(file.size>10*1024*1024)throw new Error('Файл больше 10 МБ');
  const image=await createImageBitmap(file);
  const scale=Math.min(1,2000/image.width,2000/image.height);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
  canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);image.close();
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Не удалось обработать изображение')),'image/webp',.82));
  form.set('image',new File([blob],'upload.webp',{type:'image/webp'}));
}
export async function apiFetch(path: string, init: RequestInit = {}, mode = 'endpoint') {
  if(!api)return fetch(path,init);
  const headers=new Headers(init.headers);
  const token=typeof window === 'undefined' ? null : localStorage.getItem(tokenKey);if(token)headers.set('x-session-token',token);
  if(path.startsWith('/api/admin/uploads'))await normalizeUpload(init);
  const response=await fetch(apiUrl(path,mode),{...init,headers});
  if(response.headers.get('content-type')?.includes('application/json')){
    const body=await response.clone().json();
    if(typeof window !== 'undefined' && '_session' in body){if(body._session)localStorage.setItem(tokenKey,body._session);else localStorage.removeItem(tokenKey);}
  }
  return response;
}
export async function loadRemote(path: string, mode = 'load') {
  const response=await apiFetch(path,{},mode);
  const body=await response.json();
  if(body.redirect)redirect(303,sitePath(body.redirect));
  if(!response.ok)error(response.status,body.message||'Не удалось загрузить страницу');
  return body.data;
}
export function installActions() {
  async function submit(event: SubmitEvent) {
    const form=event.target;
    if(!(form instanceof HTMLFormElement)||form.method.toUpperCase()!=='POST'||event.defaultPrevented)return;
    event.preventDefault();
    if(actionState.pending)return;
    actionState.pending=true;
    try {
      const submitter=event.submitter as HTMLButtonElement|null;
      const url=new URL(submitter?.getAttribute('formaction')||form.getAttribute('action')||location.href,location.href);
      let path=url.pathname;
      if(base && (path===base || path.startsWith(base+'/')))path=path.slice(base.length)||'/';
      const action=[...url.searchParams.keys()].find(k=>k.startsWith('/'))?.slice(1)||'default';
      const logout=path.replace(/\/$/,'')==='/auth/logout';
      url.searchParams.set('_action',action);
      const response=await apiFetch(path+url.search,{method:'POST',body:new FormData(form,submitter)},logout?'endpoint':'action');
      const result=await response.json();
      if(result.redirect){actionState.form=null;await goto(sitePath(result.redirect),{invalidateAll:true});return;}
      actionState.form=result.form??{error:result.message||'Не удалось отправить форму'};
      if(response.ok)await invalidateAll();
    }catch(err){actionState.form={error:err instanceof Error?err.message:'Ошибка сети. Попробуйте ещё раз.'};}
    finally{actionState.pending=false;}
  }
  async function download(event: MouseEvent) {
    const link=(event.target as Element)?.closest<HTMLAnchorElement>('a[download]');
    if(!link)return;
    const url=new URL(link.href);let path=url.pathname;if(base&&path.startsWith(base+'/'))path=path.slice(base.length);
    if(!path.startsWith('/admin/backups/'))return;
    event.preventDefault();
    const response=await apiFetch(path);if(!response.ok){actionState.form={error:'Не удалось скачать копию'};return;}
    const href=URL.createObjectURL(await response.blob());const anchor=document.createElement('a');anchor.href=href;anchor.download=path.split('/').at(-1)!;anchor.click();setTimeout(()=>URL.revokeObjectURL(href),1000);
  }
  document.addEventListener('submit',submit);
  document.addEventListener('click',download);
  return ()=>{document.removeEventListener('submit',submit);document.removeEventListener('click',download);};
}
