/* ===================================================================================
   NYC 2050 — contingency projections.
   A hazard is placed on the sheet, run forward twenty-four hours, and every logged
   site is asked what it would be afterwards. Two things are tracked separately:
   what the event breaks (structural) and what stops working because something else
   broke (functional). The second is usually the larger number.

   Nothing here is a prediction. The fragility figures are invented to be plausible
   and internally consistent, not surveyed. The blast case is deliberately abstract:
   a scale, a footprint, and no physics beyond distance.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{}, D=NYC.data, TR=NYC.terrain;

const STEPS=24;                 /* hours */
const CELL=12;                  /* raster cell, grid units (120 m) */
const U2KM=0.01;                /* grid units to kilometres */

/* ---- how much of itself a thing loses, by what it is ----------------------------- */
const VULN={
  Tower:    {quake:.38,blast:.62,fire:.30,flood:.35,wind:.45},
  Landmark: {quake:.72,blast:.50,fire:.40,flood:.30,wind:.25},
  Civic:    {quake:.60,blast:.52,fire:.45,flood:.50,wind:.30},
  Trade:    {quake:.70,blast:.72,fire:.80,flood:.70,wind:.50},
  Transit:  {quake:.50,blast:.40,fire:.30,flood:.95,wind:.15},
  Medical:  {quake:.55,blast:.52,fire:.50,flood:.60,wind:.35},
  Lifeline: {quake:.60,blast:.60,fire:.50,flood:.85,wind:.40},
  Industry: {quake:.50,blast:.55,fire:.70,flood:.70,wind:.45},
  Park:     {quake:.05,blast:.15,fire:.55,flood:.50,wind:.35},
  District: {quake:.62,blast:.60,fire:.75,flood:.70,wind:.45},
  Water:    {quake:.35,blast:.40,fire:.02,flood:.05,wind:.02}
};
/* what condition it was already in */
const COND={COLLAPSED:1.45,SALVAGE:1.20,FLOODED:1.18,UNSURVEYED:1,
            SEALED:.95,STANDING:.90,OCCUPIED:.85};

const STATES=[["LOST",.80,"#6E1A1A"],["CRITICAL",.55,"#8F2222"],["DAMAGED",.32,"#C4472A"],
              ["AFFECTED",.14,"#E08A24"],["HELD",0,"#3F6B3A"]];
function stateOf(d){ for(const s of STATES) if(d>=s[1]) return s[0]; return "HELD"; }
function stateIndex(d){ for(let i=0;i<STATES.length;i++) if(d>=STATES[i][1]) return i;
  return STATES.length-1; }
function stateColour(s){ for(const x of STATES) if(x[0]===s) return x[2]; return "#3F6B3A"; }

/* ---- the network that keeps the rest of it alive --------------------------------- */
const PROVIDERS=[
 {name:"Astoria Generating Station",     service:"POWER", reach:1100},
 {name:"East River Station",             service:"POWER", reach:600},
 {name:"Brooklyn Navy Yard",             service:"POWER", reach:420},
 {name:"Central Park Reservoir",         service:"WATER", reach:800},
 {name:"Highbridge Water Tower",         service:"WATER", reach:620},
 {name:"Hillview / Aqueduct Terminus",   service:"WATER", reach:2600},
 {name:"Hunts Point Market",             service:"FOOD",  reach:2000},
 {name:"Wegmans Food Markets",           service:"FOOD",  reach:620},
 {name:"Chelsea Market",                 service:"FOOD",  reach:420},
 {name:"Brooklyn Botanic Garden",        service:"FOOD",  reach:520},
 {name:"Flushing Meadows",               service:"FOOD",  reach:700},
 {name:"Newtown Creek Works",            service:"SANITATION", reach:1000},
 {name:"Atlantic Terminal",              service:"SUPPLY",reach:1200},
 {name:"Sunnyside Yard",                 service:"SUPPLY",reach:900}
];
const SERVICE_NAMES={POWER:"power",WATER:"water",FOOD:"food",
  SANITATION:"sanitation",SUPPLY:"overland supply",MEDICAL:"medical care"};
/* a provider that was already dark before the event cannot be lost again */
const LIVE_BASE=new Set(["OCCUPIED","STANDING"]);

/* ---- hazards --------------------------------------------------------------------- */
const HAZARDS=[
 {id:"surge", kind:"natural", name:"Hurricane and storm surge", short:"SURGE",
  point:false, focus:0,
  blurb:"Water first, wind second. The surge follows the old shoreline into the made "+
        "ground, and the made ground is where the city put everything it could not "+
        "put anywhere else.",
  params:[
   {id:"height",label:"PEAK SURGE",min:1,max:8,step:.5,val:4,unit:" m"},
   {id:"wind",  label:"SUSTAINED WIND",min:70,max:260,step:10,val:160,unit:" km/h"},
   {id:"bearing",label:"APPROACH",min:0,max:315,step:45,val:135,bearing:true}]},

 {id:"quake", kind:"natural", name:"Earthquake", short:"QUAKE",
  point:true, focus:1.3, pointLabel:"EPICENTRE",
  blurb:"The rock is shallow at both ends of Manhattan and deep in the middle, and "+
        "every waterfront in the region is standing on fill. The same shock does very "+
        "different things four hundred metres apart.",
  params:[
   {id:"mag",  label:"MAGNITUDE",min:4.5,max:7.5,step:.1,val:6.2},
   {id:"depth",label:"FOCAL DEPTH",min:4,max:30,step:1,val:10,unit:" km"},
   {id:"after",label:"AFTERSHOCKS",min:0,max:3,step:1,val:2}]},

 {id:"fire", kind:"natural", name:"Firestorm", short:"FIRE",
  point:true, focus:2.2, pointLabel:"IGNITION",
  blurb:"Nothing has been cleared in twenty-six years. Fire moves with the wind, "+
        "stops at water, and slows at anything the city built wide enough — which is "+
        "why the avenues are drawn on this sheet at all.",
  params:[
   {id:"wind",   label:"WIND SPEED",min:0,max:90,step:5,val:35,unit:" km/h"},
   {id:"bearing",label:"WIND FROM",min:0,max:315,step:45,val:270,bearing:true},
   {id:"dry",    label:"DRYNESS",min:10,max:100,step:5,val:70,unit:" %"}]},

 {id:"collapse", kind:"human", name:"Uncontrolled structural collapse", short:"COLLAPSE",
  point:true, focus:5, pointLabel:"STRUCTURE",
  blurb:"A tall thing coming down the way it wants to rather than the way it was "+
        "meant to. The debris field is the height of the structure, laid on its side, "+
        "and whatever it lands on may go the same way.",
  params:[
   {id:"height", label:"STRUCTURE HEIGHT",min:20,max:560,step:10,val:220,unit:" m"},
   {id:"bearing",label:"FALL BEARING",min:0,max:315,step:45,val:180,bearing:true},
   {id:"chain",  label:"PROGRESSIVE",min:0,max:1,step:1,val:1,onoff:true},
   {id:"eject",  label:"EJECTA THROW",min:0,max:1,step:1,val:1,onoff:true},
   {id:"frags",  label:"FRAGMENTS SAMPLED",min:60,max:400,step:20,val:220}]},

 {id:"blast", kind:"human", name:"Large-scale blast event", short:"BLAST",
  point:true, focus:2.4, pointLabel:"EPICENTRE",
  blurb:"Held deliberately abstract: an origin, a scale, and rings drawn off distance "+
        "alone. No energy figure is given and none is modelled. The point of the plate "+
        "is the shape of the hole in the network, not the event that made it.",
  params:[
   {id:"scale",label:"SCALE",min:1,max:5,step:1,val:3},
   {id:"burn", label:"SECONDARY FIRES",min:0,max:1,step:1,val:1,onoff:true},
   {id:"eject",label:"EJECTA THROW",min:0,max:1,step:1,val:1,onoff:true},
   {id:"frags",label:"FRAGMENTS SAMPLED",min:60,max:400,step:20,val:220}]},

 {id:"outage", kind:"human", name:"Deliberate infrastructure failure", short:"OUTAGE",
  point:true, focus:1.8, pointLabel:"INSTALLATION",
  blurb:"No footprint at all. One installation stops, and the sheet is asked what "+
        "else stops with it. This is the projection the survey runs most often.",
  params:[
   {id:"spread",label:"SECOND ORDER",min:0,max:1,step:1,val:1,onoff:true}]}
];

/* ---- deterministic noise, so a projection re-runs identically -------------------- */
function rng(seed){
  let a=(seed>>>0)||1;
  return function(){ a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296; };
}
const hashSpec=s=>{
  let h=2166136261;
  const str=s.hazard+JSON.stringify(s.params)+(s.point?s.point.join(","):"");
  for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); }
  return h>>>0;
};

/* ---- the raster the flood and the fire are computed on --------------------------- */
let RS=null;
function raster(){
  if(RS) return RS;
  const x0=-290,y0=-530,x1=650,y1=1770;
  const cols=Math.ceil((x1-x0)/CELL), rows=Math.ceil((y1-y0)/CELL);
  const elev=new Float32Array(cols*rows), fuel=new Float32Array(cols*rows);
  const land=new Uint8Array(cols*rows);
  /* the avenues and the widest thoroughfares hold a fire up */
  const breaks=[];
  D.AVES.forEach(a=>{ if(a[4]<=2) breaks.push({vert:true,x:a[1],y0:a[2],y1:a[3]}); });
  D.THRU.forEach(t=>{ if(t[2]===1) breaks.push({pts:t[1]}); });
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const x=x0+c*CELL+CELL/2, y=y0+r*CELL+CELL/2, i=r*cols+c;
    const b=TR.onLand(x,y);
    land[i]=b?1:0;
    if(!b){ elev[i]=-3; fuel[i]=0; continue; }
    const e=TR.elev(x,y);
    elev[i]=e;
    let f=0.82;
    if(e<1) f=0.45;                                   /* wet ground carries badly */
    if(NYC.terrain.inPoly(x,y,D.CPARK)) f=0.62;       /* Central Park: fuel, but green */
    for(const br of breaks){
      if(br.vert){ if(Math.abs(x-br.x)<4 && y>br.y0 && y<br.y1) f*=0.45; }
      else { for(const p of br.pts) if(Math.abs(p[0]-x)<7&&Math.abs(p[1]-y)<7) f*=0.5; }
    }
    fuel[i]=f;
  }
  RS={x0,y0,cols,rows,elev,fuel,land,
      cx:c=>x0+c*CELL+CELL/2, cy:r=>y0+r*CELL+CELL/2,
      col:x=>Math.floor((x-x0)/CELL), row:y=>Math.floor((y-y0)/CELL)};
  return RS;
}
/* rows of set cells collapsed into rectangles, so an overlay is a few hundred shapes */
function runs(mask){
  const R=raster(), out=[];
  for(let r=0;r<R.rows;r++){
    let start=-1;
    for(let c=0;c<=R.cols;c++){
      const on=c<R.cols&&mask[r*R.cols+c];
      if(on&&start<0) start=c;
      else if(!on&&start>=0){
        out.push([R.x0+start*CELL, R.y0+r*CELL, (c-start)*CELL, CELL]);
        start=-1;
      }
    }
  }
  return out;
}

/* ---- geometry -------------------------------------------------------------------- */
const dist=(a,b,c,d)=>Math.hypot(a-c,b-d);
const bearingVec=deg=>{ const r=(90-deg)*Math.PI/180; return [Math.cos(r),Math.sin(r)]; };

/* =================================================================================== */
function run(spec){
  /* the sheet's own list when the app is up, the raw data when it is not */
  const marks=(NYC.mapView&&NYC.mapView.marks)||D.LANDMARKS.map((d,i)=>({
    i,name:d[0],x:d[1],y:d[2],cat:d[3],disp:d[4],tier:d[5],note:d[6]||""}));
  const sites=marks.slice();
  const H=HAZARDS.find(h=>h.id===spec.hazard);
  const P=spec.params||{};
  const rand=rng(hashSpec(spec));
  const R=raster();

  /* per-site accumulators */
  const S=sites.map(m=>({
    m, struct:0, func:0, lost:null, cut:false,
    vuln:VULN[m.cat]||VULN.Trade, cond:COND[m.disp]||1,
    g:TR.ground(m.x,m.y), services:{}, notes:[]
  }));
  const byName=new Map(S.map(s=>[s.m.name,s]));
  const frames=[];
  const events=[];                      /* [{t, text, kind}] */
  const note=(t,text,kind)=>events.push({t,text,kind:kind||"info"});

  /* ------------------------------------------------------------------ hazard set-up */
  const pt=spec.point||[0,300];
  let fireMask=null, fireAge=null, burntMask=null, ignitions=[];
  let cones=[], rings=[], collapsed=[];

  if(H.id==="fire"||((H.id==="blast")&&P.burn)||H.id==="quake"){
    fireMask=new Uint8Array(R.cols*R.rows);
    burntMask=new Uint8Array(R.cols*R.rows);
    fireAge=new Uint8Array(R.cols*R.rows);
  }
  function ignite(x,y){
    const c=R.col(x), r=R.row(y);
    if(c<0||r<0||c>=R.cols||r>=R.rows) return;
    const i=r*R.cols+c;
    if(R.land[i]&&R.fuel[i]>0.2) fireMask[i]=1;
  }
  if(H.id==="fire") ignite(pt[0],pt[1]);

  if(H.id==="collapse"){
    /* the structure itself, and anything its debris brings down after it */
    const gen=(px,py,h,bear,depth)=>{
      const reach=h/10*0.95, [ux,uy]=bearingVec(bear);
      cones.push({x:px,y:py,ux,uy,reach,half:0.38,t:depth*2});
      collapsed.push({x:px,y:py,r:reach*1.7,t:depth*2});
      if(!P.chain||depth>=2) return;
      sites.forEach(m=>{
        if(m.cat!=="Tower"&&m.cat!=="Landmark") return;
        const dx=m.x-px, dy=m.y-py, d=Math.hypot(dx,dy);
        if(d<6||d>reach) return;
        const dot=(dx*ux+dy*uy)/d;
        if(dot>0.86&&rand()<0.5) gen(m.x,m.y,h*0.75,bear+(rand()*60-30),depth+1);
      });
    };
    gen(pt[0],pt[1],P.height,P.bearing,0);
  }
  if(H.id==="blast"){
    const Rr=60*P.scale;
    rings=[{r:Rr*0.22,d:1},{r:Rr*0.45,d:.72},{r:Rr*0.70,d:.42},{r:Rr,d:.16}];
    if(P.burn) for(let i=0;i<26;i++){
      const a=rand()*Math.PI*2, rr=Rr*(0.18+rand()*0.55);
      ignite(pt[0]+Math.cos(a)*rr, pt[1]+Math.sin(a)*rr);
    }
  }
  if(H.id==="outage"){
    /* the nearest installation worth failing */
    let best=null,bd=1e9;
    S.forEach(s=>{
      if(s.m.cat!=="Lifeline"&&s.m.cat!=="Industry"&&s.m.cat!=="Medical"&&
         s.m.cat!=="Transit") return;
      const d=dist(s.m.x,s.m.y,pt[0],pt[1]);
      if(d<bd){bd=d;best=s;}
    });
    if(best){ best.struct=1; best.lost=0;
      note(0,best.m.name+" taken out of service.","loss"); }
  }

  /* ---- what the event throws, and what it goes through on the way down ---------- */
  let ejecta=null, ejectaGeom=null;
  if(NYC.debris&&P.eject&&(H.id==="blast"||H.id==="collapse")){
    const isFall=H.id==="collapse";
    ejecta=NYC.debris.field({
      origin:pt, kind:isFall?"collapse":"blast",
      height:isFall?P.height:10,
      power:isFall?P.height:P.scale,
      bearing:isFall?P.bearing:0, spread:isFall?36:180,
      count:P.frags|0||220, seed:hashSpec(spec)^0x9E37,
      sites:sites, heightOf:m=>NYC.heights.heightOf(m)
    });
    ejecta.damage.forEach((d,name)=>{
      const s2=byName.get(name); if(!s2) return;
      const dm=Math.min(1,d*s2.cond);
      s2.struct=Math.min(1,s2.struct+dm);
      if(!s2.lost&&s2.struct>=.8) s2.lost=0;
    });
    const U=NYC.debris.U2M;
    ejectaGeom={
      origin:pt,
      rays:ejecta.frags.map(f=>({
        x1:pt[0],y1:pt[1],x2:f.land[0],y2:f.land[1],
        colour:f.colour, through:f.strikes.some(k=>k.through),
        far:f.landS>240
      })),
      impacts:[].concat.apply([],ejecta.frags.map(f=>
        f.strikes.map(k=>({x:pt[0]+f.dir[0]*k.s/U, y:pt[1]+f.dir[1]*k.s/U,
          through:k.through}))))
    };
    note(0,ejecta.stats.crossBlock+" fragments carry past the first block; "+
      ejecta.stats.through+" go through a structure and keep going.","hazard");
    if(ejecta.stats.multi)
      note(0,ejecta.stats.multi+" pass through more than one building before stopping.","hazard");
  }

  /* what was already being provided before the event; a projection reports the
     difference it makes, not the shortages the survey had already logged */
  const reachOf=(p,s)=>{
    const pv=byName.get(p.name);
    return pv && dist(s.m.x,s.m.y,pv.m.x,pv.m.y)<=p.reach;
  };
  const baseProviders=PROVIDERS.filter(p=>{
    const pv=byName.get(p.name);
    return pv && LIVE_BASE.has(pv.m.disp);
  });
  const baseMedics=S.filter(s=>s.m.cat==="Medical"&&LIVE_BASE.has(s.m.disp));
  S.forEach(s=>{
    const b={};
    ["POWER","WATER","FOOD","SANITATION","SUPPLY"].forEach(k=>{
      b[k]=baseProviders.some(p=>p.service===k&&reachOf(p,s));
    });
    b.MEDICAL=baseMedics.some(m=>dist(s.m.x,s.m.y,m.m.x,m.m.y)<=520);
    s.base=b;
  });

  /* ------------------------------------------------------------------ the run */
  const floodLevelAt=t=>{
    if(H.id!=="surge") return null;
    const peak=P.height;
    return Math.max(0, peak*Math.exp(-Math.pow((t-8)/4.6,2)));
  };
  let quakeShocks=[{t:0,mag:P.mag}];
  if(H.id==="quake"){
    const n=P.after|0;
    if(n>0) quakeShocks.push({t:3,mag:P.mag-1.1});
    if(n>1) quakeShocks.push({t:9,mag:P.mag-1.7});
    if(n>2) quakeShocks.push({t:17,mag:P.mag-2.2});
  }

  let peakFlood=0, peakFloodT=0;
  for(let t=0;t<=STEPS;t++){
    const frame={t,flood:null,fire:null,burnt:null,rings:null,cones:null,quake:null,
      debris:ejectaGeom};

    /* ---- water ---- */
    if(H.id==="surge"){
      const lvl=floodLevelAt(t);
      if(lvl>peakFlood){ peakFlood=lvl; peakFloodT=t; }
      const mask=new Uint8Array(R.cols*R.rows);
      for(let i=0;i<mask.length;i++) if(R.land[i]&&R.elev[i]<lvl) mask[i]=1;
      frame.flood=runs(mask);
      const [wx,wy]=bearingVec(P.bearing);
      S.forEach(s=>{
        /* shores facing the approach take the set-up on top of the surge */
        const bx=s.m.x-40, by=s.m.y-300, bl=Math.hypot(bx,by)||1;
        const face=Math.max(0,-(bx*wx+by*wy)/bl);
        const depth=lvl+face*1.1-s.g.elev;
        if(depth>0){
          const d=Math.min(1,depth/4)*s.vuln.flood*s.cond;
          if(d>s.struct){ s.struct=d; if(!s.lost&&d>=.8) s.lost=t; }
        }
      });
      if(t>=2&&t<=13){
        const w=Math.max(0,(P.wind-80)/190);
        S.forEach(s=>{
          const d=w*s.vuln.wind*s.cond;
          if(d>s.struct){ s.struct=d; if(!s.lost&&d>=.8) s.lost=t; }
        });
      }
      if(t===0) note(0,"Landfall. Water is ahead of the wind.","hazard");
      if(t===8) note(8,"Surge peaks at "+peak2(P.height)+" m above the tide.","hazard");
      if(t===12) note(12,"Water beginning to fall.","info");
      if(t===18) note(18,"Streets clear north of the inundated band. What it took, it kept.","info");
    }

    /* ---- shaking ---- */
    const shock=quakeShocks.find(q=>q.t===t);
    if(H.id==="quake") frame.quake={x:pt[0],y:pt[1],mag:(shock?shock.mag:P.mag),
      faint:!shock};
    if(H.id==="quake"&&shock){
      S.forEach(s=>{
        const rkm=dist(s.m.x,s.m.y,pt[0],pt[1])*U2KM;
        const rr=Math.sqrt(rkm*rkm+P.depth*P.depth);
        let I=1.5*shock.mag-3.0*Math.log10(rr+10)+1.4;
        I*=s.g.amp;
        let d=Math.max(0,(I-5)/4.3)*s.vuln.quake*s.cond;
        if(I>6) d+=s.g.liq*0.4*s.vuln.quake;
        d=Math.min(1,d);
        if(d>s.struct){ s.struct=d; if(!s.lost&&d>=.8) s.lost=t; }
      });
      note(t, t===0 ? "Magnitude "+shock.mag.toFixed(1)+" at the epicentre."
                    : "Aftershock, magnitude "+shock.mag.toFixed(1)+".", "hazard");
      /* fires start where the shaking was worst */
      if(t<=1){
        let lit=0;
        S.filter(s=>s.struct>.5&&s.m.cat==="Trade").slice(0,14)
          .forEach(s=>{ if(rand()<.5){ ignite(s.m.x,s.m.y); lit++; } });
        if(lit) note(t,lit+" fires reported in the worst-shaken ground. "+
          "Nothing is coming to put them out.","hazard");
      }
    }

    /* ---- collapse ---- */
    if(H.id==="collapse"){
      const live=cones.filter(c=>c.t<=t);
      if(live.length) frame.cones=live.map(c=>coneShape(c));
      frame.dust=collapsed.filter(c=>c.t<=t&&t-c.t<6)
        .map(c=>({x:c.x,y:c.y,r:c.r*(0.5+0.5*Math.min(1,(t-c.t)/3))}));
      S.forEach(s=>{
        live.forEach(c=>{
          const dx=s.m.x-c.x, dy=s.m.y-c.y, d=Math.hypot(dx,dy);
          if(d<2){ s.struct=1; if(s.lost==null) s.lost=c.t; return; }
          const dot=(dx*c.ux+dy*c.uy)/d;
          let dm=0;
          if(d<=c.reach&&dot>Math.cos(c.half*Math.PI))
            dm=(1-d/c.reach)*0.95+0.25;
          const dr=c.reach*1.7;
          if(d<=dr) dm=Math.max(dm,(1-d/dr)*0.45);
          dm=Math.min(1,dm*s.vuln.blast*s.cond*1.5);
          if(dm>s.struct){ s.struct=dm; if(!s.lost&&dm>=.8) s.lost=Math.max(t,c.t); }
        });
      });
      cones.forEach(c=>{ if(c.t===t&&t>0) note(t,"Progressive failure of an adjacent structure.","hazard"); });
      if(t===0) note(0,"Structure comes down across "+ (P.height/10).toFixed(0) +
        " units of ground.","hazard");
    }

    /* ---- blast ---- */
    if(H.id==="blast"&&t===0){
      frame.rings=rings.map(r=>({x:pt[0],y:pt[1],r:r.r}));
      S.forEach(s=>{
        const d=dist(s.m.x,s.m.y,pt[0],pt[1]);
        let dm=0;
        for(const r of rings) if(d<=r.r){ dm=r.d; break; }
        if(dm>0){
          dm = dm>=1 ? 1 : Math.min(1,dm*s.vuln.blast*s.cond*1.6);
          if(dm>s.struct){ s.struct=dm; if(!s.lost&&dm>=.8) s.lost=0; }
        }
      });
      note(0,"Event at "+NYC.map.gridRef(pt[0],pt[1])+". Rings drawn off distance only.","hazard");
    }
    if(H.id==="blast"&&t>0&&t<4) frame.rings=rings.map(r=>({x:pt[0],y:pt[1],r:r.r}));

    /* ---- fire spreads ---- */
    if(fireMask){
      if(t>0){
        const wind=H.id==="fire"?P.wind:18, dry=(H.id==="fire"?P.dry:60)/100;
        const [wx,wy]=bearingVec((H.id==="fire"?P.bearing:225)+180);
        /* the front covers more ground per hour the harder it is blowing */
        const sub=1+Math.round(wind/30);
        for(let k=0;k<sub;k++){
          const next=new Uint8Array(fireMask);
          for(let r=1;r<R.rows-1;r++) for(let c=1;c<R.cols-1;c++){
            const i=r*R.cols+c;
            if(!fireMask[i]) continue;
            for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++){
              if(!dr&&!dc) continue;
              const j=(r+dr)*R.cols+(c+dc);
              if(next[j]||burntMask[j]||!R.land[j]||R.fuel[j]<0.2) continue;
              const dl=Math.hypot(dc,dr);
              const align=(dc*wx+dr*wy)/dl;
              const wf=Math.max(0.10,1+2.1*align*(wind/55));
              if(rand()<0.44*R.fuel[j]*wf*dry/dl) next[j]=1;
            }
          }
          fireMask=next;
        }
        /* burn-out is measured in hours, not in fronts */
        for(let i=0;i<fireMask.length;i++) if(fireMask[i]){
          if(++fireAge[i]>3){ fireMask[i]=0; burntMask[i]=1; }
        }
      }
      frame.fire=runs(fireMask);
      frame.burnt=runs(burntMask);
      S.forEach(s=>{
        const c=R.col(s.m.x), r=R.row(s.m.y);
        if(c<0||r<0||c>=R.cols||r>=R.rows) return;
        const i=r*R.cols+c;
        if(fireMask[i]||burntMask[i]){
          const d=Math.min(1,0.92*s.vuln.fire*s.cond);
          if(d>s.struct){ s.struct=d; if(!s.lost&&d>=.8) s.lost=t; }
        }
      });
      if(t===1&&H.id==="fire") note(1,"Ignition holding. Wind "+P.wind+" km/h.","hazard");
    }

    /* ---- what stops working because something else stopped -------------------- */
    const live=name=>{
      const s=byName.get(name);
      if(!s) return false;
      if(!LIVE_BASE.has(s.m.disp)) return false;      /* already dark before the event */
      return s.struct<0.55;
    };
    const providersNow=PROVIDERS.filter(p=>live(p.name));
    const medics=S.filter(s=>s.m.cat==="Medical"&&LIVE_BASE.has(s.m.disp)&&s.struct<0.55);
    const WEIGHT={POWER:.22,WATER:.34,FOOD:.20,MEDICAL:.10,SANITATION:.08,SUPPLY:.10};
    S.forEach(s=>{
      const now={}, lostNow=[];
      ["POWER","WATER","FOOD","SANITATION","SUPPLY"].forEach(k=>{
        now[k]=providersNow.some(p=>p.service===k&&reachOf(p,s));
      });
      now.MEDICAL=medics.some(m=>dist(s.m.x,s.m.y,m.m.x,m.m.y)<=520);
      s.services=now;
      /* only what this event took: a shortage the survey already logged is not news */
      let f=0;
      Object.keys(WEIGHT).forEach(k=>{
        if(s.base[k]&&!now[k]){ f+=WEIGHT[k]; lostNow.push(k); }
      });
      s.lostServices=lostNow;
      f*=Math.min(1,t/9);                        /* it takes days, not hours */
      if(!LIVE_BASE.has(s.m.disp)) f*=0.35;      /* an empty building notices less */
      s.func=Math.max(s.func,Math.min(1,f));
    });

    frame.counts=tally(S);
    /* the state of every site at this hour, for the scrubber */
    frame.states=new Uint8Array(S.length);
    S.forEach((s,i)=>{ frame.states[i]=stateIndex(Math.max(s.struct,s.func*0.85)); });
    frames.push(frame);
  }

  /* ------------------------------------------------------------------ the reckoning */
  S.forEach(s=>{ s.total=Math.max(s.struct,s.func*0.85); s.state=stateOf(s.total); });

  /* what the network lost, said once */
  const lostServices={};
  ["POWER","WATER","FOOD","SANITATION","SUPPLY","MEDICAL"].forEach(k=>{
    const n=S.filter(s=>s.base[k]&&!s.services[k]&&LIVE_BASE.has(s.m.disp)).length;
    if(n) lostServices[k]=n;
  });
  const lostLifelines=S.filter(s=>s.m.cat==="Lifeline"&&s.struct>=.55&&LIVE_BASE.has(s.m.disp));
  const lostDistricts=S.filter(s=>s.m.cat==="District"&&s.m.disp==="OCCUPIED"&&
    (s.total>=.55||(s.base.WATER&&!s.services.WATER&&s.base.FOOD&&!s.services.FOOD)));
  const worst=S.slice().sort((a,b)=>b.total-a.total)
    .filter(s=>s.total>=.55).slice(0,10);

  PROVIDERS.forEach(p=>{
    const s=byName.get(p.name);
    if(s&&LIVE_BASE.has(s.m.disp)&&s.struct>=.55)
      note(s.lost==null?STEPS:s.lost, p.name+" fails — "+SERVICE_NAMES[p.service]+
        " lost across its reach.","loss");
  });

  const report={
    hazard:H, spec,
    counts:tally(S),
    services:lostServices,
    lifelines:lostLifelines.map(s=>s.m.name),
    districts:lostDistricts.map(s=>s.m.name),
    worst:worst.map(s=>({name:s.m.name,state:s.state,cat:s.m.cat})),
    peakFlood:H.id==="surge"?peakFlood:null,
    ejecta:ejecta?Object.assign({},ejecta.stats,{
      struck:ejecta.struck.slice(0,8),
      deepest:ejecta.deepest?{
        label:ejecta.deepest.label,
        range:Math.round(ejecta.deepest.landS),
        through:ejecta.deepest.strikes.filter(k=>k.through).length,
        names:ejecta.deepest.strikes.map(k=>k.name).filter(Boolean),
        fabric:ejecta.deepest.strikes.filter(k=>!k.name).length
      }:null}):null,
    burnt:burntMask?burntMask.reduce((a,b)=>a+b,0)*Math.pow(CELL*10,2)/1e6:0, /* km2 */
    narrative:""
  };
  report.narrative=narrate(H,P,report,S);
  report.ejectaField=ejecta;
  events.sort((a,b)=>a.t-b.t);

  return { hazard:H, spec, steps:STEPS, frames, events, report,
           sites:S.map(s=>({name:s.m.name,x:s.m.x,y:s.m.y,cat:s.m.cat,
             state:s.state,total:s.total,struct:s.struct,func:s.func,
             lost:s.lost,services:s.services,lostServices:s.lostServices||[]})) };
}

function coneShape(c){
  const a=Math.atan2(c.uy,c.ux), h=c.half*Math.PI;
  const pts=[[c.x,c.y]];
  for(let i=-1;i<=1;i+=0.25) pts.push([c.x+Math.cos(a+h*i)*c.reach,
                                        c.y+Math.sin(a+h*i)*c.reach]);
  return pts;
}
function tally(S,pre){
  const t={LOST:0,CRITICAL:0,DAMAGED:0,AFFECTED:0,HELD:0};
  S.forEach(s=>{
    const v=pre?0:Math.max(s.struct,s.func*0.85);
    t[stateOf(v)]++;
  });
  return t;
}
const peak2=v=>v.toFixed(1);

/* the survey writes its projections up the same way it writes everything else */
function narrate(H,P,rep,S){
  const c=rep.counts, out=[];
  const gone=c.LOST+c.CRITICAL;
  if(H.id==="surge")
    out.push("A surge of "+peak2(rep.peakFlood)+" m over the 2050 tide, with "+P.wind+
      " km/h behind it.");
  if(H.id==="quake")
    out.push("Magnitude "+P.mag.toFixed(1)+" at "+P.depth+" km, with "+(P.after|0)+
      " aftershock"+((P.after|0)===1?"":"s")+
      (rep.burnt>0.4?", and "+rep.burnt.toFixed(1)+" square kilometres burnt "+
        "in the fires that followed":"")+".");
  if(H.id==="fire")
    out.push("Ignition with "+P.wind+" km/h of wind and fuel at "+P.dry+
      " per cent dry; "+rep.burnt.toFixed(1)+" square kilometres burnt through.");
  if(H.id==="collapse")
    out.push("A "+P.height+" m structure down across the grid"+
      (P.chain?", taking its neighbours with it.":", cleanly."));
  if(H.id==="blast")
    out.push("Scale "+P.scale+" event; the outer ring reaches "+
      (60*P.scale*10/1000).toFixed(1)+" km.");
  if(H.id==="outage")
    out.push("One installation stopped, and nothing else touched.");

  out.push(gone+" of "+S.length+" logged sites pass out of use — "+c.LOST+
    " lost outright, "+c.CRITICAL+" critical — and "+c.DAMAGED+" more are damaged.");

  if(rep.ejecta){
    const e=rep.ejecta;
    out.push("Ejecta reaches "+Math.round(e.maxRange)+" m — "+
      (e.blocks<1.4?"most of a city block":e.blocks.toFixed(1)+" city blocks")+
      " — with "+e.crossBlock+" of "+e.count+" sampled fragments past the first block"+
      (e.crossThree?" and "+e.crossThree+" past the third":"")+". "+
      (e.through? e.through+" go through a structure and carry on"+
        (e.multi?", "+e.multi+" of them through more than one":"")+
        ", for "+e.breached+" breaches in all; "+e.struckCount+
        " logged sites are hit."
      : "Nothing carries enough energy to breach a structure."));
  }
  const svc=Object.keys(rep.services);
  if(svc.length){
    const worst=svc.sort((a,b)=>rep.services[b]-rep.services[a])[0];
    out.push("The larger figure is the network: "+rep.services[worst]+" occupied sites "+
      "end the projection without "+SERVICE_NAMES[worst]+
      (svc.length>1?", and "+(svc.length-1)+" other service"+(svc.length>2?"s":"")+
       " are degraded with it":"")+".");
  } else out.push("The network holds. Nothing that was still providing a service stops.");

  if(rep.lifelines.length)
    out.push("Lifelines lost: "+rep.lifelines.join(", ")+".");
  if(rep.districts.length)
    out.push(rep.districts.length+" occupied district"+
      (rep.districts.length===1?" passes":"s pass")+
      " out of habitability — "+rep.districts.slice(0,4).join(", ")+
      (rep.districts.length>4?", and others":"")+".");
  return out.join(" ");
}

NYC.sim={HAZARDS,STATES,STEPS,VULN,PROVIDERS,SERVICE_NAMES,run,stateOf,stateIndex,stateColour,
  raster,CELL};
})();
