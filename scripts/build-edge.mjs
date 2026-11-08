import { readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath,['scripts/port-edge.mjs'],{stdio:'inherit'});
const routes=[];
function walk(dir){for(const entry of readdirSync(dir,{withFileTypes:true})){const p=`${dir}/${entry.name}`;if(entry.isDirectory())walk(p);else if(/\+(page\.server|layout\.server|server)\.js$/.test(p))routes.push(p);}}
walk('supabase/functions/gestalt-api/server/routes');
const imports=[], records=[];
for(const [index,file] of routes.entries()){
 const path=file.replace('supabase/functions/gestalt-api/server/routes','').replace(/\/\+.*$/,'')||'/';
 const kind=file.endsWith('+page.server.js')?'page':file.endsWith('+layout.server.js')?'layout':'endpoint';
 imports.push(`import * as route${index} from './${file.replace('supabase/functions/gestalt-api/','')}';`);
 records.push(`{ path: ${JSON.stringify(path)}, kind: '${kind}', module: route${index} }`);
}
writeFileSync('supabase/functions/gestalt-api/routes.ts',imports.join('\n')+'\nexport const routes = [\n'+records.join(',\n')+'\n];\n');
