import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
const assets=Object.fromEntries(readdirSync('web').map(f=>['/'+f,readFileSync('web/'+f,'utf8')]));
mkdirSync('dist/server',{recursive:true});writeFileSync('dist/server/index.js','const assets='+JSON.stringify(assets)+';\n'+readFileSync('web/validate.js','utf8')+'\n'+readFileSync('worker/api.js','utf8'));
