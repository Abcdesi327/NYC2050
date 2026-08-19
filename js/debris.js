/* ===================================================================================
   NYC 2050 — ejecta and fragment throw.
   What an event puts into the air and where it comes down. Fragments are launched
   from an origin, flown as ballistic bodies with quadratic drag, and tested against
   every structure along their line: a fragment passes over anything shorter than its
   altitude, and strikes anything taller. A strike that carries more energy than the
   fabric can absorb goes through and keeps going, which is how debris crosses blocks.

   This models material — facade, masonry, structural steel, glazing, plant, vehicles.
   People in the throw field are counted as exposure, in the way a civil-defence plate
   counts them, and not modelled further.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};

const G=9.81, RHO=1.22, U2M=10;      /* one grid unit is ten metres */

/* ---- what gets thrown ------------------------------------------------------------- */
const CLASSES=[
 {id:"GLAZING", label:"glazing",        mass:6,    cda:0.55, colour:"#7E9BA6", w:38},
 {id:"FACADE",  label:"facade panel",   mass:190,  cda:1.40, colour:"#A89A82", w:22},
 {id:"MASONRY", label:"masonry",        mass:70,   cda:0.55, colour:"#9A8A76", w:20},
 {id:"STEEL",   label:"structural steel",mass:950, cda:0.85, colour:"#6E7276", w:10},
 {id:"VEHICLE", label:"vehicle",        mass:1500, cda:2.60, colour:"#8A5A2B", w:5},
 {id:"PLANT",   label:"roof plant",     mass:2600, cda:3.10, colour:"#5E6266", w:5}
];
const TOTALW=CLASSES.reduce((a,c)=>a+c.w,0);

/* what a building will absorb before a thing goes through it, in joules */
/* energy absorbed passing through the whole depth of one building, in joules */
const RESIST={Tower:3.0e6,Landmark:5.0e6,Civic:3.5e6,Trade:1.2e6,Transit:6.0e6,
              Medical:3.5e6,Lifeline:5.0e6,Industry:2.5e6,District:1.5e6,
              FABRIC:1.1e6,Park:2.0e4,Water:1e4};
const CONDR={COLLAPSED:0.45,SALVAGE:0.7,FLOODED:0.8,UNSURVEYED:1,SEALED:1.0,
             STANDING:1.05,OCCUPIED:1.1};

function rng(seed){
  let a=(seed>>>0)||1;
  return function(){ a|=0; a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296; };
}
function pickClass(r){
  let v=r()*TOTALW;
  for(const c of CLASSES){ v-=c.w; if(v<=0) return c; }
  return CLASSES[0];
}
/* a logged site stands for a block of fabric, not a single footprint */
const footprint=(h)=>3+Math.min(4,h/120);      /* grid units */
const STRIDE=4;                                 /* one building frontage, 40 m */

/* Between the logged sites the city is still there. Ground that is built on gets a
   typical roof height from the density model, so a fragment has to go through the
   fabric whether or not the survey put a station on it. */
function fabricAt(x,y,parks,rand){
  const T=NYC.terrain;
  if(!T.onLand(x,y)) return 0;
  for(const p of parks) if(Math.hypot(p.x-x,p.y-y)<14) return 0;   /* open ground */
  if(T.inPoly(x,y,NYC.data.CPARK)) return 0;
  const base=20*NYC.heights.densityFactor(x,y);
  return Math.max(6,base*(0.6+rand()*0.9));
}
/* everything one fragment could run into, in the order it would meet it */
function obstacles(origin,dir,sites,parks,H,maxS,rand){
  const named=[], near=[];
  for(const m of sites){
    if(m.cat==="Park"||m.cat==="Water"||m.cat==="District") continue;
    const dx=m.x-origin[0], dy=m.y-origin[1];
    const along=dx*dir[0]+dy*dir[1];
    if(along<=1) continue;
    const off=Math.abs(dx*dir[1]-dy*dir[0]);
    const h=H(m);
    if(h<=0) continue;
    if(off<=footprint(h))
      named.push({name:m.name,cat:m.cat,disp:m.disp,height:h,s:along*U2M,logged:true});
    else if(off<=14) near.push({m,h,along,off});  /* stands for its own block */
  }
  named.sort((a,b)=>a.s-b.s);
  const out=[]; let ni=0;
  for(let u=STRIDE;u*U2M<=maxS;u+=STRIDE){
    const s=u*U2M;
    while(ni<named.length&&named[ni].s<s-STRIDE*U2M/2) out.push(named[ni++]);
    if(ni<named.length&&Math.abs(named[ni].s-s)<=STRIDE*U2M/2){ out.push(named[ni++]); continue; }
    const x=origin[0]+dir[0]*u, y=origin[1]+dir[1]*u;
    const h=fabricAt(x,y,parks,rand);
    if(h<=0) continue;
    /* if the survey logged a station on this block, the strike belongs to it */
    let own=null,od=9;
    for(const n of near){
      const d=Math.abs(n.along-u);
      if(d<od&&d<12){ od=d; own=n; }
    }
    out.push(own
      ? {name:own.m.name,cat:own.m.cat,disp:own.m.disp,height:own.h,s,logged:true}
      : {name:null,cat:"FABRIC",disp:"STANDING",height:h,s,logged:false});
  }
  while(ni<named.length) out.push(named[ni++]);
  out.sort((a,b)=>a.s-b.s);
  return out;
}

/* ---- one fragment ----------------------------------------------------------------- */
function fly(o){
  const {cls,v0,theta,alt0}=o;
  const k=0.5*RHO*cls.cda/cls.mass;            /* drag per metre of travel */
  let vx=v0*Math.cos(theta), vy=v0*Math.sin(theta), s=0, alt=alt0, t=0;
  const dt=0.05, path=[{s:0,alt:alt0,v:v0}];
  const out={path,strikes:[],apex:alt0,stopped:"ground"};
  let next=0;                                   /* pointer into the candidate list */
  while(t<70&&alt>-0.5){
    const v=Math.hypot(vx,vy);
    vx+= -k*v*vx*dt;
    vy+= -G*dt - k*v*vy*dt;
    s+=vx*dt; alt+=vy*dt; t+=dt;
    if(alt>out.apex) out.apex=alt;
    if(path.length<400&&(path.length<8||t%0.25<dt)) path.push({s,alt,v});
    /* has it reached the next structure on its line? */
    while(next<o.cands.length&&o.cands[next].s<s){
      const c=o.cands[next++];
      if(alt>c.height||alt<0) continue;         /* over the roof, or already down */
      const ke=0.5*cls.mass*v*v;
      const res=(RESIST[c.cat]||1.1e6)*(CONDR[c.disp]||1)*(0.7+c.height/400);
      const dmg=Math.min(0.5,ke/(res*3.2));
      if(ke>res){                               /* through it, and slower */
        const f=Math.sqrt(Math.max(0.04,1-res/ke));
        vx*=f; vy*=f;
        out.strikes.push({name:c.name,cat:c.cat,s:c.s,alt,ke,dmg,through:true});
      } else {
        out.strikes.push({name:c.name,cat:c.cat,s:c.s,alt,ke,dmg,through:false});
        out.stopped="building"; out.stopName=c.name||"unlogged fabric";
        path.push({s,alt,v}); out.landS=s; out.landAlt=alt;
        return out;
      }
    }
    if(vx<0.4&&alt<1) break;
  }
  path.push({s,alt:Math.max(0,alt),v:Math.hypot(vx,vy)});
  out.landS=s; out.landAlt=0;
  return out;
}

/* ---- the whole field -------------------------------------------------------------- */
/* opt: {origin:[x,y], height, kind:"blast"|"collapse", power, bearing, spread,
         count, seed, sites, heightOf} */
function field(opt){
  const r=rng(opt.seed||7), sites=opt.sites||[], origin=opt.origin;
  const parks=sites.filter(m=>m.cat==="Park").map(m=>({x:m.x,y:m.y}));
  const count=opt.count||220;
  const V = opt.kind==="collapse" ? 16+opt.power*0.16 : 70+opt.power*52;
  const frags=[];
  /* every site's height once, and its distance along each bearing later */
  const H=opt.heightOf;
  for(let i=0;i<count;i++){
    const cls=pickClass(r);
    /* the heavier it is, the less of the energy it takes with it */
    const heavy=Math.pow(Math.min(1,180/cls.mass),0.28);
    const v0=V*heavy*(0.32+0.68*Math.pow(r(),1.6));
    let bearing, theta, alt0;
    if(opt.kind==="collapse"){
      bearing=opt.bearing+(r()*2-1)*opt.spread;
      theta=(-8+r()*44)*Math.PI/180;
      alt0=Math.max(2,r()*opt.height);          /* it comes off every floor */
    } else {
      bearing=r()*360;
      theta=(4+r()*68)*Math.PI/180;
      alt0=2+r()*8;
    }
    const br=(90-bearing)*Math.PI/180;
    const dir=[Math.cos(br),Math.sin(br)];
    const reach=Math.min(4000,80+v0*v0/G*1.25);
    const cands=obstacles(origin,dir,sites,parks,H,reach,r);
    const f=fly({cls,v0,theta,alt0,cands});
    f.cls=cls.id; f.label=cls.label; f.colour=cls.colour; f.mass=cls.mass;
    f.v0=v0; f.theta=theta*180/Math.PI; f.bearing=bearing; f.alt0=alt0;
    f.dir=dir; f.origin=origin;
    f.land=[origin[0]+dir[0]*f.landS/U2M, origin[1]+dir[1]*f.landS/U2M];
    f.cands=cands;
    frags.push(f);
  }

  /* ---- what it adds up to --------------------------------------------------------- */
  const dmg=new Map();
  let maxRange=0, through=0, multi=0, crossBlock=0, crossThree=0;
  frags.forEach(f=>{
    maxRange=Math.max(maxRange,f.landS);
    if(f.landS>80) crossBlock++;
    if(f.landS>240) crossThree++;
    const pen=f.strikes.filter(s=>s.through).length;
    if(pen) through++;
    if(pen>1) multi++;
    f.strikes.forEach(s=>{ if(s.name) dmg.set(s.name,(dmg.get(s.name)||0)+s.dmg); });
  });
  const struck=[...dmg.entries()].map(([name,d])=>({name,dmg:Math.min(1,d)}))
    .sort((a,b)=>b.dmg-a.dmg);
  let breached=0;
  frags.forEach(f=>{ breached+=f.strikes.filter(k=>k.through).length; });
  /* the deepest line: the fragment that went through the most fabric */
  const deepest=frags.slice().sort((a,b)=>
    (b.strikes.filter(s=>s.through).length-a.strikes.filter(s=>s.through).length)||
    (b.landS-a.landS))[0]||null;

  return {frags,damage:dmg,struck,deepest,
    stats:{count,maxRange,through,multi,crossBlock,crossThree,breached,
           blocks:maxRange/80, struckCount:struck.length}};
}

/* the side elevation under one fragment's line: what it flew over and what it hit */
function profile(f){
  if(!f) return null;
  const bars=f.cands.filter(c=>c.s<=Math.max(f.landS,60)+40)
    .map(c=>({name:c.name||"unlogged fabric",logged:!!c.logged,s:c.s,h:c.height,
      hit:f.strikes.some(k=>k.s===c.s),
      through:f.strikes.some(k=>k.s===c.s&&k.through)}));
  return {bars,path:f.path,landS:f.landS,landAlt:f.landAlt||0,
    stopped:f.stopped,stopName:f.stopName,label:f.label,mass:f.mass,
    v0:f.v0,theta:f.theta,bearing:f.bearing,apex:f.apex};
}

NYC.debris={CLASSES,RESIST,field,profile,footprint,U2M};
})();
