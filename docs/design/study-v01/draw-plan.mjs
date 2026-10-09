import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutPath = process.argv[2] ? path.resolve(process.argv[2]) : path.join(here, 'layout.json');
const c = JSON.parse(await fs.readFile(layoutPath, 'utf8'));
const suffix = process.argv[3] || 'v01';
if (!/^v\d{2}$/.test(suffix)) throw new Error('Expected version suffix vNN');
const out = path.resolve(here, '../../../references/generated/study-20261009');
await fs.mkdir(out, { recursive: true });
const s = 300, ox = 120, oy = 250;
const cm = x => Math.round(x * 100);
const seat = c.westBookcase.seat;
const X = x => ox + x * s, Y = y => oy + y * s;
const xml = x => String(x).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const items = [];
const add = x => items.push(x);
const text = (x,y,t,size=22,color='#353b36',extra='') => add(`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${xml(t)}</text>`);
const rect = (x,y,w,h,fill,stroke='#575e57',extra='') => add(`<rect x="${X(x)}" y="${Y(y)}" width="${w*s}" height="${h*s}" fill="${fill}" stroke="${stroke}" ${extra}/>`);
const line = (x1,y1,x2,y2,color='#616961',width=2,extra='') => add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`);
const dim = (x1,y1,x2,y2,label,vertical=false) => {
  line(x1,y1,x2,y2,'#687569',1.6,'marker-start="url(#arrow)" marker-end="url(#arrow)"');
  const x=(x1+x2)/2, y=(y1+y2)/2;
  if(vertical) text(x-14,y,label,22,'#48584a',`text-anchor="middle" transform="rotate(-90 ${x-14} ${y})"`);
  else text(x,y-10,label,22,'#48584a','text-anchor="middle"');
};

add(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1440" viewBox="0 0 1600 1440">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10" fill="none" stroke="#687569" stroke-width="1.5"/></marker><pattern id="drawer" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M-3 14 L14 -3 M7 21 L21 7" stroke="#ca9a49" stroke-width="1.3"/></pattern></defs>
<rect width="1600" height="1440" fill="#f7f6f0"/>
<g font-family="PingFang SC, Noto Sans CJK SC, sans-serif">`);
text(88,78,`书房 / X 空间 · 布置试排 ${suffix}`,40,'#253d31','font-weight="600"');
text(88,121,'北窗 · 南侧推拉门  |  尺寸来自当前模型，柜体为试排假设',23,'#6a756b');
rect(0,0,c.room.width,c.room.depth,'#f0e8db','#9ba497','stroke-width="2"');
// A three-sided room: the south edge is an entrance, not a solid wall.
line(X(0),Y(0),X(c.room.width),Y(0),'#707c70',12);
line(X(0),Y(0),X(0),Y(c.room.depth),'#707c70',12);
line(X(c.room.width),Y(0),X(c.room.width),Y(c.room.depth),'#707c70',12);
const win=c.room.northWindow;
line(X(win.startX),Y(0),X(win.startX+win.width),Y(0),'#acd1d5',15);
line(X(win.startX),Y(0)-4,X(win.startX+win.width),Y(0)-4,'#426f72',1.5);
text(X(win.startX+win.width/2),Y(0)+34,'北窗 · 窗前留空',20,'#426f72','text-anchor="middle"');
dim(X(0),198,X(c.room.width),198,`模型净宽约 ${c.room.width.toFixed(2)} m`);
line(X(0),212,X(0),Y(0)-14,'#a9b3a7',1);
line(X(c.room.width),212,X(c.room.width),Y(0)-14,'#a9b3a7',1);
dim(60,Y(0),60,Y(c.room.depth),`到入口界线约 ${c.room.depth.toFixed(2)} m`,true);

const b=c.westBookcase;
rect(b.x,b.y,b.baseDepth,b.length,'#a97d5c','#6c4735','stroke-width="2"');
rect(b.x,b.y,b.upperDepth,b.length,'#76513d','#ead9c0','stroke-width="2" stroke-dasharray="8 5"');
for(let n=1;n<6;n++) line(X(b.x),Y(b.y+n*b.length/6),X(b.x+b.baseDepth),Y(b.y+n*b.length/6),'#d4b599',1.5);
text(X(.22),Y(1.68),'胡桃木整墙书柜 · 约 3.00 m',24,'#fff4df',`text-anchor="middle" transform="rotate(-90 ${X(.22)} ${Y(1.68)})"`);
text(X(.48),Y(1.75),`凸出底柜深 ${cm(b.baseDepth)} cm`,18,'#fff7e7',`text-anchor="middle" transform="rotate(-90 ${X(.48)} ${Y(1.75)})"`);
rect(b.x+b.baseDepth,.73,b.drawerExtensionAssumption,.54,'url(#drawer)','#c49344','stroke-width="2" stroke-dasharray="7 5"');
if(seat) {
  rect(b.x+b.upperDepth+.015,seat.y,b.baseDepth-b.upperDepth-.03,seat.length,'#e4ded0','#998c79','rx="8" stroke-width="1.5"');
  text(X(b.x+b.upperDepth+(b.baseDepth-b.upperDepth)/2),Y(seat.y+seat.length/2),`入口侧坐位 · 净深约 ${cm(seat.exposedDepth)} cm`,18,'#6a5d4a',`text-anchor="middle" transform="rotate(-90 ${X(b.x+b.upperDepth+(b.baseDepth-b.upperDepth)/2)} ${Y(seat.y+seat.length/2)})"`);
}

const d=c.desk;
rect(d.x,d.y,d.depth,d.length,'#ceb491','#4e594f','stroke-width="2" rx="6"');
// Top view hints at the black lift frame and working direction.
rect(d.x+.08,d.y+.19,d.depth-.16,.05,'#363a36','#363a36');
rect(d.x+.08,d.y+d.length-.24,d.depth-.16,.05,'#363a36','#363a36');
rect(d.x+.43,d.y+.52,.17,.38,'#353c38','#353c38','rx="3"');
text(X(d.x+.20),Y(d.y+.70),'升降桌',25,'#3b433c',`text-anchor="middle" transform="rotate(-90 ${X(d.x+.20)} ${Y(d.y+.70)})"`);
text(X(d.x+.34),Y(d.y+.70),'140 × 70 cm',18,'#3b433c',`text-anchor="middle" transform="rotate(-90 ${X(d.x+.34)} ${Y(d.y+.70)})"`);

const sc=c.eastSideCabinet;
rect(sc.x,sc.y,sc.depth,sc.length,'#b08a6a','#6b5140','stroke-width="2"');
line(X(sc.x),Y(sc.y+sc.length/2),X(sc.x+sc.depth),Y(sc.y+sc.length/2),'#e4cfb4',1.5);
text(X(sc.x+.18),Y(sc.y+.50),'配柜 · 100 × 40 cm',21,'#fff5e7',`text-anchor="middle" transform="rotate(-90 ${X(sc.x+.18)} ${Y(sc.y+.50)})"`);
dim(X(2.78),Y(d.y+d.length),X(2.78),Y(sc.y),'15 cm',true);
dim(X(2.78),Y(sc.y+sc.length),X(2.78),Y(c.room.depth),'45 cm',true);

const ch=c.chair, [cx,cy]=ch.center, r=ch.baseDiameter/2;
rect(cx-ch.bodyDepth/2,cy-ch.baseDiameter/2,ch.bodyDepth,ch.baseDiameter,'none','#7d8679','stroke-dasharray="6 5" rx="14"');
add(`<circle cx="${X(cx)}" cy="${Y(cy)}" r="${r*s}" fill="none" stroke="#6c766d" stroke-width="1.5" stroke-dasharray="5 4"/>`);
for(let n=0;n<5;n++){const a=n*Math.PI*2/5;line(X(cx),Y(cy),X(cx+r*.91*Math.cos(a)),Y(cy+r*.91*Math.sin(a)),'#8d9690',7);add(`<circle cx="${X(cx+r*.91*Math.cos(a))}" cy="${Y(cy+r*.91*Math.sin(a))}" r="8" fill="#353a37"/>`);}
rect(cx-.24,cy-.26,.43,.52,'#333b37','#252f28','rx="18" stroke-width="2"');
rect(cx-.34,cy-.24,.06,.48,'#222c25','#222c25','rx="8"');
rect(cx-.18,cy-.32,.33,.045,'#313731','#313731','rx="5"');
rect(cx-.18,cy+.275,.33,.045,'#313731','#313731','rx="5"');
line(X(cx+.27),Y(cy),X(cx+.37),Y(cy),'#365a42',2.2,'marker-end="url(#arrow)"');
text(X(cx),Y(cy-.47),'深色转椅 · 面向东墙',20,'#48534b','text-anchor="middle"');
dim(X(b.x+b.baseDepth),Y(1.56),X(d.x),Y(1.56),`桌—底柜净距 ${c.clearances.deskToProjectingBase.toFixed(2)} m`);
text(X(seat ? .93 : .71),Y(2.07),'中间保持空地',25,'#778375');
text(X(seat ? .93 : .71),Y(2.22),seat?'取抽屉先移椅；坐位用南段':'椅后约半米，取抽屉先收椅',18,'#808b7d');

// Current door tracks run east-west outside the room; the stack continues east.
for(let n=0;n<3;n++) line(X(0),Y(3.389+n*.024),X(3.44),Y(3.389+n*.024),'#73817d',1.2);
for(let n=0;n<3;n++) rect(2.451+n*.012,3.389+n*.024,.958,.022,'#53615b','#53615b');
text(X(.83),Y(3.3)+56,'南侧推拉门 / 入口',23,'#3c5c4b','text-anchor="middle"');
text(X(2.78),Y(3.3)+112,'门扇向东叠放',17,'#53685d','text-anchor="middle"');
line(X(2.52),Y(3.3)+77,X(3.40),Y(3.3)+77,'#53685d',2,'marker-end="url(#arrow)"');
text(X(.08),Y(3.3)+108,'↑ 从餐厅进入',18,'#607663');
text(120,1370,'橙色虚线：抽屉展开 35 cm 的估算区；家具动态包络和厂家安装尺寸待核对。',19,'#8c734d');

const px=1060;
function note(y,num,title,rows){text(px,y,`${num}  ${title}`,27,'#36513f','font-weight="600"');for(let i=0;i<rows.length;i++)text(px,y+39+i*31,rows[i],21,'#677565');}
note(250,'01','西墙书柜',[`沿墙约 ${b.length.toFixed(2)} m，高度暂定 ${b.height.toFixed(2)} m`,`上柜深 ${cm(b.upperDepth)} cm / 底柜深 ${cm(b.baseDepth)} cm`,seat?`露出坐面约 ${cm(seat.exposedDepth)} cm，坐面高约 ${cm(seat.finishedHeight)} cm`:'开放格、木框玻璃门与实木门组合',seat?'南段加薄坐垫；底柜需承重设计':'北端留 18 cm，南端留 12 cm']);
note(455,'02','东墙工作区',['桌面 1.40 × 0.70 m，朝东使用','桌子靠北段，北端留 30 cm','桌旁间隔 15 cm，独立升降','窗前不增设柜子']);
note(660,'03','入口侧配柜',['暂定 1.00 × 0.40 × 1.10 m','放桌子南侧，材质呼应西侧书柜','距入口界线留 45 cm','门轨和门扇叠放位置保留']);
note(865,'04','转椅与抽屉',['底盘 73.5 cm / 整椅深 76.5 cm',`图示坐姿椅背后约 ${cm(c.clearances.chairRearToBaseAtPreviewPosition)} cm`,c.clearances.chairRearToOpenDrawerAtPreviewPosition>=0?`抽屉全开后仅约 ${cm(c.clearances.chairRearToOpenDrawerAtPreviewPosition)} cm`:`全开抽屉与椅位冲突约 ${cm(-c.clearances.chairRearToOpenDrawerAtPreviewPosition)} cm`,'开抽屉时需先收椅或移椅']);
line(px,1077,1510,1077,'#c9d0c2',1.4);
text(px,1120,'尺寸来源',25,'#36513f','font-weight="600"');
text(px,1160,'桌椅：用户尺寸 / 附件尺寸图',20,'#677565');
text(px,1194,'房间：当前模型估算，非现场实测',20,'#677565');
text(px,1228,'柜体 / 位置：本轮布置建议，待确认',20,'#677565');
add('</g></svg>');
const svg=items.join('\n');
await fs.writeFile(path.join(out,`study-layout-${suffix}.svg`),svg);
await sharp(Buffer.from(svg)).png().toFile(path.join(out,`study-layout-${suffix}.png`));
console.log(JSON.stringify({output:out,size:[1600,1440],source:layoutPath,suffix}));
