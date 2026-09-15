import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const json=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const spec=json('model/apartment.json'), measure=json('model/measurements.json'), validation=json('model/validation.json');
const checks=[];
function check(name,fn){try{fn();checks.push({name,pass:true});}catch(error){checks.push({name,pass:false,error:error.message});}}
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} differs from ${b}`);
check('North and south dimension chains close at 10.50 m',()=>{for(const key of ['north','south'])approx(spec.chains[key].reduce((a,b)=>a+b,0),10.5);});
check('West dimension chain closes at 12.90 m',()=>approx(spec.chains.west.reduce((a,b)=>a+b,0),12.9));
check('Specified main ceiling height is 2.80 m',()=>approx(spec.height,2.8));
const nodes=validation.objects;
function wallCenter(name){const o=nodes[name];assert.ok(o,'missing actual GLB object '+name);return(o.bounds[0][0]+o.bounds[1][0])/2;}
check('Actual GLB southern wall references match 3.50 / 4.00 / 3.00',()=>{
  const a=wallCenter('wall_master_living_0_0_lower');const b=wallCenter('wall_living_se_0_0_lower');
  approx(a,3.5);approx(b-a,4);approx(10.5-b,3);
});
check('Actual GLB north partitions match 2.80 / 2.80 / 2.60',()=>{
  const a=wallCenter('wall_northwest_x_0_0_lower'),b=wallCenter('wall_x_kitchen_0_0_lower');
  approx(a-.9,2.8);approx(b-a,2.8);approx(9.1-b,2.6);
});
check('NW door hinge and real opening endpoint coincide',()=>{
  const door=measure.components.find(o=>o.type==='door'&&o.id==='northwest');
  const wall=measure.components.find(o=>o.type==='wall'&&o.id==='northwest_south');
  approx(door.hinge[0],wall.a[0]+wall.openings[0][1]);approx(door.hinge[1],wall.a[1]);
  approx(door.width,wall.openings[0][1]-wall.openings[0][0]);
  assert.ok(Math.sin(door.openAngle)<0,'Door should open north into bedroom');
  assert.ok(nodes.door_northwest_lower&&nodes.jamb_northwest_lower);
});
check('Both storage niches and master contain no generated cabinet assets',()=>{
  const names=Object.keys(nodes);assert.ok(!names.some(n=>/washing_machine|utility_cabinet|closet_cabinet|master_wardrobe/i.test(n)));
  assert.ok(names.includes('wall_utility_south_0_0_lower'));assert.ok(names.includes('wall_closet_south_0_0_lower'));
});
check('Common bathroom privacy door is independent of shower glass',()=>{
  assert.ok(nodes.Common_bath_sliding_privacy_panel_lower);assert.ok(nodes.Common_shower_glass_lower);
  const panel=nodes.Common_bath_sliding_privacy_panel_lower.bounds;
  // Panel is east of the wall, in its south storage position; one metre entry stays clear.
  assert.ok(panel[0][0]>2.45);assert.ok(panel[1][1]<12.9-4.45+.01);
});
check('Actual Blender source and independently reimported GLB match',()=>{
  assert.equal(validation.roundtrip_pass,true);assert.equal(validation.source_objects,validation.reimport_objects);
  assert.ok(validation.max_bound_error_m<.0001);assert.equal(validation.source_triangles,validation.reimport_triangles);
});
check('Current export and spec match measured artifact digests',()=>{
  const hash=p=>createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
  assert.equal(hash('model/apartment.json'),measure.spec_sha256);assert.equal(hash(`public/models/${spec.assetStem}.glb`),validation.glb_sha256);
});
const result={checks,passed:checks.filter(c=>c.pass).length,total:checks.length};
writeFileSync(new URL('../model/checks.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(result.passed!==result.total)process.exitCode=1;
