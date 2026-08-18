/* ===================================================================================
   NYC 2050 — street-view plates.
   Each scene is a hand-built procedural elevation of a real place as the survey
   found it. 1200 x 700 units; the ground plane sits near y = 470.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{}, K=NYC.svkit, C=K.C;
const {T,G,R,PT,PG,LN,EL,TX,r2,rng,pick,between}=K;

/* ---- shared shapes ---------------------------------------------------------------- */
/* bilinear patch, used for anything drawn in perspective */
function pt(q,u,v){
  const a=q[0],b=q[1],c=q[2],d=q[3];
  return [ (1-u)*(1-v)*a[0]+u*(1-v)*b[0]+u*v*c[0]+(1-u)*v*d[0],
           (1-u)*(1-v)*a[1]+u*(1-v)*b[1]+u*v*c[1]+(1-u)*v*d[1] ];
}
/* windows laid on a receding facade; ratio = near height / far height */
function quadGrid(q,cols,rows,seed,o){
  o=o||{}; const rand=rng(seed+13);
  const h0=Math.abs(q[3][1]-q[0][1]), h1=Math.abs(q[2][1]-q[1][1]);
  const ratio=o.ratio|| (h1>0?h0/h1:1);
  const U=s=> ratio===1?s : s*1/(ratio-s*(ratio-1))*1;  /* even spacing in world */
  const gx=o.gx==null?.36:o.gx, gy=o.gy==null?.4:o.gy;
  let now="",then="",dec="";
  for(let c=0;c<cols;c++){
    const u0=U((c+gx/2)/cols), u1=U((c+1-gx/2)/cols);
    for(let r=0;r<rows;r++){
      const v0=(r+gy/2)/rows, v1=(r+1-gy/2)/rows;
      const p=[pt(q,u0,v0),pt(q,u1,v0),pt(q,u1,v1),pt(q,u0,v1)];
      if(Math.abs(p[1][0]-p[0][0])<1.1) continue;
      now+=PG(p,{fill:o.dark||C.dark,opacity:r2(between(rand,.7,.95))});
      then+=PG(p,{fill:o.glass||C.glass,opacity:r2(between(rand,.5,.8))});
      const t=rand();
      if(t<(o.broken==null?.3:o.broken))
        dec+=PG([p[0],[(p[0][0]+p[1][0])/2,p[0][1]],p[3]],{fill:"#565B5F",opacity:.42});
      else if(t>.95&&o.lit) dec+=PG(p,{fill:o.lit,opacity:r2(between(rand,.3,.7))});
    }
  }
  return now+G(then,{class:"intact"})+G(dec,{class:"decay"});
}
/* a canyon of buildings receding to the vanishing point */
function corridor(seed,o){
  o=o||{}; const rand=rng(seed+101);
  const hz=o.hz||470, vp=o.vp==null?600:o.vp, n=o.n||5, f=o.f||.6;
  const W0=o.w||520, H0=o.h||430, B0=o.b||150;
  let back="",front="";
  [-1,1].forEach(side=>{
    let x=vp+side*W0, h=H0, b=B0;
    for(let i=0;i<n;i++){
      const nx=vp+side*W0*Math.pow(f,i+1), nh=H0*Math.pow(f,i+1), nb=B0*Math.pow(f,i+1);
      const q=[[x,hz-h],[nx,hz-nh],[nx,hz+nb],[x,hz+b]];
      const tone=pick(rand,[C.brickD,"#6E695E","#7A736A","#5F5A52","#877E70"]);
      let s=PG(q,{fill:tone});
      s+=PG(q,{fill:"#000",opacity:side<0?.1:.2});
      s+=quadGrid(q,Math.max(2,7-i),Math.max(2,9-i*2),seed+i*7+(side>0?50:0),
        {ratio:h/nh,broken:.34,lit:o.lit});
      /* cornice */
      s+=PG([[x,hz-h],[nx,hz-nh],[nx,hz-nh-6],[x,hz-h-9]],{fill:C.stoneD,opacity:.8});
      /* ground floor: shopfronts gone dark */
      const gq=[[x,hz+b*.1],[nx,hz+nb*.1],[nx,hz+nb],[x,hz+b]];
      s+=PG(gq,{fill:"#26292C",opacity:.85});
      s+=G(K.streaks(Math.min(x,nx),hz-h,Math.abs(nx-x),h,seed+i,{n:7})+
           K.ivy(Math.min(x,nx),hz-h*.4,Math.abs(nx-x),h*.4,seed+i*3,{n:2}),{class:"decay"});
      if(i>=n-2) back+=s; else front+=s;
      x=nx; h=nh; b=nb;
    }
  });
  return back+front;
}
/* a horse, in bronze, seen from the side */
function horse(x,y,s,o){
  o=o||{}; const d=o.flip?-1:1, col=o.col||C.patina;
  const X=a=>x+a*s*d, Y=b=>y+b*s;
  let g="";
  g+=EL(X(-2),Y(-34),25*s,13*s,{fill:col});                    /* barrel */
  g+=EL(X(-21),Y(-35),14*s,14*s,{fill:col});                   /* hindquarters */
  g+=EL(X(17),Y(-37),12*s,12*s,{fill:col});                    /* shoulder */
  g+=PG([[X(12),Y(-44)],[X(24),Y(-47)],[X(41),Y(-72)],[X(30),Y(-74)]],{fill:col});
  g+=PG([[X(30),Y(-74)],[X(41),Y(-72)],[X(54),Y(-76)],[X(52),Y(-84)],[X(35),Y(-83)]],
    {fill:col});                                               /* head */
  g+=PG([[X(34),Y(-83)],[X(35),Y(-92)],[X(40),Y(-82)]],{fill:col});   /* ear */
  g+=PT("M"+X(28)+" "+Y(-76)+"Q"+X(20)+" "+Y(-88)+" "+X(10)+" "+Y(-84),
    {fill:"none",stroke:col,"stroke-width":r2(4*s),"stroke-linecap":"round"});  /* mane */
  [[16,-3],[21,3],[-16,-3],[-23,3]].forEach(l=>{
    g+=PT("M"+X(l[0])+" "+Y(-30)+"q"+r2(l[1]*s*d)+" "+r2(14*s)+" "+r2(l[1]*.4*s*d)+" "+r2(30*s),
      {fill:"none",stroke:col,"stroke-width":r2(5*s),"stroke-linecap":"round"});
  });
  g+=PT("M"+X(-33)+" "+Y(-42)+"q"+r2(-12*s*d)+" "+r2(14*s)+" "+r2(-6*s*d)+" "+r2(30*s),
    {fill:"none",stroke:col,"stroke-width":r2(4.5*s),"stroke-linecap":"round"});  /* tail */
  return G(g,o.rear?{transform:"rotate("+(-34*d)+" "+r2(X(-21))+" "+r2(y)+")"}:null);
}
/* a standing winged figure — Victory, Fame, whichever the sculptor called her */
function winged(x,y,s,o){
  o=o||{}; const col=o.col||C.patina;
  let g=EL(x,y-54*s,7*s,8*s,{fill:col});
  g+=PT("M"+r2(x-8*s)+" "+r2(y-46*s)+"q"+r2(8*s)+" "+r2(-6*s)+" "+r2(16*s)+" 0"+
    "l"+r2(4*s)+" "+r2(30*s)+"q"+r2(-12*s)+" "+r2(6*s)+" "+r2(-24*s)+" 0Z",{fill:col});
  g+=R(x-8*s,y-16*s,7*s,18*s,col);
  g+=R(x+1*s,y-16*s,7*s,18*s,col);
  /* wings */
  g+=PT("M"+r2(x-6*s)+" "+r2(y-44*s)+"q"+r2(-20*s)+" "+r2(-14*s)+" "+r2(-26*s)+" "+r2(-30*s)+
    "q"+r2(4*s)+" "+r2(20*s)+" "+r2(22*s)+" "+r2(28*s)+"Z",{fill:col,opacity:.94});
  g+=PT("M"+r2(x+6*s)+" "+r2(y-44*s)+"q"+r2(20*s)+" "+r2(-14*s)+" "+r2(26*s)+" "+r2(-30*s)+
    "q"+r2(-4*s)+" "+r2(20*s)+" "+r2(-22*s)+" "+r2(28*s)+"Z",{fill:col,opacity:.94});
  if(o.arm) g+=LN(x+6*s,y-46*s,x+22*s,y-72*s,{stroke:col,"stroke-width":r2(4.5*s),
    "stroke-linecap":"round"});
  return G(g);
}
/* verdigris running out of a bronze onto the stone below */
function bleed(x,y,w,h,seed){
  const rand=rng(seed+17); let s="";
  for(let i=0;i<10;i++){
    const bx=between(rand,x,x+w);
    s+=R(bx,y,between(rand,2,9),between(rand,h*.3,h),C.patina,
      {opacity:r2(between(rand,.1,.32))});
  }
  return s;
}

const SCENES={};

/* =================================================================================== */
/* 1. SOLDIERS' AND SAILORS' MEMORIAL ARCH — GRAND ARMY PLAZA, BROOKLYN               */
/* =================================================================================== */
SCENES["arch-brooklyn"]={
  name:"Soldiers' and Sailors' Memorial Arch",
  sub:"GRAND ARMY PLAZA · PROSPECT PARK W AT FLATBUSH AV · BROOKLYN",
  mark:"Soldiers' and Sailors' Memorial Arch", disp:"STANDING",
  cap:"Granite, eighty feet, and no reason for anyone to pull it down. The bronze quadriga "+
      "lost a horse in the third winter; it lies where it landed, on the oval, and the plaza "+
      "has grown up around it. Notices are nailed to the north pier.",
  draw(){
    const hz=474, S=[];
    S.push(K.sky({seed:4,cloud:.62}));
    S.push(K.skyline(21,{base:hz-6,max:120,fill:"#8B9296",count:12}));
    S.push(G(K.treeMass(-40,360,420,120,9,{n:22})+K.treeMass(820,356,440,124,12,{n:22}),
      {opacity:.95}));
    S.push(K.haze(300,190));
    S.push(K.ground({horizon:hz,vp:600,seed:5,fill:"#726F66",cracks:26,pot:7}));

    /* --- the arch ---------------------------------------------------------------- */
    const a=[];
    /* stepped plinth */
    a.push(K.stone(372,440,456,36,C.stoneD,{course:false}));
    a.push(K.stone(382,428,436,14,C.stone,{course:false}));
    /* piers */
    a.push(K.stone(396,250,132,182,C.stoneL,{course:16,shade:true}));
    a.push(K.stone(672,250,132,182,C.stoneL,{course:16,shade:true}));
    /* the opening */
    a.push(PT(K.archPath(600,332,72,440),{fill:"#26282A"}));
    a.push(PT(K.archPath(600,332,72,440),{fill:"#000",opacity:.35}));
    /* coffered soffit, just visible */
    for(let i=0;i<6;i++) a.push(LN(534,352+i*16,666,352+i*16,{stroke:"#3A3D40",
      "stroke-width":1,opacity:.6}));
    a.push(K.voussoirs(600,332,72,13));
    /* spandrel medallions */
    a.push(EL(524,290,15,15,{fill:C.stone,stroke:"#00000022","stroke-width":1}));
    a.push(EL(676,290,15,15,{fill:C.stone,stroke:"#00000022","stroke-width":1}));
    /* column clusters at plaza level, as built */
    a.push(K.colonnade(410,510,432,336,4,15,{tone:C.stone,capTone:C.stoneL}));
    a.push(K.colonnade(690,790,432,336,4,15,{tone:C.stone,capTone:C.stoneL}));
    /* bronze relief groups on the pier faces */
    [[404,258],[688,258]].forEach((p,i)=>{
      a.push(R(p[0],p[1],108,72,C.patina,{opacity:.92}));
      a.push(G(horse(p[0]+30,p[1]+66,.62,{flip:i===1,col:"#3F6A5B"})+
        winged(p[0]+72,p[1]+64,.72,{col:"#3F6A5B",arm:true})+
        K.figure(p[0]+16,p[1]+68,.7,{col:"#3F6A5B"}),{opacity:.95}));
      a.push(R(p[0],p[1],108,72,"#000",{opacity:.12}));
    });
    /* attic and cornice */
    a.push(K.cornice(364,236,472,16,C.stoneL));
    a.push(K.stone(378,176,444,60,C.stoneL,{course:20}));
    a.push(TX(600,214,"TO THE DEFENDERS OF THE UNION",{"text-anchor":"middle",
      "font-size":15,fill:"#8E8877","font-family":"var(--mono)","letter-spacing":".14em",
      opacity:.75}));
    a.push(K.cornice(360,160,480,18,C.stoneL));
    S.push(G(a.join("")));

    /* --- the quadriga, one horse short ------------------------------------------- */
    const q=[];
    q.push(R(452,150,306,12,"#4E7F6F",{opacity:.95}));      /* the plinth it stands on */
    q.push(horse(508,150,.95,{rear:true,col:"#4A7C6C"}));
    q.push(horse(556,150,.95,{col:"#57897A"}));
    q.push(G(horse(694,150,.95,{flip:true,col:"#57897A"}),{class:"intact"}));
    q.push(horse(742,150,.95,{rear:true,flip:true,col:"#4A7C6C"}));
    q.push(winged(626,150,1.25,{col:C.patina,arm:true}));
    S.push(G(q.join("")));

    /* --- what a hundred years of neglect did ------------------------------------- */
    const d=[];
    d.push(K.streaks(378,176,444,60,7,{n:16}));
    d.push(bleed(404,330,108,110,3)); d.push(bleed(688,330,108,110,8));
    d.push(K.cracksOn(396,250,132,182,11,7));
    d.push(K.cracksOn(672,250,132,182,15,7));
    d.push(K.ivy(396,250,132,182,19,{n:7}));
    d.push(K.ivy(690,300,110,132,23,{n:4}));
    /* a bite out of the north cornice, and its rubble */
    d.push(PG([[742,160],[840,160],[840,178],[788,178],[762,170]],{fill:"#8E9296",opacity:.001}));
    d.push(PG([[760,160],[820,160],[818,180],[772,182]],{fill:C.skyMid,opacity:1}));
    d.push(K.rubble(806,476,120,29,{n:34,h:26}));
    /* the fallen horse, on the oval where it landed */
    d.push(G(horse(1010,588,1.35,{col:"#3F6A5B"}),
      {transform:"rotate(-98 1010 588)",opacity:.96}));
    d.push(K.rubble(1010,596,150,31,{n:14,h:10}));
    d.push(TX(890,624,"BRONZE — DO NOT CUT",{"font-size":11,fill:"#E8E3D4",
      "font-family":"var(--mono)","letter-spacing":".1em",opacity:.55}));
    /* growth through the plaza */
    d.push(K.sapling(452,470,1.5,33)); d.push(K.sapling(836,472,1.2,37));
    d.push(K.sapling(600,452,.7,41));
    d.push(K.grass(560,470,1,rng(45))); d.push(K.grass(660,472,1.1,rng(47)));
    /* notices nailed to the pier */
    for(let i=0;i<7;i++) d.push(R(416+ (i%3)*22, 372+Math.floor(i/3)*24, 18,15,"#D8D2C0",
      {opacity:.8,transform:"rotate("+((i%5)-2)*3+" "+(425+(i%3)*22)+" "+(380+Math.floor(i/3)*24)+")"}));
    S.push(G(d.join(""),{class:"decay"}));

    /* --- lamps, flagpoles, people ------------------------------------------------ */
    S.push(K.lamp(268,478,1.1,-7));
    S.push(K.lamp(942,478,1.1,4));
    S.push(R(1004,214,3,266,C.metalD,{opacity:.85}));
    S.push(G(PG([[1007,214],[1064,226],[1007,238]],{fill:"#8A8377",opacity:.7}),{class:"decay"}));
    S.push(K.figure(880,500,1.1,{col:"#33352F"}));
    S.push(K.figure(908,502,1,{col:"#3A3B36"}));
    S.push(G(K.birds(760,180,120,9,53,1)+K.birds(420,140,90,5,57,.8),{class:"decay"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 2. THE NEW MUSEUM — 235 BOWERY                                                     */
/* =================================================================================== */
SCENES["new-museum"]={
  name:"New Museum",
  sub:"235 BOWERY AT PRINCE ST · MANHATTAN · LOOKING EAST",
  mark:"New Museum", disp:"SALVAGE",
  cap:"Seven boxes stacked off-centre, wrapped in anodised mesh. The mesh has come away "+
      "from the top three and hangs in sheets over Prince Street. The ground floor is dry "+
      "and in use as a store; everything above the fourth box is open to the weather.",
  draw(){
    const hz=478, S=[];
    S.push(K.sky({seed:9,cloud:.5}));
    S.push(K.skyline(31,{base:hz-40,max:200,fill:"#868E92",count:11}));
    S.push(K.haze(280,200));
    S.push(K.ground({horizon:hz,vp:600,seed:11,fill:"#67655F",cracks:22,pot:8}));
    S.push(K.busWreck(90,588,1.05,103));
    /* flanking Bowery fabric: a tenement left, a cast-iron loft right */
    const L=[];
    L.push(R(60,206,300,272,C.brickD));
    L.push(K.windows(76,222,268,236,4,6,63,{broken:.4}));
    L.push(K.cornice(52,192,316,16,"#6A4A3C"));
    L.push(G(K.fireEscape(120,262,120,4,{step:52}),{}));
    L.push(K.shopfront(74,404,270,74,67,{}));
    S.push(G(L.join("")));
    const Rt=[];
    Rt.push(R(958,166,262,312,"#7A5F52"));
    Rt.push(K.windows(974,182,230,272,4,7,71,{broken:.36}));
    Rt.push(K.cornice(948,152,282,16,"#5F4A40"));
    Rt.push(K.shopfront(974,404,230,74,73,{}));
    S.push(G(Rt.join("")));

    /* --- the stack ---------------------------------------------------------------- */
    const boxes=[[430,398,272,80],[452,320,272,78],[416,250,272,70],
                 [446,184,272,66],[428,124,272,60],[458,66,250,58]];
    const b=[];
    boxes.forEach((bx,i)=>{
      const [x,y,w,h]=bx;
      b.push(R(x,y,w,h,i%2?"#B9BDBC":"#C6CAC8"));
      /* the mesh: a fine grid, self-shading */
      for(let gx=x+3;gx<x+w;gx+=5) b.push(LN(gx,y,gx,y+h,{stroke:"#9CA2A2",
        "stroke-width":.7,opacity:.55}));
      for(let gy=y+3;gy<y+h;gy+=5) b.push(LN(x,gy,x+w,gy,{stroke:"#A8ADAC",
        "stroke-width":.6,opacity:.4}));
      b.push(R(x,y,w,h,"#000",{opacity:i%2?.06:.02}));
      b.push(R(x,y+h-3,w,3,"#8A8F8E",{opacity:.8}));       /* the shadow line */
      /* the one strip window each box was given */
      if(i===1) b.push(R(x+18,y+22,140,10,C.dark,{opacity:.85}));
      if(i===3) b.push(R(x+130,y+18,110,9,C.dark,{opacity:.85}));
    });
    S.push(G(b.join("")));
    /* the later extension, folded and faceted, to the south */
    const e=[];
    e.push(PG([[730,158],[928,226],[928,478],[730,478]],{fill:"#A7ADAC"}));
    e.push(PG([[730,158],[928,226],[928,282],[730,222]],{fill:"#8F9695"}));
    e.push(PG([[752,250],[906,298],[906,322],[752,278]],{fill:C.dark,opacity:.85}));
    e.push(PG([[824,196],[884,218],[884,244],[824,224]],{fill:"#6E2A30",opacity:.92}));
    for(let gy=300;gy<478;gy+=26) e.push(LN(730,gy,928,gy,{stroke:"#8C9392",
      "stroke-width":.8,opacity:.6}));
    for(let gx=744;gx<928;gx+=26) e.push(LN(gx,282+ (gx-730)*.29,gx,478,
      {stroke:"#8C9392","stroke-width":.8,opacity:.5}));
    S.push(G(e.join("")));
    /* ground floor glazing */
    S.push(K.shopfront(430,404,272,74,77,{}));

    /* --- decay -------------------------------------------------------------------- */
    const d=[];
    /* mesh torn away from the upper boxes */
    d.push(PG([[458,66],[708,66],[708,124],[600,110],[540,124],[458,112]],
      {fill:"#4A4E50",opacity:.92}));
    d.push(PG([[428,124],[700,124],[700,150],[560,140],[428,152]],
      {fill:"#54585A",opacity:.75}));
    d.push(PG([[416,250],[470,250],[452,320],[402,318]],{fill:"#5A5E60",opacity:.6}));
    /* a sheet of it hanging over the street */
    d.push(PG([[704,124],[730,134],[746,244],[708,230]],{fill:"#C2C7C6",opacity:.92}));
    d.push(PG([[704,124],[730,134],[734,186],[706,176]],{fill:"#000",opacity:.12}));
    d.push(K.streaks(430,124,272,354,81,{n:20,col:"#4A4438"}));
    d.push(K.streaks(730,226,198,252,83,{n:12,col:C.rust}));
    d.push(K.ivy(430,398,272,80,87,{n:5}));
    d.push(K.ivy(958,300,262,178,89,{n:6}));
    d.push(K.cracksOn(60,206,300,272,91,6,"#4A3A30"));
    d.push(K.sapling(392,480,1.3,93));
    d.push(K.sapling(898,482,1,97));
    d.push(K.birds(560,90,140,7,101,.9));
    S.push(G(d.join(""),{class:"decay"}));

    /* --- the street --------------------------------------------------------------- */
    S.push(K.car(760,556,1.15,107,{}));
    S.push(K.car(1000,620,1.5,109,{}));
    S.push(K.lamp(354,506,1.15,-9));
    S.push(K.trafficSignal(940,500,1,111,{hang:true}));
    S.push(G(K.figure(520,540,1.25,{col:"#33352F"})+K.figure(548,546,1.15,{col:"#3E3F39"}),{}));
    S.push(G(TX(468,462,"STORE — WEIGH IN",{"font-size":12,fill:"#D8D2C0",
      "font-family":"var(--mono)","letter-spacing":".12em",opacity:.55}),{class:"decay"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 3. THE GUGGENHEIM — FIFTH AVENUE AT 89TH STREET                                    */
/* =================================================================================== */
SCENES["guggenheim"]={
  name:"Solomon R. Guggenheim Museum",
  sub:"1071 FIFTH AV AT E 89 ST · MANHATTAN · LOOKING WEST",
  mark:"Solomon R. Guggenheim Museum", disp:"SEALED",
  cap:"One room, a quarter of a mile long, wound six times around a well of air. The "+
      "skylight went first and the rain has been falling down the middle of it ever since. "+
      "The ramp is silted to the second turn. The doors are welded and the survey left them so.",
  draw(){
    const hz=478, cx=648, S=[];
    S.push(K.sky({seed:14,cloud:.62}));
    S.push(K.skyline(41,{base:hz-40,max:170,fill:"#8A9195",count:9,x0:820}));
    S.push(K.haze(300,200));
    S.push(K.ground({horizon:hz,vp:520,seed:19,fill:"#6B695F",cracks:24,pot:10}));
    S.push(K.car(120,556,1.15,131,{}));
    /* the park, gone to woodland, on the near side of Fifth */
    S.push(G(K.treeMass(-70,318,300,170,43,{n:26}),{opacity:.96}));

    /* --- the rectangular block to the north --------------------------------------- */
    const m=[];
    m.push(R(186,150,168,328,"#C4BFB2"));
    m.push(R(186,150,58,328,"#000",{opacity:.05}));
    m.push(R(186,142,168,12,"#CFCABC"));
    for(let i=0;i<5;i++) m.push(R(226+i*22,196,9,104,C.dark,{opacity:.8}));
    m.push(R(210,392,120,86,"#BAB5A8"));
    S.push(G(m.join("")));

    /* --- the rotunda: four turns of one continuous floor -------------------------- */
    const bands=[[148,372,478],[165,288,372],[182,206,288],[200,122,206]];
    const g=[];
    bands.forEach((bd,i)=>{
      const rx=bd[0], ytop=bd[1], ybot=bd[2], ry=Math.max(11,rx*.115);
      const tone=i%2?"#D2CDBF":"#D9D4C6";
      g.push(EL(cx,ybot,rx,ry,{fill:"#A29B8B"}));                 /* the overhang, from below */
      g.push(EL(cx,ybot,rx,ry*.62,{fill:"#8F8878",opacity:.55}));
      g.push(R(cx-rx,ytop,rx*2,ybot-ytop,tone));                  /* the drum */
      g.push(EL(cx,ytop,rx,ry,{fill:i%2?"#DCD7C9":"#E2DDCF"}));   /* the rim */
      g.push(R(cx-rx,ytop,rx*.3,ybot-ytop,"#000",{opacity:.05}));
      g.push(R(cx+rx*.44,ytop,rx*.56,ybot-ytop,"#000",{opacity:.11}));
      /* the ribbon of glass under each parapet */
      g.push(EL(cx,ytop+34,rx*.97,ry,{fill:"#5E6468",opacity:.62}));
      g.push(EL(cx,ytop+24,rx*.97,ry,{fill:tone}));
    });
    /* the glass dome over the well */
    g.push(EL(cx,122,200,23,{fill:"#C6C1B3"}));
    g.push(G(EL(cx,118,182,19,{fill:"#9FB2B6",opacity:.8}),{class:"intact"}));
    g.push(G(EL(cx,120,178,17,{fill:"#1E2226",opacity:.92})+
      PT("M"+(cx-178)+" 120 L"+(cx-90)+" 108 L"+cx+" 128 L"+(cx+86)+" 110 L"+(cx+178)+" 122",
        {fill:"none",stroke:"#8E9498","stroke-width":2,opacity:.7}),{class:"decay"}));
    S.push(G(g.join("")));

    /* --- the entrance wing, welded shut ------------------------------------------- */
    const e=[];
    e.push(R(846,398,190,80,"#CBC6B8"));
    e.push(R(846,390,190,12,"#D6D1C3"));
    e.push(R(884,420,114,58,"#3A3E42"));
    S.push(G(e.join("")));

    /* --- decay -------------------------------------------------------------------- */
    const d=[];
    d.push(K.streaks(cx-200,140,400,338,113,{n:28,col:"#5A5346"}));
    d.push(K.cracksOn(cx-190,220,380,250,117,10,"#8A8272"));
    [[520,330],[742,262],[566,420],[720,376]].forEach(pp=>{
      d.push(PG([[pp[0],pp[1]],[pp[0]+26,pp[1]-5],[pp[0]+33,pp[1]+11],[pp[0]+6,pp[1]+16]],
        {fill:"#B6AC98",opacity:.6}));
      d.push(LN(pp[0]+4,pp[1]+3,pp[0]+29,pp[1]-1,{stroke:C.rust,"stroke-width":1.1,opacity:.6}));
      d.push(LN(pp[0]+6,pp[1]+10,pp[0]+31,pp[1]+6,{stroke:C.rust,"stroke-width":1,opacity:.5}));
    });
    d.push(K.ivy(cx-148,330,296,148,119,{n:9}));
    d.push(K.ivy(846,398,190,80,120,{n:3}));
    d.push(K.sapling(cx+150,206,1.1,121));
    d.push(K.sapling(220,150,.9,123));
    d.push(K.streaks(186,150,168,328,127,{n:12}));
    d.push(R(884,420,114,58,"#4A4F52",{opacity:.95}));
    d.push(LN(884,438,998,438,{stroke:"#5E6366","stroke-width":3,opacity:.9}));
    d.push(LN(884,460,998,460,{stroke:"#5E6366","stroke-width":3,opacity:.9}));
    d.push(TX(941,496,"SEALED · SURVEY 2049",{"text-anchor":"middle","font-size":10,
      fill:"#D8D2C0","font-family":"var(--mono)","letter-spacing":".1em",opacity:.6}));
    S.push(G(d.join(""),{class:"decay"}));

    /* --- Fifth Avenue ------------------------------------------------------------- */
    S.push(K.car(880,606,1.35,133,{}));
    S.push(K.lamp(1096,492,1.2,6));
    S.push(K.trafficSignal(150,492,1,137,{hang:true}));
    S.push(G(K.weedLine(139,490,22)+K.birds(860,170,110,8,141,1),{class:"decay"}));
    S.push(K.figure(1010,540,1.2,{col:"#33352F"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 4. WEST 34TH STREET, LOOKING EAST TO THE EMPIRE STATE BUILDING                     */
/* =================================================================================== */
SCENES["empire-34th"]={
  name:"Empire State Building",
  sub:"W 34 ST AT SEVENTH AV · MANHATTAN · LOOKING EAST",
  mark:"Empire State Building", disp:"SEALED",
  cap:"Thirty-fourth Street holds a foot of standing water from Seventh Avenue to Sixth "+
      "and drains no further. The building above it is sound, dry, and entirely useless: "+
      "eighty-six floors, no lift, and a stair that is sealed at the sixth landing.",
  draw(){
    const hz=468, vp=612, S=[];
    S.push(K.sky({seed:23,cloud:.55}));
    S.push(K.skyline(51,{base:hz-20,max:170,fill:"#8D9498",count:13}));

    /* --- the tower, at the end of the street ------------------------------------- */
    const t=[];
    const body="#8E8B80";
    t.push(R(520,214,186,254,body));                       /* the base block */
    t.push(R(520,214,186,254,"#000",{opacity:.06}));
    t.push(R(538,150,150,66,"#96938A"));                   /* first setback */
    t.push(R(556,96,114,56,"#9C9990"));                    /* the shaft */
    t.push(R(572,58,82,40,"#A29F96"));
    t.push(R(586,34,54,26,"#A8A59C"));
    t.push(R(600,10,26,26,"#B0ADA4"));                     /* the mooring mast */
    t.push(K.windows(528,224,170,238,11,17,143,{broken:.26,gx:.42,gy:.42}));
    t.push(K.windows(544,158,138,54,9,4,147,{broken:.26,gx:.42,gy:.42}));
    t.push(K.windows(562,102,102,46,7,4,149,{broken:.24,gx:.42,gy:.42}));
    t.push(K.windows(576,62,74,32,5,3,151,{broken:.22,gx:.42,gy:.42}));
    /* the vertical mullions that make it read as limestone and steel */
    for(let i=0;i<12;i++) t.push(LN(528+i*15.4,214,528+i*15.4,468,{stroke:"#7E7B72",
      "stroke-width":1.6,opacity:.5}));
    t.push(R(516,206,194,10,"#A5A299"));
    t.push(R(534,144,158,8,"#ABA89F"));
    S.push(G(t.join("")));
    const td=[];
    td.push(K.streaks(520,214,186,254,153,{n:22}));
    td.push(LN(613,10,626,-16,{stroke:C.metalD,"stroke-width":3,opacity:.9}));
    td.push(PT("M626 -16 q18 26 4 54",{fill:"none",stroke:"#5E6265","stroke-width":1.2,
      opacity:.8}));                                        /* a cable, still hanging */
    td.push(K.ivy(520,380,186,88,157,{n:5}));
    S.push(G(td.join(""),{class:"decay"}));
    S.push(K.haze(300,180));

    /* --- the canyon --------------------------------------------------------------- */
    S.push(corridor(29,{hz:hz,vp:vp,n:5,f:.585,w:560,h:452,b:132}));
    S.push(K.haze(340,140));
    S.push(K.ground({horizon:hz,vp:vp,seed:31,fill:"#63615B",cracks:18,pot:12,weeds:false}));
    S.push(G(K.flood(520,159,{opacity:.72,reflect:true}),{class:"decay"}));

    /* --- the street, under water -------------------------------------------------- */
    /* traffic left where it stopped */
    S.push(K.car(190,556,1.35,161,{}));
    S.push(K.car(360,514,1.05,163,{}));
    S.push(K.busWreck(830,548,1.2,167));
    S.push(K.car(1040,600,1.6,169,{}));
    S.push(K.trafficSignal(300,506,1.15,171,{hang:true}));
    S.push(K.trafficSignal(950,502,1.1,173,{hang:true}));
    S.push(K.lamp(120,520,1.4,-6));
    S.push(G(K.figure(660,506,1.05,{col:"#33352F"}),{}));
    S.push(G(K.birds(420,120,150,11,177,1)+
      K.deadSign(96,246,120,60,179,"")+K.deadSign(1030,224,130,64,181,""),{class:"decay"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 5. THE FLATIRON BUILDING — 23RD, FIFTH AND BROADWAY                                */
/* =================================================================================== */
SCENES["flatiron"]={
  name:"Flatiron Building",
  sub:"175 FIFTH AV AT E 23 ST · MANHATTAN · LOOKING NORTH FROM MADISON SQ",
  mark:"Flatiron Building", disp:"STANDING",
  cap:"Six feet wide at the prow and twenty-two storeys tall. The terracotta is coming "+
      "off the upper floors in sheets and the survey has drawn a fall line across both "+
      "streets. Nothing above the sixth floor is reachable. Nothing below it is worth reaching.",
  draw(){
    const hz=474, S=[];
    S.push(K.sky({seed:33,cloud:.5}));
    S.push(K.skyline(61,{base:hz-40,max:210,fill:"#878E92",count:12}));
    S.push(K.haze(280,200));
    S.push(K.ground({horizon:hz,vp:600,seed:37,fill:"#6B6960",cracks:24,pot:10}));
    /* the buildings on either avenue, well behind */
    S.push(G(R(40,244,300,230,"#7C766C")+K.windows(56,262,268,196,7,8,183,{broken:.4})+
      K.cornice(30,230,320,16,"#6E6A60"),{opacity:.95}));
    S.push(G(R(920,222,300,252,"#746E66")+K.windows(936,240,268,218,7,9,187,{broken:.4})+
      K.cornice(910,208,320,16,"#66625A"),{opacity:.95}));

    /* --- the wedge ---------------------------------------------------------------- */
    const prowTop=62, prowBase=490, sideTop=150, sideBase=454;
    const left =[[600,prowTop],[352,sideTop],[352,sideBase],[600,prowBase]];
    const right=[[600,prowTop],[846,sideTop],[846,sideBase],[600,prowBase]];
    const f=[];
    f.push(PG(left,{fill:"#B5A899"}));
    f.push(PG(right,{fill:"#A2968A"}));
    f.push(PG(right,{fill:"#000",opacity:.12}));
    /* floor bands */
    for(let i=1;i<23;i++){
      const v=i/23;
      const a=pt(left,0,v), b=pt(left,1,v), c=pt(right,1,v), e=pt(right,0,v);
      f.push(LN(a[0],a[1],b[0],b[1],{stroke:"#00000018","stroke-width":.8}));
      f.push(LN(e[0],e[1],c[0],c[1],{stroke:"#00000018","stroke-width":.8}));
    }
    f.push(quadGrid(left,8,22,191,{ratio:(prowBase-prowTop)/(sideBase-sideTop),broken:.34}));
    f.push(quadGrid(right,8,22,193,{ratio:(prowBase-prowTop)/(sideBase-sideTop),broken:.34}));
    /* the rounded prow, which is what everyone remembers */
    f.push(R(590,prowTop,20,prowBase-prowTop,"#C0B3A3"));
    f.push(R(590,prowTop,20,prowBase-prowTop,"#000",{opacity:.04}));
    for(let i=1;i<23;i++){
      const y=prowTop+(prowBase-prowTop)*i/23;
      f.push(LN(590,y,610,y,{stroke:"#00000020","stroke-width":.8}));
      f.push(R(594,y-9,12,7,C.dark,{opacity:.8}));
    }
    /* the great cornice */
    f.push(PG([[600,prowTop],[352,sideTop],[352,sideTop-14],[600,prowTop-19]],
      {fill:"#C6B9A8"}));
    f.push(PG([[600,prowTop],[846,sideTop],[846,sideTop-14],[600,prowTop-19]],
      {fill:"#B6A899"}));
    /* the two-storey base, arcaded */
    f.push(PG([[600,prowBase-72],[352,sideBase-58],[352,sideBase],[600,prowBase]],
      {fill:"#8E8478"}));
    f.push(PG([[600,prowBase-72],[846,sideBase-58],[846,sideBase],[600,prowBase]],
      {fill:"#807769"}));
    S.push(G(f.join("")));

    /* --- decay -------------------------------------------------------------------- */
    const d=[];
    /* terracotta shed from the top floors, on both faces */
    d.push(PG([[600,prowTop-19],[506,prowTop-6],[504,118],[600,100]],{fill:"#9C9084",opacity:.9}));
    d.push(PG([[694,116],[800,140],[798,172],[692,148]],{fill:"#8E8377",opacity:.85}));
    d.push(K.streaks(352,150,494,304,197,{n:26}));
    d.push(K.ivy(352,330,248,150,199,{n:7}));
    d.push(K.ivy(600,340,246,136,211,{n:5}));
    d.push(K.rubble(452,486,190,213,{n:40,h:32}));
    d.push(K.rubble(788,472,120,217,{n:22,h:18}));
    d.push(K.cracksOn(352,180,494,270,223,10,"#7E7466"));
    S.push(G(d.join(""),{class:"decay"}));

    /* --- the street --------------------------------------------------------------- */
    /* the two roadways splitting round the prow */
    S.push(LN(600,486,240,700,{stroke:"#83817A","stroke-width":2,opacity:.3}));
    S.push(LN(600,486,980,700,{stroke:"#83817A","stroke-width":2,opacity:.3}));
    /* a rank of cabs that never moved */
    S.push(K.car(150,616,1.5,227,{col:"#8A7238"}));
    S.push(K.car(320,566,1.2,229,{col:"#8A7238"}));
    S.push(K.car(452,532,1,231,{col:"#7E6C3E"}));
    S.push(K.car(900,590,1.4,233,{}));
    S.push(K.lamp(1010,500,1.3,5));
    S.push(K.trafficSignal(214,510,1.2,239,{hang:true}));
    /* Madison Square, gone to scrub */
    S.push(G(K.treeMass(-40,392,300,110,241,{n:16})+K.sapling(266,500,1.5,243)+
      K.sapling(1084,512,1.7,247)+K.weedLine(251,492,20),{class:"decay"}));
    S.push(G(K.figure(700,520,1.15,{col:"#34362F"})+K.figure(726,524,1.05,{col:"#3C3D37"}),{}));
    S.push(G(K.birds(560,110,160,10,253,1),{class:"decay"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 6. WASHINGTON SQUARE ARCH                                                          */
/* =================================================================================== */
SCENES["washington-arch"]={
  name:"Washington Square Arch",
  sub:"WASHINGTON SQ N AT FIFTH AV · MANHATTAN · LOOKING NORTH",
  mark:"Washington Square Arch", disp:"STANDING",
  cap:"The arch is sound. The park around it is thirteen acres of worked soil — the "+
      "largest cultivated ground below Fifty-ninth Street — and the fountain basin has "+
      "been given over to reeds and rainwater. Fifth Avenue begins on the far side and goes nowhere.",
  draw(){
    const hz=470, S=[];
    S.push(K.sky({seed:43,cloud:.45}));
    S.push(K.skyline(71,{base:hz-30,max:190,fill:"#8B9296",count:12}));
    S.push(G(K.treeMass(-60,330,300,150,73,{n:20})+K.treeMass(900,326,360,154,79,{n:22})));
    S.push(K.haze(310,180));
    S.push(K.ground({horizon:hz,vp:600,seed:41,fill:"#75705F",cracks:14,pot:4,weeds:false}));

    /* --- the arch ----------------------------------------------------------------- */
    const a=[];
    a.push(K.stone(452,438,296,32,C.stoneD,{course:false}));
    a.push(K.stone(462,236,90,206,"#DAD5C6",{course:18}));
    a.push(K.stone(648,236,90,206,"#DAD5C6",{course:18}));
    a.push(PT(K.archPath(600,318,46,442),{fill:"#2C2E30"}));
    a.push(PT(K.archPath(600,318,46,442),{fill:"#000",opacity:.3}));
    a.push(K.voussoirs(600,318,46,11));
    /* spandrel figures */
    a.push(G(winged(536,300,.5,{col:"#B9B2A0"})+winged(664,300,.5,{col:"#B9B2A0"}),
      {opacity:.85}));
    /* the two statues in their niches */
    [[494,438],[706,438]].forEach(p=>{
      a.push(R(p[0]-22,p[1]-96,44,96,"#C8C2B2"));
      a.push(R(p[0]-22,p[1]-96,44,10,"#D8D2C2"));
      a.push(K.figure(p[0],p[1]-8,1.5,{col:"#B4AD9B"}));
    });
    a.push(K.cornice(444,220,312,16,"#E0DBCC"));
    a.push(K.stone(456,172,288,48,"#DAD5C6",{course:20}));
    a.push(TX(600,204,"LET US RAISE A STANDARD",{"text-anchor":"middle","font-size":11,
      fill:"#8E8877","font-family":"var(--mono)","letter-spacing":".12em",opacity:.7}));
    a.push(K.cornice(440,154,320,18,"#E4DFD0"));
    a.push(K.stone(470,138,260,18,"#D6D1C2",{course:false}));
    const TR="translate(600 470) scale(1.18) translate(-600 -470)";
    S.push(G(a.join(""),{transform:TR}));

    const d=[];
    d.push(K.streaks(456,172,288,268,257,{n:20,col:"#4A4438"}));
    d.push(K.cracksOn(462,240,90,200,259,6,"#9E9686"));
    d.push(K.cracksOn(648,240,90,200,263,6,"#9E9686"));
    d.push(K.ivy(648,300,90,142,269,{n:5}));
    d.push(PG([[440,154],[510,154],[506,172],[444,172]],{fill:C.skyMid}));
    d.push(K.rubble(478,470,90,271,{n:20,h:16}));
    d.push(K.sapling(560,150,.7,277));
    S.push(G(d.join(""),{class:"decay",transform:TR}));

    /* --- the park under cultivation ----------------------------------------------- */
    const p=[];
    for(let i=0;i<9;i++){
      const y=486+i*22, spread=1+i*.28;
      p.push(LN(600-360*spread,y+5,600+360*spread,y+5,{stroke:"#5E5442",
        "stroke-width":3+i*.7,opacity:.5}));
      p.push(LN(600-360*spread,y,600+360*spread,y,{stroke:"#6E7A4A","stroke-width":2+i*.5,
        opacity:.6}));
      for(let j=0;j<26;j++)
        p.push(K.grass(600-340*spread+j*(680*spread/26),y+2,.4+i*.12,rng(281+i*10+j)));
    }
    S.push(G(p.join(""),{class:"decay"}));
    /* the fountain basin, full of reeds */
    S.push(EL(600,600,196,54,{fill:"#7E7A6C"}));
    S.push(EL(600,600,178,44,{fill:C.water,opacity:.85}));
    S.push(G(K.grass(520,592,1.8,rng(293))+K.grass(600,586,2,rng(297))+
      K.grass(676,594,1.7,rng(307))+K.grass(560,606,1.5,rng(311)),{class:"decay"}));
    S.push(K.figure(300,540,1.4,{col:"#33352F"}));
    S.push(K.figure(332,548,1.3,{col:"#3C3D37"}));
    S.push(K.figure(958,560,1.5,{col:"#35362F"}));
    S.push(G(K.birds(760,140,120,7,313,1),{class:"decay"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 7. GRAND CENTRAL TERMINAL — 42ND STREET FACADE                                     */
/* =================================================================================== */
SCENES["grand-central"]={
  name:"Grand Central Terminal",
  sub:"E 42 ST AT PARK AV · MANHATTAN · LOOKING NORTH",
  mark:"Grand Central Terminal", disp:"FLOODED",
  cap:"Water comes out of the terminal, not into it: the lower loops fill from the "+
      "Lexington trunk and discharge across Forty-second Street at a steady rate the "+
      "survey has not been able to account for. The concourse above is dry and empty.",
  draw(){
    const hz=476, S=[];
    S.push(K.sky({seed:53,cloud:.5}));
    /* the tower that was built over the terminal */
    S.push(R(430,44,340,158,"#7E8286"));
    S.push(K.windows(444,58,312,130,14,6,317,{broken:.3}));
    S.push(K.skyline(81,{base:hz-60,max:230,fill:"#868D91",count:12}));
    S.push(K.haze(260,210));

    /* --- the facade --------------------------------------------------------------- */
    const f=[];
    f.push(K.stone(280,200,640,276,"#C2BBA8",{course:22}));
    /* three great arched windows */
    [400,600,800].forEach((cx,i)=>{
      f.push(PT(K.archPath(cx,300,74,418),{fill:"#D0C9B6"}));
      f.push(PT(K.archPath(cx,304,66,412),{fill:"#23262A"}));
      /* the steel tracery */
      for(let j=1;j<6;j++) f.push(LN(cx-66+j*22,238,cx-66+j*22,412,
        {stroke:"#6E7276","stroke-width":2,opacity:.75}));
      for(let j=1;j<5;j++) f.push(LN(cx-66,304+j*26,cx+66,304+j*26,
        {stroke:"#6E7276","stroke-width":1.6,opacity:.7}));
      f.push(G(PT(K.archPath(cx,304,66,412),{fill:"#9EAFB4",opacity:.55}),{class:"intact"}));
      f.push(K.voussoirs(cx,300,74,13));
    });
    /* the paired columns between them */
    f.push(K.colonnade(492,516,476,236,2,22,{tone:"#CCC5B2",capTone:"#D8D1BE"}));
    f.push(K.colonnade(688,712,476,236,2,22,{tone:"#CCC5B2",capTone:"#D8D1BE"}));
    f.push(K.column(304,476,236,24,{tone:"#CCC5B2"}));
    f.push(K.column(896,476,236,24,{tone:"#CCC5B2"}));
    /* attic, and the sculpture group with the clock */
    f.push(K.cornice(268,178,664,22,"#CEC7B4"));
    f.push(K.stone(300,140,600,40,"#C6BFAC",{course:false}));
    const cl=[];
    cl.push(EL(600,152,44,44,{fill:"#D6CFBC",stroke:"#8E8877","stroke-width":2}));
    cl.push(EL(600,152,34,34,{fill:"#B9B2A0"}));
    cl.push(LN(600,152,600,130,{stroke:"#3A3B38","stroke-width":2.4}));
    cl.push(LN(600,152,616,160,{stroke:"#3A3B38","stroke-width":2}));
    cl.push(K.figure(548,168,2,{col:"#B4AD9B"}));
    cl.push(K.figure(654,168,2,{col:"#B4AD9B"}));
    cl.push(winged(600,118,1,{col:"#BEB7A5",arm:true}));
    f.push(G(cl.join("")));
    /* the doors, at street level */
    for(let i=0;i<5;i++) f.push(R(352+i*112,410,64,66,"#2E3134"));
    S.push(G(f.join("")));

    const d=[];
    d.push(K.streaks(280,200,640,276,319,{n:30,col:"#4A4438"}));
    d.push(K.cracksOn(280,220,640,250,323,12,"#8E8676"));
    d.push(K.ivy(280,340,640,136,331,{n:11}));
    d.push(K.sapling(330,178,1,337)); d.push(K.sapling(866,178,1.2,347));
    /* the clock, cracked */
    d.push(LN(576,132,624,176,{stroke:"#5E5C56","stroke-width":1.4,opacity:.9}));
    S.push(G(d.join(""),{class:"decay"}));

    /* --- 42nd Street, and the outfall --------------------------------------------- */
    S.push(K.ground({horizon:hz,vp:600,seed:59,fill:"#63615B",cracks:20,pot:8,weeds:false}));
    /* the Park Avenue viaduct, one span down */
    S.push(G(PG([[80,404],[268,404],[268,432],[80,440]],{fill:"#7A756B"})+
      PG([[932,404],[1128,404],[1128,440],[932,432]],{fill:"#726D64"})+
      K.column(140,476,432,26,{tone:"#6E6960"})+K.column(1064,476,432,26,{tone:"#6E6960"}),{}));
    S.push(G(PG([[268,404],[356,414],[352,446],[268,432]],{fill:"#6E6960",opacity:.001})+
      K.rubble(300,494,180,349,{n:34,h:30})+
      LN(268,410,344,452,{stroke:C.rust,"stroke-width":2,opacity:.8})+
      LN(268,420,338,466,{stroke:C.rust,"stroke-width":1.6,opacity:.7}),{class:"decay"}));
    /* water running out of the doors and down the street */
    S.push(G(K.flood(534,353,{opacity:.8,reflect:true})+
      PG([[352,470],[416,470],[470,700],[300,700]],{fill:C.waterL,opacity:.28})+
      PG([[576,470],[640,470],[700,700],[520,700]],{fill:C.waterL,opacity:.24}),{class:"decay"}));
    S.push(K.car(1020,600,1.5,359,{}));
    S.push(K.busWreck(60,560,1.15,367));
    S.push(K.trafficSignal(960,506,1.15,373,{hang:true}));
    S.push(K.lamp(200,516,1.3,-5));
    S.push(G(K.figure(760,512,1.1,{col:"#33352F"})+K.birds(460,120,150,9,379,1),{}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 8. TIMES SQUARE                                                                    */
/* =================================================================================== */
SCENES["times-square"]={
  name:"Times Square",
  sub:"BROADWAY AT W 45 ST · MANHATTAN · LOOKING SOUTH",
  mark:"Times Square", disp:"STANDING",
  cap:"Every surface here was a screen and every screen is out. The survey party recorded "+
      "the sound level at the centre of the square and noted it as the quietest reading "+
      "taken anywhere on the island, including the parks.",
  draw(){
    const hz=470, vp=596, S=[];
    S.push(K.sky({seed:63,cloud:.6}));
    S.push(K.skyline(91,{base:hz-90,max:250,fill:"#828A8E",count:10}));
    S.push(K.haze(240,220));
    S.push(K.ground({horizon:hz,vp:vp,seed:71,fill:"#67655F",cracks:26,pot:9}));
    S.push(corridor(67,{hz:hz,vp:vp,n:5,f:.6,w:600,h:470,b:150}));

    /* --- the wedge at the middle of the square ------------------------------------ */
    const w=[];
    w.push(PG([[520,120],[672,120],[672,470],[520,470]],{fill:"#6A665E"}));
    w.push(PG([[520,120],[672,120],[672,140],[520,140]],{fill:"#7A766C"}));
    for(let i=0;i<7;i++) w.push(K.deadSign(528,150+i*46,136,38,401+i,""));
    w.push(R(590,72,8,50,C.metalD,{opacity:.9}));
    w.push(EL(594,70,20,20,{fill:"#5E6266"}));
    w.push(G(EL(594,70,20,20,{fill:"#C8CBC4",opacity:.7}),{class:"intact"}));
    S.push(G(w.join("")));

    /* --- the signage that is left ------------------------------------------------- */
    const s=[];
    s.push(K.deadSign(60,150,220,150,411,"")); 
    s.push(K.deadSign(70,318,190,90,413,""));
    s.push(K.deadSign(300,206,150,190,417,""));
    s.push(K.deadSign(760,180,180,210,419,""));
    s.push(K.deadSign(960,140,220,180,421,""));
    s.push(K.deadSign(978,340,180,80,431,""));
    S.push(G(s.join("")));
    const d=[];
    d.push(K.scaffold(300,206,150,190,433));
    d.push(PG([[960,140],[1180,140],[1180,170],[1080,166],[960,182]],{fill:"#4E5256",opacity:.9}));
    d.push(K.ivy(60,150,220,150,437,{n:5}));
    d.push(K.ivy(760,180,180,212,439,{n:5}));
    d.push(K.streaks(520,140,152,330,443,{n:16}));
    d.push(K.sapling(560,124,1,449));
    d.push(K.birds(400,110,180,16,457,1.1));
    S.push(G(d.join(""),{class:"decay"}));

    /* --- the ground --------------------------------------------------------------- */
    /* the red steps, which are still red */
    S.push(G(PG([[780,470],[1060,470],[1100,560],[800,560]],{fill:"#8E3A34"})+
      PG([[790,494],[1080,494],[1084,506],[794,506]],{fill:"#7A312C"})+
      PG([[798,522],[1092,522],[1096,536],[802,536]],{fill:"#6E2C28"}),{}));
    /* paper, in drifts */
    const pr=rng(461); let paper="";
    for(let i=0;i<90;i++){
      const x=K.between(pr,-20,1220), y=K.between(pr,hz+8,700);
      paper+=PG([[x,y],[x+K.between(pr,4,14),y-K.between(pr,1,5)],
        [x+K.between(pr,6,16),y+K.between(pr,2,6)]],
        {fill:"#D6D2C4",opacity:K.r2(K.between(pr,.2,.7))});
    }
    S.push(G(paper,{class:"decay"}));
    S.push(K.car(120,584,1.4,463,{col:"#8A7238"}));
    S.push(K.busWreck(360,542,1,467));
    S.push(K.lamp(700,502,1.2,4));
    S.push(K.figure(620,516,1.3,{col:"#33352F"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 9. THE BROOKLYN BRIDGE — MANHATTAN APPROACH                                        */
/* =================================================================================== */
SCENES["brooklyn-bridge"]={
  name:"Brooklyn Bridge",
  sub:"MANHATTAN APPROACH · PARK ROW · LOOKING EAST TO BROOKLYN",
  mark:"Brooklyn Bridge", disp:"STANDING",
  cap:"The towers and the main cables are sound. The deck is not: a forty-foot breach "+
      "opened short of the Manhattan tower and has been bridged with timber and rope. "+
      "One person at a time, on a still day, is the standing instruction.",
  draw(){
    const hz=430, S=[];
    S.push(K.sky({seed:73,cloud:.55}));
    S.push(K.skyline(101,{base:hz+6,max:180,fill:"#7F878B",count:14,x0:520}));
    S.push(K.haze(250,190));
    /* the river, risen */
    S.push(K.flood(hz,467,{opacity:.9,reflect:true}));

    /* --- the near tower ----------------------------------------------------------- */
    function tower(cx,base,top,w,tone){
      const t=[];
      const h=base-top;
      t.push(K.stone(cx-w/2,top,w,h,tone,{course:20}));
      /* the two pointed openings */
      [[-w*.24],[w*.24]].forEach(o=>{
        const ax=cx+o[0], r=w*.16, spring=top+h*.34;
        t.push(PT("M"+r2(ax-r)+" "+r2(base-8)+"L"+r2(ax-r)+" "+r2(spring)+
          "L"+r2(ax)+" "+r2(spring-r*1.15)+"L"+r2(ax+r)+" "+r2(spring)+
          "L"+r2(ax+r)+" "+r2(base-8)+"Z",{fill:"#2A2D30"}));
      });
      t.push(PG([[cx-w/2-8,top],[cx+w/2+8,top],[cx+w/2,top-12],[cx-w/2,top-12]],{fill:tone}));
      return t.join("");
    }
    S.push(tower(360,470,84,150,"#A08A78"));
    S.push(tower(898,432,196,74,"#8E7C6C"));
    /* the cables */
    const cab=[];
    [[-1,0],[1,0]].forEach(()=>{});
    cab.push(PT("M60 214 Q210 300 360 116",{fill:"none",stroke:"#4A4F52","stroke-width":4}));
    cab.push(PT("M360 116 Q630 330 898 214",{fill:"none",stroke:"#4A4F52","stroke-width":4}));
    cab.push(PT("M898 214 Q1050 290 1180 250",{fill:"none",stroke:"#4A4F52","stroke-width":3}));
    cab.push(PT("M60 244 Q210 324 360 140",{fill:"none",stroke:"#565B5E","stroke-width":2.4}));
    cab.push(PT("M360 140 Q630 348 898 236",{fill:"none",stroke:"#565B5E","stroke-width":2.4}));
    /* the diagonal stays that make the web */
    for(let i=1;i<14;i++){
      const x=360+i*38;
      cab.push(LN(360,126+i*4,x,404-i*6,{stroke:"#5A5F62","stroke-width":1,opacity:.6}));
      cab.push(LN(360,126+i*4,360-i*22,404-i*2,{stroke:"#5A5F62","stroke-width":1,opacity:.5}));
    }
    /* suspenders */
    for(let i=0;i<26;i++){
      const t=i/26, x=360+t*538;
      const cy=116+(1-Math.pow(2*t-1,2))*214 + t*98;
      cab.push(LN(x,cy,x,404-t*4,{stroke:"#63686B","stroke-width":.9,opacity:.75}));
    }
    S.push(G(cab.join("")));

    /* --- the deck ----------------------------------------------------------------- */
    S.push(G(PG([[-20,462],[1220,398],[1220,414],[-20,486]],{fill:"#6E6A62"})+
      PG([[-20,486],[1220,414],[1220,424],[-20,500]],{fill:"#5A574F"})+
      /* the promenade rail */
      LN(-20,452,1220,392,{stroke:"#55595C","stroke-width":2,opacity:.8}),{}));
    const d=[];
    /* the breach */
    d.push(PG([[520,444],[660,436],[662,458],[520,466]],{fill:C.water,opacity:.95}));
    d.push(LN(520,444,540,470,{stroke:C.rust,"stroke-width":2,opacity:.9}));
    d.push(LN(560,440,572,468,{stroke:C.rust,"stroke-width":1.6,opacity:.85}));
    d.push(LN(620,438,634,464,{stroke:C.rust,"stroke-width":1.8,opacity:.85}));
    /* the timber that was laid across it */
    d.push(PG([[516,438],[666,430],[666,438],[516,446]],{fill:"#6E5A42"}));
    d.push(PG([[516,446],[666,438],[666,444],[516,452]],{fill:"#5E4C38"}));
    for(let i=0;i<8;i++) d.push(LN(524+i*18,432,524+i*18,450,{stroke:"#4E3F2E",
      "stroke-width":1.2,opacity:.8}));
    /* snapped suspenders, hanging */
    d.push(PT("M700 322 q6 44 -14 74",{fill:"none",stroke:"#63686B","stroke-width":1.2}));
    d.push(PT("M778 344 q10 40 -8 66",{fill:"none",stroke:"#63686B","stroke-width":1.2}));
    d.push(K.ivy(300,300,120,170,479,{n:5}));
    d.push(K.sapling(360,84,1,487));
    d.push(K.streaks(285,84,150,386,491,{n:14}));
    d.push(K.birds(560,190,220,14,499,1.2));
    S.push(G(d.join(""),{class:"decay"}));
    /* a wreck under the span */
    S.push(G(PG([[120,560],[300,548],[318,592],[104,600]],{fill:"#6E6960",opacity:.9})+
      R(180,516,70,34,"#7A756B",{opacity:.9})+
      PT("M250 516 l30 -40",{stroke:"#5A574F","stroke-width":3,fill:"none"}),{class:"decay"}));
    S.push(K.figure(470,442,1.1,{col:"#33352F"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 10. ST PATRICK'S CATHEDRAL — FIFTH AVENUE                                          */
/* =================================================================================== */
SCENES["st-patricks"]={
  name:"St. Patrick's Cathedral",
  sub:"FIFTH AV AT E 50 ST · MANHATTAN · LOOKING WEST",
  mark:"St. Patrick's Cathedral", disp:"STANDING",
  cap:"The largest intact interior volume in Midtown, built to work without power and "+
      "still working. The north spire lost its top forty feet and the marble came down "+
      "across Fifth Avenue, where it remains.",
  draw(){
    const hz=474, S=[];
    S.push(K.sky({seed:83,cloud:.5}));
    /* the glass slabs of Midtown behind */
    S.push(G(R(20,120,260,354,"#6E767A")+K.windows(30,132,240,330,10,16,503,{broken:.3})+
      R(940,86,260,388,"#767E82")+K.windows(950,98,240,364,10,18,509,{broken:.28}),
      {opacity:.95}));
    S.push(K.haze(250,200));
    S.push(K.ground({horizon:hz,vp:600,seed:79,fill:"#6B6960",cracks:20,pot:8}));
    S.push(K.car(180,596,1.5,577,{}));

    /* --- the cathedral ------------------------------------------------------------ */
    const c=[];
    /* nave gable */
    c.push(PG([[430,470],[430,224],[600,150],[770,224],[770,470]],{fill:"#D6D0C0"}));
    c.push(PG([[600,150],[770,224],[770,470],[600,470]],{fill:"#000",opacity:.06}));
    /* rose window */
    c.push(EL(600,268,54,54,{fill:"#C8C2B2"}));
    c.push(EL(600,268,46,46,{fill:"#24272B"}));
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6;
      c.push(LN(600,268,600+Math.cos(a)*46,268+Math.sin(a)*46,
        {stroke:"#7E827E","stroke-width":1.6,opacity:.8}));
    }
    c.push(G(EL(600,268,46,46,{fill:"#7E6A72",opacity:.65}),{class:"intact"}));
    /* the three portals */
    [[600,96],[494,64],[706,64]].forEach((p,i)=>{
      const cx=p[0], w=p[1];
      c.push(PT("M"+r2(cx-w/2)+" 470 L"+r2(cx-w/2)+" 386 L"+r2(cx)+" "+r2(386-w*.55)+
        " L"+r2(cx+w/2)+" 386 L"+r2(cx+w/2)+" 470 Z",{fill:"#CFC9B9"}));
      c.push(PT("M"+r2(cx-w/2+9)+" 470 L"+r2(cx-w/2+9)+" 390 L"+r2(cx)+" "+r2(392-w*.48)+
        " L"+r2(cx+w/2-9)+" 390 L"+r2(cx+w/2-9)+" 470 Z",{fill:"#26292C"}));
    });
    /* the towers */
    function spire(cx,baseY,topY,w,broken){
      const t=[];
      t.push(K.stone(cx-w/2,topY+60,w,baseY-topY-60,"#D2CCBC",{course:22}));
      for(let i=0;i<3;i++) t.push(R(cx-w*.3,topY+96+i*54,w*.16,40,"#2E3134",{opacity:.85}));
      for(let i=0;i<3;i++) t.push(R(cx+w*.14,topY+96+i*54,w*.16,40,"#2E3134",{opacity:.85}));
      if(!broken){
        t.push(PG([[cx-w*.56,topY+60],[cx+w*.56,topY+60],[cx,topY-96]],{fill:"#DAD4C4"}));
        t.push(PG([[cx,topY+60],[cx+w*.56,topY+60],[cx,topY-96]],{fill:"#000",opacity:.08}));
      } else {
        t.push(PG([[cx-w*.56,topY+60],[cx+w*.56,topY+60],[cx+w*.2,topY-6],[cx-w*.28,topY+14]],
          {fill:"#DAD4C4"}));
        t.push(PG([[cx-w*.28,topY+14],[cx+w*.2,topY-6],[cx+w*.1,topY+16],[cx-w*.16,topY+30]],
          {fill:"#9E9686"}));
      }
      return t.join("");
    }
    c.push(spire(432,470,150,96,false));
    c.push(G(spire(768,470,150,96,false),{class:"intact"}));
    c.push(G(spire(768,470,150,96,true),{class:"decay"}));
    /* buttresses and the aisle roofs */
    c.push(K.stone(390,330,44,140,"#CBC5B5",{course:24}));
    c.push(K.stone(766,330,44,140,"#CBC5B5",{course:24}));
    S.push(G(c.join("")));

    const d=[];
    d.push(K.streaks(430,224,340,246,521,{n:24,col:"#4A4438"}));
    d.push(K.streaks(384,150,110,320,523,{n:12,col:"#4A4438"}));
    d.push(K.cracksOn(430,240,340,220,541,10,"#9A9282"));
    d.push(K.ivy(430,360,340,110,547,{n:8}));
    d.push(K.rubble(840,486,220,557,{n:46,h:44}));
    d.push(K.rubble(900,506,150,563,{n:26,h:26}));
    d.push(K.sapling(404,332,.9,569));
    d.push(K.birds(300,140,150,10,571,1));
    S.push(G(d.join(""),{class:"decay"}));

    S.push(K.lamp(300,504,1.3,-4));
    S.push(K.trafficSignal(1000,504,1.15,587,{hang:true}));
    S.push(G(K.figure(600,512,1.2,{col:"#33352F"})+K.figure(636,516,1.1,{col:"#3A3B36"})+
      K.figure(664,520,1.15,{col:"#35362F"}),{}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 11. NEW YORK PUBLIC LIBRARY — FIFTH AVENUE AT 42ND                                 */
/* =================================================================================== */
SCENES["nypl"]={
  name:"New York Public Library",
  sub:"FIFTH AV AT W 42 ST · MANHATTAN · LOOKING WEST",
  mark:"New York Public Library", disp:"SEALED",
  cap:"The stacks are dry. That single fact makes this building the highest recovery "+
      "priority on the sheet. The doors are plated, the terrace is fenced, and one of "+
      "the lions has gone over into the areaway and been left there.",
  draw(){
    const hz=478, S=[];
    S.push(K.sky({seed:97,cloud:.45}));
    S.push(K.skyline(107,{base:hz-60,max:220,fill:"#858C90",count:12}));
    /* Bryant Park behind, under crops */
    S.push(G(K.treeMass(760,300,460,120,109,{n:18}),{opacity:.9}));
    S.push(K.haze(280,200));
    S.push(K.ground({horizon:hz,vp:600,seed:89,fill:"#6B6960",cracks:18,pot:6}));
    S.push(K.car(120,616,1.5,619,{}));

    const b=[];
    b.push(K.stone(230,196,740,238,"#D4CEBE",{course:22}));
    /* the portico */
    b.push(K.stone(360,178,480,20,"#DED8C8",{course:false}));
    b.push(R(368,198,464,236,"#8E877A"));                       /* the portico, in shadow */
    b.push(R(368,198,464,26,"#6E6A5E",{opacity:.7}));
    b.push(K.colonnade(392,808,434,214,6,30,{tone:"#DCD6C6",capTone:"#E8E2D2"}));
    for(let i=0;i<5;i++) b.push(R(410+i*88,300,52,132,"#2A2D30",{opacity:.9}));
    b.push(K.cornice(214,158,772,22,"#DED8C8"));
    b.push(K.stone(250,120,700,38,"#D0CABA",{course:false}));
    b.push(TX(600,148,"THE CITY OF NEW YORK",{"text-anchor":"middle","font-size":13,
      fill:"#8E8877","font-family":"var(--mono)","letter-spacing":".18em",opacity:.7}));
    b.push(K.cornice(240,102,720,18,"#E2DCCC"));
    /* end pavilions */
    b.push(K.stone(230,140,130,294,"#CEC8B8",{course:24}));
    b.push(K.stone(840,140,130,294,"#CEC8B8",{course:24}));
    b.push(R(266,210,58,120,"#2A2D30",{opacity:.85}));
    b.push(R(876,210,58,120,"#2A2D30",{opacity:.85}));
    /* the terrace and its steps */
    b.push(PG([[180,434],[1020,434],[1060,478],[140,478]],{fill:"#C6C0B0"}));
    for(let i=1;i<5;i++) b.push(PG([[180-i*8,434+i*9],[1020+i*8,434+i*9],
      [1020+i*9,438+i*9],[180-i*9,438+i*9]],{fill:"#BAB4A4"}));
    S.push(G(b.join("")));

    /* --- the lions: one on its pedestal, one in the areaway --------------------- */
    function lion(x,y,s,o){
      o=o||{}; const col=o.col||"#9A9280", d=o.flip?-1:1;
      const X=a=>x+a*s*d, Y=b=>y+b*s;
      let g=EL(X(-4),Y(-16),30*s,12*s,{fill:col});                /* the couched body */
      g+=EL(X(-26),Y(-20),16*s,15*s,{fill:col});                  /* haunch */
      g+=PT("M"+X(-40)+" "+Y(-18)+"q"+r2(-14*s*d)+" "+r2(10*s)+" "+r2(-4*s*d)+" "+r2(18*s),
        {fill:"none",stroke:col,"stroke-width":r2(3.4*s),"stroke-linecap":"round"});
      g+=R(X(-6),Y(-8),44*s*d,8*s,col);                           /* forelegs, out front */
      g+=EL(X(38),Y(-6),8*s,5*s,{fill:col});
      g+=EL(X(24),Y(-34),16*s,16*s,{fill:col});                   /* mane */
      for(let i=0;i<9;i++){
        const ang=i*Math.PI*2/9;
        g+=EL(X(24+Math.cos(ang)*15),Y(-34+Math.sin(ang)*15),5*s,5*s,{fill:col});
      }
      g+=EL(X(34),Y(-36),10*s,8.5*s,{fill:col});                  /* head */
      g+=PG([[X(30),Y(-45)],[X(33),Y(-52)],[X(37),Y(-44)]],{fill:col});
      g+=EL(X(42),Y(-32),5*s,4*s,{fill:col});                     /* muzzle */
      g+=EL(X(37),Y(-38),1.6*s,1.6*s,{fill:"#6E6858"});
      g+=R(X(-34),Y(-4),74*s*d,5*s,col);                          /* the ledge it lies on */
      return G(g,o.rot?{transform:"rotate("+o.rot+" "+r2(x)+" "+r2(y)+")"}:null);
    }
    S.push(R(232,478,84,48,"#B0A998"));
    S.push(EL(274,478,34,6,{fill:"#00000026"}));
    S.push(lion(274,478,1.05,{}));
    S.push(R(884,478,84,48,"#B0A998"));
    S.push(G(lion(926,478,1.05,{}),{class:"intact"}));
    S.push(G(lion(1016,608,1.15,{rot:-74,col:"#8E8674"})+K.rubble(990,616,150,577,{n:22,h:14}),
      {class:"decay"}));

    const d=[];
    d.push(K.streaks(230,196,740,238,587,{n:26,col:"#4A4438"}));
    d.push(K.cracksOn(230,210,740,220,593,10,"#9A9282"));
    d.push(K.ivy(230,340,740,94,599,{n:12}));
    /* the doors, plated over */
    for(let i=0;i<5;i++){
      d.push(R(410+i*88,300,52,132,"#4A4F52",{opacity:.95}));
      for(let j=0;j<4;j++) d.push(LN(410+i*88,314+j*34,462+i*88,314+j*34,
        {stroke:"#5E6366","stroke-width":2,opacity:.9}));
    }
    d.push(TX(600,458,"SEALED — RECOVERY PRIORITY 1",{"text-anchor":"middle","font-size":11,
      fill:"#7E7868","font-family":"var(--mono)","letter-spacing":".12em",opacity:.85}));
    d.push(K.sapling(340,436,1,601)); d.push(K.sapling(870,438,1.2,607));
    d.push(K.weedLine(613,480,20));
    d.push(K.birds(700,150,140,9,617,1));
    S.push(G(d.join(""),{class:"decay"}));

    S.push(K.lamp(200,520,1.25,-4));
    S.push(K.figure(560,530,1.25,{col:"#33352F"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 12. LIBERTY ISLAND — UPPER BAY                                                     */
/* =================================================================================== */
SCENES["liberty"]={
  name:"Statue of Liberty",
  sub:"LIBERTY ISLAND · UPPER BAY · FROM THE WATER, LOOKING NORTH-EAST",
  mark:"Statue of Liberty", disp:"STANDING",
  cap:"Copper on an iron frame, on a granite pedestal, on a star fort, on a rock. The "+
      "fort takes water at every spring tide and the landing stage is gone. The figure "+
      "itself is exactly as it was. The torch has not been lit in twenty-six years.",
  draw(){
    const wl=562, S=[];
    S.push(K.sky({seed:113,cloud:.45}));
    S.push(K.skyline(127,{base:wl-16,max:104,fill:"#8A9195",count:16}));
    S.push(K.haze(400,150));

    /* --- the fort and the pedestal ------------------------------------------------ */
    const p=[];
    p.push(PG([[300,wl],[900,wl],[862,500],[338,500]],{fill:"#9E9686"}));
    p.push(PG([[338,500],[862,500],[834,462],[366,462]],{fill:"#AAA292"}));
    p.push(K.stone(470,300,260,162,"#B6AE9E",{course:22}));
    p.push(K.stone(452,276,296,26,"#C0B8A8",{course:false}));
    p.push(K.stone(486,462,228,38,"#ADA595",{course:false}));
    for(let i=0;i<4;i++) p.push(K.column(496+i*70,462,318,15,{tone:"#B8B0A0"}));
    p.push(R(566,414,68,48,"#3A3E42",{opacity:.9}));
    S.push(G(p.join("")));

    /* --- the figure --------------------------------------------------------------- */
    const f=[], cu="#5F9080", sh="#4E7C6D", lt="#7EAB9B", bx=600;
    /* the robe */
    f.push(PT("M"+(bx-60)+" 300 L"+(bx-44)+" 178 Q"+(bx-42)+" 148 "+(bx-16)+" 142 "+
      "L"+(bx+18)+" 142 Q"+(bx+42)+" 148 "+(bx+46)+" 178 L"+(bx+64)+" 300 "+
      "Q"+bx+" 314 "+(bx-60)+" 300 Z",{fill:cu}));
    f.push(PT("M"+(bx-60)+" 300 L"+(bx-44)+" 178 Q"+(bx-42)+" 148 "+(bx-16)+" 142 "+
      "L"+(bx-8)+" 142 L"+(bx-22)+" 306 Z",{fill:sh}));
    for(let i=0;i<8;i++)
      f.push(PT("M"+(bx-36+i*12)+" 150 q"+((i-4)*2)+" 66 "+((i-4)*4)+" 152",
        {fill:"none",stroke:sh,"stroke-width":1.7,opacity:.45}));
    /* the head */
    f.push(EL(bx+4,118,20,23,{fill:cu}));
    f.push(EL(bx+12,118,11,20,{fill:lt,opacity:.4}));
    f.push(R(bx-14,138,36,10,cu));
    for(let i=0;i<7;i++){
      const ang=-Math.PI*.95+i*Math.PI*.317;
      f.push(PG([[bx+4+Math.cos(ang)*17,110+Math.sin(ang)*20],
        [bx+4+Math.cos(ang)*46,110+Math.sin(ang)*52],
        [bx+4+Math.cos(ang+.16)*17,110+Math.sin(ang+.16)*20]],{fill:cu}));
    }
    /* the raised arm and the torch */
    f.push(PT("M"+(bx+30)+" 162 L"+(bx+84)+" 104",{stroke:cu,"stroke-width":21,fill:"none",
      "stroke-linecap":"round"}));
    f.push(PT("M"+(bx+30)+" 162 L"+(bx+84)+" 104",{stroke:lt,"stroke-width":7,fill:"none",
      "stroke-linecap":"round",opacity:.4}));
    f.push(PG([[bx+70,106],[bx+106,106],[bx+100,84],[bx+76,84]],{fill:"#8AA89C"}));
    f.push(R(bx+76,70,24,16,cu));
    f.push(G(PT("M"+(bx+88)+" 34 q22 22 12 38 q-12 12 -24 0 q-10 -16 12 -38Z",
      {fill:"#F0D69A",opacity:.95})+EL(bx+88,62,30,26,{fill:"#F0D69A",opacity:.22}),
      {class:"intact"}));
    f.push(G(PT("M"+(bx+88)+" 42 q16 18 9 30 q-9 9 -18 0 q-7 -12 9 -30Z",
      {fill:"#46524F",opacity:.95}),{class:"decay"}));
    /* the left arm and the tablet */
    f.push(PT("M"+(bx-30)+" 160 L"+(bx-40)+" 214",{stroke:cu,"stroke-width":17,fill:"none",
      "stroke-linecap":"round"}));
    f.push(PG([[bx-70,186],[bx-24,164],[bx-4,214],[bx-50,238]],{fill:"#7CA396"}));
    f.push(PG([[bx-70,186],[bx-24,164],[bx-20,172],[bx-66,194]],{fill:lt,opacity:.55}));
    for(let i=0;i<4;i++) f.push(LN(bx-62+i*4,196+i*10,bx-18+i*4,174+i*10,
      {stroke:"#5F8A7E","stroke-width":1.2,opacity:.6}));
    S.push(G(f.join("")));

    const d=[];
    d.push(K.streaks(470,300,260,162,619,{n:16,col:"#3E5E52"}));
    d.push(K.streaks(bx-52,150,116,150,623,{n:10,col:"#4E7A6A"}));
    d.push(K.ivy(300,494,600,68,631,{n:10}));
    d.push(K.cracksOn(470,316,260,146,641,8,"#8A8272"));
    d.push(K.birds(780,164,190,18,643,1.1));
    d.push(K.birds(410,214,120,10,647,.9));
    S.push(G(d.join(""),{class:"decay"}));

    /* --- the bay ------------------------------------------------------------------ */
    S.push(K.flood(wl,653,{opacity:.92,reflect:true}));
    S.push(G(R(300,wl,600,10,"#4E6570",{opacity:.6})+
      PG([[276,wl],[320,wl],[312,580],[270,578]],{fill:"#8A8377",opacity:.5}),{class:"decay"}));
    S.push(G(PG([[900,592],[1130,576],[1142,624],[896,634]],{fill:"#7A756B"})+
      R(956,542,140,40,"#847E72")+R(966,550,120,16,"#2E3134",{opacity:.8})+
      PT("M1096 542 l16 -34",{stroke:"#5A574F","stroke-width":4,fill:"none"})+
      K.streaks(900,542,242,90,659,{col:C.rust,n:14}),{class:"decay"}));
    S.push(PG([[150,632],[356,622],[344,660],[166,666]],{fill:"#5E5A50"}));
    S.push(K.figure(226,628,1.25,{col:"#33352F"}));
    S.push(K.figure(274,626,1.2,{col:"#3C3D37"}));
    S.push(K.finish());
    return S.join("");
  }
};

/* =================================================================================== */
/* 13. THE APOLLO — 125TH STREET                                                      */
/* =================================================================================== */
SCENES["apollo"]={
  name:"Apollo Theater",
  sub:"253 W 125 ST · HARLEM · LOOKING NORTH · DUSK",
  mark:"Apollo Theater", disp:"OCCUPIED",
  cap:"The marquee is dark and will stay dark. The house behind it is not: four hundred "+
      "people were counted inside on the night the survey passed, by lamplight, and the "+
      "sound carried to Frederick Douglass Boulevard.",
  draw(){
    const hz=474, S=[];
    S.push(R(0,0,1200,700,"url(#svSky)"));
    S.push(G(K.clouds(131),{opacity:.4}));
    S.push(R(0,0,1200,700,"#2B3140",{opacity:.42}));            /* the light going */
    S.push(R(0,300,1200,200,"#C9834A",{opacity:.16}));
    S.push(K.skyline(137,{base:hz-40,max:150,fill:"#4E5257",count:14}));
    S.push(K.haze(300,180));
    S.push(K.ground({horizon:hz,vp:600,seed:139,fill:"#4E4C48",cracks:20,pot:8}));
    /* the block: low brick, continuous, occupied */
    const b=[];
    b.push(R(0,232,470,242,"#5E4A3E"));
    b.push(K.windows(16,248,438,206,9,5,653,{broken:.24,lit:"#E8A54B"}));
    b.push(R(730,214,470,260,"#584438"));
    b.push(K.windows(746,230,438,222,9,5,659,{broken:.24,lit:"#E8A54B"}));
    b.push(K.cornice(-10,218,492,16,"#4A392F"));
    b.push(K.cornice(720,200,492,16,"#463629"));
    S.push(G(b.join("")));

    /* --- the theatre -------------------------------------------------------------- */
    const t=[];
    t.push(R(466,186,270,288,"#6E5A4A"));
    t.push(K.cornice(452,168,298,20,"#7A6452"));
    /* the three arched windows over the entrance */
    [520,600,680].forEach(cx=>{
      t.push(PT(K.archPath(cx,258,26,326),{fill:"#3A2E26"}));
      t.push(PT(K.archPath(cx,262,21,320),{fill:"#1E2226"}));
      t.push(K.voussoirs(cx,258,26,7));
    });
    /* the marquee */
    t.push(PG([[452,352],[750,352],[738,392],[464,392]],{fill:"#3E3A34"}));
    t.push(PG([[452,352],[750,352],[750,362],[452,362]],{fill:"#4E4A42"}));
    for(let i=0;i<22;i++) t.push(EL(468+i*13,372,4,4,{fill:"#5A5248"}));
    t.push(G(""+[...Array(22)].map((_,i)=>EL(468+i*13,372,4.6,4.6,
      {fill:"#F0D08A",opacity:.9})).join(""),{class:"intact"}));
    /* the blade sign */
    t.push(R(742,180,44,190,"#4E3A32"));
    t.push(R(742,180,44,190,"#000",{opacity:.15}));
    "APOLLO".split("").forEach((ch,i)=>
      t.push(TX(764,214+i*28,ch,{"text-anchor":"middle","font-size":24,fill:"#8E7A5C",
        "font-family":"var(--cond)","font-weight":"700",opacity:.9})));
    t.push(G("APOLLO".split("").map((ch,i)=>TX(764,214+i*28,ch,{"text-anchor":"middle",
      "font-size":24,fill:"#F0C46A","font-family":"var(--cond)","font-weight":"700"})).join(""),
      {class:"intact"}));
    /* the doors, open, with light behind them */
    for(let i=0;i<4;i++){
      t.push(R(500+i*54,398,40,76,"#241E1A"));
      t.push(G(R(500+i*54,398,40,76,"#E8A54B",{opacity:.5}),{class:"decay"}));
    }
    S.push(G(t.join("")));

    const d=[];
    d.push(K.streaks(466,186,270,288,661,{n:16,col:"#3A2C22"}));
    d.push(K.ivy(0,340,470,134,673,{n:6}));
    d.push(K.ivy(730,340,470,134,677,{n:6}));
    d.push(K.cracksOn(466,200,270,260,683,7,"#4E3E32"));
    /* light spilling into the street */
    d.push(PG([[500,398],[700,398],[820,700],[380,700]],{fill:"#E8A54B",opacity:.12}));
    d.push(K.sapling(430,478,1.2,691));
    d.push(K.sapling(772,480,1,701));
    S.push(G(d.join(""),{class:"decay"}));

    /* a crowd, which is the point of the plate */
    const cr=rng(709); let crowd="";
    for(let i=0;i<26;i++){
      const x=K.between(cr,330,880), y=K.between(cr,492,560);
      crowd+=K.figure(x,y,.9+(y-492)/70,{col:pick(cr,["#2A2C28","#33352F","#26282A"])});
    }
    S.push(G(crowd));
    /* a fire drum */
    S.push(G(R(940,520,34,44,"#4A423A")+EL(957,520,17,7,{fill:"#E8A54B",opacity:.9})+
      EL(957,510,11,12,{fill:"#F0C46A",opacity:.6}),{class:"decay"}));
    S.push(K.car(90,600,1.4,719,{}));
    S.push(K.lamp(1040,500,1.3,5));
    S.push(K.finish());
    return S.join("");
  }
};

/* ---- walks: the order the survey party covered them in --------------------------- */
const ROUTES=[
 {id:"fifth", name:"FIFTH AVENUE — WASHINGTON SQ TO MUSEUM MILE",
  scenes:["washington-arch","flatiron","nypl","st-patricks","guggenheim"]},
 {id:"midtown", name:"MIDTOWN CROSSTOWN — SEVENTH AV TO PARK AV",
  scenes:["times-square","empire-34th","grand-central"]},
 {id:"east", name:"THE EAST SIDE & THE BRIDGE — BOWERY TO GRAND ARMY PLAZA",
  scenes:["new-museum","brooklyn-bridge","arch-brooklyn"]},
 {id:"edge", name:"THE EDGES — UPPER BAY AND 125TH STREET",
  scenes:["liberty","apollo"]}
];

NYC.scenes={SCENES,ROUTES,
  routeOf(id){ return ROUTES.find(r=>r.scenes.indexOf(id)>=0)||ROUTES[0]; },
  list(){ return Object.keys(SCENES).map(k=>Object.assign({id:k},SCENES[k])); }};
})();
