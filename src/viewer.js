import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

export const point = (p,h=0) => new THREE.Vector3(p[0],h,p[1]-12.9);

export class ApartmentViewer {
  constructor(container, spec, onChange) {
    this.container=container; this.spec=spec; this.onChange=onChange;
    this.mode='orbit';this.room=null;this.showLabels=false;this.showDimensions=false;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#f3f1ec');
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.VSMShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.96;
    const pmrem=new THREE.PMREMGenerator(this.renderer),environment=new RoomEnvironment();
    this.environment=pmrem.fromScene(environment,.04);this.scene.environment=this.environment.texture;
    this.scene.environmentIntensity=.38;environment.dispose();pmrem.dispose();
    this.canvas=this.renderer.domElement;this.canvas.tabIndex=0;this.canvas.setAttribute('aria-label','可旋转的房屋三维模型');
    container.append(this.canvas);
    this.ortho=new THREE.OrthographicCamera(-10,10,8,-8,.1,100);
    this.perspective=new THREE.PerspectiveCamera(68,1,.025,80);
    this.camera=this.ortho;
    this.controls=new OrbitControls(this.ortho,this.canvas);this.controls.enableDamping=true;
    this.controls.dampingFactor=.12;this.controls.minZoom=.65;this.controls.maxZoom=5;
    this.controls.maxPolarAngle=Math.PI/2.12;this.controls.minPolarAngle=.04;
    this.controls.addEventListener('change',()=>this.invalidate());
    this.ambient=new THREE.HemisphereLight(0xfff7e8,0xb8b1a6,1.20);this.scene.add(this.ambient);
    this.sun=new THREE.DirectionalLight(0xfff5df,2.1);this.sun.position.set(-3,16,1);
    this.sun.target.position.set(5,0,-6);this.scene.add(this.sun,this.sun.target);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{left:-13,right:13,top:13,bottom:-13,near:.1,far:40});
    this.sun.shadow.normalBias=.025;this.sun.shadow.bias=-.00015;this.sun.shadow.radius=5;this.sun.shadow.blurSamples=8;
    this.fill=new THREE.DirectionalLight(0xdce6ed,.65);this.fill.position.set(12,8,-15);this.scene.add(this.fill);
    this.interiorLight=new THREE.PointLight(0xffecd3,3.0,8,2);this.scene.add(this.interiorLight);
    RectAreaLightUniformsLib.init();this.fitoutLights=new THREE.Group();this.scene.add(this.fitoutLights);
    const strip=(x,t,y,width,height,target)=>{
      const light=new THREE.RectAreaLight(0xffdfad,3.8,width,height);light.position.copy(point([x,t],y));light.lookAt(point(target,y-.65));this.fitoutLights.add(light);
    };
    strip(3.43,6.46,2.08,.28,1.42,[3.70,6.46]);
    strip(3.43,6.47,1.61,.28,1.36,[3.70,6.47]);
    strip(8.70,1.95,1.545,.055,2.40,[8.45,1.95]);
    strip(6.88,1.35,1.555,.055,1.18,[7.02,1.35]);
    strip(1.90,5.72,1.385,1.70,.035,[1.90,5.96]);
    strip(1.90,5.94,.183,1.65,.025,[1.90,6.14]);
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xf3f1ec,roughness:1}));
    ground.rotation.x=-Math.PI/2;ground.position.y=-.205;ground.receiveShadow=true;this.scene.add(ground);
    this.composer=new EffectComposer(this.renderer);
    this.renderPass=new RenderPass(this.scene,this.camera);this.composer.addPass(this.renderPass);
    this.ao=new SSAOPass(this.scene,this.camera,1,1,16);this.ao.kernelRadius=.32;this.ao.minDistance=.001;this.ao.maxDistance=.035;
    this.composer.addPass(this.ao);this.composer.addPass(new OutputPass());this.composer.addPass(new SMAAPass());
    this.labelElements=spec.rooms.map(room=>{
      const el=document.createElement('span');el.className='room-label';el.textContent=room.name;
      document.querySelector('#labels').append(el);return {el,position:point(room.label,.065)};
    });
    this.dimensionGroup=new THREE.Group();this.scene.add(this.dimensionGroup);this.dimensionElements=[];
    this.buildDimensions();this.pointer=null;this.yaw=0;this.pitch=0;
    this.canvas.addEventListener('pointerdown',event=>{
      if(this.mode!=='interior'||event.button!==0)return;
      this.pointer={id:event.pointerId,x:event.clientX,y:event.clientY};this.canvas.setPointerCapture(event.pointerId);
    });
    this.canvas.addEventListener('pointermove',event=>{
      if(!this.pointer||this.mode!=='interior')return;
      this.yaw-=(event.clientX-this.pointer.x)*.004;this.pitch-=(event.clientY-this.pointer.y)*.004;
      this.pitch=THREE.MathUtils.clamp(this.pitch,-1.05,1.05);
      this.pointer.x=event.clientX;this.pointer.y=event.clientY;this.look();
    });
    const release=()=>{this.pointer=null;};this.canvas.addEventListener('pointerup',release);this.canvas.addEventListener('pointercancel',release);
    this.canvas.addEventListener('wheel',event=>{
      if(this.mode!=='interior')return;event.preventDefault();
      this.perspective.fov=THREE.MathUtils.clamp(this.perspective.fov+event.deltaY*.025,40,90);
      this.perspective.updateProjectionMatrix();this.invalidate();
    },{passive:false});
    this.canvas.addEventListener('keydown',event=>{
      if(event.key==='Home'){event.preventDefault();this.reset();return;}
      if(this.mode==='interior'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();this.yaw+=event.key==='ArrowLeft'?.1:event.key==='ArrowRight'?-.1:0;
        this.pitch=THREE.MathUtils.clamp(this.pitch+(event.key==='ArrowUp'?.1:event.key==='ArrowDown'?-.1:0),-1.05,1.05);this.look();
      }
    });
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(container);
    this.dirty=true;this.frames=0;this.animate=this.animate.bind(this);this.animation=requestAnimationFrame(this.animate);
    this.reset();
  }
  async load() {
    const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${this.spec.assetStem}.glb`);
    this.model=gltf.scene;
    this.model.traverse(ob=>{
      if(!ob.isMesh)return;
      ob.castShadow=!ob.material?.transparent;ob.receiveShadow=true;
      const materials=Array.isArray(ob.material)?ob.material:[ob.material];
      for(const material of materials){
        if(material.map)material.map.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());
        if(material.transparent){material.depthWrite=false;ob.castShadow=false;}
      }
    });
    this.scene.add(this.model);
    const mirrorProxy=this.model.getObjectByName('Master_double_mirror');
    if(mirrorProxy){
      const bounds=new THREE.Box3().setFromObject(mirrorProxy),size=bounds.getSize(new THREE.Vector3());
      this.vanityMirror=new Reflector(new THREE.PlaneGeometry(size.x-.012,size.y-.012),{textureWidth:1024,textureHeight:1024,clipBias:.002,color:0x96938d,multisample:2});
      this.vanityMirror.position.copy(bounds.getCenter(new THREE.Vector3()));this.vanityMirror.position.z=bounds.max.z+.002;
      this.vanityMirror.name='Master_vanity_room_reflection';this.vanityMirror.userData.layer='upper';
      const reflect=this.vanityMirror.onBeforeRender;
      this.vanityMirror.onBeforeRender=function(renderer,scene,camera,...args){if(!scene.overrideMaterial)reflect.call(this,renderer,scene,camera,...args);};
      mirrorProxy.visible=false;mirrorProxy.userData.layer='mirrorProxy';this.model.add(this.vanityMirror);
    }
    this.setMode(this.mode);this.invalidate();
    document.querySelector('#model-status').textContent=`米制模型已载入，${this.spec.rooms.length} 个房间，净高暂定 2.8 米。`;
  }
  resize() {
    const w=this.container.clientWidth,h=this.container.clientHeight;if(!w||!h)return;
    const aspect=w/h;this.span=Math.max(14.2,(w<700?14.0:12.5)/aspect);
    Object.assign(this.ortho,{left:-this.span*aspect/2,right:this.span*aspect/2,top:this.span/2,bottom:-this.span/2});
    this.ortho.updateProjectionMatrix();this.perspective.aspect=aspect;this.perspective.updateProjectionMatrix();
    this.renderer.setSize(w,h);this.composer.setSize(w,h);this.invalidate();this.onChange?.();
  }
  setMode(mode) {
    this.mode=mode;this.controls.enabled=mode!=='interior';this.controls.enableRotate=mode==='orbit';
    this.camera=mode==='interior'?this.perspective:this.ortho;this.ao.camera=this.camera;this.renderPass.camera=this.camera;
    // SSAOPass shader compile varies between orthographic and perspective projection.
    this.ao.ssaoMaterial.defines.PERSPECTIVE_CAMERA=mode==='interior'?1:0;this.ao.ssaoMaterial.needsUpdate=true;
    this.sun.intensity=mode==='interior'?1.0:1.85;
    this.ambient.intensity=mode==='interior'?.90:1.20;
    this.ambient.color.set(mode==='interior'?0xffe8cf:0xfff7e8);
    this.fill.intensity=mode==='interior'?.40:.65;
    this.fill.color.set(mode==='interior'?0xffeed9:0xdce6ed);
    this.scene.environmentIntensity=mode==='interior'?.34:.38;
    this.scene.background.set(mode==='interior'?'#dae5e7':'#f3f1ec');
    this.fitoutLights.visible=mode==='interior';
    this.interiorLight.visible=mode==='interior';this.canvas.style.cursor=mode==='interior'?'grab':'auto';
    if(this.model)this.model.traverse(ob=>{
      const layer=ob.userData.layer;
      if(layer==='upper'||layer==='ceiling')ob.visible=mode==='interior';
      if(layer==='cutCap')ob.visible=mode!=='interior';
    });
    if(mode==='interior')this.interior(this.room??this.spec.rooms[0]);
    else this.frame(this.room);
    this.onChange?.();this.invalidate();
  }
  selectRoom(room) {
    this.room=room;
    if(this.mode==='interior')this.interior(room??this.spec.rooms[0]);else this.frame(room);
    this.onChange?.();this.invalidate();
  }
  frame(room) {
    const target=room?point(room.label,.1):point([5.55,this.mode==='top'?6.90:6.4],.12);
    this.ortho.zoom=room?1.8:this.mode==='top'?.84:1;
    this.ortho.position.copy(target).add(this.mode==='top'?new THREE.Vector3(0,26,.001):new THREE.Vector3(1.2,23,15.5));
    this.controls.target.copy(target);this.ortho.lookAt(target);this.ortho.updateProjectionMatrix();this.controls.update();
  }
  interior(room) {
    this.activeInterior=room;
    this.perspective.position.copy(point(room.camera,room.eye??1.58));
    const target=point(room.look,room.targetHeight??1.34);const direction=target.sub(this.perspective.position).normalize();
    this.yaw=Math.atan2(-direction.x,-direction.z);this.pitch=Math.asin(direction.y);
    this.perspective.fov=room.fov??68;this.perspective.updateProjectionMatrix();
    this.interiorLight.position.copy(this.perspective.position).add(new THREE.Vector3(0,.7,0));this.look();
  }
  detail(view){this.setMode('interior');this.interior(view);this.onChange?.();}
  look(){this.perspective.rotation.set(this.pitch,this.yaw,0,'YXZ');this.invalidate();}
  reset(){this.room=null;this.setMode('orbit');}
  toggleLabels(){this.showLabels=!this.showLabels;this.invalidate();return this.showLabels;}
  toggleDimensions(){this.showDimensions=!this.showDimensions;if(this.showDimensions&&this.mode==='interior')this.setMode('top');this.invalidate();return this.showDimensions;}
  buildDimensions() {
    const material=new THREE.LineBasicMaterial({color:0x7b8a6f,transparent:true,opacity:.8,depthTest:false});
    const segment=(a,b,text,offset)=>{
      const va=point(a,.07),vb=point(b,.07),dir=vb.clone().sub(va).normalize(),tick=new THREE.Vector3(-dir.z,0,dir.x).multiplyScalar(.065);
      const geometry=new THREE.BufferGeometry().setFromPoints([va,vb,va.clone().add(tick),va.clone().sub(tick),vb.clone().add(tick),vb.clone().sub(tick)]);
      const line=new THREE.LineSegments(geometry,material);line.renderOrder=10;this.dimensionGroup.add(line);
      const el=document.createElement('span');el.className='dimension-label';el.textContent=text;document.querySelector('#dimension-labels').append(el);
      this.dimensionElements.push({el,position:va.clone().add(vb).multiplyScalar(.5).add(point(offset??[0,12.9],0))});
    };
    let x=0;for(const value of this.spec.chains.south){segment([x,13.4],[x+value,13.4],value.toFixed(2)+' m');x+=value;}
    x=0;for(const value of this.spec.chains.north){segment([x,-.45],[x+value,-.45],value.toFixed(2));x+=value;}
    let t=0;for(const value of this.spec.chains.west){segment([-.55,t],[-.55,t+value],value.toFixed(2));t+=value;}
  }
  updateLabels() {
    const w=this.container.clientWidth,h=this.container.clientHeight;
    const position=(row,visible)=>{
      row.el.hidden=!visible;if(!visible)return;
      const p=row.position.clone().project(this.camera);
      row.el.hidden=p.z>1||p.z< -1||Math.abs(p.x)>1||Math.abs(p.y)>1;
      row.el.style.left=`${(p.x*.5+.5)*w}px`;row.el.style.top=`${(-p.y*.5+.5)*h}px`;
    };
    this.labelElements.forEach(row=>position(row,this.showLabels&&this.mode!=='interior'));
    this.dimensionGroup.visible=this.showDimensions&&this.mode!=='interior';
    this.dimensionElements.forEach(row=>position(row,this.dimensionGroup.visible));
    const direction=new THREE.Vector3();this.camera.getWorldDirection(direction);
    const angle=this.mode==='top'?0:Math.atan2(direction.x,-direction.z);
    document.querySelector('#north-arrow').style.transform=`rotate(${angle}rad)`;
  }
  invalidate(){this.dirty=true;this.frames=3;}
  animate(){
    this.animation=requestAnimationFrame(this.animate);if(this.controls.enabled)this.controls.update();
    if(this.dirty||this.frames>0){
      this.updateLabels();
      const u=this.ao.ssaoMaterial.uniforms;
      u.cameraNear.value=this.camera.near;u.cameraFar.value=this.camera.far;
      u.cameraProjectionMatrix.value.copy(this.camera.projectionMatrix);
      u.cameraInverseProjectionMatrix.value.copy(this.camera.projectionMatrixInverse);
      this.composer.render();this.dirty=false;this.frames--;
    }
  }
  dispose(){cancelAnimationFrame(this.animation);this.resizeObserver.disconnect();this.controls.dispose();this.vanityMirror?.dispose();this.vanityMirror?.geometry.dispose();this.composer.dispose();this.environment.dispose();this.renderer.dispose();}
}
