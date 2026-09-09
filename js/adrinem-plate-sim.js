/* ===================================================================================
   Adrinem — projections at plate scale. The world sheet asks what a hazard does to a
   continent; this asks what it does to one place, block by block, with the properties
   the plate generator already gave every block: what it is made of, how many storeys
   it carries, how high up the hill it stands, and how many people sleep in it.

   The second half is the same idea as everywhere else in this project and it has a
   better answer here than at any other scale, because every plate is built on exactly
   one line:

       Ourasen   the head-race         water, and it runs one way, downhill from a weir
       Oem'rek   the Long Quay         everything the province sells
       Rithi     the Through-Way       a third of the continent's overland trade

   Break a stretch of that line and what depended on it stops, whether or not the event
   touched it. At Ourasen the cascade is directional: cut the race at any point and
   every terrace drawn from below that point goes dry, however far from the damage it
   is — and because the village's population was solved from what its terraces feed,
   the hectares lost convert straight back into people the place can no longer keep.

   Nothing here is a prediction. Every vulnerability is invented, and they are all in
   one table below.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const STEPS=12;

const STATES=[["LOST",.80,"#6E1A1A"],["STRICKEN",.55,"#8F2222"],["HARMED",.32,"#C4472A"],
              ["TOUCHED",.14,"#E08A24"],["HELD",0,"#3F6B3A"]];
const stateIndex=f=>{ for(let i=0;i<STATES.length;i++) if(f>=STATES[i][1]) return i;
  return STATES.length-1; };
const stateOf=f=>STATES[stateIndex(f)][0];
const mortality=f=>f<=0.14?0:Math.pow((f-0.14)/0.86,1.9)*0.5;
/* a stretch of lifeline hurt this badly no longer carries what it carried */
const LINE_CUT=0.5;
/* ground nothing touched, which has simply lost its water. It is not damage and it must
   not be drawn as damage; it is the second-order reading, and at a village it is nearly
   always the larger number. */
const DRY="#B39A63";

/* ===================================================================================
   WHAT EACH KIND OF BUILT THING IS MADE OF
   ---------------------------------------------------------------------------------
   burn: how readily it takes fire.  shake: how badly it takes a shock.
   Both invented. A village house is timber and thatch on stilts — it burns almost
   perfectly and shrugs off a shock; a stone temple is the other way round; a flooded
   paddy will not burn at all.
   =================================================================================== */
const MAT={
  paddy:   {burn:.02, shake:.18, label:"terrace"},
  dwelling:{burn:.86, shake:.30, label:"dwelling"},
  poor:    {burn:.90, shake:.42, label:"tenement"},
  craft:   {burn:.80, shake:.34, label:"workshop"},
  merchant:{burn:.52, shake:.46, label:"merchant house"},
  ward:    {burn:.82, shake:.44, label:"ward"},
  wharf:   {burn:.76, shake:.36, label:"wharf"},
  store:   {burn:.72, shake:.34, label:"store"},
  yard:    {burn:.70, shake:.26, label:"yard"},
  waggon:  {burn:.64, shake:.24, label:"waggon yard"},
  staple:  {burn:.44, shake:.38, label:"market"},
  civic:   {burn:.30, shake:.52, label:"civic"},
  garrison:{burn:.22, shake:.56, label:"garrison"},
  temple:  {burn:.18, shake:.58, label:"sanctuary"},
  noxious: {burn:.74, shake:.30, label:"noxious trade"},
  quarry:  {burn:.04, shake:.14, label:"working"},
  garden:  {burn:.34, shake:.06, label:"garden"}
};
const matOf=b=>MAT[b.use]||MAT.dwelling;
/* stone in the footing helps against fire and hurts under a shock, which is the whole
   argument between the two materials */
function burnOf(b){
  const m=matOf(b), st=b.stone||0;
  return Math.max(0.02,m.burn*(1-0.55*st));
}
function shakeOf(b){
  const m=matOf(b), st=b.stone||0;
  return Math.min(1,m.shake+0.30*st+0.06*Math.max(0,(b.storeys||1)-1));
}

/* ===================================================================================
   THE HAZARDS
   =================================================================================== */
const HAZARDS=[
 {id:"spate", kind:"natural", name:"The river comes up", short:"SPATE",
  plates:["village","port","crossing"], point:false, unit:"D",
  blurb:"It rises from the bottom. On a terraced hillside that means the lowest bunds "+
        "first, then the Water-Foot, then the weir itself — and the weir is the whole "+
        "village's water.",
  /* the same event, described from the plate it is standing on */
  blurbs:{city:"It rises from the water and works inland, so it takes the quay, the "+
        "wharves and the granaries behind them before it touches anything that could "+
        "afford to be built higher. The ground here has no surveyed height: it is "+
        "assumed to rise one metre for every sixty inland from the water."},
  params:[
   {id:"crest", label:"CREST",min:1,max:12,step:1,val:5,unit:" m"},
   {id:"days",  label:"IN SPATE",min:1,max:12,step:1,val:4,unit:" d"},
   {id:"scour", label:"IT SCOURS",min:0,max:1,step:1,val:1,onoff:true}]},

 {id:"fire", kind:"natural", name:"Fire in the village", short:"FIRE",
  plates:["village","port","crossing"], point:true, unit:"H", pointLabel:"IGNITION",
  /* a flooded terrace cannot be where a fire starts, and on this plate the terraces are
     nineteen plots in twenty, so a click has to be taken to the nearest thing that burns */
  pointBuilt:true,
  blurb:"Thatch and timber on a dry wind. It goes from roof to roof and stops at "+
        "water, at stone and at anything nobody built on — which on this plate means "+
        "the terraces, and they are the reason the whole place does not go.",
  blurbs:{city:"It goes from roof to roof on the wind and stops at water, at stone and "+
        "at open ground. A close-built quarter of timber workshops carries it; a "+
        "consecrated precinct of stone does not, and a wide street is worth more than "+
        "any wall."},
  params:[
   {id:"wind",   label:"WIND",min:0,max:80,step:5,val:35,unit:" km/h"},
   {id:"bearing",label:"WIND FROM",min:0,max:315,step:45,val:225,bearing:true},
   {id:"dry",    label:"DRYNESS",min:10,max:100,step:5,val:75,unit:" %"}]},

 {id:"quake", kind:"natural", name:"Earth shock", short:"QUAKE",
  plates:["village","port","crossing"], point:false, unit:"H",
  blurb:"Low timber on stilts rides a shock better than anything else anyone builds. "+
        "Stone does not, which is why the sanctuary at the top is the most exposed "+
        "thing on the plate and the poorest houses are among the safest.",
  blurbs:{city:"Height and masonry are what a shock punishes, so the order is inverted "+
        "from every other hazard here: the sanctuaries, the citadel and the tall "+
        "merchant houses take it worst, and the single-storey ground at the edge of "+
        "the built-up area comes through nearly whole."},
  params:[
   {id:"force", label:"FORCE",min:1,max:9,step:1,val:5},
   {id:"after", label:"AFTERSHOCKS",min:0,max:4,step:1,val:2},
   {id:"works", label:"IT BREAKS THE WORKS",min:0,max:1,step:1,val:1,onoff:true}]},

 {id:"slip", kind:"natural", name:"The hillside goes", short:"SLIP",
  plates:["village"], point:false, unit:"H",
  blurb:"A wedge of slope lets go and takes what is on it. The terraces are what has "+
        "held this hill for generations; where they go, so does everything below them, "+
        "and the race goes with the first one it crosses.",
  params:[
   {id:"where", label:"ALONG THE HILL",min:-100,max:100,step:10,val:0,unit:" %"},
   {id:"width", label:"WIDTH",min:60,max:600,step:20,val:240,unit:" m"},
   {id:"depth", label:"HOW FAR UP",min:20,max:100,step:10,val:60,unit:" %"}]},

 {id:"dragon", kind:"supernatural", name:"A dragon overhead", short:"DRAGON",
  plates:["village","port","crossing"], point:true, unit:"H", pointLabel:"WHERE IT COMES IN",
  blurb:"One pass, on a bearing, and it does not care what anything is worth. What it "+
        "leaves is a line — and whether that line crosses the works decides whether "+
        "the place recovers or not.",
  params:[
   {id:"bearing",label:"IT FLIES",min:0,max:315,step:45,val:180,bearing:true},
   {id:"wing",   label:"BREADTH",min:20,max:400,step:20,val:200,unit:" m"},
   {id:"passes", label:"PASSES",min:1,max:5,step:1,val:2}]},

 {id:"blood", kind:"supernatural", name:"The blood tide", short:"BLOOD",
  plates:["village","port","crossing"], point:true, unit:"D", pointLabel:"WHERE IT RISES",
  blurb:"It creeps from where it rose, faster over the low and the wet — which on a "+
        "terraced hillside is the entire field, and the field is the village's whole "+
        "living.",
  blurbs:{city:"It creeps from where it rose, faster over the low and the wet, slower "+
        "uphill, and slower again where the ground is consecrated. What it reaches it "+
        "does not give back."},
  params:[
   {id:"rise",  label:"RISE",min:1,max:5,step:1,val:3},
   {id:"reach", label:"REACH",min:20,max:300,step:20,val:120,unit:" m/d"},
   {id:"uphill",label:"IT CLIMBS",min:0,max:1,step:1,val:0,onoff:true}]},

 {id:"refuse", kind:"supernatural", name:"The waters refuse", short:"REFUSE",
  plates:["village"], point:false, unit:"D",
  blurb:"No footprint at all. Nothing is burnt, nothing falls, nobody is hurt. The "+
        "race simply stops carrying below a point, and the plate is asked what else "+
        "stops with it. This is the projection that says what the head-race is worth.",
  params:[
   {id:"at",   label:"IT FAILS AT",min:0,max:100,step:5,val:35,unit:" % along"},
   {id:"total",label:"TOTALLY",min:0,max:1,step:1,val:1,onoff:true}]}
];
const hazardsFor=arche=>HAZARDS.filter(H=>H.plates.indexOf(arche)>=0);
/* a village plate and a walled city are different enough that the same event wants
   describing differently; ports and crossings share the city wording */
const blurbFor=(H,arche)=>(arche!=="village"&&H.blurbs&&H.blurbs.city)||H.blurb;
const hazardById=id=>HAZARDS.find(h=>h.id===id);

/* ===================================================================================
   THE LIFELINE
   ---------------------------------------------------------------------------------
   One polyline per plate, taken from the plan. Every block is given the point along it
   that it draws from, and the line is given a damage value per sample. What breaks is
   then a matter of reading one against the other — and at a village, of reading it in
   the direction the water runs.
   =================================================================================== */
function lifelineOf(plate){
  const s=(plate.plan.streets||[]).find(x=>x.cls==="way")||
          (plate.plan.streets||[]).find(x=>x.cls==="quay");
  if(!s||!s.pts||s.pts.length<2) return null;
  const pts=s.pts, cum=[0];
  for(let i=1;i<pts.length;i++)
    cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const total=cum[cum.length-1]||1;
  return {
    name:s.name||"the works", pts:pts, cum:cum, total:total,
    /* one-way at a village: water runs from the weir onward and cannot come back */
    directed:plate.archetype==="village",
    /* where along it (0..1) a point draws from, and how far off it stands */
    at(p){
      let best=Infinity,bt=0;
      for(let i=0;i<pts.length-1;i++){
        const ax=pts[i][0],ay=pts[i][1];
        const ex=pts[i+1][0]-ax, ey=pts[i+1][1]-ay, l2=ex*ex+ey*ey||1;
        let t=((p[0]-ax)*ex+(p[1]-ay)*ey)/l2; t=t<0?0:t>1?1:t;
        const dx=p[0]-(ax+ex*t), dy=p[1]-(ay+ey*t), d=Math.hypot(dx,dy);
        if(d<best){ best=d; bt=(cum[i]+t*Math.sqrt(l2))/total; }
      }
      return {t:bt, off:best};
    },
    point(t){
      const want=t*total;
      for(let i=0;i<pts.length-1;i++){
        const seg=cum[i+1]-cum[i];
        if(want<=cum[i+1]||i===pts.length-2){
          const k=seg?(want-cum[i])/seg:0;
          return [pts[i][0]+(pts[i+1][0]-pts[i][0])*k,
                  pts[i][1]+(pts[i+1][1]-pts[i][1])*k];
        }
      }
      return pts[pts.length-1];
    }
  };
}

/* ===================================================================================
   THE RUN
   =================================================================================== */
const SAMPLES=48;                       /* how finely the lifeline is scored */

function run(plate,spec){
  const H=hazardById(spec.hazard);
  if(!H||!plate) return null;
  const B=plate.blocks, n=B.length, p=spec.params||{};
  const dmg=new Float32Array(n);
  const line=lifelineOf(plate);
  const lineDmg=new Float32Array(SAMPLES);
  const frames=[], events=[];
  const note=(t,text,kind)=>events.push({t:t,text:text,kind:kind||"note"});

  /* every block's place: along the lifeline, and up the hill */
  const village=plate.archetype==="village";
  const F=plate.F, S=plate.S;
  /* A village plate carries a real height field, because it was laid out on one. A city
     plate does not, so it is given the only proxy its own plan supports: ground rises
     away from the water, at an invented and deliberately gentle SHORE_RISE. Without it
     every block on a city plate sits at zero and a flood either takes all of it or none. */
  const SHORE_RISE=1/60;      /* one metre up for every sixty inland */
  const W=plate.water;
  const zAt=p=>village?0:(W&&W.room?W.room(p)*SHORE_RISE:0);
  const zOf=b=>village?(F?F.z(b.fw!=null?b.fw:0):0):zAt(b.c);
  const meta=B.map(b=>{
    const l=line?line.at(b.c):{t:0,off:1e9};
    return {t:l.t, off:l.off, z:zOf(b), burn:burnOf(b), shake:shakeOf(b)};
  });
  /* and the line's own height, sample by sample, so a flood can be asked whether it is
     over the quay rather than only over the ground beside it */
  let lineZs=null;
  if(line&&!village){
    lineZs=new Float32Array(SAMPLES);
    for(let k=0;k<SAMPLES;k++) lineZs[k]=zAt(line.point(k/(SAMPLES-1)));
  }
  /* The head-race climbs from a weir standing in the river to the top bund. Its two
     ends are therefore at opposite ends of the hill, and a flood that cannot reach a
     single house can still take the weir — which is the village's whole water. */
  const lineZ=village&&F?F.z(S.raceTopW):0;
  const weirZ=village&&F?F.z(S.riverW+18):0;
  const riverZ=village&&F?F.z(S.riverW):0;

  const at=spec.point!=null&&spec.point>=0?spec.point:null;  /* an index into blocks */
  const org=at!=null?B[at].c:null;

  if(H.id==="fire"&&at!=null){ dmg[at]=1; note(0,"It starts in the "+
    matOf(B[at]).label+".","start"); }
  if(H.id==="blood"&&at!=null){ dmg[at]=1; note(0,"It rises here.","start"); }
  if(H.id==="dragon"&&at!=null) note(0,"It comes in over the "+matOf(B[at]).label+
    ", flying "+compass(p.bearing||0)+".","start");
  if(H.id==="refuse") note(0,"The race stops carrying "+(p.at||35)+
    " per cent along, and nothing else happens at all.","start");

  for(let s=1;s<=STEPS;s++){
    step(H,s,plate,B,meta,dmg,lineDmg,line,p,org,note,
      {lineZ,weirZ,riverZ,village,F,S,lineZs});
    frames.push(snapshot(B,dmg,lineDmg,s));
  }

  const report=direct(plate,B,meta,dmg,H);
  report.works=works(plate,B,meta,dmg,lineDmg,line,H,p,report.dead);
  narrate(report,plate,H);
  events.sort((a,b)=>a.t-b.t);

  return {hazard:H, spec:spec, steps:STEPS, unit:H.unit, frames:frames,
    events:events, report:report, line:line, lineDmg:lineDmg, point:at,
    /* where along the line each block draws from, so the console can work out at any
       step which ground is dry without walking the polyline again */
    t:Float32Array.from(meta.map(m=>m.t))};
}

/* ---- one step -------------------------------------------------------------------- */
function step(H,s,plate,B,meta,dmg,lineDmg,line,p,org,note,G){
  const n=B.length;
  const bump=(i,v)=>{ if(v>dmg[i]) dmg[i]=Math.min(1,v); };
  const hurtLine=(t,v)=>{ const k=Math.max(0,Math.min(SAMPLES-1,Math.round(t*(SAMPLES-1))));
    if(v>lineDmg[k]) lineDmg[k]=Math.min(1,v); };

  if(H.id==="spate"){
    if(s>(p.days||4)) return;
    const crest=G.riverZ+(p.crest||5)*(0.45+0.55*Math.min(1,s/3));
    for(let i=0;i<n;i++){
      const over=crest-meta[i].z;
      if(over<=0) continue;
      const f=Math.min(1,over/(p.crest||5))*(B[i].use==="paddy"?0.55:1);
      bump(i,f*(p.scour?1:0.7));
    }
    /* the weir is in the water by definition, so it takes the whole crest */
    if(G.village&&crest>G.weirZ+1.2){
      hurtLine(0.0,Math.min(1,(p.scour?0.42:0.24)*(p.crest||5)*Math.min(1,s/2)));
      hurtLine(0.02,Math.min(1,(p.scour?0.34:0.18)*(p.crest||5)*Math.min(1,s/2)));
    }
    /* a quay stands in the water and a road along a shore runs low, so any stretch the
       crest is over stops carrying whatever else survives */
    else if(G.lineZs) for(let k=0;k<SAMPLES;k++){
      const over=crest-G.lineZs[k];
      if(over>0.8) hurtLine(k/(SAMPLES-1),
        Math.min(1,(p.scour?0.5:0.3)*over*Math.min(1,s/2)));
    }
    if(s===1) note(1,G.village?"The lowest bunds are under.":
      "It is over the low ground by the water.","loss");
    if(s===2&&G.village) note(2,"It is over the weir.","loss");
  }

  else if(H.id==="fire"){
    const wind=vec(p.bearing||0), sp=(p.wind||35), dry=(p.dry||75)/100;
    const jump=1+Math.floor(sp/25);
    /* A thatch roof that catches burns down; it does not stay half burnt. Without this
       the fire spreads at the strength of whatever lit it, which decays by a third at
       every jump and dies out after three houses no matter what the wind is doing. */
    for(let i=0;i<n;i++)
      if(dmg[i]>0.30) dmg[i]=Math.min(1,dmg[i]+0.34*dry*meta[i].burn+0.06);
    for(let k=0;k<jump;k++){
      const lit=[];
      for(let i=0;i<n;i++) if(dmg[i]>0.30) lit.push(i);
      lit.forEach(i=>{
        const a=B[i].c;
        for(let j=0;j<n;j++){
          if(j===i||dmg[j]>0.85) continue;
          const dx=B[j].c[0]-a[0], dy=B[j].c[1]-a[1];
          const d=Math.hypot(dx,dy);
          const span=72+sp*1.7;      /* how far a spark carries on this wind */
          if(d>span) continue;
          const with_=d?((dx/d)*(-wind[0])+(dy/d)*(-wind[1])):0;
          /* Burning thatch throws embers, so the fall-off with distance is nothing
             like linear — a linear one stalls the fire at the first gap between
             houses and a village with any space in it never burns at all. */
          const near=Math.pow(1-d/span,0.6);
          const take=meta[j].burn*dry*(0.30+0.70*Math.max(0,with_))*near;
          /* anything properly alight throws embers at full strength */
          const src=dmg[i]>=0.55?1:dmg[i];
          if(take>0.05) bump(j,Math.min(1,src*0.95*take*2.6));
        }
      });
    }
    /* a channel is not a roof: fire only hurts the works where they are timber */
    for(let i=0;i<n;i++) if(dmg[i]>0.6&&meta[i].off<26) hurtLine(meta[i].t,dmg[i]*0.45);
    if(s===3) note(3,"It has the wind and the roofs.","loss");
  }

  else if(H.id==="quake"){
    const shocks=1+(p.after||0);
    if(s>shocks*2) return;
    if(s%2) return;                                   /* one shock, then aftershocks */
    const which=s/2, force=(p.force||5)/9*(which===1?1:0.55/which);
    for(let i=0;i<n;i++) bump(i,dmg[i]+meta[i].shake*force*1.25);
    if(p.works) for(let k=0;k<SAMPLES;k++)
      if(hash(k,which)<force*0.5) hurtLine(k/(SAMPLES-1),force*1.3);
    note(s,which===1?"The first shock.":"Aftershock "+(which-1)+".","loss");
  }

  else if(H.id==="slip"){
    if(s>2) return;
    const S=plate.S, F=plate.F;
    if(!F) return;
    const half=(p.width||240)/2;
    const uAt=(p.where||0)/100*(plate.V?plate.V.fieldWidth*0.5:400);
    const upTo=S.raceTopW*(p.depth||60)/100;
    for(let i=0;i<n;i++){
      const b=B[i];
      if(b.fu==null) continue;
      if(Math.abs(b.fu-uAt)>half) continue;
      if(b.fw>upTo) continue;
      bump(i,1);
    }
    /* the race crosses the top of the field; if the slip reaches it, it goes */
    if(upTo>=S.raceTopW*0.94){
      const t=line?line.at(F.at(uAt,S.raceTopW)).t:0.5;
      hurtLine(t,1);
      if(s===1) note(1,"It has taken the race with it.","loss");
    } else if(s===1) note(1,"The slope has let go below the race.","loss");
  }

  else if(H.id==="dragon"){
    if(!org||s>(p.passes||2)*2) return;
    if(s%2) return;
    const v=vec(p.bearing||0), wing=(p.wing||120)/2;
    for(let i=0;i<n;i++){
      const rx=B[i].c[0]-org[0], ry=B[i].c[1]-org[1];
      const along=rx*v[0]+ry*v[1];
      if(along<-40) continue;
      const off=Math.abs(rx*(-v[1])+ry*v[0]);
      if(off>wing) continue;
      bump(i,Math.min(1,dmg[i]+(1-off/wing)*(0.45+0.55*meta[i].burn)));
    }
    for(let i=0;i<n;i++) if(dmg[i]>0.7&&meta[i].off<30) hurtLine(meta[i].t,0.8);
    note(s,"Pass "+(s/2)+".","loss");
  }

  else if(H.id==="blood"){
    if(!org) return;
    const rise=(p.rise||3)/5, reach=(p.reach||120);
    for(let k=0;k<2;k++){
      const edge=[];
      for(let i=0;i<n;i++) if(dmg[i]>0.4) edge.push(i);
      edge.forEach(i=>{
        for(let j=0;j<n;j++){
          if(dmg[j]>0.92) continue;
          const d=Math.hypot(B[j].c[0]-B[i].c[0],B[j].c[1]-B[i].c[1]);
          if(d>reach) continue;
          let take=rise*(1-d/reach);
          if(!p.uphill&&meta[j].z>meta[i].z+0.4) take*=0.3;
          if(B[j].use==="paddy") take*=1.35;            /* the wet takes it first */
          if(B[j].use==="temple") take*=0.4;
          if(take>0.05) bump(j,Math.min(1,dmg[i]*0.95*take*1.7));
        }
      });
    }
    for(let i=0;i<n;i++) if(dmg[i]>0.6&&meta[i].off<30) hurtLine(meta[i].t,dmg[i]*0.7);
    if(s===4) note(4,"It is in the field.","loss");
  }

  else if(H.id==="refuse"){
    if(s>1) return;
    const t=(p.at||35)/100;
    hurtLine(t,p.total?1:0.7);
    note(1,"It fails, and nothing else does.","loss");
  }
}
const vec=d=>[Math.cos(d*Math.PI/180),Math.sin(d*Math.PI/180)];
const compass=d=>["east","south-east","south","south-west","west","north-west","north",
  "north-east"][(Math.round(((d%360)+360)%360/45))%8];
function hash(a,b){
  let h=(Math.imul(a|0,374761393)+Math.imul(b|0,668265263))|0;
  h=Math.imul(h^(h>>>13),1274126177); h^=h>>>16;
  return (h>>>0)/4294967296;
}

/* ---- a step's picture ------------------------------------------------------------- */
function snapshot(B,dmg,lineDmg,s){
  const st=new Uint8Array(B.length);
  const tally={LOST:0,STRICKEN:0,HARMED:0,TOUCHED:0,HELD:0};
  let dead=0;
  for(let i=0;i<B.length;i++){
    const ix=stateIndex(dmg[i]);
    st[i]=ix; tally[STATES[ix][0]]++;
    dead+=(B[i].people||0)*mortality(dmg[i]);
  }
  return {step:s, state:st, tally:tally, dead:Math.round(dead),
    line:Float32Array.from(lineDmg)};
}

/* ---- what it took ----------------------------------------------------------------- */
function direct(plate,B,meta,dmg,H){
  const r={byState:{LOST:0,STRICKEN:0,HARMED:0,TOUCHED:0,HELD:0},
    dead:0, hit:0, byUse:{}, byRank:{}, floorLost:0, paddyLostHa:0, templeHit:0};
  B.forEach((b,i)=>{
    const nm=STATES[stateIndex(dmg[i])][0];
    r.byState[nm]++;
    if(dmg[i]>=0.14) r.hit++;
    r.dead+=(b.people||0)*mortality(dmg[i]);
    r.floorLost+=(b.floor||0)*dmg[i];
    if(b.use==="paddy") r.paddyLostHa+=(b.area/10000)*dmg[i];
    if(b.use==="temple"&&dmg[i]>r.templeHit) r.templeHit=dmg[i];
    const u=r.byUse[b.use]||(r.byUse[b.use]={n:0,hit:0,dead:0});
    u.n++; if(dmg[i]>=0.32) u.hit++;
    u.dead+=(b.people||0)*mortality(dmg[i]);
    if(b.rank){
      const k=r.byRank[b.rank]||(r.byRank[b.rank]={name:b.rankName,n:0,hit:0,dead:0});
      k.n++; if(dmg[i]>=0.32) k.hit++;
      k.dead+=(b.people||0)*mortality(dmg[i]);
    }
  });
  r.dead=Math.round(r.dead);
  Object.keys(r.byUse).forEach(k=>r.byUse[k].dead=Math.round(r.byUse[k].dead));
  Object.keys(r.byRank).forEach(k=>r.byRank[k].dead=Math.round(r.byRank[k].dead));
  return r;
}

/* ---- and what stopped working ---------------------------------------------------- */
function works(plate,B,meta,dmg,lineDmg,line,H,p,dead){
  const out={line:line?line.name:null, cut:[], cutAt:null, dry:0, dryHa:0,
    fedBefore:null, fedNow:null, shortfall:0, blocked:false, crossing:null};
  if(!line) return out;

  /* where the line is broken */
  const cuts=[];
  for(let k=0;k<SAMPLES;k++) if(lineDmg[k]>=LINE_CUT) cuts.push(k/(SAMPLES-1));
  out.cut=cuts;
  out.cutAt=cuts.length?Math.min.apply(null,cuts):null;
  out.cutShare=cuts.length/SAMPLES;
  out.blocked=cuts.length>0;

  if(plate.archetype==="village"){
    /* Water runs one way. Everything drawing from beyond the first break is dry,
       whether or not anything touched it. */
    const first=out.cutAt;
    let dry=0, dryHa=0;
    B.forEach((b,i)=>{
      if(b.use!=="paddy") return;
      const beyond=first!=null&&meta[i].t>=first-1e-6;
      /* ground already destroyed is counted as taken, not as merely dry */
      if(beyond&&dmg[i]<0.55){ dry++; dryHa+=b.area/10000; }
    });
    out.dry=dry; out.dryHa=dryHa;
    const V=plate.V, st=plate.stats;
    out.fedBefore=st.population;
    const workingHa=Math.max(0,st.paddyHa-dryHa-
      B.reduce((s,b,i)=>s+(b.use==="paddy"&&dmg[i]>=0.55?b.area/10000:0),0));
    out.workingHa=workingHa;
    out.fedNow=Math.round(workingHa*V.feedPerHa);
    const alive=Math.max(0,st.population-(dead||0));
    out.shortfall=Math.max(0,alive-out.fedNow);
  } else if(plate.archetype==="crossing"){
    out.crossing=out.blocked?"closed":"open";
  } else {
    out.crossing=null;
  }
  return out;
}

/* How to say where a line is broken. "Broken 0 per cent along" is true and useless when
   the whole of it is under; the first break is only worth naming when there is line
   either side of it. */
function cutPhrase(w){
  if(!w||!w.blocked) return "holds";
  if(w.cutShare>=0.8) return "gone along its whole length";
  if(w.cutAt<=0.04) return "cut at its head";
  if(w.cutAt>=0.96) return "cut at its far end";
  return "broken "+Math.round(w.cutAt*100)+"% along";
}

/* ---- which ground is dry at a given step ------------------------------------------
   The same reading as works() makes at the end, but for one frame, so the plan can show
   the cascade spreading rather than only its final extent. Water runs one way: beyond
   the first break there is none, however far from the damage the terrace is. */
function dryAt(plate,res,frame){
  const B=plate.blocks, n=B.length, out=new Uint8Array(n);
  if(plate.archetype!=="village"||!res||!res.t) return out;
  const L=frame?frame.line:res.lineDmg;
  let first=null;
  for(let k=0;k<SAMPLES;k++) if(L[k]>=LINE_CUT){ first=k/(SAMPLES-1); break; }
  if(first==null) return out;
  const st=frame?frame.state:null;
  for(let i=0;i<n;i++){
    if(B[i].use!=="paddy"||res.t[i]<first-1e-6) continue;
    if(st&&st[i]<=1) continue;         /* already stricken or lost, not merely dry */
    out[i]=1;
  }
  return out;
}
/* the stretch of line that no longer carries, as a pair of positions along it */
function deadRun(res,frame){
  const L=frame?frame.line:res.lineDmg;
  let first=null;
  for(let k=0;k<SAMPLES;k++) if(L[k]>=LINE_CUT){ first=k/(SAMPLES-1); break; }
  return first==null?null:[first,1];
}

/* ---- the write-up ----------------------------------------------------------------- */
function narrate(r,plate,H){
  const w=r.works, out=[];
  const total=plate.blocks.length;
  const village=plate.archetype==="village";
  const unit=village?"plots":"blocks";
  const holy=village?"The sanctuary":"The temple precinct";
  out.push(r.hit.toLocaleString()+" of "+total.toLocaleString()+" "+unit+" are touched, "+
    (r.byState.LOST+r.byState.STRICKEN).toLocaleString()+" stricken or lost.");
  if(r.dead>0) out.push(r.dead.toLocaleString()+" people are gone.");
  if(r.templeHit>=0.32) out.push(holy+" is "+stateOf(r.templeHit).toLowerCase()+".");
  else if(r.templeHit>0) out.push(holy+" is touched, and stands.");

  if(village){
    const ranks=Object.keys(r.byRank).filter(k=>r.byRank[k].hit>0);
    if(ranks.length){
      const worst=ranks.sort((a,b)=>
        (r.byRank[b].hit/r.byRank[b].n)-(r.byRank[a].hit/r.byRank[a].n))[0];
      out.push("It falls hardest on "+r.byRank[worst].name+" — "+
        r.byRank[worst].hit+" of its "+r.byRank[worst].n+" households.");
    }
    out.push("");
    if(w.blocked){
      out.push(w.line+" is "+cutPhrase(w)+".");
      if(w.dry>0) out.push(w.dry.toLocaleString()+" terraces below the break — "+
        w.dryHa.toFixed(1)+" hectares — are dry, and nothing touched them.");
      out.push("The terraces that still have water feed "+
        w.fedNow.toLocaleString()+", against the "+w.fedBefore.toLocaleString()+
        " this village was laid out to keep.");
      if(w.shortfall>0) out.push("That is "+w.shortfall.toLocaleString()+
        " people it can no longer feed — more than "+
        (w.shortfall>r.dead?"the event killed outright":"the harvest can cover")+".");
    } else {
      out.push(w.line+" holds, so what has water still has water.");
      if(r.paddyLostHa>0.5) out.push("The terraces themselves have lost "+
        r.paddyLostHa.toFixed(1)+" hectares.");
    }
  } else {
    out.push("");
    if(w.blocked) out.push(w.line+" is "+cutPhrase(w)+
      (plate.archetype==="crossing"?
      " — the crossing is closed, and it is the only through-route on the sheet.":
      " — the berths behind it stop."));
    else out.push(w.line+" holds.");
  }
  r.lines=out;
  r.text=out.filter(x=>x!=="").join(" ");
}

A.platesim={HAZARDS,STATES,STEPS,MAT,LINE_CUT,DRY,SAMPLES,run,stateOf,stateIndex,
  hazardsFor,blurbFor,hazardById,lifelineOf,matOf,burnOf,shakeOf,mortality,dryAt,deadRun,
  cutPhrase};
})();
