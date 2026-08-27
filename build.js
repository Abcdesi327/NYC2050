#!/usr/bin/env node
/* Inlines each sheet, its stylesheet and its scripts into one portable file.
   Usage: node build.js [sheet.html outfile]   default: both sheets into dist/   */
"use strict";
const fs=require("fs"), path=require("path");
const root=__dirname;

const SHEETS=[
  ["index.html",   path.join(root,"dist","nyc2050.html")],
  ["adrinem.html", path.join(root,"dist","adrinem.html")]
];

function inline(srcName,out){
  let html=fs.readFileSync(path.join(root,srcName),"utf8");

  html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(m,href)=>
    "<style>\n"+fs.readFileSync(path.join(root,href),"utf8").trim()+"\n</style>");

  html=html.replace(/<script src="([^"]+)"><\/script>/g,(m,src)=>
    "<script>\n"+fs.readFileSync(path.join(root,src),"utf8").trim()+"\n<\/script>");

  if(/<link rel="stylesheet"|<script src=/.test(html)){
    console.error("build: something did not inline in "+srcName); process.exit(1);
  }
  /* the two sheets link to each other by their source names; a single file has to
     point at the other single file instead */
  html=html.replace(/href="index\.html"/g,'href="nyc2050.html"');

  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,html);
  console.log("wrote "+path.relative(root,out)+"  ("+(html.length/1024).toFixed(0)+" KB)");
}

if(process.argv.length>3) inline(process.argv[2],process.argv[3]);
else if(process.argv.length===3) inline("index.html",process.argv[2]);
else SHEETS.forEach(([src,out])=>inline(src,out));
