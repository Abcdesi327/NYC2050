/* ===================================================================================
   Adrinem — the projection console and the month scrubber. The survey sheet's console,
   pointed at a continent: choose a hazard, set what it does, put it somewhere if it
   needs a somewhere, and run twelve months across the cell field.

   The report is in two halves and the second is the one worth reading: what the event
   took, and then what stopped working because of it — markets that can no longer reach
   each other, ground that has lost the market that fed it, and how much further the
   food now has to travel.
   =================================================================================== */
(function(){
"use strict";
const A=window.ADRINEM=window.ADRINEM||{};
const q=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",
  '"':"&quot;"}[c]));

let map=null, hazard=null, params={}, point=null, result=null, step=0, playing=null;
const api={pickActive:false};

/* ---- the hazard grid, split the way the sheet splits them ------------------------- */
function buildGrid(){
  const wrap=q("projHazards"); wrap.innerHTML="";
  [["natural","NATURAL"],["supernatural","SUPERNATURAL"]].forEach(([kind,label])=>{
    const h=document.createElement("p"); h.className="hkind"; h.textContent=label;
    wrap.appendChild(h);
    const row=document.createElement("div"); row.className="hrow";
    A.sim.HAZARDS.filter(H=>H.kind===kind).forEach(H=>{
      const b=document.createElement("button");
      b.className="chip"; b.textContent=H.short; b.dataset.id=H.id;
      b.onclick=()=>choose(H.id);
      row.appendChild(b);
    });
    wrap.appendChild(row);
  });
}

function choose(id){
  hazard=A.sim.hazardById(id);
  if(!hazard) return;
  params={}; hazard.params.forEach(p=>params[p.id]=p.val);
  point=null; clear(false);
  [...q("projHazards").querySelectorAll(".chip")].forEach(b=>
    b.classList.toggle("on",b.dataset.id===id));
  q("projName").textContent=hazard.name;
  q("projBlurb").textContent=hazard.blurb;
  q("projPointRow").style.display=hazard.point?"":"none";
  q("projPick").textContent=hazard.pointLabel?("SET "+hazard.pointLabel):"SET POINT";
  setPick(false);
  showPoint();
  buildParams();
}

function buildParams(){
  const box=q("projParams"); box.innerHTML="";
  hazard.params.forEach(p=>{
    const row=document.createElement("div"); row.className="prow";
    const lab=document.createElement("label");
    lab.innerHTML=p.label+"<b></b>";
    const inp=document.createElement("input");
    inp.type="range"; inp.min=p.min; inp.max=p.max; inp.step=p.step; inp.value=params[p.id];
    const show=()=>{
      const v=+inp.value;
      lab.querySelector("b").textContent=p.onoff?(v?"YES":"NO"):
        p.bearing?compass(v):(v+(p.unit||""));
    };
    inp.addEventListener("input",()=>{ params[p.id]=+inp.value; show(); });
    show();
    row.appendChild(lab); row.appendChild(inp); box.appendChild(row);
  });
}
const compass=d=>["E","SE","S","SW","W","NW","N","NE"][(Math.round(((d%360)+360)%360/45))%8]+
  " ("+d+"°)";

/* ---- putting it somewhere -------------------------------------------------------- */
function setPick(on){
  api.pickActive=!!on;
  q("projPick").setAttribute("aria-pressed",String(api.pickActive));
  q("stage").classList.toggle("picking",api.pickActive);
}
function setPoint(cell){
  point=cell; setPick(false); showPoint();
  map&&map.drawHazard({at:cell});
}
function showPoint(){
  const el=q("projPointRef");
  el.textContent=point==null?"— not set —":A.sim.placeName(point);
}

/* ---- run ------------------------------------------------------------------------- */
function runNow(){
  if(!hazard) return;
  if(hazard.point&&point==null){ toast("This one needs a point on the sheet."); return; }
  q("projRun").disabled=true; q("projRun").textContent="RUNNING…";
  setTimeout(()=>{
    try{
      result=A.sim.run({hazard:hazard.id,point:point,params:Object.assign({},params)});
    }catch(e){ result=null; console.error(e); }
    q("projRun").disabled=false; q("projRun").textContent="RUN PROJECTION";
    if(!result){ q("projReport").innerHTML=
      '<div class="rterr">The projection did not run.</div>'; return; }
    q("projTime").classList.add("on");
    show(A.sim.MONTHS);
    report();
  },30);
}

function show(n){
  if(!result) return;
  step=Math.max(1,Math.min(A.sim.MONTHS,n));
  const f=result.frames[step-1];
  map&&map.drawProjection(f);
  q("projScrub").value=step;
  q("projMonth").textContent="MONTH "+String(step).padStart(2,"0");
  const t=f.tally;
  q("projCounts").innerHTML=
    A.sim.STATES.slice(0,4).map(s=>'<i style="background:'+s[2]+'"></i>'+
      (t[s[0]]||0)).join('<b class="sep"></b>')+
    '<span class="dd">'+f.dead.toLocaleString()+' gone</span>';
  const log=q("projLog");
  log.innerHTML=result.events.filter(e=>e.t<=step).slice(-6).map(e=>
    '<span class="'+e.kind+'">M'+String(e.t).padStart(2,"0")+'</span> '+esc(e.text))
    .join("<br>")||"—";
}

function report(){
  const r=result.report, n=r.network;
  const row=(k,v)=>'<dt>'+esc(k)+'</dt><dd>'+esc(v)+'</dd>';
  let h='<p class="rep-h">WHAT IT TOOK</p><dl class="acct">'+
    row("Land cells touched",r.landHit.toLocaleString()+" of "+
      A.data.report.land_cells.toLocaleString())+
    row("Stricken or lost",(r.byState.LOST+r.byState.STRICKEN).toLocaleString())+
    row("People gone",r.dead.toLocaleString())+
    (r.unmade?row("No longer land",r.unmade+" cells"):"")+
    row("Burgs hit",r.burgs.length)+
    '</dl>';

  h+='<p class="rep-h">WHAT STOPPED WORKING</p><dl class="acct">'+
    row("Cells closed to traffic",n.closed.toLocaleString())+
    row("Markets keeping a market",n.marketsLeft+" of "+A.data.markets.length)+
    row("Market pairs reachable",n.pairsNow+" of "+n.pairsBefore)+
    row("Ground cut off",n.cutOff.toLocaleString()+" cells, "+
      n.cutPop.toLocaleString()+" people")+
    (n.daysCells?row("Supply lengthened","+"+n.daysAdded.toFixed(1)+" days for "+
      n.daysCells.toLocaleString()+" cells"):"")+
    '</dl>';

  if(n.severed.length){
    h+='<p class="rep-h">PAIRS SEVERED</p><ul class="why">';
    n.severed.slice(0,8).forEach(s=>h+='<li><b>'+esc(s[0])+' — '+esc(s[1])+
      '</b><span>no overland way between them any more</span></li>');
    if(n.severed.length>8) h+='<li><span>and '+(n.severed.length-8)+' more</span></li>';
    h+='</ul>';
  }
  const lc=Object.keys(n.lostCatchment);
  if(lc.length){
    h+='<p class="rep-h">CATCHMENTS BROKEN</p><ul class="why">';
    lc.sort((a,b)=>n.lostCatchment[b]-n.lostCatchment[a]).slice(0,6).forEach(k=>
      h+='<li><b>'+esc(k)+'</b><span>'+n.lostCatchment[k]+
        ' cells can no longer reach it</span></li>');
    h+='</ul>';
  }
  if(r.burgs.length){
    h+='<p class="rep-h">THE WORST OF IT</p><ul class="why">';
    r.burgs.slice(0,7).forEach(b=>h+='<li><b>'+esc(b.name)+' · '+
      b.pop.toLocaleString()+'</b><span>'+esc(b.state)+' — '+
      A.sim.stateOf(b.f)+(b.market?", a market centre":"")+'</span></li>');
    h+='</ul>';
  }
  h+='<p class="rep-note">'+esc(r.text)+'</p>';
  h+='<p class="rtfoot">Twelve months over '+
    A.data.report.land_cells.toLocaleString()+' land cells. What stopped working is '+
    'the router run again over the ground that is left — the same router that '+
    'reproduces the exported network to within 0.006 per cent. None of it is a '+
    'prediction: the vulnerabilities are invented to be plausible and are written '+
    'down in js/adrinem-sim.js.</p>';
  q("projReport").innerHTML=h;
}

/* ---- the scrubber ----------------------------------------------------------------- */
function play(){
  if(playing) return stop();
  q("projPlay").textContent="❚❚";
  if(step>=A.sim.MONTHS) show(1);
  playing=setInterval(()=>{
    if(step>=A.sim.MONTHS) return stop();
    show(step+1);
  },420);
}
function stop(){ if(playing) clearInterval(playing); playing=null;
  q("projPlay").textContent="▶"; }
function clear(full){
  stop(); result=null; step=0;
  q("projTime").classList.remove("on");
  q("projReport").innerHTML="";
  map&&map.clearProjection();
  if(full){ point=null; showPoint(); }
}

let toastT=null;
function toast(msg){
  const t=q("toast"); if(!t) return;
  t.textContent=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2200);
}

/* ---- open, close, wiring ---------------------------------------------------------- */
function open(){ q("projPanel").classList.add("on");
  q("projBtn").setAttribute("aria-pressed","true"); }
function close(){ q("projPanel").classList.remove("on");
  q("projBtn").setAttribute("aria-pressed","false"); setPick(false); }
function isOpen(){ return q("projPanel").classList.contains("on"); }

function init(theMap){
  map=theMap;
  buildGrid();
  choose(A.sim.HAZARDS[0].id);
  q("projClose").onclick=close;
  q("projRun").onclick=runNow;
  q("projPick").onclick=()=>setPick(!api.pickActive);
  q("projPlay").onclick=play;
  q("projReset").onclick=()=>clear(true);
  q("projScrub").addEventListener("input",e=>{ stop(); show(+e.target.value); });
  q("projScrub").max=A.sim.MONTHS;
}

A.projui=Object.assign(api,{init:init, open:open, close:close, isOpen:isOpen,
  setPoint:setPoint, setPick:setPick, clear:clear,
  get hasResult(){ return !!result; }});
})();
