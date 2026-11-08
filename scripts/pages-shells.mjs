import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import content from '../content/public.json' with { type: 'json' };
// Real HTML entry points keep public deep links and known app routes on HTTP 200.
const shell=readFileSync('build-pages/404.html','utf8');
const paths=['materials','volumes','editors','submission','support','account','admin','auth/login','auth/register','lounge','admin/articles/new',...content.articles.map(a=>`materials/${a.slug}`),...content.volumes.map(v=>`volumes/${v.id}`),...content.articles.map(a=>`admin/articles/${a.id}`)];
for(const path of paths){if(existsSync(`build-pages/${path}/index.html`))continue;mkdirSync(`build-pages/${path}`,{recursive:true});writeFileSync(`build-pages/${path}/index.html`,shell);}
writeFileSync('build-pages/.nojekyll','');
