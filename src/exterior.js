import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { presentationEnvironment } from './presentation-environment.js';

export function createExterior(config, point) {
  const data=presentationEnvironment(config);
  const group=new THREE.Group();group.name='Display_only_courtyard';
  if(!data) return group;
  const materials=Object.fromEntries(Object.entries(data.materials).map(([id,m])=>[id,new THREE.MeshStandardMaterial({
    color:m.color,roughness:m.roughness,side:THREE.DoubleSide,
    emissive:m.emission ? m.color : 0,emissiveIntensity:m.emission ?? 0,
  })]));
  const cube=new THREE.BoxGeometry(1,1,1),axis=new THREE.Vector3(0,1,0);
  const cylinder=new THREE.CylinderGeometry(1,1,1,7);
  for(const [material,mat] of Object.entries(materials)) {
    const boxes=data.boxes.filter(b=>b.material===material);
    if(boxes.length) {
      const mesh=new THREE.InstancedMesh(cube,mat,boxes.length),dummy=new THREE.Object3D();
      boxes.forEach((b,i)=>{dummy.position.copy(point(b.center));dummy.scale.set(b.size[0],b.size[2],b.size[1]);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);});
      mesh.instanceMatrix.needsUpdate=true;mesh.receiveShadow=true;group.add(mesh);
    }
  }
  // Tapered branches and folded leaf geometry preserve parallax through the window.
  const branchGeometry=[];
  for(const b of data.branches) {
    const a=point(b.a),end=point(b.b),delta=end.clone().sub(a);
    const geometry=cylinder.clone();
    const pos=geometry.attributes.position;
    for(let i=0;i<pos.count;i++) {const radius=pos.getY(i)>0 ? b.r1 : b.r0;pos.setX(i,pos.getX(i)*radius);pos.setZ(i,pos.getZ(i)*radius);}
    geometry.computeVertexNormals();
    geometry.applyMatrix4(new THREE.Matrix4().compose(a.add(end).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(axis,delta.clone().normalize()),new THREE.Vector3(1,delta.length(),1)));
    branchGeometry.push(geometry);
  }
  if(branchGeometry.length)group.add(new THREE.Mesh(mergeGeometries(branchGeometry),materials.bark));
  branchGeometry.forEach(g=>g.dispose());
  cylinder.dispose();
  data.foliage.forEach((vertices,i)=>{
    const positions=[];
    for(let k=0;k<vertices.length;k+=3) positions.push(...point(vertices.slice(k,k+3)).toArray());
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,materials['leaf'+i]);group.add(mesh);
  });
  group.visible=false;return group;
}
