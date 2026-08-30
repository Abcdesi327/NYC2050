/* ===================================================================================
   Adrinem — the model view. The survey sheet draws New York in three dimensions twice:
   the street-level plates, built from a kit of masonry, glazing and growth primitives
   in js/sv-kit.js, and the throw-line section in the projection console, which takes
   block footprints and their real heights and returns a drawn elevation.

   That kit is pure drawing — it reads no New York data at all — so it is carried over
   here unchanged and this file adds to it what a wet-rice village on a hillside needs
   and Manhattan did not: terraces, timber frames, thatch, stilts, and a stone plinth.

   Two drawings come out of it, from the same numbers the plan is drawn from:

     the model    an axonometric of the whole village, terraces first and the temple
                  last, painted back to front
     the section  a side elevation up the slope in the idiom of the throw-line section:
                  the river at one end, the temple at the other, and every household
                  marked at the height that decides its rank

   Heights are drawn at three times the plan scale. Nothing else is exaggerated, and
   the caption says so.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const K=(window.NYC&&window.NYC.svkit)||null;   /* the kit, carried over from the sheet */

/* If the kit is not on the page, the model cannot be drawn. Say so rather than
   half-drawing it. */
function ready(){ return !!K; }

const VZ=3;                       /* heights against plan */
const OX=0.34, OY=0.62;           /* how far a metre up the slope moves the drawing */

/* ---- the timber palette. sv-kit's stone and water are used as they are ------------ */
const P={
  thatch:"#B7A06A", thatchD:"#96814F", thatchX:"#77653C",
  wall:"#8C6C46", wallD:"#74583A", wallX:"#5A452C",
  post:"#54402A", frame:"#6B5335",
  stone:"#BAB3A2", stoneD:"#948D7C", stoneL:"#D2CCBC", stoneX:"#6E6858",
  paddy:"#86A98D", paddyD:"#6E9077", bund:"#A79A72", bundD:"#8A7E5A",
  river:"#6D8892", riverL:"#8DA5AC",
  ground:"#AFA684", groundD:"#948C6C",
  leaf:"#5E7A4A", leafD:"#46603A", ink:"#2C2C2A"
};

/* =================================================================================== */
/*  the projection                                                                     */
/*  u runs along the contour, w up the slope, z up out of the ground — all in metres    */
/* =================================================================================== */
const px=(u,w)=>u+w*OX;
const py=(u,w,z)=>-w*OY-(z||0)*VZ;
const pt=(u,w,z)=>[px(u,w),py(u,w,z)];
const depth=w=>w;                 /* larger w is further away, so it is drawn first */

/* =================================================================================== */
/*  primitives — the kit's idiom: functions that return SVG strings                    */
/* =================================================================================== */
function quad(a,b,c,d,fill,o){
  return K.PG([a,b,c,d],Object.assign({fill:fill},o||{}));
}

/* a flat sheet of water sitting in a terrace, with the bund that holds it in */
function paddy(u0,u1,w0,w1,z,seed){
  const top=quad(pt(u0,w0,z),pt(u1,w0,z),pt(u1,w1,z),pt(u0,w1,z),
    seed%3===0?P.paddyD:P.paddy,{stroke:P.bundD,"stroke-width":.5});
  /* the downhill face of the bund, drawn at its real height */
  const face=quad(pt(u0,w0,z),pt(u1,w0,z),pt(u1,w0,z-0.45),pt(u0,w0,z-0.45),P.bund,
    {stroke:P.bundD,"stroke-width":.4});
  /* the shine, because a flooded terrace is a mirror and that is how you know it is wet */
  const sh=K.LN(px(u0+2,w0+1),py(u0+2,w0+1,z),px(u1-2,w0+1),py(u1-2,w0+1,z),
    {stroke:"#CFE0D2","stroke-width":.7,opacity:.5});
  return face+top+sh;
}

/* a box: the side, the downhill face and the top, in that order */
function box(u0,u1,w0,w1,base,h,cols){
  const t=base+h;
  const side=quad(pt(u1,w0,base),pt(u1,w1,base),pt(u1,w1,t),pt(u1,w0,t),cols[2]);
  const front=quad(pt(u0,w0,base),pt(u1,w0,base),pt(u1,w0,t),pt(u0,w0,t),cols[1]);
  const top=quad(pt(u0,w0,t),pt(u1,w0,t),pt(u1,w1,t),pt(u0,w1,t),cols[0]);
  return side+front+top;
}

/* a hipped thatch roof over a footprint */
function thatch(u0,u1,w0,w1,base,rise){
  const wm=(w0+w1)/2, um=(u0+u1)/2, r=base+rise;
  const eave=0.55;
  const A0=pt(u0-eave,w0-eave,base), B0=pt(u1+eave,w0-eave,base);
  const C0=pt(u1+eave,w1+eave,base), D0=pt(u0-eave,w1+eave,base);
  const R0=pt(um-(u1-u0)*0.18,wm,r), R1=pt(um+(u1-u0)*0.18,wm,r);
  return K.PG([D0,C0,R1,R0],{fill:P.thatchX})+          /* the far slope */
         K.PG([B0,C0,R1],{fill:P.thatchD})+             /* the side */
         K.PG([A0,B0,R1,R0],{fill:P.thatch,stroke:P.thatchX,"stroke-width":.4})+
         K.LN(R0[0],R0[1],R1[0],R1[1],{stroke:P.thatchX,"stroke-width":.9});
}

/* a house: a stone footing, timber posts standing it out of the wet, plank walls,
   thatch over. The share of stone rises with the holding. */
function house(b,F,S,seed){
  const rnd=K.rng(seed);
  const w=b.fw, side=Math.sqrt(b.area*b.coverage);
  const u=b.fu, hw=side/2;
  const g0=F.z(w);                             /* the ground it stands on */
  const stilt=0.9+rnd()*0.5;
  const wallH=2.5+rnd()*0.9+(b.storeys>1?2.2:0);
  const stone=b.stone||0.2;
  let g="";
  /* the plinth — the bit of stonework */
  g+=box(u-hw*1.06,u+hw*1.06,w-hw*1.06,w+hw*1.06,g0,0.35+stone*0.75,
    [P.stoneL,P.stone,P.stoneD]);
  /* the posts */
  const ph=g0+stilt+0.35+stone*0.75;
  [[u-hw*0.82,w-hw*0.82],[u+hw*0.82,w-hw*0.82],[u+hw*0.82,w+hw*0.82],
   [u-hw*0.82,w+hw*0.82]].forEach(([pu,pw])=>{
    g+=box(pu-0.3,pu+0.3,pw-0.3,pw+0.3,g0+0.35+stone*0.75,stilt,
      [P.frame,P.post,P.wallX]);
  });
  /* the frame */
  g+=box(u-hw,u+hw,w-hw,w+hw,ph,wallH,[P.wall,P.wall,P.wallD]);
  /* plank lines, so it reads as timber and not as a block */
  for(let k=1;k<4;k++){
    const zz=ph+wallH*k/4;
    g+=K.LN(px(u-hw,w-hw),py(u-hw,w-hw,zz),px(u+hw,w-hw),py(u+hw,w-hw,zz),
      {stroke:P.wallX,"stroke-width":.35,opacity:.7});
  }
  /* a door onto the downhill side, because that is where the terraces are */
  g+=quad(pt(u-hw*0.22,w-hw,ph),pt(u+hw*0.22,w-hw,ph),
          pt(u+hw*0.22,w-hw,ph+wallH*0.62),pt(u-hw*0.22,w-hw,ph+wallH*0.62),P.wallX);
  g+=thatch(u-hw,u+hw,w-hw,w+hw,ph+wallH,1.5+hw*0.42);
  return {d:g,depth:w};
}

/* the temple: a stone platform, a timber hall, and a roof in two falls */
function temple(b,F,S){
  const w=b.fw, u=b.fu, side=Math.sqrt(b.area*b.coverage), hw=side/2;
  const g0=F.z(w);
  let g="";
  /* three stone steps, which is the only masonry of any size in the village */
  for(let k=0;k<3;k++){
    const e=hw*(1.5-k*0.16);
    g+=box(u-e,u+e,w-e,w+e,g0+k*0.55,0.55,[P.stoneL,P.stone,P.stoneD]);
  }
  const base=g0+1.65;
  g+=box(u-hw,u+hw,w-hw,w+hw,base,4.4,[P.wall,P.wall,P.wallD]);
  /* a colonnade of timber posts along the downhill face */
  for(let k=0;k<=6;k++){
    const pu=u-hw+ (hw*2)*k/6;
    g+=box(pu-0.34,pu+0.34,w-hw-0.9,w-hw-0.2,base,4.4,[P.frame,P.post,P.wallX]);
  }
  g+=thatch(u-hw*1.12,u+hw*1.12,w-hw*1.12,w+hw*1.12,base+4.4,2.6);
  g+=thatch(u-hw*0.72,u+hw*0.72,w-hw*0.72,w+hw*0.72,base+4.4+2.6,2.4);
  return {d:g,depth:w};
}

function tree(u,w,g0,seed){
  const rnd=K.rng(seed), h=g0+4+rnd()*3.5, r=1.6+rnd()*1.1;
  let g=box(u-0.28,u+0.28,w-0.28,w+0.28,g0,(h-g0)*0.55,[P.frame,P.post,P.wallX]);
  g+=K.EL(px(u,w),py(u,w,h),r*2.1,r*1.15,{fill:P.leafD});
  g+=K.EL(px(u,w-r*0.4),py(u,w-r*0.4,h+r*0.4),r*1.7,r*0.95,{fill:P.leaf});
  return {d:g,depth:w};
}

/* =================================================================================== */
/*  the model                                                                          */
/* =================================================================================== */
function model(v){
  if(!ready()) return null;
  const F=v.F, S=v.S, V=v.V;
  /* Every block carries the (u, w) it was laid out at, so the model reads the same
     numbers the plan did rather than trying to recover them from a centroid. */
  const parts=[];
  const add=(d,dep)=>parts.push({d:d,depth:dep});

  /* --- the river, at the foot ---------------------------------------------------- */
  const rw=S.riverW-30, rww=v.water.riverWidth;
  add(quad(pt(-V.fieldWidth*0.8,rw-rww,0),pt(V.fieldWidth*0.8,rw-rww,0),
           pt(V.fieldWidth*0.8,rw,0),pt(-V.fieldWidth*0.8,rw,0),P.river),rw-rww);
  for(let k=0;k<26;k++){
    const u=-V.fieldWidth*0.75+k*(V.fieldWidth*1.5/26);
    add(K.LN(px(u,rw-rww*0.7),py(u,rw-rww*0.7,0),px(u+22,rw-rww*0.55),
      py(u+22,rw-rww*0.55,0),{stroke:P.riverL,"stroke-width":1.1,opacity:.55}),rw-rww*0.6);
  }

  /* --- the hillside itself, drawn first so everything else stands on it ----------- */
  const topW=S.templeW+170, HWm=V.fieldWidth*0.62;
  add(quad(pt(-HWm,rw,0),pt(HWm,rw,0),
           pt(HWm*0.86,topW,F.z(topW)),pt(-HWm*0.86,topW,F.z(topW)),P.ground),topW+400);
  /* a few contour lines, so a flat wash reads as a slope */
  for(let w=120;w<topW;w+=150){
    const k=1-0.14*(w/topW);
    add(K.LN(px(-HWm*k,w),py(-HWm*k,w,F.z(w)),px(HWm*k,w),py(HWm*k,w,F.z(w)),
      {stroke:P.groundD,"stroke-width":.8,opacity:.45}),topW+399);
  }
  /* the flat between the river and the lowest bund */
  add(quad(pt(-HWm,rw,0),pt(HWm,rw,0),pt(HWm,0,0),pt(-HWm,0,0),P.ground),rw+1);

  /* --- the terraces, lowest first so each is overlapped by the one below ---------- */
  const paddies=v.blocks.filter(b=>b.use==="paddy");
  paddies.sort((a,b)=>b.fw-a.fw);
  paddies.forEach((b,ix)=>{
    add(paddy(b.fu-b.fdu,b.fu+b.fdu,b.fw-b.fdw,b.fw+b.fdw,b.z,ix),b.fw);
  });

  /* --- the head-race, holding the contour above the top bund ---------------------- */
  const raceZ=F.z(S.raceTopW)+0.5, rHalf=V.fieldWidth*0.52;
  add(quad(pt(-rHalf,S.raceTopW+4,raceZ+0.6),pt(rHalf,S.raceTopW+4,raceZ+0.6),
           pt(rHalf,S.raceTopW+13,raceZ+0.6),pt(-rHalf,S.raceTopW+13,raceZ+0.6),
           P.bund),S.raceTopW+9);
  add(quad(pt(-rHalf,S.raceTopW+6,raceZ),pt(rHalf,S.raceTopW+6,raceZ),
           pt(rHalf,S.raceTopW+11,raceZ),pt(-rHalf,S.raceTopW+11,raceZ),
           P.riverL),S.raceTopW+8.5);

  /* --- the grove ------------------------------------------------------------------ */
  for(let k=0;k<26;k++){
    const u=-V.fieldWidth*0.46+K.rng(k*31+7)()*V.fieldWidth*0.16;
    const w=S.raceTopW+90+K.rng(k*13+3)()*180;
    const t=tree(u,w,F.z(w),k*17+5); add(t.d,t.depth);
  }

  /* --- the houses and the temple -------------------------------------------------- */
  v.blocks.filter(b=>b.use==="dwelling").forEach((b,ix)=>{
    const h=house(b,F,S,ix*29+11); add(h.d,h.depth);
  });
  const tb=v.blocks.find(b=>b.use==="temple");
  if(tb){ const t=temple(tb,F,S); add(t.d,t.depth); }

  /* --- paint it back to front ----------------------------------------------------- */
  parts.sort((a,b)=>b.depth-a.depth);
  const body=parts.map(p=>p.d).join("");

  /* --- fit ------------------------------------------------------------------------ */
  const corners=[
    pt(-V.fieldWidth*0.8,rw-rww,0), pt(V.fieldWidth*0.8,rw-rww,0),
    pt(-V.fieldWidth*0.7,S.templeW+120,F.z(S.templeW+120)),
    pt(V.fieldWidth*0.7,S.templeW+120,F.z(S.templeW+120)),
    pt(0,S.templeW,F.z(S.templeW)+16)];
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  corners.forEach(c=>{ x0=Math.min(x0,c[0]); x1=Math.max(x1,c[0]);
    y0=Math.min(y0,c[1]); y1=Math.max(y1,c[1]); });
  const pad=60;
  return {svg:body, view:[x0-pad,y0-pad,(x1-x0)+pad*2,(y1-y0)+pad*2]};
}

/* =================================================================================== */
/*  the section — the throw-line elevation, pointed up a hillside                       */
/* =================================================================================== */
function section(v,W,H){
  if(!ready()) return "";
  const F=v.F, S=v.S, V=v.V;
  W=W||760; H=H||190;
  const L=44,B=30,T=16,R=14;
  const w0=S.riverW-40, w1=S.templeW+80;
  const zTop=F.z(w1)-F.z(w0);
  const X=w=>L+(W-L-R)*((w-w0)/(w1-w0));
  const Y=z=>H-B-(H-B-T)*(z/(zTop*1.12));

  let g='<svg viewBox="0 0 '+W+' '+H+'" class="sect vsect">';
  /* the hillside itself */
  let d="M"+X(w0)+" "+Y(0);
  for(let w=w0;w<=w1;w+=12) d+="L"+X(w)+" "+Y(F.z(w)-F.z(w0));
  d+="L"+X(w1)+" "+Y(0)+"Z";
  g+='<path d="'+d+'" fill="#CFC7AE" stroke="#8A8474" stroke-width="1"/>';

  /* the river, the paddies and the top bund */
  g+='<rect x="'+X(w0)+'" y="'+(Y(0)-6)+'" width="'+(X(S.riverW)-X(w0))+
     '" height="6" fill="'+P.river+'"/>';
  const bundZ=F.z(S.raceTopW)-F.z(w0);
  g+='<rect x="'+X(0)+'" y="'+Y(bundZ)+'" width="'+(X(S.raceTopW)-X(0))+
     '" height="'+(Y(0)-Y(bundZ))+'" fill="'+P.paddy+'" opacity=".5"/>';
  /* every terrace riser, at its real height */
  for(let r=0;r<v.stats.terraces;r++){
    const w=r*S.terraceTread;
    g+='<line x1="'+X(w)+'" y1="'+Y(F.z(w)-F.z(w0))+'" x2="'+X(w)+'" y2="'+
       Y(F.z(w)-F.z(w0)-V.riser)+'" stroke="'+P.bundD+'" stroke-width=".6"/>';
  }
  g+='<line x1="'+X(S.raceTopW)+'" y1="'+Y(bundZ)+'" x2="'+X(S.raceTopW)+'" y2="'+
     (Y(bundZ)-9)+'" stroke="'+P.riverL+'" stroke-width="2.4"/>';

  /* the households, each at the height that decides its rank */
  const RK={foot:"#6E8892",first:"#96825E",middle:"#8F8459",high:"#B4894E",
    temple:"#8E7BA8"};
  v.blocks.filter(b=>b.use==="dwelling").forEach(b=>{
    const z=F.z(b.fw)-F.z(w0), x=X(b.fw);
    g+='<rect x="'+(x-1.6)+'" y="'+(Y(z)-7)+'" width="3.2" height="7" fill="'+
       (RK[b.rank]||"#8F8459")+'"><title>'+b.rankName+" — "+b.z.toFixed(1)+
       ' m above the top bund, '+b.people+' people</title></rect>';
  });
  /* the rank boundaries */
  v.RANKS.forEach(r=>{
    if(r.band[0]<0||r.band[0]>90) return;
    const w=S.raceTopW+r.band[0]/V.slope;
    if(w>w1) return;
    const z=F.z(w)-F.z(w0);
    g+='<line x1="'+X(w)+'" y1="'+Y(z)+'" x2="'+X(w)+'" y2="'+T+
       '" stroke="#8A8474" stroke-width=".5" stroke-dasharray="3 3"/>';
    g+='<text transform="rotate(-90 '+(X(w)+3)+' '+(T+4)+')" x="'+(X(w)+3)+'" y="'+
       (T+4)+'" class="bl">'+r.name.replace(/^The /,"")+'</text>';
  });
  /* the temple */
  const tz=F.z(S.templeW)-F.z(w0);
  g+='<rect x="'+(X(S.templeW)-6)+'" y="'+(Y(tz)-14)+'" width="12" height="14" fill="'+
     P.stone+'" stroke="'+P.stoneX+'" stroke-width=".8"/>';
  g+='<text x="'+X(S.templeW)+'" y="'+(Y(tz)-18)+'" class="ax">TEMPLE</text>';

  g+='<text x="4" y="'+(Y(zTop)+4)+'" class="ax lft">'+Math.round(zTop)+' m</text>';
  g+='<text x="4" y="'+(Y(0)-2)+'" class="ax lft">river</text>';
  g+='<line x1="'+L+'" y1="'+Y(0)+'" x2="'+(W-R)+'" y2="'+Y(0)+'" class="gl"/>';
  g+='</svg>';
  return g;
}

A.model={ ready:ready, model:model, section:section, VZ:VZ, palette:P };
})();
