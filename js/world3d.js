/* ===================================================================================
   NYC 2050 — the three-dimensional world.

   Two things come out of here and they are deliberately separate:

     meshes()     geometry for the renderer — terrain, roads, parks, extruded blocks
     colliders()  the same city as a list of boxes with mass and material

   The second is the groundwork. Every block and every named structure becomes an
   oriented box in metres, sorted into a uniform broadphase grid, with the energy its
   fabric will absorb before something goes through it. raycast() and trace() are a
   deliberately simple integrator over that set: swap them for a real engine and the
   world it needs is already built and indexed.

   World space is metres. One grid unit on the survey sheet is ten metres.
     world x  =  grid x * 10          east
     world y  =  metres above the 2050 waterline
     world z  = -grid y * 10          north is -z
   Blocks are axis-aligned in this frame because the Manhattan grid is; the outer
   boroughs carry a yaw, stored per collider for an engine that wants the true box.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};

const U2M=10, G=9.81, RHO=1.22;
const w2g=(x,z)=>[x/U2M,-z/U2M];
const g2w=(gx,gy)=>[gx*U2M,-gy*U2M];

const hex=h=>[parseInt(h.slice(1,3),16)/255,parseInt(h.slice(3,5),16)/255,
              parseInt(h.slice(5,7),16)/255];

/* ---- what a thing is made of ------------------------------------------------------ */
const MATERIAL={
  "pre-1901": {name:"brick and timber",  resist:0.9e6, density:340, restitution:0.05},
  "1901-29":  {name:"masonry and steel", resist:1.3e6, density:400, restitution:0.06},
  "1930-60":  {name:"steel frame",       resist:2.0e6, density:300, restitution:0.10},
  "1961-99":  {name:"concrete frame",    resist:2.4e6, density:330, restitution:0.08},
  "post-2000":{name:"glass curtain wall",resist:1.5e6, density:260, restitution:0.12},
  "STRUCTURE":{name:"monumental",        resist:4.5e6, density:520, restitution:0.04},
  "GROUND":   {name:"ground",            resist:1e12,  density:1800,restitution:0.02}
};

let W=null;
function rng(seed){
  let a=(seed>>>0)||1;
  return function(){ a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296; };
}

/* =================================================================================== */
function build(opts){
  if(W&&!(opts&&opts.rebuild)) return W;
  const t0=now();
  const blocks=NYC.fabric.build();
  const colliders=[];

  /* ---- the fabric, extruded ------------------------------------------------------
     A block is not one building. Each is cut along its long axis into the two to five
     buildings that would stand on it, with heights varying about the block's own, and
     the occasional gap for the yard behind. It reads as a city rather than a wall, and
     it gives a projectile something the size of a real building to hit. */
  const rnd=rng(90210);
  blocks.forEach(b=>{
    const e1=[b.pts[1][0]-b.pts[0][0], b.pts[1][1]-b.pts[0][1]];
    const e2=[b.pts[3][0]-b.pts[0][0], b.pts[3][1]-b.pts[0][1]];
    const w=Math.hypot(e1[0],e1[1])*U2M, d=Math.hypot(e2[0],e2[1])*U2M;
    const yaw=Math.atan2(-e1[1],e1[0]);          /* grid y is world -z */
    const base=Math.max(0,NYC.terrain.elev(b.cx,b.cy));
    const [wx,wz]=g2w(b.cx,b.cy);
    const mat=MATERIAL[b.era]||MATERIAL["1901-29"];
    const along=w>=d, longSide=along?w:d;
    const n=Math.max(1,Math.min(5,Math.round(longSide/78)));
    const seg=longSide/n;
    const ux=along?Math.cos(yaw):-Math.sin(yaw);
    const uz=along?Math.sin(yaw):Math.cos(yaw);
    for(let i=0;i<n;i++){
      if(n>2&&rnd()<0.09) continue;              /* the yard behind */
      const t=(i+0.5)/n-0.5;
      const jitter=0.55+rnd()*0.85;
      const h=Math.max(3,b.height*(n===1?1:jitter));
      const px=wx+ux*t*longSide, pz=wz+uz*t*longSide;
      const sw=(along?seg:w)*0.94, sd=(along?d:seg)*0.94;
      const floors=Math.max(1,Math.round(h/3.6));
      colliders.push({
        id:colliders.length, kind:"block", ref:b.id,
        cx:px, cz:pz, base:base, height:h,
        hx:sw/2, hz:sd/2, yaw:yaw,
        era:b.era, use:b.use, material:mat,
        mass:Math.round(sw*sd*b.coverage*mat.density*floors/1000)*1000,
        label:b.zone
      });
    }
  });

  /* ---- the named structures, standing above their block -------------------------- */
  const marks=(NYC.mapView&&NYC.mapView.marks)||[];
  marks.forEach(m=>{
    const h=NYC.heights.heightOf(m);
    if(h<20) return;
    const base=Math.max(0,NYC.terrain.elev(m.x,m.y));
    const [wx,wz]=g2w(m.x,m.y);
    /* footprint grows with height, the way a tower's core does */
    const foot=Math.max(24,Math.min(90,18+h*0.16));
    colliders.push({
      id:colliders.length, kind:"structure", ref:m.name,
      cx:wx, cz:wz, base:base, height:h,
      hx:foot/2, hz:foot/2, yaw:0,
      era:"STRUCTURE", use:m.cat,
      material:MATERIAL.STRUCTURE,
      mass:Math.round(foot*foot*h*520/1000)*1000,
      label:m.name, disp:m.disp
    });
  });

  /* ---- broadphase: a uniform grid over the ground plane -------------------------- */
  const CELL=140;                               /* metres */
  const bp=new Map();
  const bkey=(cx,cz)=>cx+":"+cz;
  colliders.forEach(c=>{
    const r=Math.max(c.hx,c.hz);
    const c0=Math.floor((c.cx-r)/CELL), c1=Math.floor((c.cx+r)/CELL);
    const r0=Math.floor((c.cz-r)/CELL), r1=Math.floor((c.cz+r)/CELL);
    for(let a=c0;a<=c1;a++) for(let b2=r0;b2<=r1;b2++){
      const k=bkey(a,b2);
      let arr=bp.get(k); if(!arr){arr=[];bp.set(k,arr);}
      arr.push(c.id);
    }
  });

  W={colliders,bp,CELL,bkey,buildMs:Math.round(now()-t0),
     bounds:worldBounds()};
  return W;
}
function now(){ return (typeof performance!=="undefined")?performance.now():Date.now(); }
function worldBounds(){
  return {x0:-290*U2M,x1:650*U2M,z0:-1770*U2M,z1:530*U2M};
}

/* ---- the ground ------------------------------------------------------------------- */
function groundAt(x,z){
  const [gx,gy]=w2g(x,z);
  const e=NYC.terrain.elev(gx,gy);
  return NYC.terrain.onLand(gx,gy)?Math.max(0,e):0;
}

/* ---- collision -------------------------------------------------------------------- */
/* a box in its own frame; the ray is rotated into it, so a turned block is exact */
function rayBox(o,d,c){
  const cs=Math.cos(-c.yaw), sn=Math.sin(-c.yaw);
  const rx=(o[0]-c.cx)*cs-(o[2]-c.cz)*sn, rz=(o[0]-c.cx)*sn+(o[2]-c.cz)*cs;
  const dx=d[0]*cs-d[2]*sn, dz=d[0]*sn+d[2]*cs;
  const ry=o[1]-(c.base+c.height/2), dy=d[1];
  const h=[c.hx,c.height/2,c.hz], ro=[rx,ry,rz], rd=[dx,dy,dz];
  let tmin=-Infinity, tmax=Infinity, axis=0;
  for(let i=0;i<3;i++){
    if(Math.abs(rd[i])<1e-9){ if(Math.abs(ro[i])>h[i]) return null; continue; }
    const inv=1/rd[i];
    let t1=(-h[i]-ro[i])*inv, t2=(h[i]-ro[i])*inv;
    if(t1>t2){ const t=t1; t1=t2; t2=t; }
    if(t1>tmin){ tmin=t1; axis=i; }
    if(t2<tmax) tmax=t2;
    if(tmin>tmax) return null;
  }
  if(tmax<0) return null;
  const t=tmin>=0?tmin:tmax;
  const n=[0,0,0];
  n[axis]=(rd[axis]>0?-1:1);
  /* back to world */
  const nx=n[0]*cs+n[2]*sn, nz=-n[0]*sn+n[2]*cs;
  return {t, normal:[nx,n[1],nz]};
}
function raycast(origin,dir,maxDist,skip){
  const w=build();
  let best=null;
  const step=w.CELL*0.6;
  const seen=new Set();
  for(let travelled=0;travelled<=maxDist;travelled+=step){
    const px=origin[0]+dir[0]*travelled, pz=origin[2]+dir[2]*travelled;
    const c0=Math.floor(px/w.CELL), r0=Math.floor(pz/w.CELL);
    for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){
      const arr=w.bp.get(w.bkey(c0+a,r0+b));
      if(!arr) continue;
      for(const id of arr){
        if(seen.has(id)) continue;
        seen.add(id);
        if(skip&&skip(id)) continue;
        const hit=rayBox(origin,dir,w.colliders[id]);
        if(hit&&hit.t>=0&&hit.t<=maxDist&&(!best||hit.t<best.t))
          best={t:hit.t,normal:hit.normal,collider:w.colliders[id]};
      }
    }
    if(best&&best.t<travelled) break;           /* nothing further can be nearer */
  }
  if(!best) return null;
  best.point=[origin[0]+dir[0]*best.t,origin[1]+dir[1]*best.t,origin[2]+dir[2]*best.t];
  return best;
}

/* ---- a projectile, integrated ------------------------------------------------------
   opts: {origin:[x,y,z], velocity:[vx,vy,vz], mass, cda, dt, maxTime, penetrate}
   Returns the flight path, every structure it went through, and where it stopped.
   This is the seam a physics engine slots into: it consumes colliders() and produces
   samples; nothing else in the app depends on how it does that.
   ------------------------------------------------------------------------------------ */
function trace(opts){
  const mass=opts.mass||200, cda=opts.cda||1.2;
  const k=0.5*RHO*cda/mass;
  const dt=opts.dt||0.02, maxT=opts.maxTime||60;
  let p=opts.origin.slice(), v=opts.velocity.slice(), t=0;
  const samples=[{p:p.slice(),v:v.slice(),t:0}], impacts=[];
  const spent=new Set();
  /* whatever it started inside is not something it can hit on the way out */
  containing(p).forEach(id=>spent.add(id));
  let stopped=null;
  while(t<maxT){
    const sp=Math.hypot(v[0],v[1],v[2]);
    const ax=-k*sp*v[0], ay=-G-k*sp*v[1], az=-k*sp*v[2];
    const nv=[v[0]+ax*dt, v[1]+ay*dt, v[2]+az*dt];
    const np=[p[0]+nv[0]*dt, p[1]+nv[1]*dt, p[2]+nv[2]*dt];
    const seg=[np[0]-p[0],np[1]-p[1],np[2]-p[2]];
    const len=Math.hypot(seg[0],seg[1],seg[2]);
    if(len>1e-6){
      const dir=[seg[0]/len,seg[1]/len,seg[2]/len];
      const hit=raycast(p,dir,len,id=>spent.has(id));
      if(hit){
        const ke=0.5*mass*sp*sp;
        const res=hit.collider.material.resist*(0.6+hit.collider.height/400);
        const through=opts.penetrate!==false&&ke>res;
        impacts.push({collider:hit.collider,point:hit.point,ke:Math.round(ke),
          through,name:hit.collider.label,kind:hit.collider.kind});
        spent.add(hit.collider.id);
        if(through){
          const f=Math.sqrt(Math.max(0.04,1-res/ke));
          v=[nv[0]*f,nv[1]*f,nv[2]*f];
          p=[hit.point[0]+dir[0]*0.6,hit.point[1]+dir[1]*0.6,hit.point[2]+dir[2]*0.6];
          t+=dt; samples.push({p:p.slice(),v:v.slice(),t});
          continue;
        }
        p=hit.point.slice();
        samples.push({p:p.slice(),v:[0,0,0],t});
        stopped={reason:"struck",name:hit.collider.label,kind:hit.collider.kind};
        break;
      }
    }
    p=np; v=nv; t+=dt;
    const g=groundAt(p[0],p[2]);
    if(p[1]<=g){
      p[1]=g;
      samples.push({p:p.slice(),v:[0,0,0],t});
      stopped={reason:"ground"};
      break;
    }
    if(samples.length<2000&&(samples.length<12||Math.round(t/dt)%5===0))
      samples.push({p:p.slice(),v:v.slice(),t});
  }
  if(!stopped){ stopped={reason:"still moving"}; }
  const o=opts.origin;
  const range=Math.hypot(p[0]-o[0],p[2]-o[2]);
  return {samples,impacts,rest:p,stopped,range,
    through:impacts.filter(i=>i.through).length,
    blocks:range/80};
}

function containing(p){
  const w=build(), out=[];
  const c0=Math.floor(p[0]/w.CELL), r0=Math.floor(p[2]/w.CELL);
  for(let a=-1;a<=1;a++) for(let b=-1;b<=1;b++){
    const arr=w.bp.get(w.bkey(c0+a,r0+b));
    if(!arr) continue;
    for(const id of arr){
      const c=w.colliders[id];
      if(p[1]<c.base-2||p[1]>c.base+c.height+2) continue;
      const cs=Math.cos(-c.yaw), sn=Math.sin(-c.yaw);
      const rx=(p[0]-c.cx)*cs-(p[2]-c.cz)*sn, rz=(p[0]-c.cx)*sn+(p[2]-c.cz)*cs;
      if(Math.abs(rx)<=c.hx+2&&Math.abs(rz)<=c.hz+2) out.push(id);
    }
  }
  return out;
}

/* ---- geometry for the renderer ---------------------------------------------------- */
function meshes(opt){
  const w=build();
  const mode=(opt&&opt.mode)||"use";
  const states=(opt&&opt.states)||null;      /* per-block projection state, or null */
  const out={};

  /* terrain: an indexed grid, coloured by what is on it */
  {
    const STEP=8, x0=-290, x1=650, y0=-530, y1=1770;
    const cols=Math.ceil((x1-x0)/STEP)+1, rows=Math.ceil((y1-y0)/STEP)+1;
    const pos=new Float32Array(cols*rows*3), col=new Float32Array(cols*rows*3);
    const LAND=hex("#9C9A90"), SAND=hex("#AEAB9F"), PARK=hex("#4E6B3A"),
          DEEP=hex("#3A4B54");
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      const gx=x0+c*STEP, gy=y0+r*STEP, i=(r*cols+c)*3;
      const land=NYC.terrain.onLand(gx,gy);
      const e=land?NYC.terrain.elev(gx,gy):-8;
      const [wx,wz]=g2w(gx,gy);
      pos[i]=wx; pos[i+1]=land?Math.max(0,e):e; pos[i+2]=wz;
      let c3=land?(e<3?SAND:LAND):DEEP;
      if(land&&isPark(gx,gy)) c3=PARK;
      col[i]=c3[0]; col[i+1]=c3[1]; col[i+2]=c3[2];
    }
    const idx=new Uint32Array((cols-1)*(rows-1)*6);
    let k=0;
    for(let r=0;r<rows-1;r++) for(let c=0;c<cols-1;c++){
      const a=r*cols+c, b=a+1, d=a+cols, e2=d+1;
      idx[k++]=a; idx[k++]=d; idx[k++]=b;
      idx[k++]=b; idx[k++]=d; idx[k++]=e2;
    }
    out.terrain={pos,col,idx,count:idx.length,cols,rows};
  }

  /* the roadway, as flat ribbons a little above the ground */
  {
    const g=NYC.network.build();
    const WIDTH={ave:30,st:18,hwy:26,thru:22,bway:26,walk:8,cross:16,join:0};
    const pos=[],col=[];
    const grey=hex("#6B665C");
    g.edges.forEach(e=>{
      const wdt=WIDTH[e.kind];
      if(!wdt) return;
      const A=g.nodes[e.a], B=g.nodes[e.b];
      const [ax,az]=g2w(A.x,A.y), [bx,bz]=g2w(B.x,B.y);
      const dx=bx-ax, dz=bz-az, L=Math.hypot(dx,dz)||1;
      const nx=-dz/L*wdt/2, nz=dx/L*wdt/2;
      const ay=groundAt(ax,az)+0.5, by=groundAt(bx,bz)+0.5;
      const q=[[ax+nx,ay,az+nz],[bx+nx,by,bz+nz],[bx-nx,by,bz-nz],
               [ax+nx,ay,az+nz],[bx-nx,by,bz-nz],[ax-nx,ay,az-nz]];
      q.forEach(v=>{ pos.push(v[0],v[1],v[2]); col.push(grey[0],grey[1],grey[2]); });
    });
    out.roads={pos:new Float32Array(pos),col:new Float32Array(col),count:pos.length/3};
  }

  /* the parks, as their own ground */
  {
    const pos=[],col=[];
    const green=hex("#4E6B3A");
    NYC.data.PARKS.forEach(p=>{
      for(let i=1;i<p.length-1;i++){
        [[p[0]],[p[i]],[p[i+1]]].forEach(v=>{
          const [wx,wz]=g2w(v[0][0],v[0][1]);
          pos.push(wx,groundAt(wx,wz)+0.8,wz);
          col.push(green[0],green[1],green[2]);
        });
      }
    });
    out.parks={pos:new Float32Array(pos),col:new Float32Array(col),count:pos.length/3};
  }

  /* every box in the city, as instances */
  {
    const n=w.colliders.length;
    const off=new Float32Array(n*3), scl=new Float32Array(n*3),
          col=new Float32Array(n*3), yaw=new Float32Array(n);
    w.colliders.forEach((c,i)=>{
      let h=c.height;
      let rgb=colourOf(c,mode);
      if(states&&c.kind==="block"){
        const st=states[c.ref];
        if(st!=null&&st<4){
          rgb=hex(NYC.sim.STATES[st][2]);
          if(st===0) h=Math.max(3,c.height*0.22);      /* lost: down to its own rubble */
          else if(st===1) h=c.height*0.75;
        }
      }
      off[i*3]=c.cx; off[i*3+1]=c.base; off[i*3+2]=c.cz;
      scl[i*3]=c.hx*2; scl[i*3+1]=h; scl[i*3+2]=c.hz*2;
      col[i*3]=rgb[0]; col[i*3+1]=rgb[1]; col[i*3+2]=rgb[2];
      yaw[i]=c.yaw;
    });
    out.boxes={off,scl,col,yaw,count:n};
  }
  return out;
}
function isPark(gx,gy){
  for(const p of NYC.data.PARKS) if(NYC.fabric.inPoly(gx,gy,p)) return true;
  return false;
}
const HGT_RAMP=[[12,"#D9D2C2"],[20,"#CFC4AC"],[35,"#C0B092"],[60,"#A89478"],
                [120,"#8C7A60"],[1e9,"#6B5B46"]];
function colourOf(c,mode){
  if(c.kind==="structure") return hex("#6E6A60");
  if(mode==="era") return hex((NYC.fabric.ERAS[c.era]||{colour:"#B08A62"}).colour);
  if(mode==="height"){ for(const r of HGT_RAMP) if(c.height<r[0]) return hex(r[1]);
    return hex("#6B5B46"); }
  return hex((NYC.fabric.USES[c.use]||{colour:"#CBA57F"}).colour);
}

/* ---- what a fragment class weighs, borrowed from the two-dimensional model -------- */
function fragmentPreset(id){
  const c=(NYC.debris?NYC.debris.CLASSES:[]).find(x=>x.id===id);
  return c?{mass:c.mass,cda:c.cda,label:c.label}:{mass:200,cda:1.2,label:"debris"};
}

NYC.world3d={build,meshes,colliders:()=>build().colliders,groundAt,raycast,trace,containing,
  fragmentPreset,MATERIAL,U2M,g2w,w2g,
  get stats(){ const w=build();
    return {colliders:w.colliders.length,cells:w.bp.size,buildMs:w.buildMs}; }};
})();
