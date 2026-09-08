/* ===================================================================================
   Adrinem — contingency projections. The survey sheet runs six hazards across a city
   over twenty-four hours and scores every site twice: what the event broke, and what
   stopped working because something else broke. This is the same engine at a different
   scale — a continent over twelve months — and the second half of it is the point here
   just as it is there.

   What breaks first is cells: ground burnt, drowned, emptied or unmade. What breaks
   second is the network. A cell struck hard enough is closed to traffic, and the router
   is then run again over what is left — the same router that reproduces the exported
   figures to within 0.006 per cent. Out of that come the things a realm would actually
   notice: markets that can no longer reach each other, ground that has lost the market
   that fed it, and how many more days the food now has to travel.

   Nothing here is a prediction. The vulnerabilities are invented to be plausible and
   internally consistent; where a figure is chosen rather than read, it is in a table at
   the top of this file with a name on it.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const C=A.cells, M=A.meta, D=A.data;
const MONTHS=12;

/* ---- the five states a piece of ground can be in --------------------------------- */
const STATES=[["LOST",.80,"#6E1A1A"],["STRICKEN",.55,"#8F2222"],["HARMED",.32,"#C4472A"],
              ["TOUCHED",.14,"#E08A24"],["HELD",0,"#3F6B3A"]];
const stateIndex=f=>{ for(let i=0;i<STATES.length;i++) if(f>=STATES[i][1]) return i;
  return STATES.length-1; };
const stateOf=f=>STATES[stateIndex(f)][0];
const stateColour=f=>STATES[stateIndex(f)][2];
/* Ground this badly hurt no longer carries traffic — but only where the hazard is the
   kind that blocks a road. A drought does not close a road; it makes it easier. A
   pestilence does not close one either, which is exactly why it travels. So each
   hazard declares it, and the two that do not are the two whose damage is all in the
   second order. */
const CLOSED_AT=0.62;
/* and a market centre this badly hurt stops being a market: its catchment has to find
   another one or go without */
const MARKET_DOWN_AT=0.55;

/* ===================================================================================
   HOW EACH KIND OF GROUND TAKES IT
   ---------------------------------------------------------------------------------
   Two tables, both invented. FLAM is how readily a biome carries fire; DRY is how
   badly it suffers when the water stops. Marine and Glacier are in both so nothing has
   to special-case them.
   =================================================================================== */
const FLAM={
  "Glacier":0, "Marine":0, "Snowy":.06, "Wetland":.16, "Tropical rainforest":.22,
  "Temperate rainforest":.26, "Dragon Tundra":.22, "Hot desert":.26, "Cold desert":.30,
  "Coastal":.34, "Barrens":.32, "Volcanic":.42, "Blood Fields":.50, "Glades":.60,
  "Temperate deciduous forest":.66, "Taiga":.70, "Tropical seasonal forest":.72,
  "Grassland":.80, "Savanna":.86, "Dead Forrest":.96
};
const DRY={
  "Glacier":.05, "Marine":0, "Snowy":.20, "Tropical rainforest":.22,
  "Temperate rainforest":.16, "Dragon Tundra":.40, "Taiga":.34, "Coastal":.40,
  "Temperate deciduous forest":.46, "Tropical seasonal forest":.52, "Glades":.50,
  "Wetland":.56, "Blood Fields":.60, "Volcanic":.62, "Grassland":.70,
  "Dead Forrest":.72, "Savanna":.80, "Barrens":.86, "Cold desert":.90, "Hot desert":.95
};
/* what a people can do about the supernatural. Also invented, also stated. */
const WARD={ "ANGELS":.45, "GODLINGS":.30, "DRAGON RIDGERS":.55, "DEMONS":.15,
  "SHIFTERS":.20, "HUMANS":0, "HALFLINGS":.05, "Wildlands":0 };

const flamOf=i=>FLAM[A.biomeOf(i).name]!=null?FLAM[A.biomeOf(i).name]:.5;
const dryOf=i=>DRY[A.biomeOf(i).name]!=null?DRY[A.biomeOf(i).name]:.5;
const wardOf=i=>WARD[A.cultureOf(i)]||0;

/* ===================================================================================
   THE HAZARDS
   =================================================================================== */
const HAZARDS=[
 {id:"drought", closes:false, kind:"natural", name:"Long drought", short:"DROUGHT",
  point:false, focus:0,
  blurb:"No point to place: the rain simply does not come. What decides the damage is "+
        "what the ground was already living on — the biome, the flux the export gives "+
        "each cell, and whether a river runs through it. The deserts barely notice. "+
        "The wetlands are ruined.",
  params:[
   {id:"severity",label:"SEVERITY",min:1,max:5,step:1,val:3},
   {id:"onset",   label:"ONSET",min:1,max:8,step:1,val:3,unit:" mo"},
   {id:"rivers",  label:"RIVERS FAIL TOO",min:0,max:1,step:1,val:1,onoff:true}]},

 {id:"spate", closes:true, kind:"natural", name:"River spate", short:"SPATE",
  point:true, focus:2.2, pointLabel:"HEADWATER",
  blurb:"One river comes down. It runs by its own id through the cells the export "+
        "gives it, carrying its flux, and takes the low ground either side with it. "+
        "The cells it drowns are the flattest and most peopled on the sheet, because "+
        "that is where rivers put them.",
  params:[
   {id:"crest", label:"CREST",min:1,max:5,step:1,val:3},
   {id:"spread",label:"OUT OF BANK",min:0,max:3,step:1,val:1,unit:" cells"},
   {id:"months",label:"IN SPATE",min:1,max:6,step:1,val:2,unit:" mo"}]},

 {id:"plague", closes:false, kind:"natural", name:"Pestilence", short:"PLAGUE",
  point:true, focus:2, pointLabel:"FIRST CASE",
  blurb:"The only hazard on this sheet that travels the way trade does. It moves out "+
        "along the least-cost network at a stated number of effective miles a month, "+
        "so the places it reaches first are the places the roads were built to reach — "+
        "and the ground beyond every market's reach may never see it at all.",
  params:[
   {id:"speed",    label:"TRAVELS",min:200,max:2000,step:100,val:800,unit:" mi/mo"},
   {id:"mortality",label:"MORTALITY",min:5,max:60,step:5,val:25,unit:" %"},
   {id:"quarantine",label:"QUARANTINE",min:0,max:1,step:1,val:0,onoff:true}]},

 {id:"firestorm", closes:true, kind:"natural", name:"Firestorm", short:"FIRE",
  point:true, focus:2.4, pointLabel:"IGNITION",
  blurb:"Fire moves with the wind, stops at water, and moves at the speed the ground "+
        "will carry it. The Dead Forrest carries it almost perfectly; a rainforest "+
        "barely carries it at all.",
  params:[
   {id:"wind",   label:"WIND",min:0,max:90,step:5,val:40,unit:" km/h"},
   {id:"bearing",label:"WIND FROM",min:0,max:315,step:45,val:270,bearing:true},
   {id:"dry",    label:"DRYNESS",min:10,max:100,step:5,val:70,unit:" %"}]},

 {id:"dragon", closes:true, kind:"supernatural", name:"A dragon out of the Coves", short:"DRAGON",
  point:true, focus:2, pointLabel:"WHERE IT LIFTS",
  blurb:"It does not spread; it goes somewhere. A line laid across the sheet on a "+
        "bearing, of a stated reach and breadth, burning what it crosses and leaving "+
        "everything to either side alone. The Dragon Ridgers know how to answer one "+
        "and almost nobody else does.",
  params:[
   {id:"bearing",label:"IT FLIES",min:0,max:315,step:45,val:90,bearing:true},
   {id:"reach",  label:"REACH",min:200,max:3000,step:100,val:1200,unit:" mi"},
   {id:"wing",   label:"BREADTH",min:1,max:5,step:1,val:2,unit:" cells"},
   {id:"passes", label:"PASSES",min:1,max:6,step:1,val:3}]},

 {id:"blood", closes:true, kind:"supernatural", name:"The blood tide", short:"BLOOD",
  point:true, focus:1.6, pointLabel:"WHERE IT RISES",
  blurb:"Ground stops being what it was. It creeps cell to cell, faster over what is "+
        "already dead or already Blood Fields, slower uphill, and a people with a "+
        "ward against it holds longer. Nothing it takes comes back inside the year.",
  params:[
   {id:"rise",  label:"RISE",min:1,max:5,step:1,val:3},
   {id:"reach", label:"REACH",min:1,max:12,step:1,val:6,unit:" cells/mo"},
   {id:"uphill",label:"CLIMBS",min:0,max:1,step:1,val:0,onoff:true}]},

 {id:"riving", closes:true, kind:"supernatural", name:"A riving of the land", short:"RIVING",
  point:true, focus:1.4, pointLabel:"WHERE IT OPENS",
  blurb:"The sheet's own worst case, because it is the one the network cannot route "+
        "around. A line of ground ceases to be ground. Everything either side of it is "+
        "unharmed and may now be unreachable — which is the whole argument of the "+
        "world sheet, run backwards.",
  params:[
   {id:"bearing",label:"IT OPENS",min:0,max:315,step:45,val:0,bearing:true},
   {id:"length", label:"LENGTH",min:200,max:3000,step:100,val:1400,unit:" mi"},
   {id:"width",  label:"WIDTH",min:1,max:4,step:1,val:1,unit:" cells"},
   {id:"flood",  label:"THE SEA COMES IN",min:0,max:1,step:1,val:1,onoff:true}]}
];
const hazardById=id=>HAZARDS.find(h=>h.id===id);

/* ===================================================================================
   THE RUN
   =================================================================================== */
function run(spec){
  const H=hazardById(spec.hazard);
  if(!H) return null;
  A.build();
  const N=A.count, p=spec.params||{};
  const dmg=new Float32Array(N);
  const drowned=new Uint8Array(N);        /* ground that is not ground any more */
  const frames=[], events=[];
  const note=(t,text,kind)=>events.push({t:t,text:text,kind:kind||"note"});
  const bearingVec=d=>[Math.cos(d*Math.PI/180),Math.sin(d*Math.PI/180)];
  const at=spec.point!=null?spec.point:-1;
  const dist=(i,j)=>Math.hypot(C.x[i]-C.x[j],C.y[i]-C.y[j])*M.scale;

  /* ---- set-up: everything a hazard needs worked out once ------------------------- */
  const ctx={};
  if(H.id==="plague"&&at>=0){
    /* the network's own distances, so the thing travels the way trade does */
    ctx.reach=A.route.from(at).dist;
    note(0,"First case at "+placeName(at)+".","start");
  }
  if(H.id==="spate"&&at>=0){
    ctx.river=C.riv[at];
    ctx.stem=[];
    for(let i=0;i<N;i++) if(C.riv[i]&&C.riv[i]===ctx.river) ctx.stem.push(i);
    if(!ctx.stem.length){ /* not on a river: take the biggest one within reach */
      let best=-1; const bag=[]; A.near(C.x[at],C.y[at],80,bag);
      bag.forEach(j=>{ if(C.riv[j]&&(best<0||C.flux[j]>C.flux[best])) best=j; });
      if(best>=0){ ctx.river=C.riv[best];
        for(let i=0;i<N;i++) if(C.riv[i]===ctx.river) ctx.stem.push(i); }
    }
    note(0,ctx.stem.length?("River "+ctx.river+" rises — "+ctx.stem.length+
      " cells carry it."):"No river runs within reach of that point.","start");
  }
  if((H.id==="dragon"||H.id==="riving")&&at>=0){
    const v=bearingVec(p.bearing||0);
    ctx.line={x:C.x[at],y:C.y[at],vx:v[0],vy:v[1],
      len:(H.id==="dragon"?p.reach:p.length)/M.scale};
    note(0,(H.id==="dragon"?"It lifts from ":"The ground opens at ")+placeName(at)+
      ", running "+compass(p.bearing||0)+".","start");
  }
  if(H.id==="blood"&&at>=0){ dmg[at]=1; note(0,"It rises at "+placeName(at)+".","start"); }
  if(H.id==="firestorm"&&at>=0){ dmg[at]=1; note(0,"Ignition at "+placeName(at)+".","start"); }
  if(H.id==="drought") note(0,"The rains fail across the sheet.","start");

  /* ---- twelve months ------------------------------------------------------------- */
  for(let mo=1;mo<=MONTHS;mo++){
    step(H,mo,dmg,drowned,p,ctx,at,dist,bearingVec,note);
    frames.push(snapshot(dmg,drowned,mo));
  }

  /* ---- what it took directly ------------------------------------------------------ */
  const report=direct(dmg,drowned,H,note);
  /* ---- and what stopped working because of it ------------------------------------ */
  report.network=network(dmg,drowned,H,note);
  narrate(report,H,p,at);
  events.sort((a,b)=>a.t-b.t);

  return {hazard:H, spec:spec, months:MONTHS, frames:frames, events:events,
    report:report, point:at, closed:report.network.closedList};
}

/* ---- one month ------------------------------------------------------------------- */
function step(H,mo,dmg,drowned,p,ctx,at,dist,bearingVec,note){
  const N=A.count;
  const bump=(i,v)=>{ if(v>dmg[i]) dmg[i]=Math.min(1,v); };

  if(H.id==="drought"){
    const bite=Math.min(1,Math.max(0,(mo-(p.onset||3)+1)/5))*(p.severity/5)*0.78;
    if(bite<=0) return;
    for(let i=0;i<N;i++){
      if(!A.isLand(i)) continue;
      let f=dryOf(i)*bite;
      /* a river or a good flux carries a cell a long way through a dry year */
      if(C.riv[i]&&!p.rivers) f*=0.30;
      else if(C.riv[i]) f*=0.62;
      f*=1-Math.min(0.45,C.flux[i]/900);
      bump(i,f);
    }
    if(mo===(p.onset||3)) note(mo,"The rains have not come. The dry ground goes first.","loss");
  }

  else if(H.id==="spate"){
    if(mo>(p.months||2)) return;
    const crest=(p.crest||3)/5;
    const front=new Set(ctx.stem||[]);
    (ctx.stem||[]).forEach(i=>{
      bump(i,Math.min(1,crest*(0.55+Math.min(0.6,C.flux[i]/500))));
    });
    /* out of bank: the low ground either side */
    let ring=new Set(front);
    for(let k=0;k<(p.spread||1);k++){
      const next=new Set();
      ring.forEach(i=>A.neighboursOf(i).forEach(j=>{
        if(!A.isLand(j)||front.has(j)) return;
        const drop=Math.max(0,C.h[i]-C.h[j]+4)/22;     /* it goes downhill */
        bump(j,crest*(0.45-k*0.12)*(0.4+Math.min(1,drop)));
        next.add(j); front.add(j);
      }));
      ring=next;
    }
    if(mo===1) note(1,"The river is out of its banks.","loss");
  }

  else if(H.id==="plague"){
    if(!ctx.reach) return;
    const front=(p.speed||800)*mo*(p.quarantine?0.55:1);
    const lethal=(p.mortality||25)/100;
    for(let i=0;i<A.count;i++){
      if(!A.isLand(i)||!isFinite(ctx.reach[i])||ctx.reach[i]>front) continue;
      /* it is a disease of people: empty ground barely registers it */
      const crowd=Math.min(1,(C.pop[i]/9000)+(A.burgOf(i)?0.5:0));
      const age=Math.min(1,(front-ctx.reach[i])/900);
      bump(i,lethal*1.9*crowd*age);
    }
    if(mo===1) note(1,"It is out of the first town and on the road.","loss");
    if(mo===6) note(6,"It has run as far as the network reaches.","note");
  }

  else if(H.id==="firestorm"){
    const wind=bearingVec(p.bearing||0), sp=(p.wind||40), dryf=(p.dry||70)/100;
    const jump=1+Math.floor(sp/28);
    for(let k=0;k<jump;k++){
      const lit=[];
      for(let i=0;i<A.count;i++) if(dmg[i]>0.25&&A.isLand(i)) lit.push(i);
      lit.forEach(i=>{
        A.neighboursOf(i).forEach(j=>{
          if(!A.isLand(j)) return;                       /* fire stops at water */
          const dx=C.x[j]-C.x[i], dy=C.y[j]-C.y[i], l=Math.hypot(dx,dy)||1;
          /* downwind is where it goes; upwind it creeps */
          const with_=(dx/l)*(-wind[0])+(dy/l)*(-wind[1]);
          const p2=flamOf(j)*dryf*(0.30+0.70*Math.max(0,with_));
          if(p2>0.12) bump(j,Math.min(1,dmg[i]*0.92*p2*2.1));
        });
      });
    }
    if(mo===2) note(2,"The fire has taken the wind.","loss");
  }

  else if(H.id==="dragon"){
    if(!ctx.line||mo>(p.passes||3)) return;
    const L=ctx.line, wing=(p.wing||2)*A.spacing;
    for(let i=0;i<A.count;i++){
      if(!A.isLand(i)) continue;
      const rx=C.x[i]-L.x, ry=C.y[i]-L.y;
      const along=rx*L.vx+ry*L.vy;
      if(along<0||along>L.len) continue;
      const off=Math.abs(rx*(-L.vy)+ry*L.vx);
      if(off>wing) continue;
      const bite=(1-off/wing)*(1-0.25*along/L.len)*(0.55+0.45*flamOf(i));
      bump(i,Math.min(1,dmg[i]+bite*(1-wardOf(i))));
    }
    if(mo===1) note(1,"It has made its first pass.","loss");
    if(mo===(p.passes||3)) note(mo,"It does not come back.","note");
  }

  else if(H.id==="blood"){
    const rise=(p.rise||3)/5;
    for(let k=0;k<(p.reach||6);k++){
      const edge=[];
      for(let i=0;i<A.count;i++) if(dmg[i]>0.4&&A.isLand(i)) edge.push(i);
      edge.forEach(i=>A.neighboursOf(i).forEach(j=>{
        if(!A.isLand(j)||dmg[j]>0.9) return;
        const nm=A.biomeOf(j).name;
        let take=rise*(nm==="Blood Fields"||nm==="Dead Forrest"?1.4:
                       nm==="Glades"?0.45:1);
        if(!p.uphill&&C.h[j]>C.h[i]) take*=0.35;        /* it runs downhill */
        take*=1-wardOf(j);
        if(take>0.05) bump(j,Math.min(1,dmg[i]*0.95*take*1.6));
      }));
    }
    if(mo===3) note(3,"It is no longer contained by the ground it started on.","loss");
  }

  else if(H.id==="riving"){
    if(!ctx.line||mo>2) return;
    const L=ctx.line, wide=(p.width||1)*A.spacing*0.7;
    for(let i=0;i<A.count;i++){
      if(!A.isLand(i)) continue;
      const rx=C.x[i]-L.x, ry=C.y[i]-L.y;
      const along=rx*L.vx+ry*L.vy;
      if(along<0||along>L.len) continue;
      const off=Math.abs(rx*(-L.vy)+ry*L.vx);
      if(off>wide) continue;
      dmg[i]=1;
      if(p.flood) drowned[i]=1;
    }
    if(mo===1) note(1,p.flood?"The sea is in it.":"The ground has opened.","loss");
  }
}

/* ---- a month's picture, small enough to keep twelve of ---------------------------- */
function snapshot(dmg,drowned,mo){
  const st=new Uint8Array(A.count);
  const tally={LOST:0,STRICKEN:0,HARMED:0,TOUCHED:0,HELD:0};
  let dead=0;
  for(let i=0;i<A.count;i++){
    if(!A.isLand(i)){ st[i]=255; continue; }
    const ix=stateIndex(dmg[i]);
    st[i]=ix; tally[STATES[ix][0]]++;
    dead+=C.pop[i]*mortality(dmg[i]);
  }
  return {month:mo, state:st, tally:tally, dead:Math.round(dead),
    drowned:drowned.slice()};
}
/* how much of a cell's people a given amount of damage takes. Invented, and gentle at
   the bottom: ground can be badly hurt without everyone on it dying. */
const mortality=f=>f<=0.14?0:Math.pow((f-0.14)/0.86,1.9)*0.55;

/* ---- what the event took ---------------------------------------------------------- */
function direct(dmg,drowned,H,note){
  const r={byState:{LOST:0,STRICKEN:0,HARMED:0,TOUCHED:0,HELD:0},
    dead:0, landHit:0, burgs:[], markets:[], realms:{}, unmade:0};
  for(let i=0;i<A.count;i++){
    if(!A.isLand(i)) continue;
    const nm=STATES[stateIndex(dmg[i])][0];
    r.byState[nm]++;
    if(dmg[i]>=0.14) r.landHit++;
    if(drowned[i]) r.unmade++;
    r.dead+=C.pop[i]*mortality(dmg[i]);
    if(dmg[i]>=0.32){
      const st=A.stateOf(i);
      r.realms[st]=(r.realms[st]||0)+1;
      const b=A.burgOf(i);
      if(b) r.burgs.push({name:b.name,pop:b.pop,state:st,f:dmg[i],
        market:!!A.marketOf(i)});
    }
  }
  r.dead=Math.round(r.dead);
  r.burgs.sort((a,b)=>b.pop-a.pop);
  r.markets=r.burgs.filter(b=>b.market);
  return r;
}

/* ---- and what stopped working ----------------------------------------------------
   The heart of it. Ground hurt past CLOSED_AT carries no traffic, so the router is run
   again over what is left: one sweep from all seventeen markets for the catchments and
   the supply surface, and seventeen trees for the pairs. The difference against the
   exported figures is the second-order damage. ------------------------------------- */
function network(dmg,drowned,H,note){
  const N=A.count;
  const closed=new Uint8Array(N);
  const closedList=[];
  for(let i=0;i<N;i++)
    if(A.isLand(i)&&(drowned[i]||(H.closes&&dmg[i]>=CLOSED_AT))){
      closed[i]=1; closedList.push(i); }

  const passable=i=>A.isLand(i)&&!closed[i];
  /* A market whose own ground is stricken stops being a market, whether or not the
     roads to it are open. That is how a drought or a pestilence reaches the network:
     not by blocking a road but by emptying the place the road went to. */
  const down=m=>closed[m.cell]||dmg[m.cell]>=MARKET_DOWN_AT;
  const marketCells=D.markets.filter(m=>!down(m)).map(m=>m.cell);
  const lostMarkets=D.markets.filter(down);

  const {dist,owner}=sweep(marketCells,passable);

  let cutOff=0, cutPop=0, wasBeyond=0, daysAdded=0, daysCells=0;
  const lostCatchment={};
  for(let i=0;i<N;i++){
    if(!A.isLand(i)) continue;
    const hadMarket=C.mkt[i]>=0;
    if(!hadMarket){ wasBeyond++; continue; }
    if(closed[i]) continue;                       /* that cell's own trouble is direct */
    if(owner[i]<0||!isFinite(dist[i])){
      cutOff++; cutPop+=C.pop[i];
      const nm=(A.marketOf(C.mkt[i])||{}).name;
      if(nm) lostCatchment[nm]=(lostCatchment[nm]||0)+1;
      continue;
    }
    const add=(dist[i]-C.cost[i])/M.supplyDivisor;
    if(add>0.5){ daysAdded+=add; daysCells++; }
  }

  /* The pairs, counted against the baseline rather than in the abstract. 44 of the 136
     market pairs never had an overland way between them and still do not; reporting
     those as severed would be a lie about what the event did. So only the pairs the
     export gives a cost for are examined, and a pair is severed if either end has
     stopped keeping a market or the ground between them will no longer carry it. */
  const all=D.markets.map(m=>m.cell);
  const reachedBefore=(a,b)=>D.pairs[a+"->"+b]!=null;
  const alive=new Set(marketCells);
  const trees={};
  let pairsBefore=0, pairsNow=0;
  const severed=[];
  for(let x=0;x<all.length;x++) for(let y=x+1;y<all.length;y++){
    const a=all[x], b=all[y];
    if(!reachedBefore(a,b)) continue;
    pairsBefore++;
    if(!alive.has(a)||!alive.has(b)){ severed.push([name(a),name(b)]); continue; }
    if(!trees[a]) trees[a]=treeFrom(a,passable);
    if(isFinite(trees[a][b])) pairsNow++;
    else severed.push([name(a),name(b)]);
  }

  return {closed:closedList.length, closedList:closedList, blocks:!!H.closes,
    lostMarkets:lostMarkets.map(m=>m.name), marketsLeft:marketCells.length,
    pairsBefore:Math.round(pairsBefore), pairsNow:pairsNow,
    severed:severed, cutOff:cutOff, cutPop:Math.round(cutPop),
    lostCatchment:lostCatchment,
    daysAdded:daysCells?daysAdded/daysCells:0, daysCells:daysCells};
  function name(c){ return (A.marketOf(c)||{}).name||("cell "+c); }
}

/* one multi-source sweep, and one tree, both over the ground that is left ----------- */
function heapPush(h,k,v){ h.push([k,v]); let i=h.length-1;
  while(i>0){ const pI=(i-1)>>1; if(h[pI][0]<=h[i][0]) break;
    const t=h[pI]; h[pI]=h[i]; h[i]=t; i=pI; } }
function heapPop(h){ const top=h[0], last=h.pop();
  if(h.length){ h[0]=last; let i=0;
    for(;;){ const l=2*i+1,r=l+1; let s=i;
      if(l<h.length&&h[l][0]<h[s][0]) s=l;
      if(r<h.length&&h[r][0]<h[s][0]) s=r;
      if(s===i) break; const t=h[s]; h[s]=h[i]; h[i]=t; i=s; } }
  return top; }

function sweep(sources,passable){
  const n=A.count, dist=new Float64Array(n).fill(Infinity);
  const owner=new Int32Array(n).fill(-1), done=new Uint8Array(n), h=[];
  sources.forEach(s=>{ dist[s]=0; owner[s]=s; heapPush(h,0,s); });
  while(h.length){
    const [d,u]=heapPop(h);
    if(done[u]) continue; done[u]=1;
    const nb=A.neighboursOf(u);
    for(let i=0;i<nb.length;i++){
      const v=nb[i];
      if(!passable(v)||done[v]) continue;
      const nd=d+A.route.edgeCost(u,v);
      if(nd<dist[v]){ dist[v]=nd; owner[v]=owner[u]; heapPush(h,nd,v); }
    }
  }
  return {dist:dist,owner:owner};
}
function treeFrom(src,passable){
  const n=A.count, dist=new Float64Array(n).fill(Infinity), done=new Uint8Array(n), h=[];
  dist[src]=0; heapPush(h,0,src);
  while(h.length){
    const [d,u]=heapPop(h);
    if(done[u]) continue; done[u]=1;
    const nb=A.neighboursOf(u);
    for(let i=0;i<nb.length;i++){
      const v=nb[i];
      if(!passable(v)||done[v]) continue;
      const nd=d+A.route.edgeCost(u,v);
      if(nd<dist[v]){ dist[v]=nd; heapPush(h,nd,v); }
    }
  }
  return dist;
}

/* ---- the write-up ----------------------------------------------------------------- */
function narrate(r,H,p,at){
  const n=r.network, out=[];
  out.push(r.landHit.toLocaleString()+" land cells of "+
    D.report.land_cells.toLocaleString()+" are touched, "+
    (r.byState.LOST+r.byState.STRICKEN).toLocaleString()+" of them stricken or lost.");
  if(r.dead>0) out.push(r.dead.toLocaleString()+" people are gone.");
  if(r.unmade) out.push(r.unmade+" cells are no longer land at all.");

  const realms=Object.keys(r.realms).sort((a,b)=>r.realms[b]-r.realms[a]).slice(0,3);
  if(realms.length) out.push("It falls hardest on "+realms.join(", ")+".");
  if(r.markets.length) out.push(r.markets.length+" market centre"+
    (r.markets.length===1?" is":"s are")+" hit — "+
    r.markets.slice(0,4).map(b=>b.name).join(", ")+
    (r.markets.length>4?", and others":"")+".");

  const lost=n.pairsBefore-n.pairsNow;
  out.push("");
  if(n.closed) out.push(n.closed.toLocaleString()+" cells no longer carry traffic.");
  else if(H.closes) out.push("No ground is hurt badly enough to close a road.");
  else out.push("Nothing here blocks a road — this is not that kind of event — so what "+
    "it does to the network it does by emptying places, not by cutting between them.");
  if(n.lostMarkets.length) out.push(n.lostMarkets.length+" of the 17 market centres "+
    "stop keeping a market: "+n.lostMarkets.slice(0,5).join(", ")+
    (n.lostMarkets.length>5?", and others":"")+".");
  if(lost>0) out.push(lost+" of the "+n.pairsBefore+
    " market pairs that could be reached over land no longer can"+
    (n.severed.length?" — including "+n.severed.slice(0,3)
      .map(s=>s[0]+" and "+s[1]).join(", ")+".":"."));
  else if(n.closed) out.push("The network holds: every market pair that could reach "+
    "each other still can.");
  if(n.cutOff>0) out.push(n.cutOff.toLocaleString()+" cells carrying "+
    n.cutPop.toLocaleString()+" people have lost the market that fed them, and that "+
    "is ground the event never touched.");
  if(n.daysCells>0) out.push("For another "+n.daysCells.toLocaleString()+
    " cells the food now travels "+n.daysAdded.toFixed(1)+" days further.");
  if(!n.cutOff&&!lost&&n.closed) out.push("Nothing is cut off. The roads went round it.");
  r.text=out.filter(x=>x!=="").join(" ");
  r.lines=out;
}

/* ---- naming a place, for the log -------------------------------------------------- */
function placeName(i){
  const b=A.burgOf(i);
  if(b) return b.name;
  const pv=A.provinceOf(i), st=A.stateOf(i);
  return (pv||st||"open ground")+" (cell "+i+")";
}
function compass(d){
  return ["east","south-east","south","south-west","west","north-west","north",
    "north-east"][(Math.round(((d%360)+360)%360/45))%8];
}

A.sim={HAZARDS,STATES,MONTHS,CLOSED_AT,FLAM,DRY,WARD,run,stateOf,stateIndex,stateColour,
  hazardById,mortality,placeName};
})();
