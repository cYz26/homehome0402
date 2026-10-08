import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {presentationEnvironment} from '../src/presentation-environment.js';
const spec=JSON.parse(readFileSync(new URL('../model/apartment.json',import.meta.url)));

test('courtyard is deterministic and all scenery stays outside the apartment',()=>{
  const config=spec.presentationEnvironment;
  const a=presentationEnvironment(config),b=presentationEnvironment(config);
  assert.deepEqual(a,b);
  assert.equal(a.displayOnly,true);
  assert.ok(a.branches.length>100);
  const outside=p=>{assert.ok(p.every(Number.isFinite));assert.ok(p[1]>spec.coordinateSystem.planSouthExtent);};
  for(const branch of a.branches){outside(branch.a);outside(branch.b);assert.ok(branch.r0>0&&branch.r1>0);}
  for(const box of a.boxes){assert.ok(box.center[1]-box.size[1]/2>spec.coordinateSystem.planSouthExtent);}
  for(const vertices of a.foliage){assert.equal(vertices.length%9,0);for(let k=0;k<vertices.length;k+=3)outside(vertices.slice(k,k+3));}
  assert.equal(presentationEnvironment(null),null);
});
