// Browser routes reuse the existing Svelte views and load data from the Edge API.
import { readFileSync, readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { relative, dirname, resolve } from 'node:path';
const out=resolve('src/browser');rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
const files=[];
function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())walk(p);else if(e.name==='+page.svelte'||e.name==='+layout.svelte')files.push(p);}}
walk('src/routes');
for(const file of files){const destination=file.replace('src/routes','src/browser');mkdirSync(dirname(destination),{recursive:true});
 let source=relative(dirname(resolve(destination)),resolve(file));if(!source.startsWith('.'))source='./'+source;
 const isLayout=file.endsWith('+layout.svelte');
 const sourceText=readFileSync(file,'utf8');
 const acceptsData=/let\s+\{[^}]*\bdata\b/.test(sourceText);
 const acceptsForm=/let\s+\{[^}]*\bform\b/.test(sourceText);
 const wrapper=isLayout?'Layout':'View';
 const imports=`import ${wrapper} from '${source}';\nimport { actionState } from '$lib/client-api.svelte';`;
 const extras=file==='src/routes/+layout.svelte'?`import { onMount } from 'svelte';\nimport { afterNavigate } from '$app/navigation';\nimport { installActions } from '$lib/client-api.svelte';\nafterNavigate(({from,to})=>{if(from?.url.pathname!==to?.url.pathname)actionState.form=null;});\nonMount(installActions);`:'';
 writeFileSync(destination,`<script lang="ts">\n${imports}\n${extras}\nlet { data${isLayout?', children':''} } = $props();\n</script>\n<${wrapper}${acceptsData?' {data}':''}${isLayout?' {children}':acceptsForm?' form={actionState.form}':''} />\n`);
 const js=destination.replace('.svelte','.ts');
 if(file==='src/routes/+layout.svelte')writeFileSync(js,`import { loadRemote } from '$lib/client-api.svelte';\nexport const ssr = true;\nexport const trailingSlash = 'always';\nexport const prerender = false;\nexport const load = ({ url }: { url: URL }) => { const path=url.pathname; return loadRemote('/', 'layout'); };\n`);
 else if(!isLayout){
  const path=file.replace('src/routes/','').replace('/+page.svelte','').replace('+page.svelte','');
  const publicRoute=['','materials','materials/[slug]','volumes','volumes/[id]','[info=info]'].includes(path);
  const entries=path==='materials/[slug]'?`export const entries = () => content.articles.map(a => ({slug:a.slug}));`:
    path==='volumes/[id]'?`export const entries = () => content.volumes.map(v => ({id:String(v.id)}));`:
    path==='[info=info]'?`export const entries = () => content.pages.map(p => ({info:p.slug}));`:'';
  let contentImport=relative(dirname(resolve(js)),resolve('content/public.json'));if(!contentImport.startsWith('.'))contentImport='./'+contentImport;
  writeFileSync(js,`import { building } from '$app/environment';\nimport { base } from '$app/paths';\nimport { loadRemote } from '$lib/client-api.svelte';\n${entries?`import content from '${contentImport}';\n${entries}\n`:''}export const prerender = ${publicRoute};\n${publicRoute?'':'export const ssr = false;\n'}export const load = ({ url }: { url: URL }) => loadRemote((base ? url.pathname.slice(base.length) : url.pathname) + (building ? '' : url.search));\n`);
 }
}
writeFileSync('src/browser/hooks.server.ts','export {};\n');
console.log(`Prepared ${files.length} browser views`);
