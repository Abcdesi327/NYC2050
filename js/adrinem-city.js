/* ===================================================================================
   Adrinem — the city plate. A burg on the world sheet is one point; this generates
   the ground under it.

   Nothing here is drawn by hand. The plan is derived from what the export actually
   says about the site, in this order:

     the sea lies north-east          cell 461 touches exactly one water cell, 463
     the haven is enclosed            harbour value 1 — one sea contact, so one mouth
     the ground rises south-east      h 37 at the site, 38-39 inland at bearing 105-112
     the marsh is south               cell 551, Wetland, bearing 112
     the open coast is north-west     cell 460, harbour value 5 — five sea contacts
     no river anywhere                r=0 on the site and on every neighbour
     the land trade arrives south-east  the road to Bodmouthton, bearing 60, 11 uses
     and west                         the trail to 462, bearing -177, 2 uses
     the sea trade is the city        Cass'tow, 561,068 people in Oem'rek's own realm,
                                      has no overland way to it. Nor do P'ivka or
                                      S'ven. The harbour is not an amenity here.

   Everything below follows from those lines plus the burg's population. Where a rule
   had to be chosen rather than read — how many people to a hectare, how wide a quay,
   how far a waggon goes in a day — the figure is written down at the top of the
   section that uses it, so it can be argued with.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const C=A.cells, M=A.meta;

/* ---- a seeded generator, so the city is the same city every time ------------------ */
function rng(seed){
  let s=seed>>>0||1;
  return function(){ s^=s<<13; s>>>=0; s^=s>>17; s^=s<<5; s>>>=0; return s/4294967296; };
}
const TAU=Math.PI*2, D2R=Math.PI/180;
const vec=(deg,len)=>[Math.cos(deg*D2R)*len,Math.sin(deg*D2R)*len];
const add=(a,b)=>[a[0]+b[0],a[1]+b[1]];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const mul=(a,k)=>[a[0]*k,a[1]*k];
const len=a=>Math.hypot(a[0],a[1]);
const norm=a=>{const l=len(a)||1;return [a[0]/l,a[1]/l];};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
const lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
const polyArea=p=>{let s=0;for(let i=0;i<p.length;i++){const j=(i+1)%p.length;
  s+=p[i][0]*p[j][1]-p[j][0]*p[i][1];} return Math.abs(s)/2;};
const centroid=p=>{let x=0,y=0;p.forEach(q=>{x+=q[0];y+=q[1];});
  return [x/p.length,y/p.length];};

/* ===================================================================================
   1. THE SITE — read off the world sheet, not chosen
   =================================================================================== */
function siteOf(cell){
  const burg=A.burgOf(cell), port=A.portOf(cell), market=A.marketOf(cell);
  const nb=A.neighboursOf(cell);
  const bearingTo=j=>Math.atan2(C.y[j]-C.y[cell],C.x[j]-C.x[cell])/D2R;

  /* the sea: the mean bearing of this cell's water neighbours */
  const water=nb.filter(j=>!A.isLand(j));
  let sx=0,sy=0; water.forEach(j=>{const v=vec(bearingTo(j),1); sx+=v[0]; sy+=v[1];});
  const seaBearing=water.length?Math.atan2(sy,sx)/D2R:null;

  /* and the land, the same way. This is not the opposite of the sea bearing on a
     real coast, and the difference is what decides which shore of the haven the city
     stands on: the one with the hinterland behind it. */
  let lx=0,ly=0;
  nb.filter(j=>A.isLand(j)).forEach(j=>{const v=vec(bearingTo(j),1); lx+=v[0]; ly+=v[1];});
  const landBearing=(lx||ly)?Math.atan2(ly,lx)/D2R:(seaBearing!=null?seaBearing+180:null);

  /* the land trade: every road segment that touches the cell, with its bearing */
  const R=A.roads, roads=[];
  for(let k=0;k<R.a.length;k++){
    if(R.a[k]!==cell&&R.b[k]!==cell) continue;
    const other=R.a[k]===cell?R.b[k]:R.a[k];
    roads.push({cell:other, cls:["trail","road","trunk"][R.cls[k]], uses:R.uses[k],
      bearing:bearingTo(other), to:(A.burgOf(other)||{}).name||null});
  }
  roads.sort((a,b)=>b.uses-a.uses);

  /* The next cell along a trunk is usually empty ground, so a road named after it has
     no name. Follow it, always taking the busiest way on, until it reaches somewhere
     with a name — which is what the road is called. */
  roads.forEach(r=>{
    let prev=cell, cur=r.cell, guard=0;
    while(guard++<40){
      const b=A.burgOf(cur);
      if(b&&cur!==cell){ r.leadsTo=b.name; r.leadsToCell=cur; r.leadsIn=A.stateOf(cur);
        r.leadsHops=guard; break; }
      let best=-1,bu=-1;
      for(let k=0;k<R.a.length;k++){
        if(R.a[k]!==cur&&R.b[k]!==cur) continue;
        const o=R.a[k]===cur?R.b[k]:R.a[k];
        if(o===prev) continue;
        if(R.uses[k]>bu){ bu=R.uses[k]; best=o; }
      }
      if(best<0) break;
      prev=cur; cur=best;
    }
    if(!r.to) r.to=r.leadsTo||null;
  });

  /* the lie of the land: where it rises, where the marsh is, where the coast is open */
  let rise=null, marsh=null, exposed=null;
  nb.forEach(j=>{
    if(!A.isLand(j)) return;
    if(!rise||C.h[j]>C.h[rise]) rise=j;
    if(A.biomeOf(j).name==="Wetland"&&(!marsh||C.h[j]<C.h[marsh])) marsh=j;
    if(!exposed||C.hrb[j]>C.hrb[exposed]) exposed=j;
  });

  /* what the sea is worth here: the markets this one cannot reach over land */
  const {dist}=A.route.from(cell);
  const overland=[], seaOnly=[];
  A.markets.forEach(m=>{
    if(m.cell===cell) return;
    (isFinite(dist[m.cell])?overland:seaOnly).push({name:m.name, state:m.state,
      pop:m.pop, cost:dist[m.cell]});
  });
  overland.sort((a,b)=>a.cost-b.cost);
  seaOnly.sort((a,b)=>b.pop-a.pop);

  let catchCells=0, catchPop=0;
  for(let i=0;i<A.count;i++) if(C.mkt[i]===cell){ catchCells++; catchPop+=C.pop[i]; }

  return {
    cell:cell, name:burg?burg.name:"", pop:burg?burg.pop:0,
    state:A.stateOf(cell), province:A.provinceOf(cell), culture:A.cultureOf(cell),
    biome:A.biomeOf(cell).name, height:C.h[cell],
    harbour:port?port.quality:0, haven:port?port.haven:-1,
    isMarket:!!market, river:C.riv[cell]>0, flux:C.flux[cell],
    seaBearing:seaBearing, landBearing:landBearing,
    riseBearing:rise!=null?bearingTo(rise):null, riseHeight:rise!=null?C.h[rise]:null,
    marshBearing:marsh!=null?bearingTo(marsh):null,
    exposedBearing:exposed!=null?bearingTo(exposed):null,
    roads:roads, overland:overland, seaOnly:seaOnly,
    catchCells:catchCells, catchPop:catchPop
  };
}

/* ===================================================================================
   2. HOW MANY PEOPLE STAND ON A HECTARE
   ---------------------------------------------------------------------------------
   The export gives a head count and nothing else, so the city's size has to be solved
   for rather than picked. Densities are the ones a walled pre-industrial port runs at:
   packed inside the wall, thinning fast along the roads outside it. The generator lays
   ground out to a generous radius, prices every block, and then puts the wall where the
   running total of people first reaches the burg's population.
   =================================================================================== */
const DENSITY={
  core:520,        /* persons a hectare in the streets behind the quay */
  inner:380,       /* the intramural ground, averaged */
  outer:150,       /* the ribbon suburbs along the roads */
  fringe:70        /* the last of it, market gardens between */
};
/* The share of a walled port's people that live inside the wall. The wall is then
   drawn at whatever radius encloses that share — which is what makes it follow the
   shape of the site instead of being a circle struck around the market. */
const INTRAMURAL=0.75;

/* ===================================================================================
   2b. WHAT KIND OF CITY THIS IS
   ---------------------------------------------------------------------------------
   Read off the network, not chosen. A burg with two trunk roads leaving it on nearly
   opposite bearings is not a town with roads; it is a road with a town on it, and it
   has to be laid out the other way round — the through-way first and the city around
   it. On this sheet exactly one market answers to that: Rithi, whose two trunks leave
   175 degrees apart and carry 33 and 29 of the 136 market pairs between them. Every
   other market gets the port plan.
   =================================================================================== */
function archetypeOf(site){
  const trunks=site.roads.filter(r=>r.cls==="trunk");
  let widest=0, carried=0;
  for(let i=0;i<trunks.length;i++){
    carried+=trunks[i].uses;
    for(let j=i+1;j<trunks.length;j++)
      widest=Math.max(widest,Math.abs(((trunks[i].bearing-trunks[j].bearing+540)%360)-180));
  }
  if(trunks.length>=2&&widest>=150) return "crossing";
  return "port";
}

/* ===================================================================================
   2c. THE DOCTRINE — NOT FROM THE EXPORT
   ---------------------------------------------------------------------------------
   Everything else in this file is derived from the map file. This table is not: it is
   the author's, stating what a realm's religion will and will not allow inside a city.
   It is kept in one place, and the plate labels what it decides, so the two kinds of
   claim never get mixed up.

   Cutho keeps an interdict. The consequence on the ground is the whole plan: a city
   that must pass a third of the continent's trade through itself, and may not let any
   of it touch consecrated ground. So the through-way does not cross the city — it is
   bent round it — and the length that costs is measured on the plate.
   =================================================================================== */
const DOCTRINE={
  "Cutho":{
    name:"the Interdict",
    creed:"Cutho",
    prohibitive:true,
    /* the sanctuary takes this share of the walled radius */
    sacredShare:0.46,
    /* foreigners may not lodge on consecrated ground */
    wardsOutside:true,
    blurb:"Nothing that has not been purified may stand on consecrated ground, and "+
      "no stranger may sleep on it. A city that must move a third of the continent's "+
      "trade cannot argue with that, so it builds around it."
  }
};
const doctrineOf=site=>DOCTRINE[site.state]||null;

/* ===================================================================================
   3. THE WATER
   ---------------------------------------------------------------------------------
   Two pieces of water and one rule apiece. The open sea is a coast running along the
   bearing perpendicular to the water neighbour, waved so it is not a ruler. The haven
   is an inlet driven inland from it: harbour value 1 means one sea contact, so one
   mouth, so a basin that has to be entered and cannot be sailed through.
   =================================================================================== */
function buildWater(site,rnd,S){
  const seaB=site.seaBearing;                 /* toward the sea */
  const inward=seaB+180;                      /* down the basin, away from the sea */
  const n=norm(vec(seaB,1));                  /* seaward normal of the open coast */
  const t=[-n[1],n[0]];                       /* along the coast */

  /* The open coast is held back this far from the harbour head, so the basin has a
     throat to be enclosed by. */
  /* A port is laid out from its harbour, so the water sits at the origin. A crossing
     is laid out from its sanctuary and the sea is an edge of the plate, so the water
     is pushed out to where the coast actually is. */
  const O=S.waterOrigin||[0,0];
  const COAST_OFF=S.coastOffset;
  const Cp=add(O,mul(n,COAST_OFF));

  /* a shoreline that is not a ruled line */
  const wave=s=>170*Math.sin(s/1350)+70*Math.sin(s/430+1.7)+30*Math.sin(s/190+4.1);
  function seaSigned(p){                      /* >0 seaward of the open coast */
    const d=sub(p,Cp);
    return dot(d,n)-wave(dot(d,t));
  }

  /* the basin: a centreline from the head out to the mouth, with a waist at the throat */
  const head=add(O,mul(vec(inward,1),S.basinLength));
  const mouth=O.slice();
  const axis=norm(sub(mouth,head));           /* head -> mouth */
  const across=[-axis[1],axis[0]];
  /* Which shore is the city on? The one the hinterland is behind. Get this wrong and
     every road out of the town has to cross its own harbour to leave. */
  const landV=vec(site.landBearing!=null?site.landBearing:site.seaBearing+180,1);
  const side=dot(across,landV)>=0?1:-1;
  const cityN=mul(across,side);               /* from the basin toward the town */
  function halfWidth(u){                      /* u in 0..1 from head to mouth */
    const belly=Math.sin(Math.pow(u,0.75)*Math.PI);
    return S.basinHeadWidth+(S.basinWidth-S.basinHeadWidth)*belly
           - S.throat*Math.pow(Math.max(0,u-0.78)/0.22,2);
  }
  const STEPS=48;
  const left=[], right=[];
  for(let k=0;k<=STEPS;k++){
    const u=k/STEPS;
    const c=lerp(head,mouth,u);
    const w=halfWidth(u)*(1+0.06*Math.sin(u*17+2));
    left.push(add(c,mul(across,w)));
    right.push(add(c,mul(across,-w)));
  }
  /* run the last of it out past the coast so basin and sea read as one body of water */
  const runOut=mul(axis,S.basinLength*0.45);
  const basin=left.concat([add(left[STEPS],runOut),add(right[STEPS],runOut)],
    right.slice().reverse());

  function inBasin(p){
    let inside=false;
    for(let i=0,j=basin.length-1;i<basin.length;j=i++){
      const a=basin[i], b=basin[j];
      if((a[1]>p[1])!==(b[1]>p[1])&&
         p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
    }
    return inside;
  }
  /* The basin is a hundred segments and room() is asked about it hundreds of thousands
     of times, so this is the one place in the file written for the machine rather than
     the reader: the segments are flattened into plain numbers, every candidate is
     rejected on a squared distance to its midpoint before the real one is computed,
     and nothing allocates. It was four fifths of the running time before. */
  const SN=basin.length;
  const sAx=new Float64Array(SN), sAy=new Float64Array(SN);
  const sEx=new Float64Array(SN), sEy=new Float64Array(SN);
  const sL2=new Float64Array(SN), sMx=new Float64Array(SN), sMy=new Float64Array(SN);
  const sHalf=new Float64Array(SN);
  for(let i=0;i<SN;i++){
    const a=basin[i], b=basin[(i+1)%SN];
    sAx[i]=a[0]; sAy[i]=a[1];
    sEx[i]=b[0]-a[0]; sEy[i]=b[1]-a[1];
    sL2[i]=sEx[i]*sEx[i]+sEy[i]*sEy[i]||1;
    sMx[i]=(a[0]+b[0])/2; sMy[i]=(a[1]+b[1])/2;
    sHalf[i]=Math.sqrt(sL2[i])/2;
  }
  function nearestEdge(px,py){
    let best=Infinity, best2=Infinity;
    for(let i=0;i<SN;i++){
      const ddx=px-sMx[i], ddy=py-sMy[i], reach=best+sHalf[i];
      if(ddx*ddx+ddy*ddy>reach*reach) continue;
      let t=((px-sAx[i])*sEx[i]+(py-sAy[i])*sEy[i])/sL2[i];
      t=t<0?0:t>1?1:t;
      const dx=px-(sAx[i]+sEx[i]*t), dy=py-(sAy[i]+sEy[i]*t);
      const d2=dx*dx+dy*dy;
      if(d2<best2){ best2=d2; best=Math.sqrt(d2); }
    }
    return best;
  }

  let bx0=Infinity,by0=Infinity,bx1=-Infinity,by1=-Infinity;
  basin.forEach(q=>{ if(q[0]<bx0)bx0=q[0]; if(q[0]>bx1)bx1=q[0];
    if(q[1]<by0)by0=q[1]; if(q[1]>by1)by1=q[1]; });

  /* signed room: positive on land, and roughly a distance in metres near the edge */
  function room(p){
    const px=p[0], py=p[1];
    const ax=Math.max(bx0-px,0,px-bx1), ay=Math.max(by0-py,0,py-by1);
    const away=Math.sqrt(ax*ax+ay*ay);
    if(away>400) return Math.min(-seaSigned(p),away);
    const edge=nearestEdge(px,py);
    if(inBasin(p)) return -edge;
    return Math.min(-seaSigned(p),edge);
  }

  /* the sheltering spit: the arm of land thrown across the mouth, on the seaward
     shore — the side the town is not on */
  const spit=[];
  for(let k=0;k<=26;k++){
    const u=k/26;
    const along=lerp(add(head,mul(axis,S.basinLength*0.62)),
      add(mouth,mul(axis,S.basinLength*0.30)),u);
    spit.push(add(along,mul(cityN,-(halfWidth(0.62+u*0.38)+S.spitWidth*(1-u*0.55)))));
  }

  /* Beside the basin on the seaward side is the far shore, and a town does not cross
     its own harbour to build on it: that ground stays the sheltering spit. Past the
     head there is no water in the way, so the town wraps round it. */
  const axisV=sub(mouth,head), axis2=dot(axisV,axisV)||1;
  function acrossTheWater(p){
    const u=dot(sub(p,head),axisV)/axis2;
    if(u<=0.02) return false;
    return dot(sub(p,add(head,mul(axisV,Math.min(1,u)))),cityN)<0;
  }
  /* Land the town could stand on at all: dry, and on its own side of the water. A
     crossing has no far shore to be on the wrong side of — its water is a bight in an
     open coast, not a haven with an arm round it — so the test is only asked of a
     port. */
  const townside=S.openCoast?(()=>true):(p=>!acrossTheWater(p));

  return {
    seaBearing:seaB, inward:inward, n:n, t:t, axis:axis, across:across, cityN:cityN,
    acrossTheWater:acrossTheWater, townside:townside,
    head:head, mouth:mouth, basin:basin, spit:spit,
    coastOf:s=>add(add(Cp,mul(t,s)),mul(n,wave(s))),
    seaSigned:seaSigned, inBasin:inBasin, room:room, halfWidth:halfWidth,
    /* a point on the city-side shore of the basin, u from head to mouth */
    quayAt:(u,off)=>{
      const c=lerp(head,mouth,u);
      return add(c,mul(cityN,halfWidth(u)+(off||0)));
    }
  };
}

/* ===================================================================================
   4. THE PLAN
   ---------------------------------------------------------------------------------
   A port city is not laid out on a grid and it is not laid out at random. It is a quay
   with roads running back from it, and everything else fills in between. So: the Staple
   is set where the principal landward road meets the principal quay, radials leave it
   for each gate and each end of the harbour, rings are thrown across them, and the
   ground between rings and radials is cut into blocks. The one part that is planned —
   the warehouse ground won from the marsh behind the quay — is laid out square, which
   is what makes the rest read as unplanned.
   =================================================================================== */
function buildPlan(site,water,rnd,S){
  return S.archetype==="crossing"?planCrossing(site,water,rnd,S)
                                 :planPort(site,water,rnd,S);
}

function planPort(site,water,rnd,S){
  const streets=[], gates=[];

  /* --- the Staple: two thirds down the basin on the city side, set back from the quay */
  const quayU=0.56;
  const staple=add(water.quayAt(quayU,S.quayDepth+120),[0,0]);

  /* --- the quay itself, along the city shore of the basin --- */
  const quayPts=[];
  for(let k=0;k<=30;k++) quayPts.push(water.quayAt(0.06+k/30*0.88,S.quayDepth));
  streets.push({pts:quayPts,cls:"quay",name:"The Long Quay"});

  /* --- radials: one per gate, plus the two ends of the harbour ------------------- */
  const rays=[];
  function ray(bearing,name,kind,road){
    rays.push({bearing:((bearing%360)+360)%360,name:name,kind:kind,road:road});
  }
  site.roads.forEach((r,ix)=>{
    const nm=r.to?("The "+r.to+" Way"):(ix?"The West Way":"The Land Way");
    ray(r.bearing,nm,"gate",r);
  });
  /* the coast road east, which the export implies: cells 466 and 554 are coastal land */
  ray(site.seaBearing+95,"The Strand Road","gate",null);
  /* the marsh road south, to the pans and the fever ground */
  if(site.marshBearing!=null) ray(site.marshBearing,"The Pan Road","gate",null);
  /* and the two ends of the water */
  ray(Math.atan2(water.head[1]-staple[1],water.head[0]-staple[0])/D2R,
    "Shipwright Street","harbour",null);
  ray(Math.atan2(water.mouth[1]-staple[1],water.mouth[0]-staple[0])/D2R,
    "Chain Street","harbour",null);

  /* A road that arrives on a bearing pointing straight across the harbour cannot
     leave the town on it. It leaves by the nearest gate that is on dry ground and
     turns outside the wall, which is what roads do when a haven is in the way; the
     bearing it really arrives on is kept so the plate can say so. */
  rays.forEach(r=>{
    if(r.kind!=="gate") return;
    const ok=b=>{
      const p=add(staple,vec(b,S.wallR*0.85));
      return water.room(p)>S.quayClear&&water.townside(p);
    };
    if(ok(r.bearing)) return;
    for(let step=6;step<=110;step+=6){
      for(const dir of [1,-1]){
        if(ok(r.bearing+dir*step)){
          r.arrives=r.bearing; r.turn=dir*step; r.bearing+=dir*step; return;
        }
      }
    }
  });

  /* Two roads arriving within 22 degrees of each other share one gate. Gates are
     offered first, so a road out of the city keeps its gate and the harbour street
     is the one that gives way. */
  const apart=(a,b)=>Math.abs(((a-b+540)%360)-180);
  rays.sort((a,b)=>(a.kind==="gate"?0:1)-(b.kind==="gate"?0:1)||a.bearing-b.bearing);
  const kept=[];
  rays.forEach(r=>{
    const merged=kept.find(k=>apart(k.bearing,r.bearing)<22);
    if(merged){ if(r.kind==="gate") (merged.shares||(merged.shares=[])).push(r); }
    else kept.push(r);
  });
  kept.sort((a,b)=>a.bearing-b.bearing);

  /* --- how far the built ground goes: solved from the population --------------- */
  const REACH=S.reach;
  function densityAt(r,onRoad){
    if(r<S.coreR) return DENSITY.core;
    if(r<S.wallR) return DENSITY.inner;
    return onRoad?DENSITY.outer:DENSITY.fringe;
  }

  /* --- rings ---------------------------------------------------------------------
     Spaced at the depth of a block, not on a geometric series: a ring street every
     ninety metres or so, opening out a little toward the edge the way the ground does
     when it stops being worth subdividing. A geometric series looks reasonable written
     down and produces blocks four times longer than they are wide. */
  const rings=[];
  for(let r=S.ring0;r<REACH;r+=S.ringGap+r*S.ringFlare) rings.push(r);

  return {archetype:"port", staple:staple, centre:staple, quayU:quayU,
    quayPts:quayPts, rays:kept, rings:rings, streets:streets, gates:gates,
    densityAt:densityAt, recut:function(){}};
}

/* ===================================================================================
   4b. THE PLAN OF A CROSSING
   ---------------------------------------------------------------------------------
   A port is a quay with roads running back from it. A crossing is the other way round:
   a road with a city grown on it. Rithi's two trunks leave 175 degrees apart, so the
   straight line between its gates runs through the middle of the town — and the middle
   of the town, under Cutho's interdict, is consecrated ground that the traffic may not
   touch.

   So the plan is struck from the sanctuary and the through-way is bent round it: out of
   the west gate, round the skirt of the holy hill, in at the east gate, never crossing
   the precinct. The length that costs is the whole argument of the city and the plate
   measures it. The bend goes south because the sea is north — the export puts two water
   cells at bearing -94 and there is no room that way.
   =================================================================================== */
function planCrossing(site,water,rnd,S){
  const centre=[0,0];                       /* the sanctuary; the plan is struck here */
  const streets=[];
  const trunks=site.roads.filter(r=>r.cls==="trunk").sort((a,b)=>b.uses-a.uses);
  const gE=trunks[0].bearing, gW=trunks[1].bearing;

  /* Which way round does the road go? The way that is not the sea. */
  const norm360=d=>((d%360)+360)%360;
  const sweepA=norm360(gE-gW), sweepB=sweepA-360;      /* one each way */
  const away=sw=>{
    const mid=norm360(gW+sw/2);
    return Math.abs(((mid-site.seaBearing+540)%360)-180);
  };
  const sweep=away(sweepA)>away(sweepB)?sweepA:sweepB;
  const midBearing=norm360(gW+sweep/2);

  /* the through-way itself: out at the gates, in as close to the precinct as the
     interdict allows in the middle */
  function corridorPts(){
    const pts=[], N=72;
    for(let k=0;k<=N;k++){
      const t=k/N;
      const bulge=Math.sin(Math.PI*t);
      const r=S.wallR-(S.wallR-S.sacredR*S.corridorClear)*Math.pow(bulge,0.6);
      pts.push(add(centre,vec(gW+sweep*t,r)));
    }
    return pts;
  }

  /* --- radials ------------------------------------------------------------------- */
  const rays=[];
  const ray=(bearing,name,kind,road)=>rays.push({bearing:norm360(bearing),name:name,
    kind:kind,road:road});
  ray(gW,"The "+(trunks[1].to||"West")+" Road","gate",trunks[1]);
  ray(gE,"The "+(trunks[0].to||"East")+" Road","gate",trunks[0]);
  site.roads.filter(r=>r.cls!=="trunk").forEach(r=>
    ray(r.bearing,r.to?("The "+r.to+" Lane"):"The Lesser Road","gate",r));
  ray(site.seaBearing,"The Sea Stair","gate",null);
  /* two streets of the town itself, thrown at the through-way from the sanctuary */
  ray(midBearing,"The Pilgrim Way","sacred",null);
  ray(norm360(midBearing+180),"The Ash Road","sacred",null);

  const apart=(a,b)=>Math.abs(((a-b+540)%360)-180);
  rays.sort((a,b)=>(a.kind==="gate"?0:1)-(b.kind==="gate"?0:1)||a.bearing-b.bearing);
  const kept=[];
  rays.forEach(r=>{
    const merged=kept.find(k=>apart(k.bearing,r.bearing)<20);
    if(merged){ if(r.kind==="gate") (merged.shares||(merged.shares=[])).push(r); }
    else kept.push(r);
  });
  kept.sort((a,b)=>a.bearing-b.bearing);

  const rings=[];
  for(let r=S.ring0;r<S.reach;r+=S.ringGap+r*S.ringFlare) rings.push(r);

  const plan={
    archetype:"crossing", staple:centre, centre:centre,
    rays:kept, rings:rings, streets:streets,
    gW:gW, gE:gE, sweep:sweep, midBearing:midBearing,
    quayPts:[],
    recut(){
      plan.corridor=corridorPts();
      let L=0;
      for(let i=1;i<plan.corridor.length;i++) L+=len(sub(plan.corridor[i],plan.corridor[i-1]));
      plan.corridorLength=L;
      plan.gateGap=len(sub(plan.corridor[0],plan.corridor[plan.corridor.length-1]));
      plan.detour=L/(plan.gateGap||1);
      plan.streets.length=0;
      plan.streets.push({pts:plan.corridor,cls:"way",name:"The Through-Way"});
      /* the sanctuary's own ring road, just outside the interdict wall */
      const ring=[];
      for(let k=0;k<=64;k++) ring.push(add(centre,vec(k/64*360,S.sacredR*1.06)));
      plan.streets.push({pts:ring,cls:"great",name:"The Procession"});
    }
  };
  plan.recut();
  return plan;
}

/* the shortest distance from a point to the through-way, and where along it */
function corridorDist(plan,p){
  const c=plan.corridor;
  if(!c) return Infinity;
  let best=Infinity, at=0;
  for(let i=0;i<c.length-1;i++){
    const ax=c[i][0], ay=c[i][1], ex=c[i+1][0]-ax, ey=c[i+1][1]-ay;
    const l2=ex*ex+ey*ey||1;
    let t=((p[0]-ax)*ex+(p[1]-ay)*ey)/l2; t=t<0?0:t>1?1:t;
    const dx=p[0]-(ax+ex*t), dy=p[1]-(ay+ey*t);
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<best){ best=d; at=(i+t)/(c.length-1); }
  }
  return {d:best, at:at};
}

/* ===================================================================================
   7b. WHAT STANDS ON EACH BLOCK, UNDER AN INTERDICT
   ---------------------------------------------------------------------------------
   The order the rules are asked in is the order the city decides: the sanctuary first,
   because nothing overrules it; then the through-way, because the city exists to carry
   it; then the wards, because the strangers have to sleep somewhere and it may not be
   on consecrated ground; then everything else.
   =================================================================================== */
function usesCrossing(blocks,site,water,plan,S,doctrine){
  const centre=plan.centre;
  const gates=[plan.gW*D2R,plan.gE*D2R];
  const roadRays=plan.rays.filter(r=>r.kind==="gate").map(r=>r.bearing*D2R);
  const rise=site.riseBearing!=null?site.riseBearing*D2R:null;
  const angDiff=(a,b)=>Math.abs(((a-b+Math.PI*3)%TAU)-Math.PI);

  blocks.forEach(b=>{
    const r=len(sub(b.c,centre));
    const th=Math.atan2(b.c[1]-centre[1],b.c[0]-centre[0]);
    const cd=corridorDist(plan,b.c);
    const onWay=cd.d<S.corridorHalf;
    const besideWay=cd.d<S.corridorHalf*2.2;
    const nearGate=gates.some(g=>angDiff(g,th)<0.30);
    const onRoad=roadRays.some(a=>angDiff(a,th)<0.30);
    const pick=hash2(Math.round(b.c[0]),b.c[1]);
    const toWater=water.room(b.c);

    b.onRoad=onRoad; b.toWater=toWater;
    b.sacred=r<S.sacredR; b.onWay=onWay; b.corridor=cd.d;

    let use;
    if(toWater<S.wharfDepth&&r>S.sacredR) use="wharf";
    else if(r<S.sacredR*0.24) use="temple";
    else if(r<S.sacredR)
      use=pick<0.26?"civic":pick<0.44?"temple":pick<0.84?"dwelling":"garden";
    else if(onWay) use=pick<0.40?"waggon":pick<0.74?"store":"staple";
    else if(nearGate&&r>S.wallR*0.90&&r<S.wallR*1.03) use="garrison";
    else if(doctrine&&doctrine.wardsOutside&&nearGate&&
            r>S.sacredR*1.12&&r<S.wallR*0.90) use=pick<0.86?"ward":"staple";
    else if(besideWay) use=pick<0.45?"store":pick<0.80?"craft":"waggon";
    else if(r<S.wallR) use=pick<0.32?"craft":pick<0.82?"dwelling":"poor";
    else if(rise!=null&&angDiff(rise,th)<0.5&&!nearGate) use=pick<0.6?"quarry":"garden";
    /* outside a trunk gate the city runs on down the road it lives off */
    else if(nearGate) use=pick<0.34?"waggon":pick<0.72?"dwelling":"craft";
    /* and the trades the interdict names are put on the lesser road, out of sight */
    else if(onRoad) use=pick<0.58?"noxious":"waggon";
    else use=pick<0.70?"garden":"dwelling";

    b.use=use;
    const sp=USES[use].storeys;
    b.storeys=sp[0]+Math.round(hash2(b.c[1],b.c[0])*(sp[1]-sp[0]));
    b.coverage=use==="garden"?0.08:use==="quarry"?0.05:use==="waggon"?0.26:
      use==="temple"?0.52:
      r<S.sacredR?0.62:onWay?0.58:r<S.wallR?0.68:0.42;
  });
  return blocks;
}

/* ===================================================================================
   10b. THE NAMED GROUND OF A CROSSING
   =================================================================================== */
function landmarksCrossing(site,water,plan,wall,inner,S,doctrine){
  const L=[], c=plan.centre;
  const put=(name,kind,p,note)=>L.push({name:name,kind:kind,p:p,note:note});
  const dry=p=>water.room(p)>S.quayClear*1.2&&water.townside(p);
  const at=(bearing,r)=>{
    const first=add(c,vec(bearing,r));
    if(dry(first)) return first;
    for(let step=7;step<=170;step+=7) for(const dir of [1,-1]){
      const p=add(c,vec(bearing+dir*step,r)); if(dry(p)) return p;
    }
    return first;
  };
  const onWay=t=>plan.corridor[Math.round(t*(plan.corridor.length-1))];
  const trunks=site.roads.filter(r=>r.cls==="trunk").sort((a,b)=>b.uses-a.uses);
  const pairs=A.data.report.market_pairs;
  const days=mi=>Math.round(mi/M.supplyDivisor);

  /* --- the sanctuary --- */
  put("The Temple Rock","temple",c,
    "Cut from the ground it stands on: every neighbouring cell of this site is "+
    "Volcanic, and the city is built out of what it quarried to make this. The plan of "+
    "the whole place is struck from this point.");
  put("The Interdict Wall","gate",at(plan.midBearing,S.sacredR),
    doctrine?doctrine.blurb:"The boundary of consecrated ground.");
  put("The College of Readings","civic",at(plan.midBearing+150,S.sacredR*0.62),
    "Where the interdict is interpreted, which in a city that lives on traffic is the "+
    "same as saying where the tariff of the crossing is set.");
  put("The Silent Quarter","civic",at(plan.midBearing+205,S.sacredR*0.72),
    "Dwellings of those permitted to sleep inside the wall. "+
    site.pop.toLocaleString()+" people live at this crossing and this is the part of "+
    "it that is quiet.");
  put("The Temple Cisterns","civic",at(plan.midBearing+95,S.sacredR*0.78),
    "There is no river here — r=0 on this cell and on every cell that touches it — and "+
    "the ground is volcanic, so the water is roofed rain and what the sulphur springs "+
    "give. The sanctuary holds the good half of it.");
  put("The Watch of Hours","civic",at(plan.midBearing+20,S.sacredR*0.5),
    "The bell that closes the gates. The through-way runs at night; the precinct does "+
    "not.");

  /* --- the crossing --- */
  put("The Through-Way","harbour",onWay(0.5),
    "The road that is the reason for the city. It does not cross the precinct — it is "+
    "bent round it — and that bend costs "+
    Math.round((plan.detour-1)*100)+" per cent of the distance, "+
    Math.round(plan.corridorLength-plan.gateGap).toLocaleString()+" metres of extra "+
    "road on every crossing of Adrinem made by land.");
  put("The Long Bend","harbour",onWay(0.5+0.18),
    "The furthest the road is driven from the straight line between its own gates. "+
    "Everything that goes overland from "+(trunks[1].to||"the west")+" to "+
    (trunks[0].to||"the east")+" walks this because of what stands in the middle.");
  put("The Toll of the Crossing","staple",onWay(0.34),
    "Taken in kind and in coin. "+
    "Rithi carries 38 of the "+(pairs)+" market pairs on the sheet — more than any "+
    "other burg in Adrinem — and every one of them is assessed here.");
  put("The Weigh Bridge","staple",onWay(0.66),
    "Because the toll is by weight and the beasts are changed by weight.");
  put("The Beast Lines","waggon",onWay(0.24),
    "Where draught animals are changed. The two trunks that meet here carry "+
    trunks.map(t=>t.uses).join(" and ")+" market pairs; nothing that arrives on one "+
    "leaves on the same legs.");
  put("The Bonded Transit Sheds","store",onWay(0.76),
    "Goods that are passing through and may not be sold here. Under the interdict they "+
    "may not be opened here either, which is the whole of the arrangement.");
  ["First","Second","Third"].forEach((nm,ix)=>
    put("Caravanserai of the "+nm+" Watch","waggon",onWay(0.14+ix*0.36),
      "Standings, water and a roof, on the way and outside the wall of the precinct. "+
      "A caravan crossing Adrinem sleeps three times in this city and never once on "+
      "consecrated ground."));
  put("The Water Troughs","civic",onWay(0.44),
    "Cisterns cut for the road, filled from the same roofs as the sanctuary's and "+
    "emptied a great deal faster.");

  /* --- the strangers --- */
  if(doctrine&&doctrine.wardsOutside){
    put("The "+(trunks[1].to||"Western")+" Ward","ward",at(plan.gW,S.wallR*0.78),
      "Where those who come in at the west gate sleep, since they may not sleep "+
      "inside. It is packed, and it is the richest ground in the city that nobody who "+
      "lives on it is allowed to own.");
    put("The "+(trunks[0].to||"Eastern")+" Ward","ward",at(plan.gE,S.wallR*0.78),
      "The same, at the other end. The two wards do not speak the same language and "+
      "are not meant to meet.");
    put("The Unhallowed Market","staple",at(plan.midBearing-28,S.wallR*1.06),
      "Outside the wall. What may not be traded within it is traded here, and the "+
      "city takes a cut of that too.");
    put("The Strangers' Ground","civic",at(plan.midBearing+42,S.wallR*1.2),
      "Burial for those who die on the road. They may not lie in consecrated earth, "+
      "and a city that a third of a continent walks through buries a great many "+
      "people it never knew.");
  }

  /* --- what the ground gives, and what it will not have inside --- */
  put("The Sulphur Works","quarry",
    at(site.riseBearing!=null?site.riseBearing:plan.midBearing+120,S.wallR*1.22),
    "Volcanic ground, worked for what it is worth. The highest cell touching this site "+
    "is at height "+(site.riseHeight!=null?site.riseHeight:site.height)+" against "+
    site.height+" here, and the workings climb it.");
  put("The Basalt Quarries","quarry",
    at(site.riseBearing!=null?site.riseBearing+34:plan.midBearing+150,S.wallR*1.3),
    "The city is cut from its own hill. Nothing else here is worth building with.");
  put("The Tanners' Exile","noxious",at(plan.midBearing+70,S.wallR*1.16),
    "Beyond the wall, and beyond it by doctrine rather than by wind. The trades the "+
    "interdict names may not be practised within sight of the precinct.");
  put("The Slaughter Ground","noxious",at(plan.midBearing+96,S.wallR*1.24),
    "The same rule, and the same distance.");

  /* --- the state, and the lesser road --- */
  put("The Warden of the Crossing","garrison",at(plan.gE-16,S.wallR*0.92),
    "Cutho holds the only through-route in Adrinem. The keep watches the east gate, "+
    "because that is the one the "+(trunks[0].to||"eastern")+" trunk uses, and it "+
    "carries "+trunks[0].uses+" market pairs.");
  put("The Sea Stair","harbour",at(site.seaBearing,S.wallR*0.94),
    "The lesser road. Harbour value "+site.harbour+" — two sea contacts and no "+
    "shelter worth the name — so what can go by land does, and this stair takes the "+
    "rest.");

  /* --- the reachable world, priced --- */
  const near=site.overland.slice(0,3);
  near.forEach((m,ix)=>put("The "+m.name+" Factory","merchant",
    at(plan.midBearing+180+(ix-1)*26,S.sacredR*1.5),
    m.name+" in "+m.state+": "+Math.round(m.cost).toLocaleString()+
    " effective miles, "+days(m.cost)+" days. Its house stands outside the interdict "+
    "wall like everyone else's."));

  wall.gates.forEach(g=>{
    let note=g.to?("The trunk road to "+g.to+", carrying "+g.uses+" of the "+pairs+
      " market pairs on the sheet."):"A gate of the outer wall.";
    if(g.turn) note+=" It arrives on a bearing that would take it through the "+
      "precinct, so it turns outside the wall.";
    (g.shares||[]).forEach(r=>{ note+=" "+r.name+" leaves here too."; });
    put(g.name,"gate",g.p,note);
  });
  (inner?inner.gates:[]).forEach(g=>put(g.name,"gate",g.p,
    "A gate of the interdict wall. Everything that passes it is washed and looked at; "+
    "nothing on wheels passes it at all."));
  return L;
}

/* ===================================================================================
   5. THE BLOCKS
   ---------------------------------------------------------------------------------
   Ring lines and radial lines are laid first and the ground between them is cut into
   blocks, which is the order a radial city is actually built in. Every corner is
   jittered by a value hashed from its ring and its angle, so the two blocks either
   side of a street agree on where the street is. Where the arc between two radials
   grows past a block frontage a new radial is inserted and carried outward from
   there — minor streets that begin part-way out, never at the centre, the way they do.
   =================================================================================== */
const FRONTAGE=86;          /* metres of street frontage a block wants */
const ST_WIDTH={quay:26,great:18,ring:12,minor:8};

/* Math.imul throughout: a plain multiply of two 32-bit values leaves 2^53 and the low
   bits — the only ones that carry any mixing — are quietly rounded away. */
function hash2(a,b){
  let h=(Math.imul(a|0,374761393)+Math.imul(Math.round(b*1000)|0,668265263))|0;
  h=Math.imul(h^(h>>>13),1274126177);
  h^=h>>>16;
  return (h>>>0)/4294967296;
}

function buildBlocks(site,water,plan,S){
  const {staple,rays,rings}=plan;
  const R2D=1/D2R;

  /* the angles present at each ring, each set containing the one inside it */
  const base=rays.map(r=>r.bearing*D2R).sort((a,b)=>a-b);
  const angles=[];
  let cur=base.slice();
  rings.forEach((r,k)=>{
    const next=[];
    for(let i=0;i<cur.length;i++){
      const a=cur[i], b=(i===cur.length-1)?cur[0]+TAU:cur[i+1];
      next.push(a);
      const arc=(b-a)*r;
      const cuts=Math.max(0,Math.round(arc/FRONTAGE)-1);
      for(let c=1;c<=cuts;c++) next.push(a+(b-a)*c/(cuts+1));
    }
    cur=next.sort((x,y)=>x-y);
    angles[k]=cur.slice();
  });

  /* A corner, jittered the same way whichever block asks for it. The wander is scaled
     to the gap between rings and to a block's frontage — not to the radius, which
     sounds equivalent and is not: a tenth of a radius is a few metres at the market
     and two hundred at the edge, and rings that far out of true cross each other and
     shatter the fabric into splinters. */
  const node=(k,theta)=>{
    const gap=k+1<rings.length?rings[k+1]-rings[k]:rings[k]-rings[k-1];
    const r=rings[k]+(hash2(k*7+1,theta)-0.5)*gap*0.34
      +Math.sin(theta*3.1+k*0.9)*gap*0.15;
    const th=theta+(hash2(k*13+5,theta)-0.5)*FRONTAGE*0.34/Math.max(rings[k],1);
    return add(staple,vec(th*R2D,r));
  };

  /* shrink a block off the street lines by a margin that depends on what bounds it */
  function inset(poly,m){
    const c=centroid(poly);
    return poly.map(p=>{
      const d=sub(p,c), l=len(d)||1;
      return add(c,mul(d,Math.max(0.25,(l-m)/l)));
    });
  }

  const blocks=[];
  for(let k=0;k<rings.length-1;k++){
    const inner=angles[k], outer=angles[k+1];
    for(let i=0;i<inner.length;i++){
      const a=inner[i], b=(i===inner.length-1)?inner[0]+TAU:inner[i+1];
      const poly=[node(k,a)];
      /* any radial inserted at the next ring puts a corner on the outer face */
      const mids=outer.filter(t=>{
        const tt=t<a?t+TAU:t;
        return tt>a+1e-9&&tt<b-1e-9;
      });
      poly.push(node(k,b));
      poly.push(node(k+1,b));
      mids.slice().reverse().forEach(t=>poly.push(node(k+1,t)));
      poly.push(node(k+1,a));
      /* the outer face was walked backwards, so the ring order is b -> mids -> a */
      const ring=[poly[0],poly[1]].concat(poly.slice(2));
      blocks.push({poly:inset(ring,ST_WIDTH.minor*0.9+ (k<2?3:0)),
        ring:k, theta:(a+b)/2, r:(rings[k]+rings[k+1])/2});
    }
  }
  return {blocks:blocks, node:node, angles:angles};
}

/* ===================================================================================
   6. CLIPPING TO THE GROUND THERE IS
   =================================================================================== */
function clipToLand(blocks,water,plan,S,site,everywhere){
  const kept=[];
  const acrossTheWater=water.acrossTheWater;
  /* Outside the wall a city does not spread evenly; it runs out along its roads. */
  const roadRays=plan.rays.filter(r=>r.kind==="gate").map(r=>r.bearing*D2R);
  const angDiff=(a,b)=>Math.abs(((a-b+Math.PI*3)%TAU)-Math.PI);
  function suburb(p){
    const d=len(sub(p,plan.staple));
    if(d<=S.wallR*1.04) return true;
    const th=Math.atan2(p[1]-plan.staple[1],p[0]-plan.staple[0]);
    const near=roadRays.reduce((m,a)=>Math.min(m,angDiff(a,th)),Math.PI);
    /* A skirt of ground just outside the wall, then ribbons that narrow as they run,
       and nothing at all between them. An even scatter of odd blocks out in the fields
       is not what a city does; it is what a random number looks like. */
    if(d<S.wallR*1.18) return true;
    /* a crossing spreads along its road before it spreads anywhere else */
    if(plan.corridor&&corridorDist(plan,p).d<S.corridorHalf*1.8) return true;
    const reachOut=Math.min(1,(d-S.wallR)/(S.reach-S.wallR));
    return near<0.30*(1-reachOut*0.72);
  }

  blocks.forEach(b=>{
    /* Most blocks are nowhere near the water; only the ones that might be pay for the
       walk back to the shore. */
    const mid=centroid(b.poly);
    if(acrossTheWater(mid)) return;
    if(!everywhere&&!suburb(mid)) return;
    if(water.room(mid)>420){
      b.area=polyArea(b.poly); b.c=mid; kept.push(b); return;
    }
    /* pull any corner that fell in the water back to the shore */
    const poly=b.poly.map(p=>{
      let q=p, room=water.room(q), guard=0;
      while(room<S.quayClear&&guard++<14){
        const e=2.5;
        const gx=(water.room([q[0]+e,q[1]])-water.room([q[0]-e,q[1]]))/(2*e);
        const gy=(water.room([q[0],q[1]+e])-water.room([q[0],q[1]-e]))/(2*e);
        const g=norm([gx,gy]);
        q=add(q,mul(g,Math.min(60,S.quayClear-room+2)));
        room=water.room(q);
      }
      return q;
    });
    const area=polyArea(poly);
    if(area<1400) return;                       /* squeezed out against the water */
    if(area>polyArea(b.poly)*1.9) return;       /* folded on itself doing it */
    const c=centroid(poly);
    if(water.room(c)<S.quayClear*0.6) return;
    b.poly=poly; b.area=area; b.c=c;
    kept.push(b);
  });
  return kept;
}

/* ===================================================================================
   7. WHAT STANDS ON EACH BLOCK
   ---------------------------------------------------------------------------------
   Use is decided by where a block is, in the order a city decides it: the water first,
   then the wall, then the roads, then the wind. Nothing is assigned at random; the
   only randomness is which of the uses a mixed quarter draws, and that is seeded.
   =================================================================================== */
const USES={
  wharf:   {label:"Wharf and warehouse", colour:"#8C6239", storeys:[2,4]},
  yard:    {label:"Shipyard and cordage", colour:"#A0784A", storeys:[1,2]},
  staple:  {label:"Market and exchange",  colour:"#C4881F", storeys:[2,3]},
  merchant:{label:"Merchant house",       colour:"#B4894E", storeys:[3,5]},
  craft:   {label:"Craft and workshop",   colour:"#8F8459", storeys:[2,4]},
  dwelling:{label:"Dwelling",             colour:"#9A9478", storeys:[2,4]},
  poor:    {label:"Tenement",             colour:"#8A8570", storeys:[3,5]},
  civic:   {label:"Civic and temple",     colour:"#5F7A93", storeys:[2,3]},
  garrison:{label:"Citadel and garrison", colour:"#5A5852", storeys:[2,4]},
  noxious: {label:"Noxious trade",        colour:"#7A5D4A", storeys:[1,2]},
  store:   {label:"Granary and store",    colour:"#A8935E", storeys:[2,4]},
  garden:  {label:"Garden and orchard",   colour:"#6F8455", storeys:[0,1]},
  waggon:  {label:"Waggon yard and inn",  colour:"#96825E", storeys:[1,2]},
  temple:  {label:"Sanctuary",            colour:"#8E7BA8", storeys:[1,3]},
  ward:    {label:"Strangers' ward",      colour:"#A87A6A", storeys:[2,4]},
  quarry:  {label:"Quarry and sulphur",   colour:"#6E655A", storeys:[0,1]}
};

function assignUses(blocks,site,water,plan,S,rnd){
  if(plan.archetype==="crossing")
    return usesCrossing(blocks,site,water,plan,S,doctrineOf(site));
  const {staple}=plan;
  const marsh=site.marshBearing!=null?site.marshBearing*D2R:null;
  const rise=site.riseBearing!=null?site.riseBearing*D2R:null;
  const roadRays=plan.rays.filter(r=>r.kind==="gate").map(r=>r.bearing*D2R);
  const angDiff=(a,b)=>Math.abs(((a-b+Math.PI*3)%TAU)-Math.PI);

  blocks.forEach(b=>{
    const r=len(sub(b.c,staple));
    const th=Math.atan2(b.c[1]-staple[1],b.c[0]-staple[0]);
    const toWater=water.room(b.c);
    const onRoad=roadRays.some(a=>angDiff(a,th)<0.30);
    const pick=hash2(Math.round(b.c[0]),b.c[1]);

    b.onRoad=onRoad;
    b.toWater=toWater;

    let use;
    if(toWater<S.wharfDepth) use=(r>S.wallR*0.9)?"yard":"wharf";
    else if(r<S.stapleR) use="staple";
    else if(toWater<S.wharfDepth*2.2&&r<S.wallR) use=pick<0.5?"wharf":"store";
    else if(rise!=null&&angDiff(rise,th)<0.34&&r>S.coreR*0.8&&r<S.wallR*1.05)
      use=pick<0.55?"garrison":"civic";
    else if(marsh!=null&&angDiff(marsh,th)<0.24&&r>S.wallR&&r<S.wallR*1.55)
      use=pick<0.72?"noxious":"garden";
    else if(r<S.coreR) use=pick<0.34?"merchant":pick<0.72?"craft":"civic";
    else if(r<S.wallR) use=pick<0.30?"craft":pick<0.80?"dwelling":"poor";
    else if(onRoad) use=pick<0.26?"waggon":pick<0.72?"dwelling":"craft";
    else use=pick<0.72?"garden":"dwelling";

    b.use=use;
    const sp=USES[use].storeys;
    b.storeys=sp[0]+Math.round(hash2(b.c[1],b.c[0])*(sp[1]-sp[0]));
    /* how much of a block is roofed: packed inside the wall, loose outside it */
    b.coverage=use==="garden"?0.08:use==="waggon"?0.24:
      r<S.coreR?0.78:r<S.wallR?0.66:0.42;
  });
  return blocks;
}

/* ===================================================================================
   8. PEOPLE
   ---------------------------------------------------------------------------------
   Only some uses house anybody. The rest of the head count is spread over those that
   do, then the whole city is scaled once so the total is the burg population the
   export gives — 560,794 for Oem'rek — rather than a number this file made up.
   =================================================================================== */
const HOUSES={dwelling:1, poor:1.22, craft:0.62, merchant:0.5, staple:0.22,
  wharf:0.1, store:0.06, civic:0.12, garrison:0.2, yard:0.05, noxious:0.3,
  waggon:0.25, garden:0.05,
  /* the sanctuary houses its own and nobody else; a ward is packed, because the people
     in it are not allowed to sleep anywhere better */
  temple:0.34, ward:1.9, quarry:0.04};

function housePeople(blocks,site,plan,S){
  let weight=0;
  blocks.forEach(b=>{
    const r=len(sub(b.c,plan.staple));
    b.roofed=b.area*b.coverage;
    b.floor=b.roofed*Math.max(1,b.storeys);
    b.w=b.floor*(HOUSES[b.use]||0)*(r<S.coreR?1.18:r<S.wallR?1:0.72);
    weight+=b.w;
  });
  const perWeight=site.pop/(weight||1);
  let inside=0, outside=0;
  blocks.forEach(b=>{
    b.people=Math.round(b.w*perWeight);
    if(len(sub(b.c,plan.staple))<S.wallR) inside+=b.people; else outside+=b.people;
  });
  return {inside:inside, outside:outside};
}

/* The street network is not drawn separately from the blocks — it is the lines the
   block corners were hung on, so a street is always exactly the gap between two rows
   of building. */
/* A street stops where the town does: at the water, and at the far shore it never
   built on. Each line is broken into the runs of it that are on the town's ground. */
function streetsFrom(mesh,rings,rays,plan,S,water,blocks){
  const out=[];
  const R2D=1/D2R;
  /* A street exists where there is city on it. The block layer has already had the
     water, the far shore and the empty fields taken out of it, so ask it rather than
     working the same rules out twice — otherwise the ring roads keep going out over
     ground nobody built on. */
  const CELL=210, near=new Map();
  const key=(x,y)=>Math.floor(x/CELL)+","+Math.floor(y/CELL);
  (blocks||[]).forEach(b=>{
    const k=key(b.c[0],b.c[1]);
    (near.get(k)||near.set(k,[]).get(k)).push(b.c);
  });
  const hasCity=p=>{
    const gx=Math.floor(p[0]/CELL), gy=Math.floor(p[1]/CELL);
    for(let x=gx-1;x<=gx+1;x++) for(let y=gy-1;y<=gy+1;y++){
      const list=near.get(x+","+y); if(!list) continue;
      for(let i=0;i<list.length;i++)
        if(Math.hypot(list[i][0]-p[0],list[i][1]-p[1])<190) return true;
    }
    return false;
  };
  const ok=p=>water.room(p)>S.quayClear*0.35&&water.townside(p)&&
    (!blocks||hasCity(p));
  function runs(pts,closed){
    const list=closed?pts.concat([pts[0]]):pts;
    const found=[]; let run=[];
    list.forEach(p=>{ if(ok(p)) run.push(p); else { if(run.length>1) found.push(run);
      run=[]; } });
    if(run.length>1) found.push(run);
    return found;
  }
  const emit=(pts,closed,rest)=>runs(pts,closed).forEach(r=>
    out.push(Object.assign({pts:r},rest)));
  plan.streets.forEach(st=>{
    if(st.cls==="way"){ out.push({pts:st.pts,cls:st.cls,name:st.name}); return; }
    emit(st.pts,false,{cls:st.cls,name:st.name});
  });

  /* the rings */
  rings.forEach((r,k)=>{
    if(k===0||k>=rings.length-1) return;
    emit(mesh.angles[k].map(t=>mesh.node(k,t)),true,{cls:"ring",name:null,ringIndex:k});
  });

  /* the radials: each angle runs outward from the ring it first appears at */
  const firstAt=new Map();
  mesh.angles.forEach((set,k)=>set.forEach(t=>{
    const key=t.toFixed(6);
    if(!firstAt.has(key)) firstAt.set(key,{k:k,t:t});
  }));
  firstAt.forEach(({k,t})=>{
    const pts=[];
    for(let j=Math.max(0,k-1);j<rings.length;j++) pts.push(mesh.node(j,t));
    const deg=((t*R2D)%360+360)%360;
    const great=rays.find(r=>Math.abs(((r.bearing-deg+540)%360)-180)<0.6);
    emit(pts,false,{cls:great?"great":"minor", name:great?great.name:null, bearing:deg});
  });
  return out;
}

/* ===================================================================================
   9. THE WALL
   ---------------------------------------------------------------------------------
   Hung on the ring street nearest the radius the population solved for, so it sits in
   the plan rather than across it. It stops at the water at either end — a wall does
   not cross a harbour — and the gates fall where the great roads cross it.
   =================================================================================== */
function buildWall(mesh,rings,rays,water,S,radius,label){
  const target=radius||S.wallR;
  let wk=1;
  for(let k=1;k<rings.length-1;k++)
    if(Math.abs(rings[k]-target)<Math.abs(rings[wk]-target)) wk=k;

  const ring=mesh.angles[wk].map(t=>({p:mesh.node(wk,t), t:t}));
  ring.forEach(n=>{ n.dry=water.room(n.p)>S.quayClear*0.5&&water.townside(n.p); });

  /* the longest unbroken dry arc, wrapping the ring */
  let best=[], run=[];
  for(let i=0;i<ring.length*2;i++){
    const n=ring[i%ring.length];
    if(n.dry){ run.push(n); if(run.length>best.length) best=run.slice(); }
    else run=[];
    if(run.length>=ring.length) break;
  }
  const arc=best.length?best:ring;

  const pts=arc.map(n=>n.p);
  const towers=[];
  for(let i=0;i<pts.length;i+=2) towers.push(pts[i]);

  const gates=[];
  const compassOf=d=>["East","South-East","South","South-West","West","North-West",
    "North","North-East"][(Math.round(((d%360)+360)%360/45))%8];
  rays.filter(r=>r.kind==="gate").forEach(r=>{
    let pick=null,bd=1e9;
    arc.forEach(n=>{
      const deg=((n.t/D2R)%360+360)%360;
      const d=Math.abs(((deg-r.bearing+540)%360)-180);
      if(d<bd){ bd=d; pick=n; }
    });
    if(pick&&bd<=(r.gateName?11:7)) gates.push({
      name:(function(){
        let nm=r.gateName||
          (r.name.replace(/^The /,"").replace(/ (Way|Road|Street|Lane)$/,"")+" Gate");
        /* two roads can lead to the same place by different ways; the gates cannot
           both be called after it, so the second takes its compass instead */
        if(gates.some(g=>g.name===nm)) nm=compassOf(r.bearing)+" Gate";
        let n=2, base=nm;
        while(gates.some(g=>g.name===nm)) nm=base+" "+(n++);
        return nm;
      })(),
      p:pick.p, bearing:r.bearing, road:r.name, turn:r.turn||null, arrives:r.arrives,
      shares:r.shares||null,
      uses:r.road?r.road.uses:null, to:r.road?r.road.to:null});
  });
  return {ring:pts, towers:towers, gates:gates, ringIndex:wk, radius:target,
    label:label||null, open:arc.length<ring.length};
}

/* ===================================================================================
   10. THE NAMED GROUND
   ---------------------------------------------------------------------------------
   Every entry below is anchored to something the export said. The berths are named for
   the markets that have no overland way to Oem'rek; the cisterns exist because no cell
   within reach carries a river; the citadel sits on the bearing of the highest
   neighbouring cell; the pans and the tanneries sit on the bearing of the wetland.
   =================================================================================== */
function buildLandmarks(site,water,plan,wall,S,inner){
  if(plan.archetype==="crossing")
    return landmarksCrossing(site,water,plan,wall,inner,S,doctrineOf(site));
  const L=[], st=plan.staple;
  /* A bearing struck from the market does not always land on ground: the Staple sits on
     the quay, so anything set to the seaward side of it falls in the harbour. Rotate
     round until the ground is there — a building goes where there is room for it. */
  const dry=p=>water.room(p)>S.quayClear*1.2&&water.townside(p);
  const at=(bearing,r)=>{
    const first=add(st,vec(bearing,r));
    if(dry(first)) return first;
    for(let step=7;step<=170;step+=7){
      for(const dir of [1,-1]){
        const p=add(st,vec(bearing+dir*step,r));
        if(dry(p)) return p;
      }
    }
    /* nowhere at that radius: pull it in toward the market instead */
    for(let k=0.85;k>0.15;k-=0.1){
      const p=add(st,vec(bearing,r*k));
      if(dry(p)) return p;
    }
    return first;
  };
  const put=(name,kind,p,note)=>L.push({name:name,kind:kind,p:p,note:note});
  const days=mi=>Math.round(mi/M.supplyDivisor);

  const seaOnlyPop=site.seaOnly.reduce((n,m)=>n+m.pop,0);
  const biggestSeaOnly=site.seaOnly[0];
  const nearestLand=site.overland[0];
  /* "the largest market it can reach" has to mean reach in a season a merchant would
     actually spend: past about 180 days the cost stops being a trade and starts being
     an expedition. */
  const TRADE_DAYS=180;
  const richestLand=site.overland.filter(m=>m.cost/M.supplyDivisor<=TRADE_DAYS)
    .sort((a,b)=>b.pop-a.pop)[0];
  const mainRoad=site.roads[0];

  /* --- the water --- */
  put("The Chain Towers","harbour",water.quayAt(0.955,S.quayDepth*0.4),
    "Two towers and a chain across the only entrance. This cell touches the sea at "+
    "exactly one place — harbour value "+site.harbour+" — which is what makes the "+
    "place a haven and not a beach: one mouth to close, and nothing to be blown "+
    "through.");
  put("The Long Quay","harbour",water.quayAt(plan.quayU,S.quayDepth*0.35),
    "The principal quay, on the lee shore of the basin. Everything the province sells "+
    "leaves from here, because the alternative is "+
    (nearestLand?Math.round(nearestLand.cost).toLocaleString()+" effective miles of "+
      "road to "+nearestLand.name+", "+days(nearestLand.cost)+" days with a waggon":
      "no road at all")+".");
  if(biggestSeaOnly)
    put("The "+biggestSeaOnly.name+" Stair","harbour",water.quayAt(0.72,S.quayDepth*0.35),
      "Berths kept for the "+biggestSeaOnly.name+" packet. "+
      biggestSeaOnly.pop.toLocaleString()+" people in "+biggestSeaOnly.state+
      " — this city's own realm — and no overland way to them whatever. This stair is "+
      "the entire connection between the two halves of "+site.state+".");
  if(site.seaOnly.length>1)
    put("The Outer Berths","harbour",water.quayAt(0.86,S.quayDepth*0.35),
      "For the trades that exist only because the sea does: "+
      site.seaOnly.map(m=>m.name).join(", ")+" — "+seaOnlyPop.toLocaleString()+
      " people between them, not one of them reachable on wheels.");
  put("The Custom House","civic",water.quayAt(plan.quayU-0.06,S.quayDepth+80),
    "Where the staple duty is taken. The province of "+site.province+" is assessed on "+
    "what passes this door.");
  put("The Bonded Sheds","store",water.quayAt(plan.quayU+0.11,S.quayDepth+110),
    "Warehousing held against duty, on ground won from behind the quay. Laid out "+
    "square — the one planned quarter in the city, which is what makes the rest of it "+
    "read as unplanned.");
  put("The Shipwrights' Head","yard",water.quayAt(0.085,S.quayDepth*0.7),
    "Slips, a careening beach and the timber ponds, at the dead end of the basin where "+
    "the water is stillest and no cargo wants to be.");
  put("The Ropewalk","yard",water.quayAt(0.21,S.quayDepth+150),
    "A quarter of a mile of shed, dead straight, because rope is laid straight.");
  put("The Lazaretto","harbour",add(water.spit[9],mul(water.cityN,-190)),
    "Quarantine, on the spit, outside everything else. A port that is the only sea "+
    "road into half a realm cannot afford to guess about a ship.");
  put("The Beacon","harbour",water.spit[water.spit.length-1],
    "On the point of the sheltering spit, at the mouth.");
  put("The Fish Strand","harbour",
    add(water.coastOf(-S.basinLength*0.85),mul(water.n,-S.quayClear*4)),
    "The beach on the open shore, outside the wall. The cell next door west has five "+
    "sea contacts and no shelter at all — that coast lands fish and nothing else.");

  /* --- the market --- */
  put("The Staple","staple",st,
    "The great market, set where the "+
    (mainRoad&&mainRoad.to?"road from "+mainRoad.to:"land road")+
    " reaches the quay. "+site.catchCells+" cells and "+
    site.catchPop.toLocaleString()+" people are assigned to this market by the "+
    "travel-cost surface, and all of it is bought and sold on this square.");
  put("The Weigh House","staple",at(site.seaBearing+150,S.stapleR*1.6),
    "Public beam and standard measures, on the market's landward side.");
  put("The Exchange","civic",at(site.seaBearing+205,S.stapleR*1.7),
    "Where freights are taken. A port whose hinterland is "+
    site.catchPop.toLocaleString()+" people and whose sister city cannot be reached by "+
    "land prices risk more often than it prices goods.");
  if(nearestLand)
    put("The "+nearestLand.name+" Factory","merchant",at(site.seaBearing+178,S.stapleR*2.6),
      nearestLand.name+" keeps its house here: "+
      Math.round(nearestLand.cost).toLocaleString()+" effective miles of road, "+
      days(nearestLand.cost)+" days with a waggon. The nearest market of any size "+
      "that can be reached without a hull.");
  if(richestLand&&richestLand!==nearestLand)
    put("The "+richestLand.name+" Factory","merchant",at(site.seaBearing+232,S.stapleR*2.7),
      richestLand.pop.toLocaleString()+" people at "+
      Math.round(richestLand.cost).toLocaleString()+" effective miles — "+
      days(richestLand.cost)+" days off. The largest market this city can reach over "+
      "land inside a trading season, and it is most of one.");
  put("The Corn Market","store",at(site.seaBearing+160,S.coreR*1.2),
    "Grain reaches this city by sea and by the "+
    (mainRoad&&mainRoad.to?mainRoad.to+" road":"land road")+
    ", never down a river, because there is no river: r=0 on this cell and on every "+
    "cell that touches it.");

  /* --- water, which this site has none of --- */
  put("The Great Cisterns","civic",
    at(site.riseBearing!=null?site.riseBearing-26:120,S.coreR*1.3),
    "Roofed rain, under the whole of this quarter. No river runs within reach of the "+
    "city, so every drop it drinks has either fallen on it or been carried to it.");
  put("The Conduit Head","civic",
    at(site.riseBearing!=null?site.riseBearing:110,S.wallR*1.24),
    "The spring on the rise — height "+(site.riseHeight!=null?site.riseHeight:site.height)+
    " against "+site.height+" at the quay. The fall is small, so the conduit is long "+
    "and slow and jealously kept.");

  /* --- the state --- */
  put("The Citadel","garrison",
    at(site.riseBearing!=null?site.riseBearing+18:100,S.wallR*0.84),
    "On the highest ground the site has, which is not much: "+
    (site.riseHeight!=null?site.riseHeight:site.height)+" against "+site.height+
    " at the water. It watches the mouth, not the landward road.");
  put("The High Temple","civic",at(site.seaBearing+196,S.coreR*0.66),
    "Of the "+site.culture.toLowerCase()+", who hold this coast.");
  put("The Province Hall","civic",at(site.seaBearing+218,S.stapleR*2.2),
    "Where "+site.province+" is governed from, under "+site.state+".");

  /* --- what a city puts downwind of itself --- */
  if(site.marshBearing!=null){
    put("The Tanners' Row","noxious",at(site.marshBearing-11,S.wallR*1.2),
      "Outside the wall, on the marsh side. The neighbouring cell that way is Wetland; "+
      "the city put everything that stinks between itself and it.");
    put("The Dye Yards","noxious",at(site.marshBearing+17,S.wallR*1.29),
      "Beside the tanners, for the same reason and out of the same water.");
    put("The Salt Pans","noxious",at(site.marshBearing+3,S.reach*0.92),
      "Cut into the wetland. The one thing this marsh is good for, and the reason the "+
      "fish that leaves here keeps long enough to be worth shipping.");
    put("The Fever Ground","civic",at(site.marshBearing-34,S.wallR*1.36),
      "Burial. Downwind of the city and downhill of the cisterns, which is the only "+
      "decision on this sheet everybody agreed with.");
  }

  /* --- the roads out --- */
  if(mainRoad)
    put("The Waggon Yards","waggon",at(mainRoad.bearing,S.wallR*1.22),
      "Outside the "+(mainRoad.to||"land")+" gate: standings, inns and the beasts. "+
      "That road carries "+mainRoad.uses+" of the "+A.data.report.market_pairs+
      " market pairs on the sheet, and it is the busiest thing that arrives here on "+
      "wheels.");
  const compass=d=>{
    const names=["east","south-east","south","south-west","west","north-west","north",
      "north-east"];
    return names[(Math.round(((d%360)+360)%360/45))%8];
  };
  wall.gates.forEach(g=>{
    let note=g.to?("The road to "+g.to+", carrying "+g.uses+" market pairs of the "+
      A.data.report.market_pairs+" on the sheet."):"A gate of the wall.";
    if(g.turn) note+=" It arrives from the "+compass(g.arrives)+
      ", which is straight across the harbour, so it leaves by this gate and turns "+
      "outside the wall.";
    (g.shares||[]).forEach(r=>{
      note+=" "+r.name+" leaves here too";
      note+=r.turn?(", turning outside the wall — it runs to the "+compass(r.arrives)+
        ", and there is a harbour in the way."):".";
    });
    put(g.name,"gate",g.p,note);
  });

  return L;
}

/* ===================================================================================
   11. PUTTING IT TOGETHER
   =================================================================================== */
/* The plate is grown until the ground it covers actually houses the population at
   the density the rules state. A first guess treats the town as a disc, which it is
   not — the harbour and the far shore take most of one, and the suburbs are ribbons —
   so the guess comes out about twice too dense. Each pass measures what it built and
   scales the next one by the square root of how far out it was, which settles in two
   or three. */
function generate(cell,opts){
  const site=siteOf(cell);
  if(!site.name||site.seaBearing==null) return null;
  /* The disc the first guess assumes is roughly half harbour, far shore and ribbon,
     so start it out by the square root of that rather than discovering it twice. */
  let spread=Math.sqrt(site.pop/DENSITY.inner*10000/Math.PI)*1.45;
  let out=null;
  for(let pass=0;pass<3;pass++){
    out=buildCity(site,spread,opts);
    const d=out.stats.densityInside;
    if(!isFinite(d)||d<=0) break;
    const k=Math.sqrt(d/DENSITY.inner);
    out.stats.passes=pass+1;
    if(Math.abs(k-1)<0.05) break;
    spread*=Math.min(1.5,Math.max(0.72,k));
  }
  return out;
}

function buildCity(site,spread,opts){
  const arche=archetypeOf(site), doctrine=doctrineOf(site);
  /* A port is cut round an enclosed haven; a crossing has a coast rather than a
     harbour — two sea contacts and no shelter — so it gets a shallow bight set out at
     the edge of the plate instead of a basin driven through the middle of it. */
  const sea=arche==="crossing"?{
    openCoast:true,
    basinLength:spread*0.18, basinWidth:spread*0.26, basinHeadWidth:spread*0.19,
    throat:spread*0.02, spitWidth:spread*0.04, coastOffset:spread*0.12,
    waterOrigin:vec(site.seaBearing,spread*0.95)
  }:{
    openCoast:false,
    basinLength:spread*1.55, basinWidth:spread*0.30, basinHeadWidth:spread*0.10,
    throat:spread*0.15, spitWidth:spread*0.16, coastOffset:spread*0.30,
    waterOrigin:[0,0]
  };
  const S=Object.assign({
    spread:spread, archetype:arche,
    quayDepth:34, quayClear:26, wharfDepth:150,
    stapleR:spread*0.115, coreR:spread*0.42, wallR:spread*0.96, reach:spread*1.66,
    ring0:spread*0.055, ringGap:86, ringFlare:0.030,
    /* the crossing's own figures */
    sacredR:spread*0.96*(doctrine?doctrine.sacredShare:0.4),
    corridorClear:1.42,        /* how close the way may come to the precinct */
    corridorHalf:112           /* half the width of the way and its yards */
  },sea,opts||{});

  const rnd=rng(site.cell*2654435761);
  const water=buildWater(site,rnd,S);
  const plan=buildPlan(site,water,rnd,S);
  const mesh=buildBlocks(site,water,plan,S);

  /* --- where the wall goes -------------------------------------------------------
     The ground is laid out first with no suburbs thinned, the people are spread over
     it, and the wall is then drawn at the radius enclosing the intramural share of
     them. Because the ground on one side is harbour and the ground on the other is the
     far shore the town never built on, that radius traces the site rather than a
     circle: the wall reaches further inland than it does along the water. */
  (function solveWall(){
    const trial=assignUses(clipToLand(mesh.blocks.map(b=>({poly:b.poly.slice(),
      ring:b.ring, theta:b.theta, r:b.r})),water,plan,S,site,true),
      site,water,plan,S,rnd);
    housePeople(trial,site,plan,S);
    trial.sort((a,b)=>len(sub(a.c,plan.staple))-len(sub(b.c,plan.staple)));
    const want=site.pop*INTRAMURAL;
    let people=0, edge=plan.rings[3]||S.wallR;
    for(const b of trial){
      people+=b.people;
      edge=len(sub(b.c,plan.staple));
      if(people>=want) break;
    }
    S.wallR=Math.max(plan.rings[3]||edge,Math.min(edge,S.reach*0.70));
    S.coreR=S.wallR*0.44;
    S.sacredR=S.wallR*(doctrine?doctrine.sacredShare:0.4);
    plan.recut();          /* the through-way is hung on the wall, so it moves with it */
  })();

  const blocks=assignUses(clipToLand(mesh.blocks,water,plan,S,site),
    site,water,plan,S,rnd);
  const split=housePeople(blocks,site,plan,S);
  const wall=buildWall(mesh,plan.rings,plan.rays,water,S,S.wallR,"outer");
  /* under an interdict the precinct has a wall of its own, with posterns and no gates
     a waggon could use */
  let inner=null;
  if(arche==="crossing"&&doctrine){
    const posterns=[
      {bearing:plan.gW,name:"The West Postern",gateName:"The West Postern",kind:"gate"},
      {bearing:plan.gE,name:"The East Postern",gateName:"The East Postern",kind:"gate"},
      {bearing:site.seaBearing,name:"The Water Postern",gateName:"The Water Postern",
        kind:"gate"}
    ];
    inner=buildWall(mesh,plan.rings,posterns,water,S,S.sacredR,"interdict");
  }
  const streets=streetsFrom(mesh,plan.rings,plan.rays,plan,S,water,blocks)
    .filter(s=>s.pts.length>1);
  const landmarks=buildLandmarks(site,water,plan,wall,S,inner);

  let roofed=0, floor=0, area=0, inWall=0;
  const byUse={};
  blocks.forEach(b=>{
    roofed+=b.roofed; floor+=b.floor; area+=b.area;
    if(len(sub(b.c,plan.staple))<S.wallR) inWall+=b.area;
    const u=byUse[b.use]||(byUse[b.use]={blocks:0,area:0,people:0,floor:0});
    u.blocks++; u.area+=b.area; u.people+=b.people; u.floor+=b.floor;
  });
  let quayM=0;
  for(let i=1;i<plan.quayPts.length;i++) quayM+=len(sub(plan.quayPts[i],plan.quayPts[i-1]));

  /* the account of a crossing is about the road, so count what stands on it */
  let sacredHa=0, wayHa=0, wayPeople=0, wardPeople=0;
  if(plan.archetype==="crossing"){
    blocks.forEach(b=>{
      if(b.sacred) sacredHa+=b.area/10000;
      if(b.onWay){ wayHa+=b.area/10000; wayPeople+=b.people; }
      if(b.use==="ward") wardPeople+=b.people;
    });
  }

  return {
    site:site, S:S, water:water, plan:plan, wall:wall, inner:inner, streets:streets,
    blocks:blocks, landmarks:landmarks, byUse:byUse,
    archetype:plan.archetype, doctrine:doctrine,
    stats:{
      population:site.pop, inside:split.inside, outside:split.outside,
      blocks:blocks.length, streets:streets.length, landmarks:landmarks.length,
      areaHa:area/10000, wallHa:inWall/10000,
      roofedHa:roofed/10000, floorHa:floor/10000,
      densityInside:split.inside/(inWall/10000||1),
      densityOutside:split.outside/(((area-inWall)/10000)||1),
      wallGates:wall.gates.length, wallTowers:wall.towers.length, quayM:quayM,
      sacredHa:sacredHa, wayHa:wayHa, wayPeople:wayPeople, wardPeople:wardPeople,
      corridorM:plan.corridorLength||0, gateGapM:plan.gateGap||0,
      detour:plan.detour||1, innerGates:inner?inner.gates.length:0
    }
  };
}

A.city={ siteOf:siteOf, generate:generate, rng:rng, DENSITY:DENSITY, USES:USES,
  ST_WIDTH:ST_WIDTH, FRONTAGE:FRONTAGE, DOCTRINE:DOCTRINE,
  archetypeOf:archetypeOf, doctrineOf:doctrineOf, corridorDist:corridorDist,
  _geom:{vec,add,sub,mul,len,norm,dot,lerp,polyArea,centroid,D2R,hash2} };
})();
