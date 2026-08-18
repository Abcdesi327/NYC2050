/* ===================================================================================
   NYC 2050 — terrain model.
   The sheet needed a ground surface before it could be asked what happens when the
   water rises or the ground shakes. Elevations are metres above the 2050 mean tide,
   not above the old datum, so the ground the survey already lists as inundated sits
   at or below zero. One grid unit is about ten metres.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{}, D=NYC.data;

const U2M=10;                 /* metres per grid unit */

/* ---- spot heights: [x, y, metres above the 2050 tide] ----------------------------- */
const SPOT=[
 /* --- Manhattan, south to north --- */
 [4,-346,-1],[-52,-292,-1.5],[26,-284,0.5],[74,-298,0],[10,-300,0.5],
 [0,-201,4],[-56,-176,1.5],[-88,-196,0.5],[46,-118,9],[10,-104,1],
 [-30,-44,4],[110,-30,3],[-95,52,5],[-38,32,5],[92,60,4],
 [14,113,8],[34,160,10],[-2,184,9],[28,240,16],[-50,264,8],[2,272,12],
 [28,336,10],[-48,360,13],[-95,380,7],[-140,268,3],
 [-72,472,16],[-104,512,12],[-36,676,24],[-40,632,30],[-6,712,20],
 [-100,640,18],[112,704,6],[-116,896,38],[-134,928,40],[-92,904,20],
 [-16,1004,10],[60,900,5],[-156,976,40],[-100,1160,42],[-38,1080,8],
 [-100,1440,66],[-140,1608,76],[-108,1660,10],[-72,1352,55],[16,1452,1],
 /* --- Brooklyn --- */
 [210,-146,2],[190,-206,18],[215,-175,11],[248,-120,28],[290,-58,1],
 [246,-118,6],[270,-34,2],[296,-186,28],[316,-232,38],[282,-272,43],
 [240,-262,28],[200,-236,-0.5],[196,-262,0],[225,-346,58],[258,-312,36],
 [316,-136,22],[236,-410,0.5],[420,-210,20],[470,-134,12],
 /* --- Queens --- */
 [250,340,3],[305,456,10],[300,300,9],[408,314,18],[506,296,3],
 [466,240,1],[286,520,2],[268,180,0],[496,222,15],
 /* --- The Bronx --- */
 [280,1180,22],[216,1120,8],[250,1250,42],[330,1240,18],[320,1080,1],
 [180,1560,60],[240,1430,25],
 /* --- New Jersey and the islands --- */
 [-232,60,1],[-248,-140,6],[-262,600,55],[-224,1500,40],
 [-118,-470,1],[-132,-424,0.5],[70,-418,2],[200,450,2],[240,1040,1]
];

/* ---- made ground: everything here was water once, and behaves like it ------------- */
const FILL=[
 /* the lower tip, out to the old shoreline */
 [[-90,-200],[-70,-286],[-20,-346],[30,-352],[92,-290],[110,-232],[60,-190],[-20,-186]],
 /* the east-side ribbon under the FDR */
 [[95,-180],[150,-120],[190,-20],[205,90],[195,240],[170,430],[130,700],[150,700],
  [190,430],[214,240],[224,90],[210,-20],[170,-120],[110,-180]],
 /* the west side, from the Battery to the yards */
 [[-124,-20],[-140,120],[-152,300],[-140,470],[-160,470],[-172,300],[-160,120],[-140,-20]],
 [[186,-210],[214,-222],[224,-266],[196,-256]],          /* Gowanus */
 [[176,-250],[206,-244],[210,-286],[180,-282]],          /* Red Hook */
 [[240,140],[290,160],[300,240],[246,250]],              /* Newtown Creek, Long Island City */
 [[436,196],[500,206],[494,272],[432,262]],              /* Flushing Meadows, on ash */
 [[210,-400],[270,-396],[266,-420],[212,-420]],          /* Coney Island */
 [[268,-40],[300,-46],[304,-76],[272,-70]],              /* the Navy Yard basins */
 [[300,1050],[350,1062],[344,1102],[296,1092]]           /* Hunts Point */
];

/* ---- rock: the schist is shallow at both ends of the island and deep in between ---
   It is why the towers stand where they stand, and it changes how the ground shakes. */
const ROCK=[
 {name:"shallow schist", amp:0.85, box:[-200,-352,240,-120]},   /* the Financial District */
 {name:"deep till",      amp:1.35, box:[-200,-120,240,190]},    /* Canal to 23rd */
 {name:"shallow schist", amp:0.85, box:[-200,190,240,760]},     /* Midtown */
 {name:"shallow schist", amp:0.9,  box:[-200,760,240,1740]}     /* uptown */
];

/* ---- helpers ---------------------------------------------------------------------- */
function inPoly(x,y,pts){
  let hit=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const xi=pts[i][0],yi=pts[i][1],xj=pts[j][0],yj=pts[j][1];
    if((yi>y)!==(yj>y) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) hit=!hit;
  }
  return hit;
}
function onLand(x,y){
  if(y>=-352&&y<=1740&&x>=D.WX(y)&&x<=D.EX(y)) return "MN";
  if(inPoly(x,y,D.BKQN)) return y<150?"BK":"QN";
  if(inPoly(x,y,D.BRONX)) return "BX";
  if(inPoly(x,y,D.NJ)) return "NJ";
  if(inPoly(x,y,D.ROOSEVELT)||inPoly(x,y,D.RANDALLS)) return "IS";
  if(inPoly(x,y,D.LIBERTY)||inPoly(x,y,D.ELLIS)||inPoly(x,y,D.GOVERNORS)) return "IS";
  return null;
}
function isFill(x,y){ for(const f of FILL) if(inPoly(x,y,f)) return true; return false; }

/* inverse-distance interpolation over the spot heights, six nearest points */
const cache=new Map();
function elev(x,y){
  const key=(Math.round(x/4)*4)+":"+(Math.round(y/4)*4);
  const hit=cache.get(key); if(hit!==undefined) return hit;
  const near=[];   /* interpolated everywhere; the raster masks water separately, and
                      several logged sites sit just off the polygon shoreline */
  for(const s of SPOT){
    const d2=(s[0]-x)*(s[0]-x)+(s[1]-y)*(s[1]-y);
    if(d2<1) { cache.set(key,s[2]); return s[2]; }
    near.push([d2,s[2]]);
  }
  near.sort((a,b)=>a[0]-b[0]);
  let num=0,den=0;
  for(let i=0;i<6&&i<near.length;i++){
    const w=1/Math.pow(near[i][0],1.25);
    num+=w*near[i][1]; den+=w;
  }
  let v=num/den;
  /* made ground was brought up to a working level and no higher */
  if(isFill(x,y)) v=Math.min(v,2.2);
  cache.set(key,v);
  return v;
}

/* how hard the ground shakes here, relative to rock */
function amplification(x,y){
  let amp=1;
  for(const r of ROCK){
    const b=r.box;
    if(x>=b[0]&&x<b[2]&&y>=b[1]&&y<b[3]){ amp=r.amp; break; }
  }
  if(isFill(x,y)) amp*=1.9;                     /* fill rings like a bell */
  else if(elev(x,y)<4) amp*=1.25;               /* soft ground near the water */
  return amp;
}
/* saturated fill below the water table will simply flow */
function liquefaction(x,y){ return isFill(x,y)&&elev(x,y)<6 ? 0.75 : 0; }

function ground(x,y){
  const b=onLand(x,y);
  return { land:b, elev:elev(x,y), fill:isFill(x,y),
           amp:amplification(x,y), liq:liquefaction(x,y) };
}

NYC.terrain={U2M,SPOT,FILL,elev,onLand,isFill,amplification,liquefaction,ground,inPoly};
})();
