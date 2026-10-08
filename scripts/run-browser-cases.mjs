import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
const option = (name, fallback) => { const i=process.argv.indexOf(name); return i<0 ? fallback : process.argv[i+1]; };
const inventoryPath=option('--inventory','test-results/browser-inventory.json');
const [shard,total]=option('--shard','1/1').split('/').map(Number);
if(!Number.isInteger(shard)||!Number.isInteger(total)||shard<1||shard>total)throw Error('Invalid shard');
const inventory=JSON.parse(await fs.readFile(inventoryPath));
function* specs(suites){for(const suite of suites){yield* suite.specs;yield* specs(suite.suites??[]);}}
const cases=[...specs(inventory.suites)].flatMap(spec=>spec.tests.map(test=>({
  id:spec.id,title:spec.title,file:spec.file,line:spec.line,project:test.projectName,
})));
// Balance the measured expensive flows; assignment is deterministic on every
// runner. The final inventory guard still requires every case exactly once.
const weight=c=>/standard rendering/.test(c.title)?8:/section caps/.test(c.title)?4:/homepage preload, model/.test(c.title)?4:/mobile touch/.test(c.title)?2:1;
const groups=Array.from({length:total},()=>({weight:0,cases:[]}));
for(const c of [...cases].sort((a,b)=>weight(b)-weight(a)||a.id.localeCompare(b.id))){
  const group=groups.reduce((best,g)=>g.weight<best.weight?g:best,groups[0]);
  group.cases.push(c);group.weight+=weight(c);
}
const selected=groups[shard-1].cases;
const root=option('--output','test-results/browser-cases');
const blobs=option('--blobs','blob-report');
await fs.mkdir(root,{recursive:true});await fs.mkdir(blobs,{recursive:true});
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
let failures=0;
for(const [index,c] of selected.entries()){
  const name=`${shard}-${index}-${c.id}`;
  const folder=path.resolve(root,name),blob=path.join(folder,'blob');
  await fs.mkdir(folder,{recursive:true});
  const file=path.resolve(inventory.config.rootDir,c.file);
  const args=['node_modules/@playwright/test/cli.js','test',`${file}:${c.line}`,'--grep',`${escape(c.title)}$`,'--output',path.join(folder,'results'),'--reporter=list,blob'];
  if(c.project)args.push('--project',c.project);
  console.log(`Case ${index+1}/${selected.length}: ${c.title}`);
  const code=await new Promise(resolve=>{
    const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,PLAYWRIGHT_BLOB_OUTPUT_DIR:blob}});
    child.on('error',()=>resolve(1));child.on('exit',code=>resolve(code??1));
  });
  failures+=code!==0?1:0;
  // Each process owns a temporary blob folder; copying after it exits prevents
  // the next reporter's cleanup from deleting already completed evidence.
  for(const file of await fs.readdir(blob))if(file.endsWith('.zip'))await fs.copyFile(path.join(blob,file),path.join(blobs,`${name}.zip`));
}
await fs.writeFile(path.join(root,`shard-${shard}.json`),JSON.stringify({shard,total,inventoryPath,cases:selected,failures},null,2)+'\n');
if(failures)process.exitCode=1;
