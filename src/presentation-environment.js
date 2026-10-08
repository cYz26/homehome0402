// One deterministic display-only environment shared by Cycles and Three.js.
// Coordinates stay in the project's x/east, t/south, z/up convention.
export function presentationEnvironment(config) {
  if (!config) return null;
  let seed = config.seed >>> 0;
  const random = () => {
    seed += 0x6d2b79f5;
    let n = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
  const round = (n) => Math.round(n * 1e5) / 1e5;
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const scale = (a, s) => a.map((v) => v * s);
  const mix = (a, b, s) => a.map((v, i) => v + (b[i] - v) * s);
  const boxes = [], branches = [], foliage = [[], [], [], []];
  const box = (center, size, material) => boxes.push({ center, size, material });
  const [x0, t0, x1, t1] = config.courtyard.bounds;
  const south = config.courtyard.screenSouth, h = config.courtyard.screenHeight;
  box([(x0 + x1) / 2, (t0 + t1) / 2, -.02], [x1-x0, t1-t0, .16], 'paving');
  box([(x0+x1)/2, south+.6, h/2], [x1-x0, .12, h], 'screen');
  // Pale courtyard screening and the building frame seen in the actual photo.
  for (let x=x0+.12; x<x1; x+=.20) box([round(x),south+.49,h/2],[.019,.035,h],'rib');
  for (const x of [x0+.12, x0+3.3, x0+6.8, x1-.12]) box([x,south+.2,h/2],[.12,.36,h],'concrete');
  box([(x0+x1)/2,south+.15,h-.12],[x1-x0,.52,.20],'concrete');
  box([(x0+x1)/2,t0+.32,.12],[x1-x0,.55,.22],'soil');
  const branch = (a,b,r0,r1) => branches.push({a:a.map(round),b:b.map(round),r0,r1});
  function leaf(center, size) {
    const az=random()*Math.PI*2, tilt=-1.22+random()*2.44;
    const u=[Math.cos(az),Math.sin(az),0];
    const v=[-Math.sin(az)*Math.cos(tilt),Math.cos(az)*Math.cos(tilt),Math.sin(tilt)];
    const n=[Math.sin(az)*Math.sin(tilt),-Math.cos(az)*Math.sin(tilt),Math.cos(tilt)];
    const ring=[[-1,0],[-.5,.43],[.48,.36],[1,0],[.48,-.36],[-.5,-.43]];
    const vertices=[add(center,scale(n,size*.09)),...ring.map(([a,b])=>add(center,add(scale(u,size*a),scale(v,size*b))))];
    const color=Math.min(3,Math.floor(random()*4));
    for(let i=0;i<6;i++) foliage[color].push(...vertices[0].map(round),...vertices[1+i].map(round),...vertices[1+(i+1)%6].map(round));
  }
  for(const tree of config.trees) {
    const p=tree.position, top=add(p,[.05,.04,tree.height*.93]);
    const trunk=[p,add(p,[.03,-.05,tree.height*.34]),add(p,[-.05,.025,tree.height*.64]),top];
    for(let k=0;k<3;k++) branch(trunk[k],trunk[k+1],.024-k*.006,.019-k*.006);
    for(let i=0;i<18;i++) {
      const phase=i*2.39996+.3, z=tree.height*(.37+.58*random());
      const base=add(p,[.02,.02,z*.83]);
      const r=tree.crownRadius*(.42+.52*random())*(1-Math.max(0,z/tree.height-.70));
      const end=add(p,[Math.cos(phase)*r,Math.sin(phase)*r,z]);
      const elbow=add(mix(base,end,.58),[0,0,-.07]);
      branch(base,elbow,.010,.005);branch(elbow,end,.005,.0018);
      for(let j=0;j<3;j++) {
        const a=phase+(j-1)*.64;
        const from=mix(elbow,end,.25+j*.22);
        const tip=add(from,[Math.cos(a)*.23,Math.sin(a)*.23,.10+random()*.18]);
        branch(from,tip,.003,.0009);
        for(let k=0;k<9;k++) {
          const c=add(mix(from,tip,.16+k*.10),[(random()-.5)*.22,(random()-.5)*.22,(random()-.5)*.18]);
          leaf(c,.067+random()*.052);
        }
      }
    }
  }
  return {
    id:config.id,displayOnly:true,basis:config.basis,
    materials:{
      paving:{color:'#c4ceca',roughness:1},soil:{color:'#85876a',roughness:1},
      screen:{color:'#d4e1e3',roughness:.95,emission:.12},rib:{color:'#e6eded',roughness:.8},
      concrete:{color:'#d6ddd9',roughness:.9},bark:{color:'#67594c',roughness:.95},
      leaf0:{color:'#648657',roughness:.85},leaf1:{color:'#82a96c',roughness:.85},
      leaf2:{color:'#94b67a',roughness:.85},leaf3:{color:'#6c915e',roughness:.85},
    },boxes,branches,foliage,
  };
}
