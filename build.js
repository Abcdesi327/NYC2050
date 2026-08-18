#!/usr/bin/env node
/* Inlines index.html, its stylesheet and its scripts into one portable file.
   Usage: node build.js [outfile]        default: dist/nyc2050.html            */
"use strict";
const fs=require("fs"), path=require("path");
const root=__dirname;
const out=process.argv[2]||path.join(root,"dist","nyc2050.html");

let html=fs.readFileSync(path.join(root,"index.html"),"utf8");

html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(m,href)=>
  "<style>\n"+fs.readFileSync(path.join(root,href),"utf8").trim()+"\n</style>");

html=html.replace(/<script src="([^"]+)"><\/script>/g,(m,src)=>
  "<script>\n"+fs.readFileSync(path.join(root,src),"utf8").trim()+"\n<\/script>");

if(/<link rel="stylesheet"|<script src=/.test(html)){
  console.error("build: something did not inline"); process.exit(1);
}
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,html);
console.log("wrote "+path.relative(root,out)+"  ("+(html.length/1024).toFixed(0)+" KB)");
