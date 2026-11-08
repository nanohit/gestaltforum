// Produce the Edge Function version of the existing handlers with async Postgres calls.
// The application rules stay in src/routes and src/lib/server.
import ts from 'typescript';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, dirname } from 'node:path';
const out = resolve('supabase/functions/gestalt-api/server');
const files = [];
function walk(dir) { for (const e of readdirSync(dir, { withFileTypes: true })) { const p = `${dir}/${e.name}`; if(e.isDirectory()) walk(p); else if (/\+(page\.server|layout\.server|server)\.ts$/.test(p)) files.push(p); } }
walk('src/routes');
for(const name of ['access','auth','cloudpayments','content','email','permissions']) files.push(`src/lib/server/${name}.ts`);
files.push('src/lib/types.ts');
const skips = ['src/routes/api/admin/uploads/+server.ts','src/routes/admin/backups/[name]/+server.ts','src/routes/uploads/[...path]/+server.ts'];
const prepared = new Set(['activeEntitlement','findUserBySession','addAuthor']);
const asyncNames = new Set(['consumeRateLimit','listBackups','createBackup']);
const sources = files.filter(f=>!skips.includes(f)).map(file=>({file,ast:ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS)}));
function nameOf(node) {
 if(node.name && ts.isIdentifier(node.name))return node.name.text;
 if(ts.isVariableDeclaration(node.parent)&&ts.isIdentifier(node.parent.name))return node.parent.name.text;
 if(ts.isPropertyAssignment(node.parent))return node.parent.name.getText();
 return '';
}
function isFunction(n) {return ts.isFunctionDeclaration(n)||ts.isArrowFunction(n)||ts.isFunctionExpression(n)||ts.isMethodDeclaration(n);}
function sqlCall(n) {
 if(!ts.isCallExpression(n))return false;
 if(ts.isPropertyAccessExpression(n.expression)) {
 const {expression:obj,name}=n.expression;
 return ['get','all','run'].includes(name.text)&&(obj.getText().includes('.prepare(')||prepared.has(obj.getText()));
 }
 return false;
}
for (const {ast} of sources) {
 function collect(n){if(ts.isVariableDeclaration(n)&&n.initializer&&n.initializer.getText().includes('sqlite.transaction(')&&ts.isIdentifier(n.name))asyncNames.add(n.name.text);ts.forEachChild(n,collect);}collect(ast);
}
function needsAwait(n) {
 if(sqlCall(n))return true;
 if(!ts.isCallExpression(n))return false;
 if(ts.isIdentifier(n.expression)&&asyncNames.has(n.expression.text))return true;
 return ts.isCallExpression(n.expression)&&n.expression.expression.getText()==='sqlite.transaction';
}
const marked = new Set();
let changed=true;
while(changed){changed=false;for(const {ast} of sources){
 function visit(n,scope){const fn=isFunction(n)?n:scope;
 if(needsAwait(n)&&fn&&!marked.has(fn)){marked.add(fn);const name=nameOf(fn);if(name&&!asyncNames.has(name)){asyncNames.add(name);changed=true;}}
 ts.forEachChild(n,c=>visit(c,fn));}visit(ast,null);
}}
for(const {file,ast} of sources){
 let dest=resolve(out,file.replace(/^src\//,''));mkdirSync(dirname(dest),{recursive:true});
 const edits=[];
 function edit(start,end,text){edits.push({start,end,text});}
 function visit(n){
 if(ts.isImportDeclaration(n)){
 const spec=n.moduleSpecifier.text;
 if(n.importClause?.isTypeOnly||spec==='./$types')edit(n.getStart(),n.end,'');
 else {
 let target;
 if(spec.startsWith('$lib/server/')){
  const name=spec.slice('$lib/server/'.length);
  target=['db','config','backup','cache','http','rate-limit'].includes(name)?resolve('supabase/functions/gestalt-api/runtime',name+'.ts'):resolve(out,'lib/server',name+'.ts');
 } else if(spec==='$lib/types')target=resolve(out,'lib/types.ts');
 else if(spec==='@sveltejs/kit')target=resolve('supabase/functions/gestalt-api/runtime/kit.ts');
 else if(spec==='argon2')target=resolve('supabase/functions/gestalt-api/runtime/argon2.ts');
 if(target){let path=relative(dirname(dest),target);if(!path.startsWith('.'))path='./'+path;edit(n.moduleSpecifier.getStart(),n.moduleSpecifier.end,JSON.stringify(path));}
 else if(spec==='zod')edit(n.moduleSpecifier.getStart(),n.moduleSpecifier.end,JSON.stringify('npm:zod@4.3.5'));
 else if(spec==='resend')edit(n.moduleSpecifier.getStart(),n.moduleSpecifier.end,JSON.stringify('npm:resend@6.16.0'));
 }
 }
 if(marked.has(n)&&!n.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword)){
  let start=n.getStart();if(ts.isFunctionDeclaration(n)){const text=ast.text.slice(start,n.end);const offset=text.indexOf('function');start+=offset;}
  edit(start,start,'async ');
 }
 if(needsAwait(n)&&!ts.isAwaitExpression(n.parent)){edit(n.getStart(),n.getStart(),'(await ');edit(n.end,n.end,')');}
 ts.forEachChild(n,visit);
 }visit(ast);
 let text=ast.text;
 for(const e of edits.sort((a,b)=>b.start-a.start||b.end-a.end))text=text.slice(0,e.start)+e.text+text.slice(e.end);
 // Deno does not type-check SvelteKit's generated route types. Emit clean JavaScript.
 const emitted=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
 const errs=emitted.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)||[];if(errs.length)throw new Error(ts.formatDiagnosticsWithColorAndContext(errs,{getCurrentDirectory:()=>process.cwd(),getCanonicalFileName:x=>x,getNewLine:()=> '\n'}));
 dest=dest.replace(/\.ts$/,'.js');
 writeFileSync(dest,'// Generated by npm run build:edge; edit the original handler in src.\n'+emitted.outputText.replace(/(from\s+["'][^"']+)\.ts(["'])/g,'$1.js$2').replace(/runtime\/([^"']+)\.js/g,'runtime/$1.ts'));
}
console.log(`Ported ${sources.length} modules; async helpers: ${[...asyncNames].join(', ')}`);
