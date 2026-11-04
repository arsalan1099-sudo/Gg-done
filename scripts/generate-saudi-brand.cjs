#!/usr/bin/env node
// Render Go Saudi-owned launcher/splash artwork at build time; do NOT reuse
// inherited Go Bharat or any official government seal.
const fs=require("node:fs");
const path=require("node:path");
const sharp=require("sharp");
const dest=path.resolve(__dirname,"../assets/images");
fs.mkdirSync(dest,{recursive:true});
const bg="#063F32",gold="#E4BA69";
const core=({mono=false})=>`
 <g fill="none" stroke="${mono?"#FFFFFF":gold}" stroke-linecap="round" stroke-linejoin="round">
 <path d="M230 630 Q256 375 512 265 Q768 375 794 630" stroke-width="31" opacity=".96"/>
 <path d="M290 660 Q512 776 734 660" stroke-width="21" opacity=".9"/>
 <path d="M340 720 Q512 810 684 720" stroke-width="11" opacity=".8"/>
 <path d="M455 352 L511 297 L567 352" stroke-width="16"/>
 </g>
 <text x="512" y="605" text-anchor="middle" font-family="DejaVu Sans,Liberation Sans,sans-serif"
 font-size="245" font-weight="900" letter-spacing="-26" fill="${mono?"#FFFFFF":"#FFDF9D"}">GS</text>
 <path d="M515 145 L536 194 L585 214 L536 234 L515 283 L494 234 L445 214 L494 194Z" fill="${mono?"#FFFFFF":"#EAC17B"}"/>
`;
const square=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
 <stop stop-color="#0D6750"/><stop offset=".57" stop-color="#05392F"/><stop offset="1" stop-color="#042B25"/>
 </linearGradient></defs>
<rect width="1024" height="1024" rx="230" fill="url(#g)"/>
<rect x="75" y="75" width="874" height="874" rx="185" fill="none" stroke="#BE9148" stroke-width="14"/>
${core({})}
</svg>`;
const foreground=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
${core({})}
</svg>`;
const mono=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
${core({mono:true})}
</svg>`;
const background=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${bg}"/></svg>`;
const list=[
 ["icon.png",square],["android-icon-foreground.png",foreground],
 ["android-icon-background.png",background],["android-icon-monochrome.png",mono],
 ["splash-icon.png",square],["favicon.png",square]
];
(async()=>{
 for(const [name,svg] of list){
  const size=name==="favicon.png"?96:1024;
  await sharp(Buffer.from(svg)).resize(size,size).png().toFile(path.join(dest,name));
  console.log("Generated Saudi-only brand asset",name);
 }
})().catch(err=>{console.error(err);process.exit(1)});
