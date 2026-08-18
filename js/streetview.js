/* ===================================================================================
   NYC 2050 — the street-view viewer. Draws a plate, walks the route it belongs to,
   and cross-fades between the city as surveyed and the city as built.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};

let el={}, cur=null, era="now", hooks={};

function q(id){ return document.getElementById(id); }

function init(o){
  hooks=o||{};
  el={ root:q("sv"), canvas:q("svCanvas"), name:q("svName"), sub:q("svSub"),
       cap:q("svCap"), disp:q("svDisp"), route:q("svRoute"), era:q("svEra"),
       prev:q("svPrev"), next:q("svNext"), eraBtn:q("svEraBtn"),
       mapBtn:q("svMap"), markBtn:q("svMark"), close:q("svClose") };
  el.close.onclick=close;
  el.prev.onclick=()=>step(-1);
  el.next.onclick=()=>step(1);
  el.eraBtn.onclick=toggleEra;
  el.mapBtn.onclick=()=>{ const s=NYC.scenes.SCENES[cur]; close();
    hooks.onShowOnMap&&hooks.onShowOnMap(s.mark); };
  el.markBtn.onclick=()=>{ const s=NYC.scenes.SCENES[cur];
    hooks.onBookmark&&hooks.onBookmark(s.mark); paintMark(); };
  addEventListener("keydown",e=>{
    if(!isOpen()) return;
    if(e.key==="Escape"){ close(); }
    else if(e.key==="ArrowLeft"){ step(-1); }
    else if(e.key==="ArrowRight"){ step(1); }
    else if(e.key==="t"||e.key==="T"){ toggleEra(); }
  });
  /* a swipe walks the route on a phone */
  let sx=null,sy=null;
  el.canvas.addEventListener("touchstart",e=>{
    if(e.touches.length!==1) return; sx=e.touches[0].clientX; sy=e.touches[0].clientY;
  },{passive:true});
  el.canvas.addEventListener("touchend",e=>{
    if(sx==null||!e.changedTouches.length) return;
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.6) step(dx<0?1:-1);
    sx=sy=null;
  },{passive:true});
}

function isOpen(){ return el.root&&el.root.classList.contains("on"); }

function paintMark(){
  const s=NYC.scenes.SCENES[cur]; if(!s) return;
  const on=hooks.isStarred&&hooks.isStarred(s.mark);
  el.markBtn.textContent=on?"★ BOOKMARKED":"☆ BOOKMARK";
  el.markBtn.classList.toggle("on",!!on);
}

function open(id){
  const S=NYC.scenes.SCENES;
  if(!S[id]) return false;
  cur=id;
  const s=S[id], route=NYC.scenes.routeOf(id), i=route.scenes.indexOf(id);
  el.canvas.innerHTML=NYC.svkit.defs()+s.draw();
  el.name.textContent=s.name;
  el.sub.textContent=s.sub;
  el.cap.textContent=s.cap;
  el.disp.textContent=s.disp;
  el.disp.style.background=NYC.map.DISP[s.disp]||"#2C2C2A";
  el.route.textContent=route.name+"  ·  "+(i+1)+" / "+route.scenes.length;
  el.prev.disabled=i<=0;
  el.next.disabled=i>=route.scenes.length-1;
  el.prev.textContent= i>0 ? "◀ "+S[route.scenes[i-1]].name.toUpperCase().slice(0,18) : "◀ START";
  el.next.textContent= i<route.scenes.length-1
    ? S[route.scenes[i+1]].name.toUpperCase().slice(0,18)+" ▶" : "END ▶";
  paintMark();
  setEra("now");
  el.root.classList.add("on");
  document.body.style.overflow="hidden";
  return true;
}
function step(dir){
  const route=NYC.scenes.routeOf(cur), i=route.scenes.indexOf(cur)+dir;
  if(i<0||i>=route.scenes.length) return;
  open(route.scenes[i]);
}
function setEra(e){
  era=e;
  el.root.classList.toggle("then",era==="then");
  el.era.textContent = era==="then" ? "BEFORE — AS BUILT" : "2050 — AS SURVEYED";
  el.eraBtn.textContent = era==="then" ? "SHOW 2050" : "SHOW BEFORE";
  el.eraBtn.classList.toggle("on",era==="then");
}
function toggleEra(){ setEra(era==="then"?"now":"then"); }
function close(){
  el.root.classList.remove("on");
  document.body.style.overflow="";
  hooks.onClose&&hooks.onClose();
}

NYC.streetview={init,open,close,isOpen,step,toggleEra,get current(){return cur;}};
})();
