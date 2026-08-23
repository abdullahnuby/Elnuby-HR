const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const code=fs.readFileSync(path.join(root,'apps-script','Code.gs'),'utf8');
const page=fs.readFileSync(path.join(root,'frontend','src','app','page.tsx'),'utf8');
const routeActions=[...code.matchAll(/case\s+'([^']+)'\s*:/g)].map(m=>m[1]);
const uiActions=[...page.matchAll(/api(?:<[^>]+>)?\(\s*'([^']+)'/g)].map(m=>m[1]);
const missing=[...new Set(uiActions)].filter(a=>!routeActions.includes(a));
if(missing.length) throw new Error('UI actions missing backend routes: '+missing.join(', '));
const funcs=new Set([...code.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)].map(m=>m[1]));
const routedFuncs=[];
for(const a of routeActions){const re=new RegExp(`case\\s+'${a}'\\s*:\\s*(?:return\\s+)?(?:withAuth\\([^,]+,\\s*auth\\s*=>\\s*)?([A-Za-z0-9_]+)\\s*\\(`);const m=code.match(re);if(m)routedFuncs.push([a,m[1]]);}
const bad=routedFuncs.filter(([,f])=>!funcs.has(f));
if(bad.length) throw new Error('Routes reference undefined functions: '+bad.map(x=>x.join('->')).join(', '));
console.log(`PASS contract: ${new Set(uiActions).size} UI actions map to backend routes; routed functions are defined.`);
