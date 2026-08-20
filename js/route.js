/* ===================================================================================
   NYC 2050 — routing.
   Two points and a question: which way, and what is on the way. Every edge of the
   walking network is priced twice — in minutes, and in what it costs to be there —
   and four different weightings of those two numbers produce four different routes.

   The hazard side reads the same sources as everything else on the sheet: the
   elevation surface and the tide for water, the fabric for what might come off a
   building, the named structures for their fall lines, and, if a projection is up,
   whatever that projection has just done to the city.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};

const WALK=75;                    /* metres per minute on clear ground */
const TIDES={LOW:-0.5,MEAN:0,HIGH:0.7,SPRING:1.15};

const PROFILES=[
 {id:"fast",  name:"FASTEST",  blurb:"Shortest time on the ground, whatever is on it."},
 {id:"safe",  name:"SAFEST",   blurb:"Avoids falling fabric, rubble and open ground."},
 {id:"dry",   name:"DRIEST",   blurb:"Stays out of the water at the stated tide."},
 {id:"supply",name:"SUPPLIED", blurb:"Keeps within reach of water, food and care."}
];

/* ---- static hazard attributes, computed once per edge ---------------------------- */
let PREPPED=false, TALL=null;
function prep(){
  if(PREPPED) return;
  const g=NYC.network.build(), T=NYC.terrain;
  /* the structures big enough and loose enough to drop something on a street */
  TALL=(NYC.mapView?NYC.mapView.marks:[]).map(m=>({m,h:NYC.heights.heightOf(m)}))
    .filter(o=>o.h>=70&&o.m.disp!=="OCCUPIED");
  const providers=(NYC.sim?NYC.sim.PROVIDERS:[]).map(p=>{
    const m=(NYC.mapView?NYC.mapView.marks:[]).find(x=>x.name===p.name);
    return m&&(m.disp==="OCCUPIED"||m.disp==="STANDING")?{x:m.x,y:m.y,reach:p.reach}:null;
  }).filter(Boolean);

  g.edges.forEach(e=>{
    e.elev=T.elev(e.mx,e.my);
    e.wide=(e.kind==="ave"||e.kind==="hwy"||e.kind==="bway");
    /* what is standing over the roadway */
    const blk=NYC.fabric?NYC.fabric.at(e.mx,e.my):null;
    e.block=blk?blk.id:-1;
    let fall=0;
    if(blk){
      const oldish=blk.era==="pre-1901"?1:blk.era==="1901-29"?0.7:0.35;
      fall=Math.min(0.55,(blk.height/160)*oldish);
    }
    for(const o of TALL){
      const d=Math.hypot(o.m.x-e.mx,o.m.y-e.my)*10;      /* metres */
      if(d<o.h*0.75){
        const loose=o.m.disp==="COLLAPSED"?1:o.m.disp==="SALVAGE"?0.8:0.45;
        fall=Math.max(fall,Math.min(0.9,(1-d/(o.h*0.75))*loose));
        e.fallName=o.m.name;
      }
    }
    if(e.wide) fall*=0.55;                               /* a wide street is a fall gap */
    e.fall=fall;
    e.exposure=e.kind==="cross"?0.85:e.kind==="hwy"?0.35:e.wide?0.2:0.1;
    e.supply=providers.some(p=>Math.hypot(p.x-e.mx,p.y-e.my)<=p.reach*0.55)?1:0;
    e.band=NYC.map.bandOf(e.my);
  });
  PREPPED=true;
}
function reset(){ PREPPED=false; }

/* ---- what an edge costs right now ------------------------------------------------- */
function evaluate(e,ctx){
  const depth=ctx.water-e.elev;
  let speed=1, risk=e.fall*0.55+e.exposure*0.25, water=0, blocked=false, why=null;

  if(depth>0){
    water=Math.min(1,depth/1.2);
    if(depth>1.15){ blocked=true; why="under water"; }
    else if(depth>0.5){ speed*=0.35; risk+=0.42; }
    else { speed*=0.8; risk+=0.14; }
  }
  if(e.crossing){
    if(!e.passable){ blocked=true; why="crossing severed"; }
    else { speed*=1/e.penalty; risk+=0.35; }
  }
  /* whatever the projection has just done here */
  const P=ctx.proj;
  if(P){
    if(P.fire&&P.fire(e.mx,e.my)){ blocked=true; why="fire"; }
    const bs=(e.block>=0&&P.blocks)?P.blocks[e.block]:null;
    if(bs!=null){
      if(bs===0){ speed*=0.18; risk+=0.55; why=why||"rubble"; }
      else if(bs===1){ speed*=0.45; risk+=0.35; }
      else if(bs===2){ speed*=0.8; risk+=0.15; }
    }
    if(P.flood&&P.flood(e.mx,e.my,e.elev)){ blocked=true; why=why||"flooded by the event"; }
  }
  risk=Math.min(1,risk);
  const minutes=e.len/(WALK*speed);
  return {minutes,risk,water,blocked,why,speed};
}
function priced(v,profile){
  if(v.blocked) return Infinity;
  const m=v.minutes;
  switch(profile){
    case "safe":   return m*(1+v.risk*2.2)+v.risk*18;
    case "dry":    return m*(1+v.water*4)+v.water*40;
    case "supply": return m*(1+v.risk*0.8);
    default:       return m;
  }
}

/* ---- a small binary heap ----------------------------------------------------------- */
function Heap(){ this.a=[]; }
Heap.prototype.push=function(k,v){
  const a=this.a; a.push([k,v]);
  let i=a.length-1;
  while(i>0){ const p=(i-1)>>1; if(a[p][0]<=a[i][0]) break;
    const t=a[p];a[p]=a[i];a[i]=t; i=p; }
};
Heap.prototype.pop=function(){
  const a=this.a; if(!a.length) return null;
  const top=a[0], last=a.pop();
  if(a.length){ a[0]=last; let i=0;
    for(;;){ const l=2*i+1,r=l+1; let m=i;
      if(l<a.length&&a[l][0]<a[m][0]) m=l;
      if(r<a.length&&a[r][0]<a[m][0]) m=r;
      if(m===i) break; const t=a[m];a[m]=a[i];a[i]=t; i=m; }
  }
  return top;
};

/* ---- the search ---------------------------------------------------------------------
   Over directed edges rather than nodes, so that turning off a street can be made to
   cost something. Without it the grid produces a staircase: every zigzag between two
   points on a lattice is exactly the same length, and the router picks one at random.
   ------------------------------------------------------------------------------------ */
const TURN=1.6;                   /* minutes of hesitation at a junction */

function search(from,to,profile,ctx,vals){
  const g=NYC.network.build(), E=g.edges.length;
  const dist=new Float64Array(E*2).fill(Infinity);
  const prev=new Int32Array(E*2).fill(-1);
  const done=new Uint8Array(E*2);
  const head=s=>{ const e=g.edges[s>>1]; return (s&1)?e.a:e.b; };
  const cost=i=>priced(vals[i],profile);
  const h=new Heap();

  for(const r of g.nodes[from].adj){
    const e=g.edges[r.e];
    const c=cost(r.e);
    if(!isFinite(c)) continue;
    const s=(r.e<<1)|(e.a===from?0:1);
    if(c<dist[s]){ dist[s]=c; h.push(c,s); }
  }
  let best=-1,bestD=Infinity;
  while(true){
    const top=h.pop(); if(!top) break;
    const s=top[1];
    if(done[s]) continue;
    done[s]=1;
    const v=head(s);
    if(v===to){ if(dist[s]<bestD){ bestD=dist[s]; best=s; } break; }
    if(dist[s]>bestD) break;
    const name=g.edges[s>>1].name;
    for(const r of g.nodes[v].adj){
      if(r.e===(s>>1)) continue;                       /* no doubling back */
      const e2=g.edges[r.e];
      const c=cost(r.e);
      if(!isFinite(c)) continue;
      const s2=(r.e<<1)|(e2.a===v?0:1);
      if(done[s2]) continue;
      const turn=(e2.name===name||e2.kind==="join"||g.edges[s>>1].kind==="join")?0:TURN;
      const nd=dist[s]+c+turn;
      if(nd<dist[s2]){ dist[s2]=nd; prev[s2]=s; h.push(nd,s2); }
    }
  }
  if(best<0) return null;
  const states=[];
  for(let s=best;s>=0;s=prev[s]) states.push(s);
  states.reverse();
  const eids=states.map(s=>s>>1);
  const path=[];
  for(let k=0;k<states.length;k++){
    const e=g.edges[states[k]>>1], d=states[k]&1;
    const tail=d?e.b:e.a;
    if(!k) path.push(tail);
    path.push(d?e.a:e.b);
  }
  return {path,eids};
}

/* ---- turn it into something a person could follow ---------------------------------- */
const POINTS=["east","north-east","north","north-west","west","south-west","south",
              "south-east"];
const COMPASS=(dx,dy)=>{
  if(!dx&&!dy) return "along";
  let a=Math.atan2(dy,dx)*180/Math.PI;           /* +x east, +y north */
  if(a<0) a+=360;
  return POINTS[Math.round(a/45)%8];
};
function assemble(res,ctx,profile){
  const g=NYC.network.build();
  const legs=[], warn=[];
  let dist=0,minutes=0,riskSum=0,wet=0;
  let cur=null;
  res.eids.forEach((ei,k)=>{
    const e=g.edges[ei], v=evaluate(e,ctx);
    const A=g.nodes[res.path[k]], B=g.nodes[res.path[k+1]];
    dist+=e.len; minutes+=v.minutes; riskSum+=v.risk*e.len;
    if(v.water>0) wet+=e.len;
    const name=e.kind==="join"?(cur?cur.name:e.name):e.name;
    if(!cur||cur.name!==name){
      if(cur) legs.push(cur);
      cur={name,m:0,minutes:0,risk:0,wet:0,dir:COMPASS(B.x-A.x,B.y-A.y),kind:e.kind,
           notes:new Set()};
    }
    cur.m+=e.len; cur.minutes+=v.minutes; cur.risk=Math.max(cur.risk,v.risk);
    if(v.water>0) cur.wet+=e.len;
    if(v.why) cur.notes.add(v.why);
    if(e.fallName&&e.fall>0.4) cur.notes.add("under "+e.fallName);
    if(e.crossing&&e.passable) cur.notes.add(e.note);
  });
  if(cur) legs.push(cur);
  legs.forEach(l=>l.notes=[...l.notes]);
  /* the things worth saying before setting out */
  if(wet>60) warn.push(Math.round(wet)+" m of standing water at "+ctx.tide.toLowerCase()+" tide");
  const crossing=legs.find(l=>l.kind==="cross");
  if(crossing) warn.push("crosses by the "+crossing.name+" — "+crossing.notes.join(", "));
  const fallLegs=legs.filter(l=>l.notes.some(n=>n.indexOf("under ")===0));
  if(fallLegs.length) warn.push("passes the fall line of "+
    fallLegs.map(l=>l.notes.find(n=>n.indexOf("under ")===0).slice(6)).slice(0,2).join(" and "));
  const rubble=legs.filter(l=>l.notes.indexOf("rubble")>=0);
  if(rubble.length) warn.push("climbs rubble on "+rubble.map(l=>l.name).slice(0,2).join(" and "));
  return {profile,legs:legs.filter(l=>l.m>25),path:res.path,eids:res.eids,
    distance:dist,minutes,hazard:dist?riskSum/dist:0,wet,warnings:warn};
}

/* ---- the public call ---------------------------------------------------------------- */
/* opt: {from:[x,y], to:[x,y], tide:"MEAN", useProjection:bool} */
function plan(opt){
  prep();
  const g=NYC.network.build();
  const from=NYC.network.nearest(opt.from[0],opt.from[1],60);
  const to=NYC.network.nearest(opt.to[0],opt.to[1],60);
  if(from<0||to<0) return {error:"No road within six hundred metres of that point."};
  if(from===to) return {error:"Those two points are on the same corner."};

  const ctx={tide:opt.tide||"MEAN",water:TIDES[opt.tide||"MEAN"],proj:null};
  if(opt.useProjection&&NYC.simui&&NYC.simui.projectionContext)
    ctx.proj=NYC.simui.projectionContext();

  const vals=g.edges.map(e=>evaluate(e,ctx));
  const routes=[], seen=new Set();
  PROFILES.forEach(p=>{
    const r=search(from,to,p.id,ctx,vals);
    if(!r) return;
    const a=assemble(r,ctx,p);
    const sig=a.eids.join(",");
    if(seen.has(sig)){
      const first=routes.find(x=>x.eids.join(",")===sig);
      if(first) first.alsoBest.push(p.name);
      return;
    }
    seen.add(sig);
    a.alsoBest=[];
    routes.push(a);
  });
  if(!routes.length) return {error:"No way through. Every road out of there is under "+
    "water, on fire, or on the far side of a severed crossing.",
    from:g.nodes[from],to:g.nodes[to]};
  routes.sort((a,b)=>a.minutes-b.minutes);
  return {routes,from:g.nodes[from],to:g.nodes[to],ctx};
}

NYC.route={plan,PROFILES,TIDES,reset,prep,evaluate,WALK};
})();
