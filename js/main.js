/**
 * main.js — Page init, Audio engine, Architecture modal + draggable graphs.
 * Reads profile data from data/profile.js. Wires Terminal and Chat.
 *
 * ⚡ To go live: replace YOUR_API_GATEWAY_ID with your deployed endpoint.
 */

const CONFIG = {
  API_ENDPOINT: "https://bomamgy5h1.execute-api.us-east-1.amazonaws.com/prod/chat",
};

document.addEventListener("DOMContentLoaded", () => {
  initNav();
  Terminal.init("term-output", "term-input", "term-wrap");
  Chat.init(CONFIG.API_ENDPOINT);
  initArchModal();
  initAudio();
});

function initNav() {
  const nav = document.querySelector("nav");
  window.addEventListener("scroll", () => {
    nav.style.boxShadow = window.scrollY > 10 ? "0 1px 12px rgba(0,0,0,0.06)" : "none";
  });
}

// ── Audio Engine ──────────────────────────────────────────────────────────
const Audio = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone({ freq=440, type="sine", gain=0.1, attack=0.005, decay=0.08 }) {
    try {
      const c=getCtx(), osc=c.createOscillator(), env=c.createGain();
      osc.connect(env); env.connect(c.destination);
      osc.type=type; osc.frequency.value=freq;
      env.gain.setValueAtTime(0,c.currentTime);
      env.gain.linearRampToValueAtTime(gain,c.currentTime+attack);
      env.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+attack+decay);
      osc.start(c.currentTime); osc.stop(c.currentTime+attack+decay+0.01);
    } catch(e) {}
  }
  function click()  { tone({freq:300,type:"sine",gain:0.06,attack:0.002,decay:0.04}); }
  function tick()   { tone({freq:1200,type:"square",gain:0.04,attack:0.001,decay:0.03}); }
  function tab()    { tone({freq:400,type:"sine",gain:0.05,attack:0.003,decay:0.05}); setTimeout(()=>tone({freq:500,type:"sine",gain:0.03,attack:0.002,decay:0.04}),30); }
  function pop()    { tone({freq:320,type:"sine",gain:0.07,attack:0.004,decay:0.09}); setTimeout(()=>tone({freq:440,type:"sine",gain:0.04,attack:0.002,decay:0.06}),40); }
  function whoosh() {
    try {
      const c=getCtx(), osc=c.createOscillator(), env=c.createGain();
      osc.connect(env); env.connect(c.destination); osc.type="sine";
      osc.frequency.setValueAtTime(200,c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600,c.currentTime+0.15);
      env.gain.setValueAtTime(0,c.currentTime);
      env.gain.linearRampToValueAtTime(0.07,c.currentTime+0.02);
      env.gain.exponentialRampToValueAtTime(0.0001,c.currentTime+0.18);
      osc.start(c.currentTime); osc.stop(c.currentTime+0.2);
    } catch(e) {}
  }
  return {click,tick,tab,pop,whoosh};
})();

function initAudio() {
  document.querySelectorAll(".btn,.nav-links a").forEach(el=>el.addEventListener("click",()=>Audio.click()));
  const archBtn=document.getElementById("arch-btn");
  if(archBtn) archBtn.addEventListener("click",()=>Audio.whoosh());
  ["arch-tab-chat","arch-tab-full","arch-tab-security"].forEach(id=>{
    const el=document.getElementById(id); if(el) el.addEventListener("click",()=>Audio.tab());
  });
  const ac=document.getElementById("arch-close"); if(ac) ac.addEventListener("click",()=>Audio.click());
  const ti=document.getElementById("term-input");
  if(ti) ti.addEventListener("keydown",e=>{ e.key!=="Enter"?Audio.tick():Audio.tab(); });
}

// ── Architecture Modal ────────────────────────────────────────────────────
var activeTab="chat";

function initArchModal() {
  const btn=document.getElementById("arch-btn");
  if(btn) btn.addEventListener("click",()=>{
    document.getElementById("arch-overlay").style.display="flex";
    document.body.style.overflow="hidden";
    showTab("chat");
  });
  document.getElementById("arch-overlay").addEventListener("click",function(e){ if(e.target===this) closeArch(); });
  updateTabStyles();
}

function tabBtnStyle(active) {
  return `font-family:'DM Mono',monospace;font-size:11px;cursor:pointer;padding:5px 12px;border-radius:4px;border:1px solid #e5e2de;transition:all 0.15s;background:${active?"#1a1816":"transparent"};color:${active?"#fff":"#6b6760"};`;
}
function updateTabStyles() {
  document.getElementById("arch-tab-chat").style.cssText=tabBtnStyle(activeTab==="chat");
  document.getElementById("arch-tab-full").style.cssText=tabBtnStyle(activeTab==="full");
  document.getElementById("arch-tab-security").style.cssText=tabBtnStyle(activeTab==="security");
}
function showTab(tab) {
  activeTab=tab; updateTabStyles();
  const c=document.getElementById("arch-content");
  if(tab==="chat") initDraggableFlow(c);
  else if(tab==="full") initFullArchGraph(c);
  else initSecurityGraph(c);
}
function closeArch() {
  document.getElementById("arch-overlay").style.display="none";
  document.body.style.overflow="";
}

// ── Shared Draggable Graph Engine ─────────────────────────────────────────
function makeDraggableGraph(container,cfg) {
  const NS="http://www.w3.org/2000/svg";
  const {nodes,edges,viewBox,bannerHtml,footerHtml}=cfg;

  function connPt(id,side) {
    const n=nodes[id];
    if(side==="right")  return {x:n.x+n.w,   y:n.y+n.h/2};
    if(side==="left")   return {x:n.x,         y:n.y+n.h/2};
    if(side==="top")    return {x:n.x+n.w/2,   y:n.y};
    if(side==="bottom") return {x:n.x+n.w/2,   y:n.y+n.h};
  }

  function edgePath(e) {
    const s=connPt(e.from,e.fromSide), t=connPt(e.to,e.toSide);
    if(e.fromSide==="top"&&e.toSide==="top") {
      const topY=Math.min(nodes[e.from].y,nodes[e.to].y)-46, r=13;
      return `M ${s.x} ${s.y} L ${s.x} ${topY+r} Q ${s.x} ${topY} ${s.x-r} ${topY} L ${t.x+r} ${topY} Q ${t.x} ${topY} ${t.x} ${topY+r} L ${t.x} ${t.y}`;
    }
    const dx=Math.abs(t.x-s.x)*0.5, dy=Math.abs(t.y-s.y)*0.5;
    let cx1=s.x,cy1=s.y,cx2=t.x,cy2=t.y;
    if(e.fromSide==="right")  cx1+=dx; if(e.fromSide==="left")   cx1-=dx;
    if(e.fromSide==="bottom") cy1+=dy; if(e.fromSide==="top")    cy1-=dy;
    if(e.toSide==="right")    cx2+=dx; if(e.toSide==="left")     cx2-=dx;
    if(e.toSide==="bottom")   cy2+=dy; if(e.toSide==="top")      cy2-=dy;
    return `M ${s.x} ${s.y} C ${cx1} ${cy1} ${cx2} ${cy2} ${t.x} ${t.y}`;
  }

  function labelPos(e) {
    const s=connPt(e.from,e.fromSide), t=connPt(e.to,e.toSide);
    if(e.fromSide==="top"&&e.toSide==="top") { const topY=Math.min(nodes[e.from].y,nodes[e.to].y)-46; return {x:(s.x+t.x)/2,y:topY-8,anchor:"middle"}; }
    if(e.fromSide==="bottom") return {x:Math.max(s.x,t.x)+7,y:(s.y+t.y)/2,anchor:"start"};
    return {x:(s.x+t.x)/2,y:Math.min(s.y,t.y)-7,anchor:"middle"};
  }

  container.innerHTML="";
  const hint=document.createElement("div");
  hint.style.cssText="text-align:center;font-size:11px;color:#6b6760;font-family:'DM Mono',monospace;margin-bottom:10px;";
  hint.textContent="✦ drag any node to rearrange";
  container.appendChild(hint);

  const svg=document.createElementNS(NS,"svg");
  svg.setAttribute("viewBox",viewBox);
  svg.style.cssText="width:100%;font-family:'DM Sans',sans-serif;user-select:none;overflow:visible;touch-action:none;";

  const defs=document.createElementNS(NS,"defs");
  defs.innerHTML=`
    <marker id="mhd"  markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#1a1816"/></marker>
    <marker id="mhds" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto-start-reverse"><polygon points="0 0,8 3,0 6" fill="#1a1816"/></marker>
    <marker id="mhg"  markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#6b6760"/></marker>
    <marker id="mha"  markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#a0782a"/></marker>
    <marker id="mht"  markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#0F6E56"/></marker>
    <marker id="mhb"  markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#4a6fa5"/></marker>`;
  svg.appendChild(defs);

  if(bannerHtml){const b=document.createElementNS(NS,"g");b.innerHTML=bannerHtml;svg.appendChild(b);}
  const edgeLayer=document.createElementNS(NS,"g"), labelLayer=document.createElementNS(NS,"g");
  svg.appendChild(edgeLayer); svg.appendChild(labelLayer);

  const edgeEls={};
  edges.forEach(e=>{
    const path=document.createElementNS(NS,"path");
    path.setAttribute("fill","none");
    path.setAttribute("stroke",e.noArrow?"#6b6760":(e.color||"#1a1816"));
    path.setAttribute("stroke-width",e.noArrow?"0.5":"1.5");
    if(e.dashed||e.noArrow) path.setAttribute("stroke-dasharray",e.noArrow?"3,3":"5,4");
    if(!e.noArrow){
      const m=e.color==="#a0782a"?"mha":e.color==="#0F6E56"?"mht":e.color==="#4a6fa5"?"mhb":(e.dashed?"mhg":"mhd");
      path.setAttribute("marker-end",`url(#${m})`);
      if(e.bidir) path.setAttribute("marker-start","url(#mhds)");
    }
    edgeLayer.appendChild(path);
    const txt=document.createElementNS(NS,"text");
    txt.setAttribute("font-size","10"); txt.setAttribute("fill","#6b6760"); txt.setAttribute("text-anchor","middle");
    txt.textContent=e.label||"";
    labelLayer.appendChild(txt);
    edgeEls[e.id]={path,txt};
  });

  let dragging=null,ox=0,oy=0;

  Object.entries(nodes).forEach(([id,n])=>{
    const g=document.createElementNS(NS,"g"); g.style.cursor="grab";
    const rect=document.createElementNS(NS,"rect");
    rect.setAttribute("width",n.w); rect.setAttribute("height",n.h);
    rect.setAttribute("rx","6"); rect.setAttribute("fill",n.fill);
    rect.setAttribute("stroke",n.stroke); rect.setAttribute("stroke-width",n.dashedBorder?"0.5":"1");
    if(n.dashedBorder) rect.setAttribute("stroke-dasharray","4,3");
    const t1=document.createElementNS(NS,"text");
    t1.setAttribute("x",n.w/2); t1.setAttribute("y",n.sub?n.h/2-8:n.h/2);
    t1.setAttribute("text-anchor","middle"); t1.setAttribute("dominant-baseline","central");
    t1.setAttribute("font-size",n.fs||"12"); t1.setAttribute("font-weight","500"); t1.setAttribute("fill",n.tc);
    t1.textContent=n.label;
    g.appendChild(rect); g.appendChild(t1);
    if(n.sub){
      const t2=document.createElementNS(NS,"text");
      t2.setAttribute("x",n.w/2); t2.setAttribute("y",n.h/2+11);
      t2.setAttribute("text-anchor","middle"); t2.setAttribute("dominant-baseline","central");
      t2.setAttribute("font-size","10"); t2.setAttribute("fill","#6b6760");
      t2.textContent=n.sub; g.appendChild(t2);
    }
    svg.appendChild(g);
    function sc(){return parseFloat(svg.getAttribute("viewBox").split(" ")[2])/svg.getBoundingClientRect().width;}
    g.addEventListener("mousedown",ev=>{
      ev.preventDefault(); dragging=id;
      const r=svg.getBoundingClientRect(),s=sc();
      ox=(ev.clientX-r.left)*s-n.x; oy=(ev.clientY-r.top)*s-n.y; g.style.cursor="grabbing";
    });
    g.addEventListener("touchstart",ev=>{
      ev.preventDefault(); dragging=id;
      const r=svg.getBoundingClientRect(),s=sc(),t=ev.touches[0];
      ox=(t.clientX-r.left)*s-n.x; oy=(t.clientY-r.top)*s-n.y;
    },{passive:false});
    nodes[id]._el=g;
  });

  function sc2(){return parseFloat(svg.getAttribute("viewBox").split(" ")[2])/svg.getBoundingClientRect().width;}
  function moveNode(id,mx,my){const n=nodes[id];n.x=mx-ox;n.y=my-oy;n._el.setAttribute("transform",`translate(${n.x},${n.y})`);redraw();}
  svg.addEventListener("mousemove",ev=>{if(!dragging)return;const r=svg.getBoundingClientRect();moveNode(dragging,(ev.clientX-r.left)*sc2(),(ev.clientY-r.top)*sc2());});
  svg.addEventListener("mouseup",()=>{if(dragging){nodes[dragging]._el.style.cursor="grab";dragging=null;}});
  svg.addEventListener("mouseleave",()=>{if(dragging){nodes[dragging]._el.style.cursor="grab";dragging=null;}});
  svg.addEventListener("touchmove",ev=>{if(!dragging)return;ev.preventDefault();const r=svg.getBoundingClientRect(),t=ev.touches[0];moveNode(dragging,(t.clientX-r.left)*sc2(),(t.clientY-r.top)*sc2());},{passive:false});
  svg.addEventListener("touchend",()=>{dragging=null;});

  function redraw(){
    edges.forEach(e=>{
      const els=edgeEls[e.id];
      els.path.setAttribute("d",edgePath(e));
      const lp=labelPos(e);
      els.txt.setAttribute("x",lp.x); els.txt.setAttribute("y",lp.y);
      if(lp.anchor) els.txt.setAttribute("text-anchor",lp.anchor);
    });
  }
  Object.entries(nodes).forEach(([id,n])=>n._el.setAttribute("transform",`translate(${n.x},${n.y})`));
  redraw();
  container.appendChild(svg);
  if(footerHtml){const f=document.createElement("div");f.innerHTML=footerHtml;container.appendChild(f);}
}

// ── AI Chat Flow ──────────────────────────────────────────────────────────
function initDraggableFlow(c) {
  makeDraggableGraph(c,{
    nodes:{
      browser: {x:20, y:160,w:130,h:76,label:"Browser",    sub:"chat.js",      fill:"#f0ede8",stroke:"#888780",tc:"#1a1816"},
      apiGw:   {x:205,y:160,w:145,h:76,label:"API Gateway",sub:"CORS + Policy",fill:"#fff3e0",stroke:"#a0782a",tc:"#a0782a"},
      lambda:  {x:410,y:160,w:130,h:76,label:"Lambda",     sub:"handler.py",   fill:"#fff3e0",stroke:"#a0782a",tc:"#a0782a"},
      bedrock: {x:598,y:160,w:142,h:76,label:"AWS Bedrock",sub:"Claude (IAM)", fill:"#e8f5e9",stroke:"#2d6a4f",tc:"#2d6a4f"},
    },
    edges:[
      {id:"e1",from:"browser",fromSide:"right",to:"apiGw",  toSide:"left",label:"POST /chat",       dashed:false},
      {id:"e2",from:"apiGw",  fromSide:"right",to:"lambda", toSide:"left",label:"Validated",        dashed:false},
      {id:"e3",from:"lambda", fromSide:"right",to:"bedrock",toSide:"left",label:"InvokeModel (IAM)",dashed:false},
      {id:"e4",from:"bedrock",fromSide:"top",  to:"browser",toSide:"top", label:"streamed response",dashed:true},
    ],
    viewBox:"0 0 780 380",
    bannerHtml:`<rect x="20" y="16" width="740" height="22" rx="4" fill="#faf9f7" stroke="#e5e2de" stroke-width="1"/>
      <text x="390" y="31" text-anchor="middle" font-size="10" fill="#6b6760">🔒 3 layers before Bedrock: CORS → Resource policy → Rate limiting → IAM</text>`,
  });
}

// ── Full Architecture ─────────────────────────────────────────────────────
function initFullArchGraph(c) {
  makeDraggableGraph(c,{
    nodes:{
      indexHtml: {x:10, y:90, w:140,h:50,label:"index.html",     sub:"Entry point",    fill:"#f0f4ff",stroke:"#4a6fa5",tc:"#4a6fa5"},
      profileJs: {x:165,y:90, w:145,h:50,label:"data/profile.js",sub:"Source of truth",fill:"#f0f4ff",stroke:"#4a6fa5",tc:"#4a6fa5"},
      terminalJs:{x:10, y:175,w:140,h:50,label:"js/terminal.js", sub:"State machine",  fill:"#f0f4ff",stroke:"#4a6fa5",tc:"#4a6fa5"},
      chatJs:    {x:165,y:175,w:145,h:50,label:"js/chat.js",     sub:"AI chat widget", fill:"#f0f4ff",stroke:"#4a6fa5",tc:"#4a6fa5"},
      mainJs:    {x:10, y:268,w:300,h:44,label:"js/main.js",     sub:"Init + wiring",  fill:"#f0f4ff",stroke:"#4a6fa5",tc:"#4a6fa5"},
      apiGw:     {x:450,y:80, w:145,h:50,label:"API Gateway",    sub:"CORS + Auth",    fill:"#fff8f0",stroke:"#a0782a",tc:"#a0782a"},
      lambda:    {x:450,y:185,w:145,h:50,label:"Lambda",         sub:"handler.py",     fill:"#fff8f0",stroke:"#a0782a",tc:"#a0782a"},
      cloudwatch:{x:630,y:185,w:140,h:50,label:"CloudWatch",     sub:"Logs + Metrics", fill:"#fff8f0",stroke:"#a0782a",tc:"#a0782a"},
      bedrock:   {x:390,y:320,w:320,h:50,label:"AWS Bedrock",    sub:"Claude (IAM)",   fill:"#e8f5e9",stroke:"#2d6a4f",tc:"#2d6a4f"},
    },
    edges:[
      {id:"e1",from:"chatJs",  fromSide:"right", to:"apiGw",     toSide:"left",  label:"POST /chat",       dashed:false,bidir:true},
      {id:"e2",from:"apiGw",   fromSide:"bottom",to:"lambda",    toSide:"top",   label:"",                 dashed:false,bidir:true},
      {id:"e3",from:"lambda",  fromSide:"right", to:"cloudwatch",toSide:"left",  label:"logs",             dashed:false},
      {id:"e4",from:"lambda",  fromSide:"bottom",to:"bedrock",   toSide:"top",   label:"InvokeModel (IAM)",dashed:false,bidir:true},
      {id:"e5",from:"profileJs",fromSide:"bottom",to:"chatJs",   toSide:"top",   label:"feeds",            dashed:false,color:"#4a6fa5"},
      {id:"e6",from:"profileJs",fromSide:"bottom",to:"terminalJs",toSide:"top",  label:"",                 dashed:false,color:"#4a6fa5"},
    ],
    viewBox:"0 0 780 400",
  });
}

// ── Security Layers ───────────────────────────────────────────────────────
function initSecurityGraph(c) {
  makeDraggableGraph(c,{
    nodes:{
      l1:        {x:20, y:110,w:150,h:50,label:"CORS policy",    sub:"Layer 1 · browser",  fill:"#E6F1FB",stroke:"#185FA5",tc:"#0C447C",fs:"12"},
      l2:        {x:20, y:168,w:150,h:50,label:"Resource policy",sub:"Layer 2 · AWS-level", fill:"#E6F1FB",stroke:"#185FA5",tc:"#0C447C",fs:"12"},
      l3:        {x:20, y:226,w:150,h:50,label:"Rate limiting",  sub:"Layer 3 · rate+quota",fill:"#E6F1FB",stroke:"#185FA5",tc:"#0C447C",fs:"12"},
      l4:        {x:20, y:284,w:150,h:50,label:"Origin check",   sub:"Layer 4 · code-level",fill:"#E1F5EE",stroke:"#0F6E56",tc:"#085041",fs:"12"},
      browser:   {x:285,y:20, w:120,h:44,label:"Browser",     sub:"",fill:"#F1EFE8",stroke:"#5F5E5A",tc:"#2C2C2A"},
      apiGw:     {x:285,y:130,w:120,h:44,label:"API Gateway", sub:"",fill:"#E6F1FB",stroke:"#185FA5",tc:"#0C447C"},
      lambda:    {x:285,y:250,w:120,h:44,label:"Lambda",      sub:"",fill:"#E1F5EE",stroke:"#0F6E56",tc:"#085041"},
      bedrock:   {x:285,y:360,w:120,h:44,label:"AWS Bedrock", sub:"",fill:"#e8f5e9",stroke:"#2d6a4f",tc:"#2d6a4f"},
      cloudwatch:{x:510,y:250,w:150,h:50,label:"CloudWatch",  sub:"logs + metrics",  fill:"#FAEEDA",stroke:"#854F0B",tc:"#633806"},
    },
    edges:[
      {id:"e1",from:"browser",fromSide:"bottom",to:"apiGw",  toSide:"top", label:"POST /chat",dashed:false,bidir:true},
      {id:"e2",from:"apiGw",  fromSide:"bottom",to:"lambda", toSide:"top", label:"",          dashed:false,bidir:true},
      {id:"e3",from:"lambda", fromSide:"bottom",to:"bedrock",toSide:"top", label:"IAM auth",  dashed:false,bidir:true},
      {id:"l1",from:"l1",fromSide:"right",to:"apiGw", toSide:"left",label:"",noArrow:true},
      {id:"l2",from:"l2",fromSide:"right",to:"apiGw", toSide:"left",label:"",noArrow:true},
      {id:"l3",from:"l3",fromSide:"right",to:"apiGw", toSide:"left",label:"",noArrow:true},
      {id:"l4",from:"l4",fromSide:"right",to:"lambda",toSide:"left",label:"",noArrow:true},
      {id:"s1",from:"lambda",fromSide:"right",to:"cloudwatch",toSide:"left",label:"",dashed:false,color:"#a0782a"},
    ],
    viewBox:"0 0 680 430",
    footerHtml:``,
  });
}
