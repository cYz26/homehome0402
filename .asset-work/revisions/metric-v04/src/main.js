import './style.css';
import { ApartmentViewer } from './viewer.js';

const $=selector=>document.querySelector(selector);
const spec=await fetch('/models/apartment.json').then(r=>{if(!r.ok)throw new Error('模型信息读取失败');return r.json();});
const roomButtons=[];
for(const room of [{id:'all',name:'全屋'},...spec.rooms]){
  const button=document.createElement('button');button.textContent=room.name;button.dataset.room=room.id;
  button.setAttribute('aria-pressed',room.id==='all'?'true':'false');$('#rooms').append(button);roomButtons.push(button);
}
for(const value of spec.assumptions){const li=document.createElement('li');li.textContent=value;$('#assumptions').append(li);}
const detailButtons=(spec.detailViews??[]).map(view=>{
  const button=document.createElement('button');button.textContent=view.name;button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>viewer?.detail(view));$('#detail-views').append(button);return{button,view};
});
let viewer;
function syncUI(){
  if(!viewer)return;
  document.querySelectorAll('.view-tabs [data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===viewer.mode)));
  roomButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.room===(viewer.room?.id??'all'))));
  $('#toggle-labels').setAttribute('aria-pressed',String(viewer.showLabels));$('#toggle-labels').disabled=viewer.mode==='interior';
  $('#toggle-dimensions').setAttribute('aria-pressed',String(viewer.showDimensions));
  const room=viewer.mode==='interior'?(viewer.room??spec.rooms[0]):viewer.room;
  $('#room-detail').hidden=!room;
  if(room){$('#room-detail h2').textContent=room.name+(viewer.mode==='interior'?' · 室内视角':'');$('.room-drawing').textContent=room.drawing;$('.room-finish').textContent=room.finish;}
  detailButtons.forEach(({button,view})=>{button.hidden=view.room!==room?.id;button.setAttribute('aria-pressed',String(viewer.mode==='interior'&&viewer.activeInterior?.id===view.id));});
  $('#detail-views').hidden=!detailButtons.some(({view})=>view.room===room?.id);
  const small=matchMedia('(max-width:700px)').matches;
  $('#gesture-hint').textContent=small
    ?viewer.mode==='interior'?'拖动转头 · 切换房间更换机位':viewer.mode==='top'?'双指缩放、平移 · 北向朝上':'单指旋转 · 双指缩放、平移'
    :viewer.mode==='interior'?'拖动转头 · 滚轮调整视野 · 方向键转头':viewer.mode==='top'?'滚轮缩放 · 右键平移 · 北向朝上':'拖动旋转 · 滚轮缩放 · 右键平移';
  $('#stage').dataset.view=viewer.mode;$('#stage').dataset.room=viewer.room?.id??'all';
}
try{
  viewer=new ApartmentViewer($('#canvas-container'),spec,()=>{if(viewer)syncUI();});
  viewer.load().then(()=>{$('#loading').hidden=true;syncUI();}).catch(error=>{
    console.error(error);$('#loading').textContent='模型未能载入，请刷新页面重试。'+error.message;
  });
}catch(error){console.error(error);$('#loading').textContent='模型未能载入，请刷新页面重试。'+error.message;}
for(const button of roomButtons)button.addEventListener('click',()=>{
  viewer?.selectRoom(spec.rooms.find(r=>r.id===button.dataset.room)??null);closeSidebar();
});
document.querySelectorAll('.view-tabs [data-view]').forEach(button=>button.addEventListener('click',()=>{viewer?.setMode(button.dataset.view);closeSidebar();}));
$('#toggle-labels').addEventListener('click',()=>{viewer?.toggleLabels();syncUI();});
$('#toggle-dimensions').addEventListener('click',()=>{viewer?.toggleDimensions();syncUI();});
$('#reset').addEventListener('click',()=>{viewer?.reset();syncUI();});
function closeSidebar(){document.body.classList.remove('sidebar-open');$('#mobile-rooms').setAttribute('aria-expanded','false');}
$('#mobile-rooms').addEventListener('click',()=>{const open=document.body.classList.toggle('sidebar-open');$('#mobile-rooms').setAttribute('aria-expanded',String(open));});
const refs={
  approved:['approved-v05.png','已确认的空房精装外观参考 v05','v05 已确认外观。3D 比例以原始户型图尺寸链为准。'],
  plan:['floor-plan.png','原始户型图','原图尺寸为图纸分段；房间净尺寸取决于墙体厚度与标注基准。'],
  living:['entry-living.jpg','入户看向客厅的实景','图2 · 入户位置看向南侧客厅。客厅两侧墙面按后续修订保留素墙。'],
  north:['north-room-kitchen.jpg','正北 X 空间与东北厨房实景','图3 · 正北 X 空间与东北厨房，门扇按确认版本收起。'],
  southeast:['southeast-bedroom.jpg','东南卧室实景','图4 · 东南卧室，东墙包覆按后续修订移除。'],
  master:['southwest-master.jpg','西南主卧实景','图5 · 西南主卧，人字拼木地板；柜体按后续修订移除。']
};
Object.assign(refs,{
  hall:['hall-materials-v04.png','客厅柜与周边墙面参考','最新参考 · 柔和灰褐木饰面、薄分格、发光石材展示架及暖色灯带。'],
  sliders:['north-frame-v04.png','X 空间和厨房推拉门外框','最新参考 · 薄深色门扇沿东西方向叠放，外围深色框与门洞相接。'],
  hob:['kitchen-hob.jpg','烟机灶具及东侧橱柜','最新参考 · 三眼灶、斜面烟机、嵌入式烤箱和浅色橱柜。'],
  fridge:['kitchen-fridge.jpg','西侧冰箱及北侧水槽','最新参考 · 入口西侧双门冰箱、三面操作台和北窗下嵌入式水槽。'],
  doublebasin:['master-double-basin-v04.png','主卫一体式双人宽槽','最新参考 · 一个连续长槽、两组墙出龙头，石材背板、镜柜及悬空抽屉柜。'],
  bathdoor:['master-sliding-door-v04.png','主卫薄推拉门','最新参考 · 深色薄门扇停放在入口右侧，门框与上轨贴墙。']
});
$('#reference').addEventListener('click',()=>$('#reference-dialog').showModal());
$('#dimensions-info').addEventListener('click',()=>$('#dimensions-dialog').showModal());
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const b=dialog.getBoundingClientRect();if(event.clientX<b.left||event.clientX>b.right||event.clientY<b.top||event.clientY>b.bottom)dialog.close();}}));
document.querySelectorAll('[data-ref]').forEach(button=>button.addEventListener('click',()=>{
  const [file,alt,caption]=refs[button.dataset.ref];$('#reference-image').src='/references/'+file;$('#reference-image').alt=alt;$('#reference-caption').textContent=caption;
  document.querySelectorAll('[data-ref]').forEach(other=>other.setAttribute('aria-pressed',String(button===other)));
}));
window.addEventListener('pagehide',()=>viewer?.dispose(),{once:true});
