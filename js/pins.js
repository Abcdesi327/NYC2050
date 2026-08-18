/* ===================================================================================
   NYC 2050 — the surveyor's own marks: dropped pins and bookmarked sites.
   Held in localStorage where the browser allows it, in memory where it does not.
   =================================================================================== */
(function(){
"use strict";
const NYC=window.NYC=window.NYC||{};
const KEY="nyc2050.marks.v1";

let mem=null, usable=true;
function read(){
  if(mem) return mem;
  let raw=null;
  try{ raw=localStorage.getItem(KEY); }catch(e){ usable=false; }
  try{ mem=raw?JSON.parse(raw):null; }catch(e){ mem=null; }
  if(!mem||typeof mem!=="object") mem={pins:[],stars:[]};
  if(!Array.isArray(mem.pins)) mem.pins=[];
  if(!Array.isArray(mem.stars)) mem.stars=[];
  return mem;
}
const subs=[];
function write(){
  if(usable){ try{ localStorage.setItem(KEY,JSON.stringify(mem)); }
    catch(e){ usable=false; } }
  subs.forEach(f=>{ try{ f(mem); }catch(e){} });
}
const uid=()=>"p"+Date.now().toString(36)+Math.random().toString(36).slice(2,6);

const store={
  get persistent(){ return usable; },
  pins(){ return read().pins.slice(); },
  stars(){ return read().stars.slice(); },
  pin(id){ return read().pins.find(p=>p.id===id)||null; },
  addPin(p){
    const d=read();
    const rec={id:uid(), name:(p.name||"Untitled mark").slice(0,60),
      note:(p.note||"").slice(0,600), x:+p.x, y:+p.y, ts:Date.now()};
    d.pins.push(rec); write(); return rec;
  },
  updatePin(id,patch){
    const d=read(), p=d.pins.find(p=>p.id===id);
    if(!p) return null;
    if(patch.name!=null) p.name=String(patch.name).slice(0,60)||p.name;
    if(patch.note!=null) p.note=String(patch.note).slice(0,600);
    if(patch.x!=null) p.x=+patch.x;
    if(patch.y!=null) p.y=+patch.y;
    write(); return p;
  },
  removePin(id){
    const d=read(), i=d.pins.findIndex(p=>p.id===id);
    if(i<0) return false;
    d.pins.splice(i,1); write(); return true;
  },
  isStarred(name){ return read().stars.indexOf(name)>=0; },
  toggleStar(name){
    const d=read(), i=d.stars.indexOf(name);
    if(i>=0) d.stars.splice(i,1); else d.stars.push(name);
    write(); return i<0;
  },
  clear(){ mem={pins:[],stars:[]}; write(); },
  toJSON(){ return JSON.stringify(Object.assign({v:1},read()),null,2); },
  fromJSON(txt){
    let d; try{ d=JSON.parse(txt); }catch(e){ return {ok:false,err:"not valid JSON"}; }
    if(!d||typeof d!=="object") return {ok:false,err:"not a mark file"};
    const pins=Array.isArray(d.pins)?d.pins:[], stars=Array.isArray(d.stars)?d.stars:[];
    const cur=read(), seen=new Set(cur.pins.map(p=>p.id));
    let added=0;
    pins.forEach(p=>{
      if(typeof p.x!=="number"||typeof p.y!=="number") return;
      const rec={id:seen.has(p.id)||!p.id?uid():p.id,
        name:String(p.name||"Untitled mark").slice(0,60),
        note:String(p.note||"").slice(0,600), x:p.x, y:p.y, ts:p.ts||Date.now()};
      cur.pins.push(rec); seen.add(rec.id); added++;
    });
    stars.forEach(s=>{ if(typeof s==="string"&&cur.stars.indexOf(s)<0) cur.stars.push(s); });
    write();
    return {ok:true,added:added,stars:stars.length};
  },
  onChange(fn){ subs.push(fn); return ()=>{const i=subs.indexOf(fn); if(i>=0)subs.splice(i,1);}; }
};
NYC.store=store;
})();
