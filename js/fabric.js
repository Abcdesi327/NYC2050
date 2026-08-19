/* ===================================================================================
   NYC 2050 — the built fabric.
   The survey logged 300-odd stations. The city has rather more buildings than that,
   and a projection that only knows about the stations cannot answer an infrastructural
   question. So the blocks are generated from the thing that actually determines them:
   the street grid already on the sheet. Avenues and streets bound them, the shoreline
   clips them, the parks are cut out, and each block is given a use, a period of
   construction, a height and a floor area from where it stands.

   None of this is surveyed. It is a plausible city, built to the right rules.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{}, D=NYC.data;

const U2M=10;                         /* one grid unit is ten metres */

/* ---- what a block can be ---------------------------------------------------------- */
const USES={
  RESID:  {label:"residential",  colour:"#CBA57F"},
  MIXED:  {label:"mixed",        colour:"#AC8663"},
  COMM:   {label:"commercial",   colour:"#8DA2AC"},
  CIVIC:  {label:"civic",        colour:"#93AC90"},
  INDUST: {label:"industrial",   colour:"#9A8574"},
  TRANSIT:{label:"rail and yard",colour:"#77848A"}
};
/* how it was built decides how it fails */
const ERAS={
  "pre-1901": {colour:"#9A6B52",quake:1.55,fire:1.45,blast:1.25,resist:0.75},
  "1901-29":  {colour:"#B08A62",quake:1.25,fire:1.15,blast:1.05,resist:0.95},
  "1930-60":  {colour:"#B8A87E",quake:0.95,fire:0.85,blast:0.90,resist:1.15},
  "1961-99":  {colour:"#A9B09A",quake:0.85,fire:0.75,blast:0.95,resist:1.30},
  "post-2000":{colour:"#9EAAB2",quake:0.70,fire:0.65,blast:1.15,resist:1.45}
};

/* ---- the character of the ground, north to south --------------------------------- */
/* [yFrom, yTo, name, use weights, height range m, era weights, coverage] */
const W=(o)=>o;
const MN_ZONES=[
 [-352,-190,"Financial District", W({COMM:.78,RESID:.14,CIVIC:.08}), [24,120],
   W({"pre-1901":.10,"1901-29":.34,"1930-60":.22,"1961-99":.20,"post-2000":.14}), .84],
 [-190,-104,"Tribeca and Civic Centre", W({MIXED:.42,RESID:.30,COMM:.20,CIVIC:.08}), [16,38],
   W({"pre-1901":.44,"1901-29":.34,"1930-60":.10,"1961-99":.08,"post-2000":.04}), .88],
 [-104,0,"SoHo, Chinatown and the Lower East Side", W({MIXED:.46,RESID:.38,COMM:.16}), [16,30],
   W({"pre-1901":.58,"1901-29":.28,"1930-60":.06,"1961-99":.06,"post-2000":.02}), .90],
 [0,112,"The Villages and the East Side", W({RESID:.58,MIXED:.30,COMM:.12}), [15,28],
   W({"pre-1901":.52,"1901-29":.30,"1930-60":.08,"1961-99":.08,"post-2000":.02}), .86],
 [112,272,"Chelsea to Murray Hill", W({RESID:.44,MIXED:.24,COMM:.28,CIVIC:.04}), [16,56],
   W({"pre-1901":.26,"1901-29":.34,"1930-60":.16,"1961-99":.16,"post-2000":.08}), .88],
 [272,472,"Midtown", W({COMM:.66,RESID:.20,CIVIC:.08,MIXED:.06}), [26,110],
   W({"pre-1901":.06,"1901-29":.32,"1930-60":.24,"1961-99":.24,"post-2000":.14}), .82],
 [472,760,"The Upper East and West Sides", W({RESID:.76,MIXED:.12,COMM:.08,CIVIC:.04}), [20,62],
   W({"pre-1901":.16,"1901-29":.40,"1930-60":.20,"1961-99":.18,"post-2000":.06}), .84],
 [760,1000,"Morningside to East Harlem", W({RESID:.74,MIXED:.14,CIVIC:.08,COMM:.04}), [16,40],
   W({"pre-1901":.24,"1901-29":.36,"1930-60":.22,"1961-99":.16,"post-2000":.02}), .82],
 [1000,1240,"Harlem", W({RESID:.72,MIXED:.16,CIVIC:.08,COMM:.04}), [15,34],
   W({"pre-1901":.30,"1901-29":.34,"1930-60":.20,"1961-99":.14,"post-2000":.02}), .80],
 [1240,1740,"Washington Heights and Inwood", W({RESID:.80,MIXED:.12,CIVIC:.06,COMM:.02}), [16,32],
   W({"pre-1901":.14,"1901-29":.52,"1930-60":.20,"1961-99":.12,"post-2000":.02}), .78]
];
const OUTER=[
 ["BK", W({RESID:.68,MIXED:.14,INDUST:.10,COMM:.06,CIVIC:.02}), [10,26],
   W({"pre-1901":.30,"1901-29":.38,"1930-60":.18,"1961-99":.12,"post-2000":.02}), .68],
 ["QN", W({RESID:.70,INDUST:.12,MIXED:.10,COMM:.06,CIVIC:.02}), [9,24],
   W({"pre-1901":.14,"1901-29":.34,"1930-60":.30,"1961-99":.20,"post-2000":.02}), .60],
 ["BX", W({RESID:.70,INDUST:.12,MIXED:.10,CIVIC:.06,COMM:.02}), [11,30],
   W({"pre-1901":.14,"1901-29":.36,"1930-60":.28,"1961-99":.20,"post-2000":.02}), .64]
];
/* the waterfront is where the city put the things nobody wanted to look at */
function waterfrontish(x,y){
  const w=D.WX(y), e=D.EX(y);
  return (x-w<14)||(e-x<14);
}

function rng(seed){
  let a=(seed>>>0)||1;
  return function(){ a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296; };
}
function weighted(r,map){
  let v=r(), acc=0;
  for(const k in map){ acc+=map[k]; if(v<=acc) return k; }
  return Object.keys(map)[0];
}
function inPoly(x,y,pts){
  let hit=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const xi=pts[i][0],yi=pts[i][1],xj=pts[j][0],yj=pts[j][1];
    if((yi>y)!==(yj>y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) hit=!hit;
  }
  return hit;
}
const inPark=(x,y)=>{ for(const p of D.PARKS) if(inPoly(x,y,p)) return true; return false; };

/* the avenue lines that exist at a given latitude, west to east */
function avenuesAt(y){
  const out=[];
  for(const a of D.AVES) if(y>=a[2]&&y<=a[3]) out.push(a[1]);
  return out.sort((a,b)=>a-b);
}

/* ---- generation ------------------------------------------------------------------- */
let BLOCKS=null;
function build(){
  if(BLOCKS) return BLOCKS;
  const t0=(typeof performance!=="undefined")?performance.now():0;
  const r=rng(20500129);
  BLOCKS=[];
  manhattan(r);
  outer(r);
  BLOCKS.forEach((b,i)=>b.id=i);
  BLOCKS.buildMs=Math.round(((typeof performance!=="undefined")?performance.now():0)-t0);
  return BLOCKS;
}

function emit(pts,cx,cy,boro,zone,r,opts){
  const use=weighted(r,zone.use);
  let era=weighted(r,zone.era);
  const [hLo,hHi]=zone.h;
  /* a few blocks in every neighbourhood are much taller than their neighbours */
  const tall=r()<(opts&&opts.tallChance||0.06);
  let height=hLo+(hHi-hLo)*Math.pow(r(),1.7);
  if(tall) height=hHi*(1.15+r()*1.35);
  if(use==="INDUST"||use==="TRANSIT"){ height=Math.min(height,22); era=era==="pre-1901"?"1901-29":era; }
  height=Math.round(height);
  const floors=Math.max(1,Math.round(height/3.6));
  /* area of the quad, in square metres */
  let a=0;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++)
    a+=(pts[j][0]*pts[i][1]-pts[i][0]*pts[j][1]);
  const area=Math.abs(a/2)*U2M*U2M;
  const coverage=zone.cov*(0.85+r()*0.3);
  const floorArea=Math.round(area*Math.min(1,coverage)*floors);
  const shelter=(use==="RESID"||use==="MIXED")?Math.round(floorArea/45):0;
  BLOCKS.push({pts,cx,cy,boro,zone:zone.name,use,era,height,floors,
    area:Math.round(area),coverage:+coverage.toFixed(2),floorArea,shelter,
    band:NYC.map?null:null});
}

function manhattan(r){
  const AVE_MAXW=26, DT_MAXW=17;
  let y=-352;
  while(y<1740){
    const gridded=y>=112;
    const bandH=gridded?8:6.5;
    const y0=y, y1=Math.min(1740,y+bandH), ym=(y0+y1)/2;
    const w=D.WX(ym), e=D.EX(ym);
    if(e-w>6){
      const maxW=gridded?AVE_MAXW:DT_MAXW;
      let xs=[w];
      if(gridded) avenuesAt(ym).forEach(ax=>{ if(ax>w+4&&ax<e-4) xs.push(ax); });
      xs.push(e);
      xs.sort((a,b)=>a-b);
      const bounds=[];
      for(let i=0;i<xs.length-1;i++){
        const gap=xs[i+1]-xs[i], n=Math.max(1,Math.ceil(gap/maxW));
        for(let k=0;k<n;k++) bounds.push([xs[i]+gap*k/n, xs[i]+gap*(k+1)/n]);
      }
      const zone=zoneFor(ym);
      bounds.forEach(([xa,xb])=>{
        const jx=gridded?0:(r()-0.5)*2.2, jy=gridded?0:(r()-0.5)*1.6;
        const insetX=1.5, insetY=0.9;
        const ax=xa+insetX+jx, bx=xb-insetX+jx;
        const ay=y0+insetY+jy, by=y1-insetY+jy;
        if(bx-ax<2||by-ay<1.4) return;
        const cx=(ax+bx)/2, cy=(ay+by)/2;
        if(inPark(cx,cy)) return;
        if(cx<D.WX(cy)-1||cx>D.EX(cy)+1) return;
        const z=Object.assign({},zone);
        if(waterfrontish(cx,cy)&&r()<0.42){
          z.use={INDUST:.5,TRANSIT:.18,RESID:.22,COMM:.10};
          z.h=[Math.min(zone.h[0],12),Math.min(zone.h[1],30)];
        }
        emit([[ax,ay],[bx,ay],[bx,by],[ax,by]],cx,cy,"MN",z,r,
          {tallChance:cy>272&&cy<472?0.09:cy<-190?0.08:0.035});
      });
    }
    y+=bandH;
  }
}

/* the other boroughs get a coarser weave, on their own alignment */
function outer(r){
  const areas=[
   {poly:D.BKQN,boro:"BK",split:150,ang:-0.52,bandH:15,maxW:23},
   {poly:D.BRONX,boro:"BX",split:null,ang:0.12,bandH:16,maxW:24}
  ];
  areas.forEach(A=>{
    const xs=A.poly.map(p=>p[0]), ys=A.poly.map(p=>p[1]);
    const x0=Math.min.apply(null,xs), x1=Math.max.apply(null,xs);
    const y0=Math.min.apply(null,ys), y1=Math.max.apply(null,ys);
    const ca=Math.cos(A.ang), sa=Math.sin(A.ang);
    const mgn=(Math.abs(A.ang)*0.6+0.12);
    const px=(x1-x0)*mgn, py=(y1-y0)*mgn;
    for(let v=y0-py;v<y1+py;v+=A.bandH) for(let u=x0-px;u<x1+px;u+=A.maxW){
      /* rotate the cell about the area's centre so the weave is not Manhattan's */
      const mx=(x0+x1)/2, my=(y0+y1)/2;
      const rot=(px,py)=>[mx+(px-mx)*ca-(py-my)*sa, my+(px-mx)*sa+(py-my)*ca];
      const q=[[u+1.6,v+1],[u+A.maxW-1.6,v+1],[u+A.maxW-1.6,v+A.bandH-1],[u+1.6,v+A.bandH-1]]
        .map(p=>rot(p[0],p[1]));
      const cx=(q[0][0]+q[2][0])/2, cy=(q[0][1]+q[2][1])/2;
      if(!inPoly(cx,cy,A.poly)) continue;
      if(inPark(cx,cy)) continue;
      let boro=A.boro;
      if(A.split!=null) boro=cy<A.split?"BK":"QN";
      const base=OUTER.find(o=>o[0]===boro)||OUTER[0];
      const zone={name:boro==="BK"?"Brooklyn":boro==="QN"?"Queens":"The Bronx",
        use:base[1],h:base[2],era:base[3],cov:base[4]};
      const z=Object.assign({},zone);
      if(r()<0.10){ z.use={INDUST:.62,TRANSIT:.2,COMM:.18}; z.h=[8,20]; }
      emit(q,cx,cy,boro,z,r,{tallChance:0.03});
    }
  });
}

function zoneFor(y){
  for(const z of MN_ZONES) if(y>=z[0]&&y<z[1])
    return {name:z[2],use:z[3],h:z[4],era:z[5],cov:z[6]};
  const z=MN_ZONES[MN_ZONES.length-1];
  return {name:z[2],use:z[3],h:z[4],era:z[5],cov:z[6]};
}

/* ---- queries ---------------------------------------------------------------------- */
const IX={cell:26,map:null,x0:-320,y0:-560};
function index(){
  if(IX.map) return IX;
  const bs=build();
  IX.map=new Map();
  bs.forEach(b=>{
    const c=Math.floor((b.cx-IX.x0)/IX.cell), r=Math.floor((b.cy-IX.y0)/IX.cell);
    const k=c+":"+r;
    let a=IX.map.get(k); if(!a){ a=[]; IX.map.set(k,a); }
    a.push(b);
  });
  return IX;
}
function at(x,y){
  const ix=index();
  const c=Math.floor((x-ix.x0)/ix.cell), r=Math.floor((y-ix.y0)/ix.cell);
  let best=null,bd=400;
  for(let dc=-1;dc<=1;dc++) for(let dr=-1;dr<=1;dr++){
    const a=ix.map.get((c+dc)+":"+(r+dr));
    if(!a) continue;
    for(const b of a){
      if(inPoly(x,y,b.pts)) return b;
      const d=(b.cx-x)*(b.cx-x)+(b.cy-y)*(b.cy-y);
      if(d<bd){ bd=d; best=b; }   /* a point in the roadway fronts a block */
    }
  }
  return best;
}
function stats(){
  const bs=build(), by={}, era={}, boro={};
  let floorArea=0, shelter=0;
  bs.forEach(b=>{
    by[b.use]=(by[b.use]||0)+1; era[b.era]=(era[b.era]||0)+1;
    boro[b.boro]=(boro[b.boro]||0)+1;
    floorArea+=b.floorArea; shelter+=b.shelter;
  });
  return {count:bs.length,use:by,era:era,boro:boro,
    floorArea,shelter,buildMs:bs.buildMs};
}

NYC.fabric={build,at,stats,index,blocks:()=>build(),USES,ERAS,MN_ZONES,inPoly,U2M};
})();
