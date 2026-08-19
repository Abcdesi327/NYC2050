/* ===================================================================================
   NYC 2050 — the projection console. Sets a hazard up, runs it, and walks the
   twenty-four hours afterwards with the sheet recoloured to match.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};
const q=id=>document.getElementById(id);

let map=null, hazard=null, params={}, point=null, result=null;
let step=NYC.sim?NYC.sim.STEPS:24, playing=null, hooks={};
const api={ pickActive:false };

function init(o){
  hooks=o||{}; map=o.map;
  buildHazards();
  select(NYC.sim.HAZARDS[0].id);
  q("simClose").onclick=close;
  q("simRun").onclick=runNow;
  q("simPick").onclick=()=>setPick(!api.pickActive);
  q("simPlay").onclick=togglePlay;
  q("simReset").onclick=clear;
  q("simScrub").addEventListener("input",e=>{ stop(); show(+e.target.value); });
}

/* ---- setting one up --------------------------------------------------------------- */
function buildHazards(){
  const wrap=q("simHazards"); wrap.innerHTML="";
  [["natural","NATURAL"],["human","MAN-MADE"]].forEach(([kind,label])=>{
    const h=document.createElement("div");
    h.className="ghead"; h.textContent=label; wrap.appendChild(h);
    NYC.sim.HAZARDS.filter(z=>z.kind===kind).forEach(z=>{
      const b=document.createElement("button");
      b.className="chip"; b.dataset.id=z.id; b.textContent=z.short;
      b.title=z.name;
      b.onclick=()=>select(z.id);
      wrap.appendChild(b);
    });
  });
}
function select(id){
  hazard=NYC.sim.HAZARDS.find(h=>h.id===id);
  params={}; hazard.params.forEach(p=>params[p.id]=p.val); snapped=null;
  [...q("simHazards").querySelectorAll(".chip")].forEach(b=>
    b.setAttribute("aria-pressed", b.dataset.id===id));
  q("simName").textContent=hazard.name;
  q("simBlurb").textContent=hazard.blurb;
  buildParams();
  q("simPointRow").style.display=hazard.point?"":"none";
  q("simPick").textContent=hazard.pointLabel?("SET "+hazard.pointLabel):"SET POINT";
  updatePointRef();
  setPick(false);
}
const COMPASS=["N","NE","E","SE","S","SW","W","NW"];
function fmt(p,v){
  if(p.bearing) return COMPASS[(Math.round(v/45))%8]+" ("+v+"°)";
  if(p.onoff) return v?"ON":"OFF";
  return (p.step<1?v.toFixed(1):v)+(p.unit||"");
}
function buildParams(){
  const box=q("simParams"); box.innerHTML="";
  hazard.params.forEach(p=>{
    const row=document.createElement("div"); row.className="prow";
    row.innerHTML='<label>'+p.label+'<b id="pv_'+p.id+'">'+fmt(p,params[p.id])+'</b></label>';
    const inp=document.createElement("input");
    inp.type="range"; inp.min=p.min; inp.max=p.max; inp.step=p.step; inp.value=params[p.id];
    inp.oninput=()=>{ params[p.id]=+inp.value; q("pv_"+p.id).textContent=fmt(p,+inp.value); };
    row.appendChild(inp);
    box.appendChild(row);
  });
}
function setPick(on){
  api.pickActive=!!(on&&hazard.point);
  q("simPick").setAttribute("aria-pressed",api.pickActive);
  q("stage").classList.toggle("picking",api.pickActive);
  if(api.pickActive) hooks.toast&&hooks.toast("Tap the sheet to place the "+
    (hazard.pointLabel||"point").toLowerCase());
}
let snapped=null;
function takePoint(g){
  point=[Math.round(g[0]),Math.round(g[1])];
  snapped=null;
  /* a collapse is a collapse OF something: take the nearest structure and its height */
  if(hazard.id==="collapse"&&map){
    let best=null,bd=1e9;
    map.marks.forEach(m=>{
      const h=NYC.heights.heightOf(m);
      if(h<20) return;
      const d=Math.hypot(m.x-point[0],m.y-point[1]);
      if(d<bd){bd=d;best={m,h,d};}
    });
    if(best&&best.d<26){
      snapped=best;
      point=[best.m.x,best.m.y];
      const hp=hazard.params.find(p=>p.id==="height");
      params.height=Math.max(hp.min,Math.min(hp.max,Math.round(best.h/10)*10));
      buildParams();
    }
  }
  setPick(false); updatePointRef();
}
function updatePointRef(){
  const el=q("simPointRef");
  if(!hazard.point){ el.textContent=""; return; }
  if(!point){ el.textContent="not set — the sheet's centre will be used"; return; }
  el.textContent = (snapped ? snapped.m.name+" · "+snapped.h+" m · " : "")+
    NYC.map.describe(point[0],point[1])+" · "+NYC.map.gridRef(point[0],point[1]);
}

/* ---- running it ------------------------------------------------------------------- */
function runNow(){
  const spec={hazard:hazard.id,params:Object.assign({},params),
    point:point||defaultPoint()};
  q("simRun").disabled=true; q("simRun").textContent="RUNNING…";
  setTimeout(()=>{
    try{ result=NYC.sim.run(spec); }
    catch(err){ console.error(err); hooks.toast&&hooks.toast("Projection failed — see console"); }
    q("simRun").disabled=false; q("simRun").textContent="RUN PROJECTION";
    if(!result) return;
    q("simTime").classList.add("on");
    renderReport();
    /* bring the sheet to where it happened, unless the whole region is in it */
    if(hazard.focus) map.flyTo(spec.point[0],spec.point[1],hazard.focus);
    show(NYC.sim.STEPS);
    hooks.onRun&&hooks.onRun(result);
  },20);
}
function defaultPoint(){
  if(hazard.id==="outage") return [286,520];      /* the generating station */
  return [0,300];                                  /* Midtown, for want of anywhere else */
}

function show(t){
  if(!result) return;
  step=Math.max(0,Math.min(NYC.sim.STEPS,t));
  q("simScrub").value=step;
  q("simHour").textContent="H+"+String(step).padStart(2,"0");
  const f=result.frames[step];
  map.drawHazard(f);
  const states=new Map();
  result.sites.forEach((s,i)=>{
    const idx=f.states[i], st=NYC.sim.STATES[idx];
    states.set(s.name,{state:st[0],colour:st[2]});
  });
  map.paintOutcomes(null,states);
  const c=f.counts;
  q("simCounts").innerHTML=
    '<i style="background:#6E1A1A"></i>'+c.LOST+
    '<i style="background:#8F2222"></i>'+c.CRITICAL+
    '<i style="background:#C4472A"></i>'+c.DAMAGED+
    '<i style="background:#E08A24"></i>'+c.AFFECTED+
    '<i style="background:#3F6B3A"></i>'+c.HELD;
  const log=q("simLog");
  if(log){
    const ev=result.events.filter(e=>e.t<=step).slice(-6).reverse();
    log.innerHTML=ev.length?ev.map(e=>'<div class="ev '+e.kind+'"><b>H+'+
      String(e.t).padStart(2,"0")+'</b> '+esc(e.text)+'</div>').join(""):"";
  }
  hooks.onStep&&hooks.onStep(step);
}
function togglePlay(){
  if(playing) return stop();
  if(!result) return;
  if(step>=NYC.sim.STEPS) show(0);
  q("simPlay").textContent="❚❚";
  playing=setInterval(()=>{
    if(step>=NYC.sim.STEPS) return stop();
    show(step+1);
  },420);
}
function stop(){ if(playing) clearInterval(playing); playing=null; q("simPlay").textContent="▶"; }

function clear(){
  stop(); result=null; point=point;
  map.clearHazard(); map.clearOutcomes();
  q("simTime").classList.remove("on");
  q("simReport").innerHTML="";
  hooks.onRun&&hooks.onRun(null);
}

/* ---- the write-up ----------------------------------------------------------------- */
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",
  ">":"&gt;",'"':"&quot;"}[c])); }
function renderReport(){
  const r=result.report, c=r.counts, box=q("simReport");
  const total=Object.values(c).reduce((a,b)=>a+b,0);
  let h='<div class="rep">';
  h+='<div class="repnarr">'+esc(r.narrative)+'</div>';
  h+='<div class="bar">'+NYC.sim.STATES.map(s=>{
      const n=c[s[0]]; if(!n) return "";
      return '<span style="background:'+s[2]+';flex:'+n+'" title="'+s[0]+' '+n+'"></span>';
    }).join("")+'</div>';
  h+='<div class="legrow">'+NYC.sim.STATES.map(s=>
      '<span><i style="background:'+s[2]+'"></i>'+s[0]+' '+c[s[0]]+'</span>').join("")+'</div>';

  const svc=Object.keys(r.services);
  if(svc.length){
    h+='<h4>SERVICE LOST</h4><ul class="svc">';
    svc.forEach(k=>h+='<li><b>'+esc(NYC.sim.SERVICE_NAMES[k].toUpperCase())+'</b>'+
      '<span>'+r.services[k]+' sites</span></li>');
    h+='</ul>';
  }
  if(r.ejecta){
    const e=r.ejecta;
    h+='<h4>EJECTA THROW</h4>';
    h+='<ul class="svc">';
    h+='<li><b>MAX RANGE</b><span>'+Math.round(e.maxRange)+' m · '+
        e.blocks.toFixed(1)+' blocks</span></li>';
    h+='<li><b>PAST ONE BLOCK</b><span>'+e.crossBlock+' of '+e.count+'</span></li>';
    h+='<li><b>PAST THREE BLOCKS</b><span>'+e.crossThree+'</span></li>';
    h+='<li><b>THROUGH A BUILDING</b><span>'+e.through+'</span></li>';
    h+='<li><b>THROUGH TWO OR MORE</b><span>'+e.multi+'</span></li>';
    h+='<li><b>STRUCTURES STRUCK</b><span>'+e.struckCount+'</span></li>';
    h+='</ul>';
    h+='<div class="secthead">SECTION UNDER THE DEEPEST LINE'+
       '<span><button data-frag="deepest" class="fsel on">DEEPEST</button>'+
       '<button data-frag="longest" class="fsel">LONGEST</button>'+
       '<button data-frag="heaviest" class="fsel">HEAVIEST</button></span></div>';
    h+='<div id="simSection"></div>';
  }
  if(r.lifelines.length)
    h+='<h4>LIFELINES LOST</h4><p>'+r.lifelines.map(esc).join("<br>")+'</p>';
  if(r.districts.length)
    h+='<h4>DISTRICTS OUT OF HABITABILITY</h4><p>'+r.districts.map(esc).join(", ")+'</p>';
  if(r.worst.length){
    h+='<h4>WORST HIT</h4><ul class="worst">';
    r.worst.forEach(w=>h+='<li><i style="background:'+NYC.sim.stateColour(w.state)+
      '"></i><span>'+esc(w.name)+'</span><b>'+w.state+'</b></li>');
    h+='</ul>';
  }
  h+='<div class="foot">Fictional projection. Fragility figures are invented for the '+
     'setting, not surveyed, and no part of this models a real event.</div>';
  h+='</div>';
  box.innerHTML=h;
  if(r.ejecta){
    drawSection("deepest");
    [...box.querySelectorAll(".fsel")].forEach(b=>b.onclick=()=>{
      [...box.querySelectorAll(".fsel")].forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      drawSection(b.dataset.frag);
    });
  }
}

/* ---- the side elevation: what the fragment flew over, and what it went through ---- */
function pickFragment(which){
  const f=result&&result.report.ejectaField;
  if(!f||!f.frags.length) return null;
  const by={
    deepest:(a,b)=>(b.strikes.filter(k=>k.through).length-
                    a.strikes.filter(k=>k.through).length)||(b.landS-a.landS),
    longest:(a,b)=>b.landS-a.landS,
    heaviest:(a,b)=>(b.mass-a.mass)||(b.landS-a.landS)
  }[which];
  if(!by) return f.frags[0];
  return f.frags.slice().sort(by)[0];
}
function drawSection(which){
  const host=q("simSection"); if(!host) return;
  const frag=pickFragment(which);
  const pr=frag&&NYC.debris.profile(frag);
  if(!pr){ host.innerHTML=""; return; }
  const W=316,Hh=156,L=26,B=26,T=12,R=8;
  const maxS=Math.max(120,pr.landS*1.06,
    pr.bars.length?pr.bars[pr.bars.length-1].s+40:0);
  const maxA=Math.max(30,pr.apex*1.12,
    pr.bars.reduce((a,b)=>Math.max(a,b.h),0)*1.12);
  const X=s=>L+(W-L-R)*(s/maxS), Y=a=>Hh-B-(Hh-B-T)*(a/maxA);
  let g='<svg viewBox="0 0 '+W+' '+Hh+'" class="sect">';
  /* the ground, and a block scale */
  g+='<line x1="'+L+'" y1="'+Y(0)+'" x2="'+(W-R)+'" y2="'+Y(0)+'" class="gl"/>';
  for(let s=0;s<=maxS;s+=80){
    g+='<line x1="'+X(s)+'" y1="'+Y(0)+'" x2="'+X(s)+'" y2="'+(Y(0)+4)+'" class="tk"/>';
    if(s%240===0) g+='<text x="'+X(s)+'" y="'+(Hh-12)+'" class="ax">'+
      (s===0?"0":(s/80)+" blk")+'</text>';
  }
  g+='<text x="3" y="'+(Y(maxA*0.9)+3)+'" class="ax lft">'+Math.round(maxA)+' m</text>';
  g+='<text x="3" y="'+(Y(0)-2)+'" class="ax lft">0</text>';
  /* the fabric it passed over */
  pr.bars.forEach(b=>{
    const x=X(b.s), y=Y(b.h), w=Math.max(4,X(b.s+22)-x);
    g+='<rect x="'+(x-w/2)+'" y="'+y+'" width="'+w+'" height="'+(Y(0)-y)+
       '" class="bd'+(b.through?" thru":b.hit?" hit":"")+(b.logged?" log":"")+
       '"><title>'+esc(b.name)+" — "+b.h+' m</title></rect>';
    if(b.logged&&w>5)
      g+='<text transform="rotate(-90 '+(x+2)+' '+(Y(0)-4)+')" x="'+(x+2)+'" y="'+
         (Y(0)-4)+'" class="bl">'+esc(b.name.slice(0,17))+'</text>';
  });
  /* the line it flew */
  let d="";
  pr.path.forEach((p,i)=>{ d+=(i?"L":"M")+X(p.s)+" "+Y(Math.max(0,p.alt)); });
  g+='<path d="'+d+'" class="traj"/>';
  /* where it hit something */
  (frag.strikes||[]).forEach(k=>{
    g+='<circle cx="'+X(k.s)+'" cy="'+Y(k.alt)+'" r="2.6" class="'+
       (k.through?"stk thru":"stk")+'"/>';
  });
  g+='<circle cx="'+X(pr.landS)+'" cy="'+Y(pr.landAlt)+'" r="3" class="land"/>';
  g+='</svg>';
  const stop = pr.stopped==="building"
    ? "stopped inside "+esc(pr.stopName)
    : "came to ground at "+Math.round(pr.landS)+" m";
  host.innerHTML=g+'<div class="seckey"><i class="k1"></i>passed over'+
    '<i class="k2"></i>struck and stopped<i class="k3"></i>gone through</div>'+
    '<div class="secap"><b>'+esc(pr.label)+'</b> · '+pr.mass+
    ' kg · launched at '+Math.round(pr.v0)+' m/s, '+Math.round(pr.theta)+
    '° · apex '+Math.round(pr.apex)+' m · '+stop+'.</div>';
}

/* ---- what the info sheet shows while a projection is up --------------------------- */
function outcomeFor(name){
  if(!result) return null;
  const f=result.frames[step], i=result.sites.findIndex(s=>s.name===name);
  if(i<0) return null;
  const st=NYC.sim.STATES[f.states[i]], s=result.sites[i];
  const missing=(s.lostServices||[]).map(k=>NYC.sim.SERVICE_NAMES[k].toUpperCase());
  return {state:st[0],colour:st[2],missing:missing,
    hour:s.lost==null?null:s.lost};
}

function open(){ q("simPanel").classList.add("on"); q("simBtn").setAttribute("aria-pressed","true"); }
function close(){ q("simPanel").classList.remove("on"); q("simBtn").setAttribute("aria-pressed","false");
  setPick(false); }
function toggle(){ q("simPanel").classList.contains("on")?close():open(); }

Object.assign(api,{init,open,close,toggle,takePoint,outcomeFor,clear,
  cancelPick(){ setPick(false); },
  get running(){return !!result;}});
NYC.simui=api;
})();
