/* ===================================================================================
   NYC 2050 — the route console. Two points, four ways of weighing what is between
   them, and a list of what is on each.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};
const q=id=>document.getElementById(id);

let map=null, hooks={}, from=null, to=null, picking=null, result=null, chosen=0;
const api={ get pickActive(){ return !!picking; } };

const COLOURS={fast:"#2C2C2A",safe:"#3F6B3A",dry:"#3D6B8F",supply:"#B4741A"};

function init(o){
  hooks=o||{}; map=o.map;
  q("rtClose").onclick=close;
  q("rtFromPick").onclick=()=>setPick("from");
  q("rtToPick").onclick=()=>setPick("to");
  q("rtSwap").onclick=swap;
  q("rtPlan").onclick=plan;
  q("rtClear").onclick=clear;
  ["rtFrom","rtTo"].forEach(id=>{
    const el=q(id);
    el.addEventListener("input",()=>suggest(id));
    el.addEventListener("keydown",e=>{ if(e.key==="Enter"){ takeFirst(id); } });
  });
  q("rtTide").addEventListener("input",()=>{
    q("rtTideVal").textContent=tideName();
    if(result) plan();
  });
  q("rtProj").onclick=()=>{
    const on=q("rtProj").getAttribute("aria-pressed")!=="true";
    if(on&&!(NYC.simui&&NYC.simui.projectionContext())){
      hooks.toast&&hooks.toast("Run a projection first — SIM on the rail");
      return;
    }
    q("rtProj").setAttribute("aria-pressed",on);
    projLabel();
    if(result) plan();
  };
  projLabel();
}
function projLabel(){
  const on=q("rtProj").getAttribute("aria-pressed")==="true";
  const c=NYC.simui&&NYC.simui.projectionContext();
  q("rtProj").textContent = on&&c
    ? "PLANNING AGAINST THE PROJECTION AT H+"+String(c.hour).padStart(2,"0")
    : "PLAN AGAINST THE CURRENT PROJECTION";
}
const TIDE_KEYS=["LOW","MEAN","HIGH","SPRING"];
const tideName=()=>TIDE_KEYS[+q("rtTide").value];

/* ---- picking the ends -------------------------------------------------------------- */
function setPick(which){
  picking=picking===which?null:which;
  q("rtFromPick").setAttribute("aria-pressed",picking==="from");
  q("rtToPick").setAttribute("aria-pressed",picking==="to");
  q("stage").classList.toggle("picking",!!picking);
  if(picking) hooks.toast&&hooks.toast("Tap the sheet to set the "+
    (picking==="from"?"starting point":"destination"));
}
function takePoint(g){
  const pt=[Math.round(g[0]),Math.round(g[1])];
  const label=NYC.map.describe(pt[0],pt[1]);
  if(picking==="from"){ from={pt,label}; q("rtFrom").value=label; }
  else { to={pt,label}; q("rtTo").value=label; }
  setPick(null);
  paintEnds();
  if(from&&to) plan();
}
function cancelPick(){ setPick(null); }
function setEnd(which,name,x,y){
  const rec={pt:[x,y],label:name};
  if(which==="from"){ from=rec; q("rtFrom").value=name; }
  else { to=rec; q("rtTo").value=name; }
  paintEnds();
}
function swap(){
  const a=from; from=to; to=a;
  q("rtFrom").value=from?from.label:"";
  q("rtTo").value=to?to.label:"";
  paintEnds();
  if(from&&to) plan();
}
function paintEnds(){
  map.drawRouteEnds(from&&from.pt,to&&to.pt);
}

/* ---- the search boxes -------------------------------------------------------------- */
function suggest(id){
  const box=q(id), list=q(id+"Res"), t=box.value.trim().toLowerCase();
  list.innerHTML=""; list.classList.remove("on");
  if(t.length<2) return;
  const hits=[];
  map.marks.forEach(m=>{
    if(hits.length>=7) return;
    if(m.name.toLowerCase().indexOf(t)<0) return;
    hits.push(m);
  });
  if(!hits.length) return;
  hits.forEach(m=>{
    const b=document.createElement("button");
    b.innerHTML=esc(m.name)+'<span class="sub">'+esc(NYC.map.describe(m.x,m.y))+'</span>';
    b.onclick=()=>{
      setEnd(id==="rtFrom"?"from":"to",m.name,m.x,m.y);
      list.classList.remove("on");
      if(from&&to) plan();
    };
    list.appendChild(b);
  });
  list.classList.add("on");
}
function takeFirst(id){
  const list=q(id+"Res");
  if(list.firstChild) list.firstChild.click();
}

/* ---- planning ---------------------------------------------------------------------- */
function plan(){
  if(!from||!to){ hooks.toast&&hooks.toast("Set both ends first"); return; }
  q("rtPlan").disabled=true; q("rtPlan").textContent="PLANNING…";
  setTimeout(()=>{
    const useProj=q("rtProj").getAttribute("aria-pressed")==="true";
    let out;
    try{ out=NYC.route.plan({from:from.pt,to:to.pt,tide:tideName(),useProjection:useProj}); }
    catch(err){ console.error(err); out={error:"Routing failed — see the console."}; }
    q("rtPlan").disabled=false; q("rtPlan").textContent="FIND A WAY";
    result=out.error?null:out;
    chosen=0;
    render(out);
  },20);
}
function clear(){
  result=null; from=null; to=null;
  q("rtFrom").value=""; q("rtTo").value="";
  q("rtOut").innerHTML="";
  map.drawRoutes(null); map.drawRouteEnds(null,null);
}
function render(out){
  const box=q("rtOut");
  if(out.error){
    box.innerHTML='<div class="rterr">'+esc(out.error)+'</div>';
    map.drawRoutes(null);
    return;
  }
  const g=NYC.network.build();
  map.drawRoutes(out.routes.map((r,i)=>({
    pts:r.path.map(n=>[g.nodes[n].x,g.nodes[n].y]),
    colour:COLOURS[r.profile.id]||"#2C2C2A", on:i===chosen })));
  let h="";
  out.routes.forEach((r,i)=>{
    const names=[r.profile.name].concat(r.alsoBest).join(" + ");
    h+='<div class="rtcard'+(i===chosen?" on":"")+'" data-i="'+i+'">'+
       '<div class="rth"><i style="background:'+(COLOURS[r.profile.id]||"#2C2C2A")+'"></i>'+
       '<b>'+esc(names)+'</b><span>'+(r.distance/1000).toFixed(1)+' km</span></div>'+
       '<div class="rtm">'+fmtTime(r.minutes)+' on foot · hazard '+
       hazardWord(r.hazard)+(r.wet>60?' · '+Math.round(r.wet)+' m wet':'')+'</div>'+
       '<div class="rtbar"><i style="width:'+Math.round(r.hazard*100)+'%"></i></div>'+
       (r.warnings.length?'<ul class="rtw">'+r.warnings.map(w=>'<li>'+esc(w)+'</li>').join("")+
         '</ul>':'')+
       (i===chosen?legList(r):'')+
       '</div>';
  });
  h+='<div class="rtfoot">'+esc(out.routes.length===1?"One way through.":
      out.routes.length+" ways through.")+" Times assume four and a half kilometres an "+
      "hour on clear ground, and rather less through water. Fictional projection.</div>";
  box.innerHTML=h;
  [...box.querySelectorAll(".rtcard")].forEach(c=>c.onclick=()=>{
    chosen=+c.dataset.i; render(out);
  });
}
function legList(r){
  let h='<ol class="rtlegs">';
  r.legs.forEach(l=>{
    h+='<li><b>'+cap(l.dir)+' on '+esc(l.name)+'</b>'+
       '<span>'+Math.round(l.m)+' m · '+fmtTime(l.minutes)+'</span>'+
       (l.notes.length?'<em>'+esc(l.notes.join(" · "))+'</em>':'')+'</li>';
  });
  return h+'</ol>';
}
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const fmtTime=m=>m<60?Math.round(m)+" min":
  Math.floor(m/60)+" h "+String(Math.round(m%60)).padStart(2,"0");
const hazardWord=h=>h<0.12?"low":h<0.25?"moderate":h<0.45?"high":"severe";
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",
  ">":"&gt;",'"':"&quot;"}[c])); }

function open(){ projLabel(); q("rtPanel").classList.add("on"); q("navBtn").setAttribute("aria-pressed","true");
  if(NYC.simui) NYC.simui.close(); }
function close(){ q("rtPanel").classList.remove("on");
  q("navBtn").setAttribute("aria-pressed","false"); setPick(null); }
function toggle(){ q("rtPanel").classList.contains("on")?close():open(); }

Object.assign(api,{init,open,close,toggle,takePoint,cancelPick,setEnd,plan,clear,
  routeTo(name,x,y){ open(); setEnd("to",name,x,y); if(from) plan(); },
  routeFrom(name,x,y){ open(); setEnd("from",name,x,y); if(to) plan(); }});
NYC.routeui=api;
})();
