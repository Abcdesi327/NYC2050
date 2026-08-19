/* ===================================================================================
   NYC 2050 — application wiring: the sheet, the drawer, search, and the pin tools.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{}, S=NYC.store;
const q=id=>document.getElementById(id);

let map=null, sel=null, selPin=null, pinMode=false, editing=null, tab="views";

/* ---- toast ------------------------------------------------------------------------ */
let toastT=null;
function toast(msg){
  const t=q("toast"); t.textContent=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2200);
}

/* ---- the info sheet --------------------------------------------------------------- */
function closeSheet(){ q("sheet").classList.remove("on"); sel=selPin=null;
  map&&map.clearHighlight(); }

function showMark(m){
  sel=m; selPin=null;
  q("sNm").textContent=m.name;
  const zone=(m.x>150&&m.y<700)||(m.x<-190)?"OUTER BOROUGH":NYC.map.bandOf(m.y);
  const ht=NYC.heights.heightOf(m);
  q("sMeta").textContent=m.cat.toUpperCase()+" · ZONE "+zone+" · "+NYC.map.describe(m.x,m.y)+
    (ht>0?" · "+ht+" m, c."+NYC.heights.floorsOf(ht)+" floors":"");
  const c=q("sCode"); c.textContent=m.disp;
  c.style.background=NYC.map.DISP[m.disp]||"#2C2C2A"; c.style.color="";
  q("sNote").textContent=m.note||"No field note recorded.";
  const proj=NYC.simui&&NYC.simui.outcomeFor(m.name);
  const pv=q("sProj");
  if(proj){
    pv.style.display="";
    pv.innerHTML='<b style="background:'+proj.colour+'">'+proj.state+'</b>'+
      (proj.missing.length?"NO "+proj.missing.join(", NO "):"SERVICES HELD");
  } else pv.style.display="none";
  const acts=q("sActs"); acts.innerHTML="";
  if(m.scene) acts.appendChild(btn("◉ STREET VIEW","pri",()=>NYC.streetview.open(m.scene)));
  const starred=S.isStarred(m.name);
  acts.appendChild(btn((starred?"★":"☆")+" BOOKMARK",starred?"on":"",()=>{
    const on=S.toggleStar(m.name);
    toast(on?"Bookmarked "+m.name:"Removed "+m.name);
    showMark(m); refreshPins();
  }));
  acts.appendChild(btn("⌖ CENTRE","",()=>map.flyTo(m.x,m.y,Math.max(map.scale,3))));
  q("sheet").classList.add("on");
  map.highlight(m.x,m.y);
}
function showPin(p){
  selPin=p; sel=null;
  q("sNm").textContent=p.name;
  q("sMeta").textContent="DROPPED MARK · "+NYC.map.describe(p.x,p.y)+" · "+
    NYC.map.gridRef(p.x,p.y);
  const c=q("sCode"); c.textContent="OWN MARK"; c.style.background="var(--mark)";
  q("sNote").textContent=p.note||"No note.";
  const acts=q("sActs"); acts.innerHTML="";
  acts.appendChild(btn("✎ EDIT","pri",()=>openEditor(p)));
  acts.appendChild(btn("⌖ CENTRE","",()=>map.flyTo(p.x,p.y,Math.max(map.scale,3))));
  acts.appendChild(btn("✕ REMOVE","",()=>{
    S.removePin(p.id); refreshPins(); closeSheet(); toast("Mark removed");
  }));
  q("sheet").classList.add("on");
  map.highlight(p.x,p.y);
}
function showBlock(b){
  sel=null; selPin=null;
  q("sNm").textContent=b.zone;
  q("sMeta").textContent="BLOCK "+b.id+" · "+NYC.map.describe(b.cx,b.cy)+" · "+
    b.height+" m, "+b.floors+" floors";
  const c=q("sCode");
  c.textContent=NYC.fabric.USES[b.use].label.toUpperCase();
  c.style.background=NYC.fabric.USES[b.use].colour; c.style.color="#2C2C2A";
  q("sNote").textContent="Built "+b.era+". "+
    Math.round(b.area).toLocaleString()+" m² of ground at "+
    Math.round(b.coverage*100)+"% coverage, "+
    Math.round(b.floorArea).toLocaleString()+" m² of floor"+
    (b.shelter?", shelter for about "+b.shelter.toLocaleString()+" people":"")+
    ". Generated fabric, not a surveyed station.";
  q("sProj").style.display="none";
  const acts=q("sActs"); acts.innerHTML="";
  acts.appendChild(btn("⌖ CENTRE","",()=>map.flyTo(b.cx,b.cy,Math.max(map.scale,4))));
  q("sheet").classList.add("on");
  map.highlight(b.cx,b.cy);
}
function btn(label,cls,fn){
  const b=document.createElement("button");
  b.textContent=label; if(cls) b.className=cls; b.onclick=fn; return b;
}

/* ---- the pin editor --------------------------------------------------------------- */
function openEditor(p){
  editing=p;
  q("edTitle").textContent=p.isNew?"New mark":"Edit mark";
  q("edLoc").textContent=NYC.map.describe(p.x,p.y)+" · "+NYC.map.gridRef(p.x,p.y);
  q("edName").value=p.isNew?"":p.name;
  q("edNote").value=p.note||"";
  q("edDel").style.display=p.isNew?"none":"";
  q("editor").classList.add("on"); q("scrim").classList.add("on");
  setTimeout(()=>q("edName").focus(),30);
}
function closeEditor(commit){
  const p=editing; editing=null;
  q("editor").classList.remove("on"); q("scrim").classList.remove("on");
  if(!p) return;
  if(!commit){ if(p.isNew) S.removePin(p.id); refreshPins(); return; }
  const name=q("edName").value.trim()||"Mark "+NYC.map.gridRef(p.x,p.y).slice(3);
  const rec=S.updatePin(p.id,{name:name,note:q("edNote").value.trim()});
  refreshPins();
  if(rec) showPin(rec);
  toast(p.isNew?"Mark dropped — "+name:"Mark saved");
}

/* ---- pins on the sheet ------------------------------------------------------------ */
function refreshPins(){
  map.renderPins(S.pins(),S.stars());
  const n=S.pins().length+S.stars().length;
  const b=q("pinCount"); b.textContent=n; b.classList.toggle("on",n>0);
  if(tab==="marks") paintDrawer();
}

/* ---- the drawer ------------------------------------------------------------------- */
function paintDrawer(){
  const body=q("drawerBody"); body.innerHTML="";
  q("tabViews").setAttribute("aria-selected",tab==="views");
  q("tabMarks").setAttribute("aria-selected",tab==="marks");
  q("drawerTitle").textContent = tab==="views"?"Street-view plates":"Your marks";
  q("drawerFoot").style.display = tab==="marks"?"":"none";

  if(tab==="views"){
    NYC.scenes.ROUTES.forEach(r=>{
      const h=document.createElement("div");
      h.className="rm"; h.style.margin="12px 2px 6px"; h.textContent=r.name;
      body.appendChild(h);
      r.scenes.forEach(id=>{
        const s=NYC.scenes.SCENES[id];
        const row=document.createElement("div"); row.className="row";
        row.innerHTML='<div class="rn"><span class="dot" style="background:'+
          (NYC.map.DISP[s.disp]||"#2C2C2A")+'"></span>'+esc(s.name)+'</div>'+
          '<div class="rm">'+esc(s.sub)+'</div>';
        row.onclick=()=>{ closeDrawer(); NYC.streetview.open(id); };
        body.appendChild(row);
      });
    });
    return;
  }

  const pins=S.pins().sort((a,b)=>b.ts-a.ts), stars=S.stars();
  if(!pins.length&&!stars.length){
    body.innerHTML='<div class="empty">No marks yet.<br><br>'+
      'Press <b>PIN</b> on the control rail, then tap anywhere on the sheet to drop a '+
      'mark of your own. Tap any surveyed site and press <b>BOOKMARK</b> to keep it here.'+
      (S.persistent?"":"<br><br>Storage is unavailable in this browser — marks will be "+
       "lost when the page is closed.")+'</div>';
    return;
  }
  if(pins.length){
    const h=document.createElement("div");
    h.className="rm"; h.style.margin="4px 2px 6px"; h.textContent="DROPPED MARKS";
    body.appendChild(h);
  }
  pins.forEach(p=>{
    const row=document.createElement("div"); row.className="row";
    row.innerHTML='<div class="rn"><span class="dot" style="background:var(--mark)"></span>'+
      esc(p.name)+'</div><div class="rm">'+esc(NYC.map.describe(p.x,p.y))+' · '+
      NYC.map.gridRef(p.x,p.y)+'</div>'+
      (p.note?'<div class="rnote">'+esc(p.note)+'</div>':'');
    const ed=document.createElement("button");
    ed.className="rv"; ed.textContent="✎"; ed.title="Edit";
    ed.onclick=e=>{e.stopPropagation(); closeDrawer(); openEditor(p);};
    const del=document.createElement("button");
    del.className="rx"; del.textContent="✕"; del.title="Remove";
    del.onclick=e=>{e.stopPropagation(); S.removePin(p.id); refreshPins(); toast("Mark removed");};
    row.appendChild(ed); row.appendChild(del);
    row.onclick=()=>{ closeDrawer(); map.flyTo(p.x,p.y,3.2); showPin(p); };
    body.appendChild(row);
  });
  if(stars.length){
    const h=document.createElement("div");
    h.className="rm"; h.style.margin="14px 2px 6px"; h.textContent="BOOKMARKED SITES";
    body.appendChild(h);
  }
  stars.forEach(nm=>{
    const m=map.markByName(nm); if(!m) return;
    const row=document.createElement("div"); row.className="row";
    row.innerHTML='<div class="rn"><span class="dot" style="background:'+
      (NYC.map.DISP[m.disp]||"#2C2C2A")+'"></span>'+esc(m.name)+'</div>'+
      '<div class="rm">'+esc(m.disp+" · "+NYC.map.describe(m.x,m.y))+'</div>';
    if(m.scene){
      const v=document.createElement("button");
      v.className="rv"; v.textContent="◉"; v.title="Street view";
      v.onclick=e=>{e.stopPropagation(); closeDrawer(); NYC.streetview.open(m.scene);};
      row.appendChild(v);
    }
    const del=document.createElement("button");
    del.className="rx"; del.textContent="✕"; del.title="Remove bookmark";
    del.onclick=e=>{e.stopPropagation(); S.toggleStar(nm); refreshPins(); toast("Bookmark removed");};
    row.appendChild(del);
    row.onclick=()=>{ closeDrawer(); map.flyTo(m.x,m.y,3.2); showMark(m); };
    body.appendChild(row);
  });
}
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",
  ">":"&gt;",'"':"&quot;"}[c])); }
function openDrawer(t){ if(t) tab=t; paintDrawer();
  q("drawer").classList.add("on"); q("listBtn").setAttribute("aria-pressed","true"); }
function closeDrawer(){ q("drawer").classList.remove("on");
  q("listBtn").setAttribute("aria-pressed","false"); }

/* ---- search ----------------------------------------------------------------------- */
let results=[], cursor=-1;
function search(term){
  const box=q("results"), t=term.trim().toLowerCase();
  results=[]; cursor=-1;
  if(t.length<2){ box.classList.remove("on"); box.innerHTML=""; return; }
  const seen=new Set(), hits=[];
  map.marks.forEach(m=>{
    const i=m.name.toLowerCase().indexOf(t);
    if(i<0||seen.has(m.name)) return;
    seen.add(m.name);
    /* a plate, then an exact opening match, then the shorter name */
    hits.push({m:m,rank:(i===0?0:2)+(m.scene?0:1)+m.name.length/500});
  });
  hits.sort((a,b)=>a.rank-b.rank);
  hits.slice(0,14).forEach(h=>results.push({kind:"mark",m:h.m}));
  S.pins().forEach(p=>{
    if(results.length>=18) return;
    if(p.name.toLowerCase().indexOf(t)>=0) results.push({kind:"pin",p:p});
  });
  box.innerHTML="";
  if(!results.length){
    box.innerHTML='<button disabled style="color:var(--muted)">Nothing on the sheet '+
      'matches that.</button>';
    box.classList.add("on"); return;
  }
  results.forEach((r,i)=>{
    const b=document.createElement("button");
    if(r.kind==="mark"){
      b.innerHTML=esc(r.m.name)+'<span class="sub">'+esc(r.m.disp+" · "+
        NYC.map.describe(r.m.x,r.m.y))+(r.m.scene?" · STREET VIEW":"")+'</span>';
      b.onclick=()=>{ pickResult(i); };
    } else {
      b.innerHTML='◆ '+esc(r.p.name)+'<span class="sub">OWN MARK · '+
        esc(NYC.map.describe(r.p.x,r.p.y))+'</span>';
      b.onclick=()=>{ pickResult(i); };
    }
    box.appendChild(b);
  });
  box.classList.add("on");
}
function pickResult(i){
  const r=results[i]; if(!r) return;
  q("results").classList.remove("on");
  q("search").blur();
  if(r.kind==="mark"){ map.flyTo(r.m.x,r.m.y,3.4); showMark(r.m); }
  else { map.flyTo(r.p.x,r.p.y,3.4); showPin(r.p); }
}
function moveCursor(d){
  const box=q("results"); if(!box.classList.contains("on")||!results.length) return;
  cursor=Math.max(0,Math.min(results.length-1,cursor+d));
  [...box.children].forEach((b,i)=>b.classList.toggle("sel",i===cursor));
  const n=box.children[cursor]; n&&n.scrollIntoView({block:"nearest"});
}

/* ---- boot -------------------------------------------------------------------------- */
function boot(){
  map=NYC.map.init({
    svg:q("map"), stage:q("stage"),
    onMark:m=>{ pinMode&&setPinMode(false); showMark(m); },
    onPin:p=>{ showPin(p); },
    onGround:(g,e)=>{
      if(NYC.simui&&NYC.simui.pickActive){ NYC.simui.takePoint(g); return; }
      if(pinMode){
        const rec=S.addPin({x:g[0],y:g[1],name:"",note:""});
        refreshPins();
        rec.isNew=true; openEditor(rec);
        setPinMode(false);
      } else if(map.fabricMode){
        const b=NYC.fabric.at(g[0],g[1]);
        if(b) showBlock(b); else closeSheet();
      } else closeSheet();
    }
  });
  NYC.streetview.init({
    onShowOnMap:name=>{ const m=map.markByName(name);
      if(m){ map.flyTo(m.x,m.y,3.4); showMark(m); } },
    onBookmark:name=>{ const on=S.toggleStar(name); refreshPins();
      toast(on?"Bookmarked "+name:"Removed "+name); },
    isStarred:name=>S.isStarred(name)
  });
  NYC.mapView=map;            /* exposed for tooling and the console */
  NYC.simui.init({map:map, toast:toast,
    onRun:()=>{ if(sel) showMark(sel); },
    onStep:()=>{ if(sel) showMark(sel); }});
  refreshPins();

  /* controls */
  q("closeSheet").onclick=closeSheet;
  q("keyBtn").onclick=()=>{ const on=q("key").classList.toggle("on");
    q("keyBtn").setAttribute("aria-pressed",on); };
  q("covBtn").onclick=()=>{ const on=q("covBtn").getAttribute("aria-pressed")!=="true";
    q("covBtn").setAttribute("aria-pressed",on); map.setCoverage(on); };
  q("thruBtn").onclick=()=>{ const on=q("thruBtn").getAttribute("aria-pressed")!=="true";
    q("thruBtn").setAttribute("aria-pressed",on); map.setThoroughfares(on); };
  q("pinBtn").onclick=()=>setPinMode(!pinMode);
  q("listBtn").onclick=()=>{ q("drawer").classList.contains("on")?closeDrawer():openDrawer(); };
  q("simBtn").onclick=()=>NYC.simui.toggle();
  const FAB_MODES=[null,"use","height","era"];
  let fabIdx=0;
  function cycleFabric(){
    fabIdx=(fabIdx+1)%FAB_MODES.length;
    const mode=FAB_MODES[fabIdx];
    map.drawFabric(mode);
    q("blkBtn").setAttribute("aria-pressed",mode?"true":"false");
    q("blkModeLbl").textContent=mode?("· "+mode.toUpperCase()):"";
    paintFabricKey(mode);
    if(mode) toast("Built fabric — "+mode.toUpperCase()+
      " ("+NYC.fabric.build().length+" blocks)");
  }
  function paintFabricKey(mode){
    const k=q("blkKey");
    if(!mode){ k.innerHTML='<i style="background:#C8B9A6"></i>PRESS BLK FOR THE BLOCKS'; return; }
    if(mode==="use") k.innerHTML=Object.keys(NYC.fabric.USES).map(u=>
      '<i style="background:'+NYC.fabric.USES[u].colour+'"></i>'+
      NYC.fabric.USES[u].label.toUpperCase()).join("<br>");
    else if(mode==="era") k.innerHTML=Object.keys(NYC.fabric.ERAS).map(e=>
      '<i style="background:'+NYC.fabric.ERAS[e].colour+'"></i>'+e.toUpperCase()).join("<br>");
    else k.innerHTML=['UNDER 12 m|#D9D2C2','12–20 m|#CFC4AC','20–35 m|#C0B092',
      '35–60 m|#A89478','60–120 m|#8C7A60','OVER 120 m|#6B5B46']
      .map(x=>{const[t,c]=x.split("|");return '<i style="background:'+c+'"></i>'+t;})
      .join("<br>");
  }
  paintFabricKey(null);
  q("blkBtn").onclick=cycleFabric;
  q("hgtBtn").onclick=()=>{ const on=q("hgtBtn").getAttribute("aria-pressed")!=="true";
    q("hgtBtn").setAttribute("aria-pressed",on); map.setHeights(on); };
  q("zin").onclick=()=>map.zoomAt(1.45,innerWidth/2,innerHeight/2);
  q("zout").onclick=()=>map.zoomAt(1/1.45,innerWidth/2,innerHeight/2);
  q("rst").onclick=()=>{ map.fit(); closeSheet(); };
  q("drawerClose").onclick=closeDrawer;
  q("tabViews").onclick=()=>{ tab="views"; paintDrawer(); };
  q("tabMarks").onclick=()=>{ tab="marks"; paintDrawer(); };
  q("scrim").onclick=()=>closeEditor(false);
  q("edSave").onclick=()=>closeEditor(true);
  q("edCancel").onclick=()=>closeEditor(false);
  q("edDel").onclick=()=>{ const p=editing; closeEditor(false);
    if(p){ S.removePin(p.id); refreshPins(); closeSheet(); toast("Mark removed"); } };
  q("edName").addEventListener("keydown",e=>{ if(e.key==="Enter") closeEditor(true); });

  /* the marks file */
  q("mkCopy").onclick=()=>{
    const txt=S.toJSON();
    if(navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(txt).then(()=>toast("Marks copied to the clipboard"),
        ()=>toast("Copy failed — see the console")) ;
    else { console.log(txt); toast("Marks written to the console"); }
  };
  q("mkPaste").onclick=()=>{
    const txt=prompt("Paste a marks file:");
    if(!txt) return;
    const r=S.fromJSON(txt);
    if(!r.ok) toast("Could not read that: "+r.err);
    else { refreshPins(); toast("Added "+r.added+" mark"+(r.added===1?"":"s")); }
  };
  q("mkClear").onclick=()=>{
    if(!confirm("Remove every dropped mark and bookmark? This cannot be undone.")) return;
    S.clear(); refreshPins(); paintDrawer(); toast("All marks cleared");
  };

  /* search */
  const box=q("search");
  box.addEventListener("input",()=>{
    q("srch").classList.toggle("has",box.value.length>0);
    search(box.value);
  });
  box.addEventListener("keydown",e=>{
    if(e.key==="ArrowDown"){ e.preventDefault(); moveCursor(1); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); moveCursor(-1); }
    else if(e.key==="Enter"){ pickResult(cursor<0?0:cursor); }
    else if(e.key==="Escape"){ box.value=""; search(""); box.blur();
      q("srch").classList.remove("has"); }
  });
  q("searchClear").onclick=()=>{ box.value=""; search(""); box.focus();
    q("srch").classList.remove("has"); };
  document.addEventListener("click",e=>{
    if(!q("srch").contains(e.target)) q("results").classList.remove("on");
  });

  /* keyboard */
  addEventListener("keydown",e=>{
    if(NYC.streetview.isOpen()) return;
    const tag=(e.target.tagName||"").toLowerCase();
    if(tag==="input"||tag==="textarea") return;
    if(e.key==="/"){ e.preventDefault(); q("search").focus(); }
    else if(e.key==="p"||e.key==="P"){ setPinMode(!pinMode); }
    else if(e.key==="b"||e.key==="B"){ q("drawer").classList.contains("on")?
      closeDrawer():openDrawer("marks"); }
    else if(e.key==="k"||e.key==="K"){ q("keyBtn").click(); }
    else if(e.key==="s"||e.key==="S"){ NYC.simui.toggle(); }
    else if(e.key==="h"||e.key==="H"){ q("hgtBtn").click(); }
    else if(e.key==="f"||e.key==="F"){ cycleFabric(); }
    else if(e.key==="Escape"){
      if(q("editor").classList.contains("on")) closeEditor(false);
      else if(NYC.simui&&NYC.simui.pickActive) NYC.simui.cancelPick();
      else if(q("drawer").classList.contains("on")) closeDrawer();
      else if(pinMode) setPinMode(false);
      else closeSheet();
    }
  });
}
function setPinMode(on){
  pinMode=on;
  q("pinBtn").setAttribute("aria-pressed",on?"true":"false");
  q("stage").classList.toggle("pinning",on);
  if(on) toast("Tap the sheet to drop a mark");
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot);
else boot();
})();
