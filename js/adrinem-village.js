/* ===================================================================================
   Adrinem — the village plate. The city generator lays out places the export names;
   this lays out one it does not.

   Cell 1308 carries no burg, no market, no road and 15,303 people spread over ground a
   hundred miles across. The export says what the ground is and nothing about what
   stands on it, so a settlement here is invention — but it is invention constrained by
   the same readings, in the same order:

     the river is south-west        neighbour 1307 carries river 206 at flux 415, the
                                    largest within reach, bearing 158
     the ground rises north-east    h23 here, h31 at neighbour 1394 on bearing 25
     the country is wet and warm    Tropical seasonal forest, habitability 50
     there is no road at all        no exported segment touches this cell
     it is 53 days from its market  1,338 effective miles to Str'amar
     the people are GODLINGS        the culture the export assigns this ground

   Water off a river of that size, on a slope of that aspect, in that climate, is a
   wet-rice terrace. Everything below follows from that and from one rule the author
   supplies rather than reads — that rank here is height above the paddies — which is
   labelled as such on the plate.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const C=A.cells, M=A.meta;
const G=A.city._geom;
const {vec,add,sub,mul,len,norm,dot,lerp,polyArea,centroid,D2R,hash2}=G;
const TAU=Math.PI*2;

/* ===================================================================================
   THE FIGURES, WRITTEN DOWN
   ---------------------------------------------------------------------------------
   Five numbers do the work here and none of them is in the export, so they are all in
   one place where they can be argued with.
   =================================================================================== */
const V={
  slope:0.062,        /* the fall of the hillside — 6.2 per cent, 56 m over 900 m */
  riser:0.45,         /* the step between one paddy terrace and the next, in metres */
  crossBund:44,       /* how far apart the cross-bunds are, so a paddy is workable */
  fieldWidth:1180,    /* the width of the terraced ground, along the contour */
  fieldDepth:520,     /* how far the paddies climb from the river */
  villageDepth:400,   /* how far the houses climb above the top bund */
  feedPerHa:6.2,      /* people a hectare of wet rice keeps in a year */
  plot:340,           /* the ground a household holds, in square metres */
  raceFall:0.004      /* the fall of the head-race: it must run nearly level */
};

/* the five ranks, lowest first — the whole social order of the place, by elevation */
const RANKS=[
  {key:"foot",  name:"The Water-Foot",    band:[-99,1.5],
   note:"Below the top bund, among the water. The sluice-keeper, the miller and the "+
        "ferry live here, which is to say the people who decide when anyone else's "+
        "field is flooded live at the bottom of the order."},
  {key:"first", name:"The First Bund",    band:[1.5,7],
   note:"The first dry ground. Newly-made households and the families who work another "+
        "family's terraces."},
  {key:"middle",name:"The Middle Ground", band:[7,14],
   note:"Households holding terraces of their own, which is most of the village."},
  {key:"high",  name:"The High Ground",   band:[14,21],
   note:"Old holdings. Their terraces are the furthest from their doors and the "+
        "nearest to the race, and both facts are the point."},
  {key:"temple",name:"The Temple Terrace",band:[21,99],
   note:"The sanctuary and the readers' households. Nothing may be built above the "+
        "temple, so this band has a ceiling that no other one has, and the families on "+
        "it hold no terraces at all."}
];
const rankOf=z=>RANKS.find(r=>z>=r.band[0]&&z<r.band[1])||RANKS[RANKS.length-1];

/* ===================================================================================
   THE SITE
   =================================================================================== */
function siteOf(cell,name){
  const base=A.city.siteOf(cell);
  const nb=A.neighboursOf(cell);
  const bearingTo=j=>Math.atan2(C.y[j]-C.y[cell],C.x[j]-C.x[cell])/D2R;

  /* the river: the neighbouring cell carrying the most water, and its bearing */
  let riv=null;
  nb.forEach(j=>{ if(C.riv[j]&&(!riv||C.flux[j]>C.flux[riv])) riv=j; });
  /* and the biggest one within reach, in case no neighbour carries it */
  if(!riv){
    const bag=[]; A.near(C.x[cell],C.y[cell],70,bag);
    bag.forEach(j=>{ if(C.riv[j]&&(!riv||C.flux[j]>C.flux[riv])) riv=j; });
  }

  /* the fall of the land: toward the river, away from the highest neighbour */
  let high=null;
  nb.forEach(j=>{ if(A.isLand(j)&&(!high||C.h[j]>C.h[high])) high=j; });
  const upBearing=high!=null?bearingTo(high):(riv!=null?bearingTo(riv)+180:0);
  const downBearing=riv!=null?bearingTo(riv):upBearing+180;

  /* how remote: the nearest named place, and how long the market is */
  let nearest=null,nd=Infinity;
  A.burgs.forEach(b=>{
    const d=Math.hypot(C.x[b.cell]-C.x[cell],C.y[b.cell]-C.y[cell])*M.scale;
    if(d<nd){nd=d;nearest=b;}
  });
  let roads=0;
  const R=A.roads;
  for(let k=0;k<R.a.length;k++) if(R.a[k]===cell||R.b[k]===cell) roads++;

  return Object.assign({},base,{
    name:name, invented:true,
    riverCell:riv, riverId:riv!=null?C.riv[riv]:0, riverFlux:riv!=null?C.flux[riv]:0,
    riverBearing:riv!=null?bearingTo(riv):null,
    upBearing:upBearing, downBearing:downBearing,
    upHeight:high!=null?C.h[high]:C.h[cell],
    nearestBurg:nearest?nearest.name:null, nearestBurgMi:Math.round(nd),
    nearestBurgIn:nearest?A.stateOf(nearest.cell):null,
    roadsHere:roads,
    marketName:C.mkt[cell]>=0?(A.marketOf(C.mkt[cell])||{}).name:null,
    marketMi:C.cost[cell], marketDays:C.cost[cell]>=0?C.cost[cell]/M.supplyDivisor:null,
    cellPop:C.pop[cell]
  });
}

/* ===================================================================================
   THE GROUND
   ---------------------------------------------------------------------------------
   One straight hillside, read in two directions: u along the contour, w up the slope.
   Elevation is w times the slope, plus a little wander so the contours are not ruled
   lines — and the terraces follow the contours, because water does.
   =================================================================================== */
function frame(site){
  const up=norm(vec(site.upBearing,1));            /* uphill */
  const along=[-up[1],up[0]];                      /* along the contour */
  /* the wander of the hillside, so contours bend the way ground does */
  const wobble=u=>26*Math.sin(u/230)+11*Math.sin(u/86+1.4);
  return {
    up:up, along:along,
    /* map-space point from (u along the contour, w up the slope) */
    at:(u,w)=>add(mul(along,u),mul(up,w+wobble(u))),
    /* how high above the river, in metres */
    z:w=>Math.max(0,w)*V.slope,
    wobble:wobble
  };
}

/* ===================================================================================
   THE WORKS
   =================================================================================== */
function build(cell,name){
  const site=siteOf(cell,name||"Ourasen");
  const F=frame(site);
  const blocks=[], streets=[], landmarks=[];
  const HW=V.fieldWidth/2;

  /* --- the river, along the foot of the slope ------------------------------------ */
  const riverW=-90;                                /* below the lowest paddy */
  const river=[];
  for(let u=-HW*1.5;u<=HW*1.5;u+=40)
    river.push(F.at(u,riverW-30*Math.sin(u/310)-16*Math.sin(u/97+2.2)));
  /* wide enough to read as the thing the whole place is built on */
  const riverWidth=34+Math.min(70,site.riverFlux/9);

  /* --- the weir and the head-race ------------------------------------------------
     The race must run almost level to carry water along the hill, so it climbs the
     slope only as fast as its own fall allows: it leaves the weir high upstream and
     arrives at the top of the paddies having dropped a few centimetres in a kilometre.
     That is why it is the most valuable line on the plate. */
  const weirU=-HW*1.16, weirW=riverW+18;
  const raceTopW=V.fieldDepth;                     /* the top bund of the paddies */
  const race=[];
  for(let k=0;k<=54;k++){
    const t=k/54;
    const u=lerp([weirU,0],[HW*1.05,0],t)[0];
    /* rises quickly out of the weir, then holds the contour */
    const w=weirW+(raceTopW-weirW)*Math.min(1,Math.pow(t/0.22,0.85))
      -(t>0.22?(t-0.22)*V.raceFall*V.fieldWidth/V.slope:0);
    race.push(F.at(u,w));
  }
  streets.push({pts:race,cls:"way",name:"The Head-Race"});

  /* --- the paddies: terraces along the contour, cross-bunded into fields ---------- */
  const terraceTread=V.riser/V.slope;              /* 7.3 m on this hill */
  const rows=Math.floor(V.fieldDepth/terraceTread);
  let paddyArea=0;
  for(let r=0;r<rows;r++){
    const w0=r*terraceTread, w1=w0+terraceTread*0.86;
    /* the field narrows toward the top, where the race can no longer reach across */
    const half=HW*(1-0.22*Math.pow(r/rows,1.7));
    const cells=Math.max(4,Math.round(half*2/V.crossBund));
    for(let c=0;c<cells;c++){
      const u0=-half+c*(half*2/cells), u1=u0+(half*2/cells)*0.94;
      const poly=[F.at(u0,w0),F.at(u1,w0),F.at(u1,w1),F.at(u0,w1)];
      const area=polyArea(poly);
      paddyArea+=area;
      blocks.push({poly:poly, c:centroid(poly), area:area, use:"paddy",
        fu:(u0+u1)/2, fw:(w0+w1)/2, fdu:(u1-u0)/2, fdw:(w1-w0)/2,
        w:(w0+w1)/2, z:F.z((w0+w1)/2), terrace:r, storeys:0, coverage:0,
        people:0, floor:0, roofed:0});
    }
  }
  const paddyHa=paddyArea/10000;
  const fed=Math.round(paddyHa*V.feedPerHa);

  /* --- the households, in bands above the top bund -------------------------------- */
  const houses=Math.max(8,Math.round(fed/5.1));    /* about five to a household */
  const plots=[];
  let placed=0, guard=0;

  /* The water-people first, and below the top bund on purpose: the sluice-keeper, the
     miller and the ferry families live among the paddies. By this village's rule that
     puts them at the bottom of the order, and by the fact of the hillside it puts every
     household above them downstream of what they do. */
  const footCount=Math.max(3,Math.round(houses*0.14));
  for(let k=0;k<footCount;k++){
    const u=(hash2(k*17+9,k*3.3)*2-1)*HW*0.74;
    const w=raceTopW-30-hash2(k*5+1,u)*90;
    plots.push({p:F.at(u,w),u:u,w:w}); placed++;
  }

  while(placed<houses&&guard++<4000){
    const s=hash2(placed*7+1,guard*13.7);
    const s2=hash2(guard*3+5,placed*11.3);
    /* households thin out steeply with height: the high ground is held by very few */
    const t=Math.pow(s,2.1);
    const w=raceTopW+26+t*V.villageDepth;
    const half=HW*(0.92-0.40*t);
    const u=(s2*2-1)*half;
    const p=F.at(u,w);
    if(plots.some(q=>Math.hypot(q.p[0]-p[0],q.p[1]-p[1])<21)) continue;
    plots.push({p:p,u:u,w:w});
    placed++;
  }
  plots.forEach((pl,ix)=>{
    const z=F.z(pl.w)-F.z(raceTopW);               /* height above the top bund */
    const rank=rankOf(z);
    const k=Math.sqrt(V.plot)*(0.72+0.5*(RANKS.indexOf(rank)/4));
    const a=(hash2(ix*5+3,pl.u)-0.5)*0.5;
    const co=Math.cos(a)*k/2, si=Math.sin(a)*k/2;
    const poly=[
      add(pl.p,[-co+si,-si-co]), add(pl.p,[co+si,si-co]),
      add(pl.p,[co-si,si+co]),  add(pl.p,[-co-si,-si+co])];
    blocks.push({poly:poly, c:pl.p.slice(), area:polyArea(poly), use:"dwelling",
      fu:pl.u, fw:pl.w, fdu:k/2, fdw:k/2,
      w:pl.w, z:z, rank:rank.key, rankName:rank.name,
      reader:rank.key==="temple", waterFoot:rank.key==="foot",
      storeys:1+(hash2(pl.u,pl.w)<0.30?1:0),
      coverage:0.42+0.10*(RANKS.indexOf(rank)/4),
      /* mostly timber; the older and higher the holding, the more stone in its footing */
      stone:0.10+0.55*(RANKS.indexOf(rank)/4)});
  });

  /* --- the temple, at the top ----------------------------------------------------- */
  const templeW=raceTopW+V.villageDepth+70;
  const templeP=F.at(0,templeW);
  const templeZ=F.z(templeW)-F.z(raceTopW);
  const tk=34;
  blocks.push({poly:[add(templeP,[-tk,-tk]),add(templeP,[tk,-tk]),
    add(templeP,[tk,tk]),add(templeP,[-tk,tk])],
    c:templeP.slice(), area:tk*tk*4, use:"temple",
    fu:0, fw:templeW, fdu:tk, fdw:tk, w:templeW, z:templeZ,
    rank:"temple", rankName:"The Temple Terrace", storeys:2, coverage:0.62, stone:0.86});

  /* --- the paths: one up the hill, one along each rank ---------------------------- */
  const spine=[];
  for(let w=riverW;w<=templeW+40;w+=26) spine.push(F.at(6*Math.sin(w/120),w));
  streets.push({pts:spine,cls:"great",name:"The Stair"});
  RANKS.forEach((r,ix)=>{
    if(ix===0) return;
    const w=raceTopW+30+(r.band[0]/V.slope);
    if(w>templeW) return;
    const line=[];
    for(let u=-HW*0.86;u<=HW*0.86;u+=32) line.push(F.at(u,w));
    streets.push({pts:line,cls:"ring",name:r.name});
  });
  /* and the bund walks between the terraces, every eighth one */
  for(let r=0;r<rows;r+=8){
    const line=[];
    for(let u=-HW;u<=HW;u+=34) line.push(F.at(u,r*terraceTread));
    streets.push({pts:line,cls:"minor",name:null});
  }

  /* --- what is named -------------------------------------------------------------- */
  const put=(nm,kind,p,note)=>landmarks.push({name:nm,kind:kind,p:p,note:note});
  put("The Weir","harbour",F.at(weirU,weirW),
    "Where the water is taken. River "+site.riverId+" carries a flux of "+
    site.riverFlux+" past this hill — the largest within reach of the cell — and the "+
    "whole village is downstream of this one stone sill.");
  put("The Head-Race","harbour",race[Math.round(race.length*0.5)],
    "A channel that must fall about "+(V.raceFall*100).toFixed(1)+" metres in a "+
    "hundred to work at all, so it holds the contour where the hillside falls "+
    (V.slope*100).toFixed(1)+" in a hundred. It reaches the top bund and every terrace "+
    "below is fed from it in turn.");
  put("The Sluice-Keeper's House","civic",F.at(HW*0.22,raceTopW-40),
    "The office that opens the gates. By the rule of this place its holder lives at "+
    "the water and therefore near the bottom of the order, and by the fact of the "+
    "hillside every household above depends on him. The village has never resolved "+
    "this and the plate cannot either.");
  put("The Mill","yard",F.at(-HW*0.52,riverW+42),
    "On the race where it still has fall to spare, below the lowest bund.");
  put("The Threshing Floor","staple",F.at(HW*0.06,raceTopW+16),
    "Flat, hard and level, on the top bund where the whole field can reach it.");
  put("The Granary","store",F.at(-HW*0.16,raceTopW+64),
    "Raised on stone staddles against the wet and the rats. "+
    paddyHa.toFixed(0)+" hectares of terrace pass through it.");
  put("The Ford","harbour",F.at(HW*0.62,riverW-8),
    "There is no bridge. There is no road either: no exported segment touches this "+
    "cell, and the nearest named place is "+(site.nearestBurg||"nowhere")+", "+
    site.nearestBurgMi.toLocaleString()+" miles off.");
  put("The Temple of the Godlings","temple",templeP,
    "At the top, because the rule of this place is that height is rank, and nothing "+
    "may be built above it. The culture the export assigns this ground is "+
    site.culture+"; what it believes is the author's.");
  put("The Readers' Houses","civic",F.at(-58,templeW-52),
    "The households on the temple terrace. They hold no terraces, take a share of every "+
    "one below, and are the only families in the village whose rank cannot rise, "+
    "because there is no ground above them.");
  put("The Burial Terrace","civic",F.at(HW*0.42,templeW-120),
    "High, dry and out of the water — which under this village's rule is also the most "+
    "honourable ground it has.");
  put("The Grove","garden",F.at(-HW*0.66,raceTopW+150),
    "Left standing. Tropical seasonal forest is what all this was, and what the "+
    "terraces were cut out of.");

  /* --- the account ---------------------------------------------------------------- */
  const byRank={};
  blocks.filter(b=>b.rank).forEach(b=>{
    const r=byRank[b.rank]||(byRank[b.rank]={key:b.rank,name:b.rankName,houses:0,
      people:0,lowZ:Infinity,highZ:-Infinity});
    r.houses++; r.lowZ=Math.min(r.lowZ,b.z); r.highZ=Math.max(r.highZ,b.z);
  });
  /* people, spread over the households the paddies can feed */
  const houseBlocks=blocks.filter(b=>b.use==="dwelling");
  houseBlocks.forEach((b,ix)=>{
    b.people=Math.max(2,Math.round(fed/houseBlocks.length*(0.7+0.6*hash2(ix,b.w))));
    b.roofed=b.area*b.coverage; b.floor=b.roofed*b.storeys;
  });
  let total=houseBlocks.reduce((n,b)=>n+b.people,0);
  /* trim the rounding onto the largest household so the total is exactly what the
     terraces feed */
  if(houseBlocks.length) houseBlocks[0].people+=fed-total;
  Object.keys(byRank).forEach(k=>{
    byRank[k].people=houseBlocks.filter(b=>b.rank===k)
      .reduce((n,b)=>n+b.people,0);
  });

  const byUse={};
  blocks.forEach(b=>{
    const u=byUse[b.use]||(byUse[b.use]={blocks:0,area:0,people:0,floor:0});
    u.blocks++; u.area+=b.area; u.people+=(b.people||0); u.floor+=(b.floor||0);
  });

  return {
    archetype:"village", site:site, V:V, F:F, RANKS:RANKS,
    plan:{archetype:"village", centre:F.at(0,raceTopW), staple:F.at(0,raceTopW),
      streets:streets, rays:[], rings:[], quayPts:[], corridor:null},
    water:{river:river, riverWidth:riverWidth, race:race,
      riverW:riverW, room:()=>999, townside:()=>true},
    S:{spread:V.fieldWidth, wallR:Infinity, sacredR:0, reach:V.fieldWidth,
       quayClear:0, ring0:0, raceTopW:raceTopW, templeW:templeW, riverW:riverW,
       terraceTread:terraceTread},
    wall:{ring:[],towers:[],gates:[]}, inner:null,
    blocks:blocks, streets:streets, landmarks:landmarks, byUse:byUse, byRank:byRank,
    doctrine:null,
    stats:{
      population:fed, inside:fed, outside:0,
      households:houseBlocks.length,
      blocks:blocks.length, streets:streets.length, landmarks:landmarks.length,
      paddyHa:paddyHa, terraces:rows, paddies:blocks.filter(b=>b.use==="paddy").length,
      areaHa:blocks.reduce((n,b)=>n+b.area,0)/10000,
      wallHa:0, floorHa:houseBlocks.reduce((n,b)=>n+b.floor,0)/10000,
      densityInside:fed/(paddyHa||1), densityOutside:0,
      wallGates:0, wallTowers:0, quayM:0, innerGates:0,
      raceM:(function(){let d=0;for(let i=1;i<race.length;i++)
        d+=len(sub(race[i],race[i-1])); return d;})(),
      riseM:F.z(templeW)-F.z(riverW), feedPerHa:V.feedPerHa
    }
  };
}

/* which cells the author has put a village on. Not from the export. */
const HAMLETS={1308:"Ourasen"};

A.village={ build:build, siteOf:siteOf, RANKS:RANKS, V:V, HAMLETS:HAMLETS,
  has:cell=>!!HAMLETS[cell], nameOf:cell=>HAMLETS[cell]||null };
})();
