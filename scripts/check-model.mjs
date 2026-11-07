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
const southeastWardrobe = spec.furnishings?.find(item => item.id === 'southeast-wardrobe');
const priorNodeNames = Object.keys(nodes).filter(name => name !== southeastWardrobe?.node);
const childroom = spec.revisions.find(r => r.id === 'northwest-childroom-pink');
const childroomWindowParts = new Set(childroom?.windowChangedNodes);
const childroomEntities = new Set(childroom?.entityIds);
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
check('Living glazing reaches the floor and room-specific windows retain their specified sills',()=>{
  assert.ok(!Object.keys(nodes).some(n => /^(Living_south|Master_south|SE_south|NW_north|X_north).*guard/i.test(n)));
  const living=nodes.Living_south_glass_lower.bounds;
  assert.ok(living[0][2]<.08);
  for (const id of ['Master_south', 'SE_south', 'NW_north']) {
    const window = spec.windowDefinitions.find(w => w.id === id);
    approx(nodes[id + '_glass_lower'].bounds[0][2], window.sill + .025);
    approx(nodes[id + '_glass_upper'].bounds[1][2], window.head - .025);
  }
  const study=nodes.X_north_glass_lower.bounds;
  approx(study[0][2],spec.windowDefinitions.find(w=>w.id==='X_north').sill+.025);
  assert.ok(nodes.X_north_glass_upper.bounds[1][2]>2.50);
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
check('Earlier removed elevator shell and unused wardrobes remain absent',()=>{
  assert.ok(!priorNodeNames.some(n => !n.startsWith('Furniture_childroom_') && /Elevator_(slab|core)|wardrobe|wall_elevator_(north|south|east)/i.test(n)));
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
if(spec.furnishings?.length) {
  const furniture=json('model/furniture-measurements.json');
  const sofa = spec.furnishings.find(c=>c.id==='living-sofa');
  if(sofa?.source) check('Tripo sofa retains the source bounds, PBR material and back-wall clearance',()=>{
    const hash=p=>createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
    assert.equal(hash(sofa.source.path),sofa.source.sha256);
    const current=nodes[sofa.node];
    assert.deepEqual(current.materials,['Tripo_sofa_original_PBR']);
    approx(current.bounds[1][0]-current.bounds[0][0],sofa.dimensions[1]);
    approx(current.bounds[1][1]-current.bounds[0][1],sofa.dimensions[0]);
    approx(current.bounds[1][2]-current.bounds[0][2],sofa.dimensions[2]);
    approx(current.bounds[0][2],sofa.source.floorElevation);
    assert.ok(current.bounds[0][0]>3.60,'sofa penetrates west finish');
    assert.equal(current.triangles,149999);
    assert.equal(validation.model_packages.length,spec.modelPackages.length);
    for(const p of validation.model_packages) assert.equal(hash(p.path),p.sha256);
  });
  check('Measured table follows the supplied 2800 x 900 x 750 mm drawing and asymmetric supports',()=>{
    assert.equal(furniture.version,spec.version);
    assert.equal(furniture.sourceSha256,validation.source_sha256);
    assert.equal(furniture.specSha256,measure.spec_sha256);
    const parts=furniture.components.find(c=>c.id==='dining-work-table').parts;
    const top=parts.find(c=>c.name.includes('_tabletop_')).bounds;
    approx(top[1][0]-top[0][0],.9);approx(top[1][1]-top[0][1],2.8);
    approx(top[1][2],.75);approx(top[1][2]-top[0][2],.07);
    const panel=parts.find(c=>c.name.includes('_panel_support_')).bounds;
    approx(panel[1][0]-panel[0][0],.53);approx(panel[1][1]-panel[0][1],.08);
    const sides=parts.filter(c=>c.name.includes('_storage_side_')).map(c=>c.bounds);
    const low=Math.min(...sides.map(b=>b[0][1])),high=Math.max(...sides.map(b=>b[1][1]));
    approx(high-low,.60);for(const b of sides){approx(b[1][0]-b[0][0],.70);approx(b[1][1]-b[0][1],.05);approx(b[1][2],.68);}
    approx(panel[0][1]-high,1.6);approx(low-top[0][1],.26);approx(top[1][1]-panel[1][1],.26);
    assert.equal(parts.filter(c=>c.name.includes('_pullout_tray_')).length,6);
  });
  check('Furnishing preserves v06 architecture outside the explicitly revised photo doorway, facing arrangement and open center',()=>{
    const old=json('model/baseline-v06/validation.json');
    const photoDoorNodes=new Set(spec.revisions.filter(r=>r.id==='living-v06-photo-tv-wall').flatMap(r=>r.nodeNames??[]));
    const allowedStudy=new Set(spec.studyDecision ? [
      ...spec.entities.find(e=>e.windowId==='X_north').sourceNodes,
      'wall_north_3_0_lower',
    ] : []);
    for(const [name,o] of Object.entries(old.objects)){
      if(photoDoorNodes.has(name))continue;
      assert.ok(nodes[name],name);assert.equal(nodes[name].entityId,o.entityId,name);assert.equal(nodes[name].triangles,o.triangles,name);
      if(allowedStudy.has(name) || childroomWindowParts.has(name))continue;
      for(let side=0;side<2;side++)for(let axis=0;axis<3;axis++)approx(nodes[name].bounds[side][axis],o.bounds[side][axis]);
    }
    assert.ok(!spec.entities.some(e=>/coffee-table/.test(e.id)));
    const sofa=spec.furnishings.find(c=>c.id==='living-sofa'),cabinet=spec.furnishings.find(c=>c.id==='living-modular-cabinet');
    assert.deepEqual(sofa.front,[1,0]);assert.deepEqual(cabinet.front,[-1,0]);assert.ok(sofa.position[0]<cabinet.position[0]);
    const table=spec.furnishings.find(c=>c.id==='dining-work-table'),bench=spec.furnishings.find(c=>c.id==='dining-bench');
    const chairs=spec.furnishings.filter(c=>c.recipe==='chair');assert.equal(chairs.length,4);
    assert.ok(bench.position[0]<table.position[0]);for(const c of chairs)assert.ok(c.position[0]>table.position[0]);
  });
  check('Fourth dining chair matches the existing chair and remains distinct in actual geometry',()=>{
    const added=nodes.Furniture_dining_chair_4,existing=nodes.Furniture_dining_chair_1;
    assert.equal(added.entityId,'dining-chair-4');assert.equal(added.triangles,existing.triangles);
    assert.deepEqual(added.materials,existing.materials);
    for(let axis=0;axis<3;axis++)approx(added.bounds[1][axis]-added.bounds[0][axis],existing.bounds[1][axis]-existing.bounds[0][axis]);
    for(const chair of spec.furnishings.filter(c=>c.recipe==='chair'&&c.id!=='dining-chair-4')){
      const other=nodes[chair.node].bounds;
      assert.ok(added.bounds[0][1]-other[1][1]>.02,'chair footprints overlap');
    }
  });
  const cabinet=spec.furnishings.find(c=>c.id==='living-modular-cabinet');
  if(cabinet.moduleHeights) check('Measured cabinet tiers and wall display follow the revised hanging layout',()=>{
    const parts=furniture.components.find(c=>c.id===cabinet.id).parts;
    let t=cabinet.position[1]-cabinet.dimensions[0]/2;
    cabinet.moduleWidths.forEach((w,i)=>{
      const y=spec.coordinateSystem.planSouthExtent-(t+w/2);
      const group=parts.filter(p=>Math.abs((p.bounds[0][1]+p.bounds[1][1])/2-y)<w/2-.012);
      assert.ok(group.length>5);approx(Math.max(...group.map(p=>p.bounds[1][2])),cabinet.moduleHeights[i]);t+=w;
    });
    const display=spec.furnishings.find(c=>c.id==='living-art-panels');
    const bounds=nodes[display.node].bounds;
    approx(bounds[1][1]-bounds[0][1],display.dimensions[0]);approx(bounds[1][2]-bounds[0][2],display.dimensions[2]);
    approx((bounds[0][2]+bounds[1][2])/2,display.centerHeight);
    assert.ok(!furniture.components.find(c=>c.id===display.id).parts.some(p=>p.name.includes('panel_board')));
    // The wall display spans the low modules and stops before the high end module.
    assert.ok(display.position[1]+display.dimensions[0]/2 < cabinet.position[1]+cabinet.dimensions[0]/2-cabinet.moduleWidths.at(-1));
  });
  const television=spec.furnishings.find(c=>c.recipe==='television');
  if(television) check('Television replaces the painting with a clear screen and stable query identity',()=>{
    assert.equal(television.id,'living-art-panels');assert.deepEqual(television.front,[-1,0]);
    assert.ok(!spec.furnishings.some(c=>c.recipe==='framed_art'||c.recipe==='art_panels'));
    const parts=furniture.components.find(c=>c.id===television.id).parts;
    assert.equal(parts.filter(p=>p.name.includes('_tv_screen_')).length,1);
    assert.ok(!nodes[television.node].materials.includes('Furniture_art_atlas'));
    const screen=parts.find(p=>p.name.includes('_tv_screen_')).bounds;
    const cabinetTop=cabinet.moduleHeights ? Math.max(...cabinet.moduleHeights.slice(1,-1)) : nodes[cabinet.node].bounds[1][2];
    assert.ok(screen[0][2]>cabinetTop+.20);
    const lamp=spec.furnishings.find(c=>c.id==='living-table-lamp');
    const lampBounds=nodes[lamp.node].bounds;
    // Lamp is beside the screen in the wall elevation; a different depth cannot hide overlap.
    assert.ok(lampBounds[1][1]<screen[0][1]||lampBounds[0][1]>screen[1][1]);
    const screenMaterial=spec.furnitureMaterials.find(m=>m.id==='Furniture_tv_screen');
    assert.ok(!screenMaterial.texture);assert.equal(screenMaterial.emissionStrength,0);
    if(television.diagonalInches===85){
      const width=screen[1][1]-screen[0][1],height=screen[1][2]-screen[0][2];
      assert.ok(Math.abs(Math.hypot(width,height)/.0254-85)<.02);
      assert.ok(Math.abs(width/height-16/9)<.002);
    }
  });
  if(cabinet.recipe==='floating_cabinet') {
    const component=id=>furniture.components.find(c=>c.id===id);
    check('Low floating cabinet has a real floor gap, closed drawers and socket service clearance',()=>{
      const parts=component(cabinet.id).parts;
      const body=parts.filter(p=>p.name.includes('_carcass_')).map(p=>p.bounds);
      approx(Math.min(...body.map(b=>b[0][2]))-.016,.12);
      approx(Math.max(...body.map(b=>b[1][2]))-.016,.42);
      assert.equal(parts.filter(p=>p.name.includes('_drawer_face_')).length,5);
      assert.ok(!parts.some(p=>p.name.includes('plinth')));
      const back=parts.find(p=>p.name.includes('_removable_service_back_')).bounds;
      const sockets=component('living-tv-outlets').parts.filter(p=>p.name.includes('_plate_'));
      for(const p of sockets){assert.ok(p.bounds[0][0]-back[1][0]>.065);assert.ok(p.bounds[0][2]>.136+.018&&p.bounds[1][2]<.436-.018);}
      const brackets=parts.filter(p=>p.name.includes('_wall_bracket_'));
      for(const p of sockets)for(const b of brackets)assert.ok(b.bounds[1][1]<p.bounds[0][1]||b.bounds[0][1]>p.bounds[1][1]);
    });
    check('Photographed socket groups retain their common height and middle-wall placement',()=>{
      const parts=component('living-tv-outlets').parts.filter(p=>p.name.includes('_plate_'));
      assert.equal(parts.length,2);
      for(const [label,t,width] of [['triple',10.26,.258],['single',10.92,.086]]){
        const b=parts.find(p=>p.name.includes('_outlet_'+label+'_')).bounds;
        approx(12.9-(b[0][1]+b[1][1])/2,t);approx((b[0][2]+b[1][2])/2,.355);approx(b[1][1]-b[0][1],width);
      }
      const cab=nodes[cabinet.node].bounds;
      for(const p of parts)assert.ok(p.bounds[0][1]>cab[0][1]&&p.bounds[1][1]<cab[1][1]);
    });
    check('Selected C extends the low cabinet and exposes the wall side and bedroom doorway',()=>{
      assert.ok(!spec.entities.some(e=>e.id==='living-tall-cabinet'));
      assert.ok(!Object.keys(nodes).some(name=>name.startsWith('Furniture_living_tall_cabinet')));
      assert.ok(!furniture.components.some(c=>c.id.startsWith('living-tall-cabinet')));
      const cab=nodes[cabinet.node].bounds;
      approx(cab[1][1]-cab[0][1],3.56);approx(cab[1][0]-cab[0][0],.40);
      approx(12.9-cab[1][1],8.57);approx(12.9-cab[0][1],12.13);
      const parts=component('living-tv-wall-finish').parts;
      const side=parts.find(p=>p.name.includes('_left_black_return_')).bounds;
      const light=parts.find(p=>/_vertical_light_\d+$/.test(p.name)).bounds;
      assert.ok(side[0][1]-cab[1][1]>.02);
      assert.ok(cab[0][1]-light[1][1]>.02);
      const jamb=nodes.jamb_far_southeast_lower.bounds;
      assert.ok(jamb[0][1]-cab[1][1]>.04);
      assert.ok(nodes.door_southeast_lower.bounds[0][0]>cab[1][0]);
      const stone=nodes.Furniture_living_tv_stone.bounds;
      assert.ok(cab[0][1]>stone[1][1]);
    });
    check('Photo wall retains four vertical panel bays, continuous stone and warm light across cut height',()=>{
      for(const id of ['living-tv-wall-finish','living-tv-wall-finish-upper'])assert.equal(component(id).parts.filter(p=>p.name.includes('_greige_panel_')).length,4);
      for(const tag of ['greige_panel_0','greige_panel_1','greige_panel_2','greige_panel_3','vertical_light','left_black_return']){
        const low=component('living-tv-wall-finish').parts.find(p=>p.name.includes('_'+tag+'_')).bounds;
        const high=component('living-tv-wall-finish-upper').parts.find(p=>p.name.includes('_'+tag+'_')).bounds;
        approx(low[1][2],high[0][2]);for(const a of [0,1])for(const side of [0,1])approx(low[side][a],high[side][a]);
      }
      assert.ok(nodes.Furniture_living_tv_stone.materials.includes('Grey_olive_niche_stone'));
      assert.ok(nodes.Furniture_living_tv_wall_finish.materials.includes('Furniture_tv_wall_light'));
    });
    check('Black return is the built-out wall side beside a tall flush bedroom doorway',()=>{
      const parts=component('living-tv-wall-finish').parts;
      const side=parts.find(p=>p.name.includes('_left_black_return_')).bounds;
      assert.ok(side[1][0]-side[0][0]>.22);assert.ok(side[1][1]-side[0][1]<.009);
      const grey=parts.find(p=>p.name.includes('_greige_panel_0_')).bounds;
      approx(grey[0][0],7.198);
      const doorway=spec.doors.find(c=>c.id==='southeast');assert.deepEqual(doorway.hinge,[7.5,7.62]);approx(doorway.width,.90);
      assert.equal(doorway.finish.style,'flush');approx(doorway.finish.openingHeight,2.62);
      const jamb=nodes.jamb_far_southeast_upper.bounds;approx(jamb[1][1]-jamb[0][1],.010);approx(jamb[1][2],2.62);
      assert.ok(nodes.jamb_southeast_upper.materials.includes('Warm_white_plaster'));
      approx(nodes.wall_living_se_1_1_upper.bounds[0][2],2.62);
    });
  }
}
const studyBookcaseRevision=spec.revisions.find(r=>r.id==='study-full-wall-20261107');
const studyChangedEntities=new Set(studyBookcaseRevision?.entityIds);
if(spec.studyDecision) {
  const old=json('model/baseline-v09/validation.json'), furniture=json('model/furniture-measurements.json');
  check('Recorded living and study changes preserve every other v09 part',()=>{
    const allowed=new Set([...spec.entities.find(e=>e.windowId==='X_north').sourceNodes,'wall_north_3_0_lower']);
    const livingChanges=new Set(spec.revisions.find(r=>r.id==='living-study-integrated')?.livingChangedNodesFromV09 ?? []);
    for(const [name,o] of Object.entries(old.objects)) {
      if(livingChanges.has(name))continue;
      const current=nodes[name];assert.ok(current,name);assert.equal(current.entityId,o.entityId,name);
      if(allowed.has(name) || childroomWindowParts.has(name))continue;
      assert.equal(current.triangles,o.triangles,name);
      for(let side=0;side<2;side++)for(let axis=0;axis<3;axis++)approx(current.bounds[side][axis],o.bounds[side][axis]);
    }
    const ids=spec.modelPackages.find(p=>p.id==='study').entityIds;
    assert.equal(ids.length,5);
    for(const id of ids)assert.deepEqual(spec.entities.find(e=>e.id===id).roomIds,['xroom']);
  });
  const parts=id=>furniture.components.find(c=>c.id===id).parts;
  const config=spec.furnishings.find(f=>f.id==='study-bookcase');
  const bookcase=nodes.Furniture_study_bookcase.bounds;
  check('Actual study retains its specified desk dimensions',()=>{
    const top=parts('study-standing-desk').find(p=>p.name.includes('_desk_top_')).bounds;
    approx(top[1][0]-top[0][0],.70);approx(top[1][1]-top[0][1],1.40);approx(top[1][2]-.024,.74);
  });
  if(studyBookcaseRevision) {
    check('Full-wall bookcase spans 3.19 m with flush window-side doors and sill clearance',()=>{
      const bookcaseParts=parts('study-bookcase');
      const findParts=label=>bookcaseParts.filter(part=>part.name.includes(`_${label}_`));
      approx(bookcase[1][0]-bookcase[0][0],.40);
      approx(bookcase[1][1]-bookcase[0][1],3.19);
      approx(bookcase[1][2]-bookcase[0][2],2.50);
      approx(bookcase[0][2],config.floorElevation);
      approx(spec.coordinateSystem.planSouthExtent-bookcase[1][1],.10);
      approx(spec.coordinateSystem.planSouthExtent-bookcase[0][1],3.29);
      approx(config.moduleWidths.reduce((a,b)=>a+b,0),config.dimensions[0]);
      assert.deepEqual(config.sideFillers,[.025,.05]);
      const flushPanels=[
        ...findParts('north_solid_door'),
        ...findParts('glass_stile'),
        ...findParts('window_scribe'),
        ...findParts('floating_drawer'),
      ];
      assert.equal(findParts('north_solid_door').length,1);
      assert.equal(findParts('glass_stile').length,4);
      assert.equal(findParts('window_scribe').length,3);
      assert.equal(findParts('solid_pair_door').length,2);
      assert.equal(findParts('glass_leaf').length,2);
      assert.equal(findParts('open_vertical_mullion').length,2);
      assert.equal(findParts('floating_drawer').length,6);
      for(const panel of flushPanels)approx(panel.bounds[1][0],bookcase[1][0]);
      const sill=nodes.X_north_stone_sill.bounds;
      for(const part of bookcaseParts) {
        const intersects=sill[0].every((min,axis)=>
          Math.min(sill[1][axis],part.bounds[1][axis])-Math.max(min,part.bounds[0][axis])>1e-5);
        assert.ok(!intersects,`Window sill intersects ${part.name}`);
      }
    });
  } else {
    check('Actual study has one deep seat-base row and four facade modules',()=>{
      const bench=parts('study-bookcase').find(p=>p.name.includes('_bench_top_')).bounds;
      approx(bench[1][0]-bench[0][0],.80);approx(bench[1][1]-bench[0][1],3);approx(bench[1][2]-.024,.42);
      assert.equal(parts('study-bookcase').filter(p=>p.name.includes('_single_row_drawer_')).length,4);
      const cushion=parts('study-bookcase').find(p=>p.name.includes('_seat_cushion_')).bounds;
      approx(cushion[1][2]-.024,.45);
      approx(config.moduleWidths.reduce((a,b)=>a+b,0),3);
      approx(config.upperDepth,.35);approx(config.dimensions[1]-config.upperDepth,.45);
    });
  }
  check('Actual study furniture clears the fixed walls and slider',()=>{
    const desk=nodes.Furniture_study_standing_desk.bounds, side=nodes.Furniture_study_side_cabinet.bounds;
    approx(desk[0][0]-bookcase[1][0],studyBookcaseRevision ? 1.47 : 1.07);
    assert.ok(bookcase[0][0]>=3.788 && side[1][0]<6.412,'furniture crosses wall/skirting');
    assert.ok(12.9-bookcase[0][1]<3.30,'bookcase crosses southern door frame');
    assert.ok(12.9-side[0][1]<3.10,'cabinet reaches southern sliding door');
    assert.deepEqual(spec.rooms.find(r=>r.id==='xroom').walkEntry,[5.30,2.97]);
    if(!studyBookcaseRevision)assert.match(spec.entities.find(e=>e.id==='study-bookcase').basis,/移椅/);
  });
}
function assertPart(name,original) {
    const actual=nodes[name];assert.ok(actual,name);
    assert.equal(actual.entityId,original.entityId,name);assert.equal(actual.triangles,original.triangles,name);
    // Blender numeric suffixes vary with import order; compare stable material identities.
    if(original.materials)assert.deepEqual(actual.materials.map(m=>m.replace(/\.\d{3}$/,'')),original.materials.map(m=>m.replace(/\.\d{3}$/,'')),name);
    for(let side=0;side<2;side++)for(let axis=0;axis<3;axis++)approx(actual.bounds[side][axis],original.bounds[side][axis]);
}
const integration=spec.revisions.find(r=>r.id==='living-study-integrated');
if(integration) {
  check('Integrated source preserves published parts outside recorded revisions',()=>{
    const baseline=json(integration.studyBaseline),livingChanges=new Set(integration.livingChangedNodesFromV09);
    const priorSpec=json('model/baseline-v13/apartment.json');
    const studyMaterialIds=new Set(Object.entries(baseline.objects).filter(([name])=>name.startsWith('Furniture_study_')).flatMap(([,part])=>part.materials.map(m=>m.replace(/\.\d{3}$/,''))));
    for(const prior of priorSpec.furnitureMaterials.filter(m=>studyMaterialIds.has(m.id)))assert.deepEqual(spec.furnitureMaterials.find(m=>m.id===prior.id),prior,prior.id);
    for(const [name,part] of Object.entries(baseline.objects))
      if(!livingChanges.has(name) && !childroomWindowParts.has(name) && !studyChangedEntities.has(part.entityId))assertPart(name,part);
  });
  check('Integrated source preserves the complete latest living model outside the published study window change',()=>{
    const baseline=json(integration.livingBaseline);
    const studyChanges=new Set([...spec.entities.find(e=>e.windowId==='X_north').sourceNodes,'wall_north_3_0_lower']);
    for(const [name,part] of Object.entries(baseline.objects))if(!studyChanges.has(name) && !childroomWindowParts.has(name))assertPart(name,part);
    const expectedNames=new Set([...Object.keys(baseline.objects),...spec.modelPackages.find(p=>p.id==='study').entityIds.flatMap(id=>spec.entities.find(e=>e.id===id).sourceNodes)]);
    assert.deepEqual(priorNodeNames.filter(name => !childroomEntities.has(nodes[name].entityId)).sort(), [...expectedNames].sort());
  });
}
if(studyBookcaseRevision) {
  check('Only the bookcase changes against the preceding model',()=>{
    const previous=json(studyBookcaseRevision.baseline);
    assert.deepEqual([...priorNodeNames].sort(),Object.keys(previous.objects).sort());
    for(const [name,part] of Object.entries(previous.objects))
      if(!studyChangedEntities.has(part.entityId))assertPart(name,part);
  });
}
if (childroom) {
  const previous = json(childroom.baseline);
  const furniture = json('model/furniture-measurements.json');
  const component = id => furniture.components.find(c => c.id === 'childroom-' + id);
  check('Northwest room integration preserves the prior model outside recorded revisions', () => {
    for (const [name, prior] of Object.entries(previous.objects)) {
      const current = nodes[name];
      assert.ok(current, name);
      assert.equal(current.entityId, prior.entityId, name);
      if (childroomWindowParts.has(name) || studyChangedEntities.has(prior.entityId)) continue;
      assert.equal(current.triangles, prior.triangles, name);
      assert.deepEqual(current.materials.map(m => m.replace(/\.\d{3}$/, '')),
        prior.materials.map(m => m.replace(/\.\d{3}$/, '')), name);
      for (let side = 0; side < 2; side++)
        for (let axis = 0; axis < 3; axis++)
          approx(current.bounds[side][axis], prior.bounds[side][axis]);
    }
    const added = priorNodeNames.filter(name => !previous.objects[name]);
    assert.deepEqual(new Set(added.map(name => nodes[name].entityId)), childroomEntities);
    for (const id of childroomEntities)
      assert.deepEqual(spec.entities.find(e => e.id === id).roomIds, ['northwest']);
  });
  check('Actual childroom stairs have two equal rises, two drawers and a direct boarding edge', () => {
    const stairs = component('stairs').parts;
    const treads = stairs.filter(p => /_tread_[12]_/.test(p.name))
      .sort((a, b) => a.bounds[1][2] - b.bounds[1][2]);
    assert.equal(treads.length, 2);
    assert.equal(stairs.filter(p => /_drawer_[12]_/.test(p.name)).length, 2);
    const deck = component('bed').parts.find(p => /_deck_\d+$/.test(p.name)).bounds;
    const wardrobe = component('wardrobe').parts.find(p => /_carcass_/.test(p.name)).bounds;
    const floor = nodes.floor_northwest.bounds[1][2];
    const rise = spec.furnishings.find(f => f.id === 'childroom-stairs').rise;
    approx(treads[0].bounds[1][2] - floor, rise);
    approx(treads[1].bounds[1][2] - treads[0].bounds[1][2], rise);
    approx(treads[1].bounds[0][1], deck[1][1]);
    approx(treads[1].bounds[0][0], wardrobe[1][0]);
    approx(deck[1][2] - treads[1].bounds[1][2], rise);
    assert.ok(treads[1].bounds[1][1] < nodes.NW_north_stone_sill.bounds[0][1]);
    for (const [i, sample] of validation.childroom_step_samples.entries()) {
      assert.equal(sample.object, 'Furniture_childroom_stairs');
      approx(sample.height, treads[i].bounds[1][2]);
    }
    assert.equal(validation.childroom_step_samples.length, 2);
    assert.equal(validation.childroom_boarding_clear, true);
  });
  check('Fitted bed, east-facing wardrobe and stair envelope follow the user dimensions', () => {
    const fit = spec.revisions.find(r => r.id === 'northwest-childroom-fitted-joinery');
    const prior = json(fit.baseline);
    for (const [name, original] of Object.entries(prior.objects)) {
      if (fit.entityIds.includes(original.entityId) || studyChangedEntities.has(original.entityId)) continue;
      const current = nodes[name];
      assert.equal(current.entityId, original.entityId, name);
      assert.equal(current.triangles, original.triangles, name);
      assert.deepEqual(current.materials.map(m => m.replace(/\.\d{3}$/, '')),
        original.materials.map(m => m.replace(/\.\d{3}$/, '')), name);
      for (let side = 0; side < 2; side++)
        for (let axis = 0; axis < 3; axis++)
          approx(current.bounds[side][axis], original.bounds[side][axis]);
    }
    assert.deepEqual([...priorNodeNames].sort(), Object.keys(prior.objects).sort());
    const bed = nodes.Furniture_childroom_bed.bounds;
    const deck = component('bed').parts.find(p => /_deck_\d+$/.test(p.name)).bounds;
    const wardrobe = component('wardrobe').parts;
    const carcass = wardrobe.find(p => /_carcass_/.test(p.name)).bounds;
    const doors = wardrobe.filter(p => /_tall_door_/.test(p.name));
    const stairs = nodes.Furniture_childroom_stairs.bounds;
    approx(bed[1][1] - bed[0][1], 2);
    approx(bed[1][0] - bed[0][0], 1.5);
    approx(deck[1][2] - nodes.floor_northwest.bounds[1][2], 1);
    assert.equal(doors.length, 2);
    assert.deepEqual(spec.furnishings.find(f => f.id === 'childroom-wardrobe').front, [1, 0]);
    for (const door of doors) {
      assert.ok(door.bounds[1][0] > carcass[1][0]);
      assert.ok(door.bounds[1][1] - door.bounds[0][1] > .50);
    }
    assert.ok(stairs[0][0] >= bed[0][0]);
    approx(stairs[1][0], bed[1][0]);
    approx(carcass[0][0], bed[0][0]);
    approx(carcass[0][1], bed[1][1]);
    const north = spec.walls.find(w => w.id === 'north');
    const south = spec.walls.find(w => w.id === 'northwest_south');
    const extent = spec.coordinateSystem.planSouthExtent;
    approx(extent - carcass[1][1] - north.thickness / 2, .01);
    approx(south.a[1] - south.thickness / 2 - (extent - bed[0][1]), .01);
  });
  check('Northwest opening follows the local annotation without moving its center', () => {
    const window = spec.windowDefinitions.find(w => w.id === 'NW_north');
    const north = measure.components.find(c => c.type === 'wall' && c.id === 'north');
    const [from, to, sill, head] = north.openings[0];
    approx(window.sill, .70);
    approx(window.head - window.sill, 1.79);
    approx(window.width, 1.69);
    approx(north.a[0] + (from + to) / 2, window.x);
    approx(to - from, window.width);
    approx(sill, window.sill);
    approx(head, window.head);
  });
}
if (southeastWardrobe) {
  check('Southeast wardrobe bounds fit the approved placement and clear the room door', () => {
    const actual = nodes[southeastWardrobe.node];
    assert.equal(actual.entityId, southeastWardrobe.id);
    const [min, max] = actual.bounds;
    approx(max[0] - min[0], 1.40);
    approx(max[1] - min[1], .60);
    approx(max[2] - min[2], 2.40);
    approx(min[2], nodes.floor_southeast.bounds[1][2]);
    const [shortWallMin] = nodes.wall_east_notch_0_0_lower.bounds;
    const [eastWallMin] = nodes.wall_east_south_0_0_lower.bounds;
    approx(shortWallMin[0] - min[0], .12);
    approx(shortWallMin[1] - max[1], .02);
    approx(eastWallMin[0] - max[0], .02);
    const door = spec.doors.find(item => item.id === 'southeast');
    const [hingeX, hingeT] = door.hinge.map((value, i) => value + door.leafOffset[i]);
    const backT = spec.coordinateSystem.planSouthExtent - max[1];
    assert.ok(min[0] > hingeX && backT > hingeT);
    assert.ok(Math.hypot(min[0] - hingeX, backT - hingeT) > door.width);
  });
  check('Southeast wardrobe has six individual door fronts and two drawers', () => {
    const { components } = json('model/furniture-measurements.json');
    const { parts } = components.find(component => component.id === southeastWardrobe.id);
    for (const label of ['left_upper_door', 'right_upper_door', 'right_lower_door', 'left_drawer_front'])
      assert.equal(parts.filter(part => part.name.includes('_' + label + '_')).length, 2, label);
  });
}
const result={checks,passed:checks.filter(c=>c.pass).length,total:checks.length};
writeFileSync(new URL('../model/checks.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));if(result.passed!==result.total)process.exitCode=1;
