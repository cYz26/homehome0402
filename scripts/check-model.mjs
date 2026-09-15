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
check('Common vanity mixer stands on the south wall side of the actual bowl',()=>{
  const tap=nodes.Common_basin_tap.bounds,bowl=nodes.Common_basin_bowl_floor.bounds;
  assert.ok(tap[1][1]<bowl[0][1],'Mixer should sit behind the bowl toward the south wall');
  assert.ok(tap[0][1]>12.9-5.50,'Mixer should remain inside the bathroom wall');
});
check('All parked north sliding leaves lie east-west, not perpendicular to the facade',()=>{
  const leaves=Object.entries(nodes).filter(([name])=>/^(X|Kitchen)_retracted_leaf_\d+_glass_lower$/.test(name));
  assert.ok(leaves.length>=2);
  for(const [name,{bounds:b}] of leaves)assert.ok(b[1][0]-b[0][0]>(b[1][1]-b[0][1])*10,name);
});
check('Living glazing reaches the floor; bedroom glazing has lowered sills and no guards',()=>{
  assert.ok(!Object.keys(nodes).some(n=>/guard/i.test(n)));
  const living=nodes.Living_south_glass_lower.bounds;
  assert.ok(living[0][2]<.08);
  for(const prefix of ['Master_south','SE_south','NW_north','X_north']) {
    const b=nodes[prefix+'_glass_lower'].bounds;
    assert.ok(b[0][2]<.32 && b[0][2]>.20,prefix);
    assert.ok(nodes[prefix+'_glass_upper'].bounds[1][2]>2.50,prefix);
  }
});
check('Kitchen equipment occupies west / north / east positions and sink is recessed',()=>{
  const fridge=nodes.Fridge_door_0_lower.bounds,oven=nodes.Oven_glass.bounds;
  assert.ok(fridge[1][0]<7.25 && oven[0][0]>8.25);
  assert.equal(Object.keys(nodes).filter(n=>/^Hob_burner_\d$/.test(n)).length,3);
  assert.ok(nodes.Extractor_inclined_glass.bounds[1][2]-nodes.Extractor_inclined_glass.bounds[0][2]>.2);
  const bowl=nodes.Kitchen_sink_bowl_floor.bounds,base=nodes.Kitchen_north_bases.bounds;
  assert.ok(base[1][2]<bowl[0][2],'Cabinet mass must not fill the sink bowl');
  assert.ok(bowl[0][1]>12.2 && bowl[1][2]<.78);
});
check('Earlier removed elevator shell and bedroom wardrobes remain absent',()=>{
  assert.ok(!Object.keys(nodes).some(n=>/Elevator_(slab|core)|wardrobe|wall_elevator_(north|south|east)/i.test(n)));
  assert.ok(nodes.wall_east_elevator_0_0_lower && nodes.wall_east_notch_0_0_lower);
});
check('North parked door frames are thin and the full stack is under 10 cm',()=>{
  const frames=Object.entries(nodes).filter(([name])=>/^(X|Kitchen)_retracted_leaf_\d+_stile_lower/.test(name));
  assert.ok(frames.length>=4);const b=frames.map(([,o])=>o.bounds);
  for(const a of b)assert.ok(a[1][1]-a[0][1]<.024);
  assert.ok(Math.max(...b.map(a=>a[1][1]))-Math.min(...b.map(a=>a[0][1]))<.10);
});
check('X room and kitchen have dark side surrounds, header and thresholds',()=>{
  for(const name of ['X_left','X_right','Kitchen_left','Kitchen_right']) {
    const node=nodes['North_surround_'+name+'_lower'];assert.ok(node);assert.ok(node.materials.includes('Graphite_frame'));
    assert.ok(nodes['North_surround_'+name+'_upper'].bounds[1][2]>2.50);
  }
  assert.ok(nodes.North_sliding_header&&nodes.North_surround_X_threshold&&nodes.North_surround_Kitchen_threshold);
});
check('Master vanity is a continuous 1.8 m double-user trough with two wall outlets',()=>{
  const b=nodes.Master_double_stone_trough.bounds;approx(b[1][0]-b[0][0],1.8);
  assert.ok(!nodes.Master_basin_bowl_floor);
  const outlets=Object.keys(nodes).filter(n=>/^Master_double_wall_spout_\d$/.test(n));assert.equal(outlets.length,2);
  assert.equal(validation.trough_downward_ray_samples.length,3);
  for(const ray of validation.trough_downward_ray_samples){assert.equal(ray.object,'Master_double_stone_trough');assert.ok(ray.height<.80 && ray.height>.70);}
});
check('Both bathrooms have thin dark privacy leaves and master entry remains clear',()=>{
  const common=nodes.Common_bath_sliding_privacy_panel_lower,master=nodes.Master_bath_sliding_privacy_glass_lower;
  for(const node of [common,master])assert.ok(node.materials.includes('Charcoal_bath_privacy_glass'));
  assert.ok(common.bounds[1][0]-common.bounds[0][0]<.020);
  assert.ok(master.bounds[1][1]-master.bounds[0][1]<.012);
  assert.ok(master.bounds[0][0]>1.91 && master.bounds[1][0]<2.91);
  assert.ok(nodes.Master_bath_sliding_track&&nodes.Master_bath_entry_head);
});
check('Actual Blender source and independently reimported GLB match',()=>{
  assert.equal(validation.roundtrip_pass,true);assert.equal(validation.source_objects,validation.reimport_objects);
  assert.ok(validation.max_bound_error_m<.0001);assert.equal(validation.source_triangles,validation.reimport_triangles);
});
check('Current export and spec match measured artifact digests',()=>{
  const hash=p=>createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
  assert.equal(hash('model/apartment.json'),measure.spec_sha256);assert.equal(hash(`asset_exchange/${spec.assetStem}.glb`),validation.glb_sha256);
});
const result={checks,passed:checks.filter(c=>c.pass).length,total:checks.length};
writeFileSync(new URL('../model/checks.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(result.passed!==result.total)process.exitCode=1;
