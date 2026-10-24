import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
const dir='/Users/initia-army/Documents/juristic-platform/docs/diagrams';
const source=await readFile(dir+'/block-diagram-semester-scope.svg','utf8');
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});
 await page.route('**/*',r=>r.abort());
 await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">'+source+'</body></html>');
 await page.evaluate(()=>document.fonts.ready);
 const items=await page.evaluate(()=>[...document.querySelector('svg').children].filter(n=>['rect','text','path','line'].includes(n.tagName)).map((n,i)=>{
  const s=getComputedStyle(n),b=n.getBoundingClientRect();
  return {id:'source-'+i,tag:n.tagName,attrs:Object.fromEntries([...n.attributes].map(a=>[a.name,a.value])),value:n.textContent,bounds:{x:b.x,y:b.y,w:b.width,h:b.height},style:{fill:s.fill,stroke:s.stroke,strokeWidth:parseFloat(s.strokeWidth),dash:s.strokeDasharray,fontSize:parseFloat(s.fontSize),fontFamily:s.fontFamily,fontWeight:s.fontWeight,textAnchor:s.textAnchor,letterSpacing:s.letterSpacing}};
 }));
 await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#FAFBF9"><div id="graph" style="position:relative;width:1920px;height:1080px;overflow:hidden;background:#FAFBF9"></div></body></html>');
 await page.evaluate(()=>{window.urlParams={};window.mxLoadResources=false;window.mxLoadStylesheets=false;window.mxBasePath='';window.mxImageBasePath='';window.mxLanguage='en';window.mxDefaultLanguage='en';});
 await page.addScriptTag({path:'/tmp/juristic-drawio-app.min.js'});
 const result=await page.evaluate(async(items)=>{
  const graph=new Graph(document.getElementById('graph'));
  window.diagramGraph=graph;
  graph.setConnectable(true);graph.setHtmlLabels(false);graph.gridEnabled=false;graph.background='#FAFBF9';graph.pageFormat=new mxRectangle(0,0,1920,1080);
  const model=graph.getModel(),root=graph.getDefaultParent(),cells={};
  const hex=v=>{const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v||'');return m?'#'+m.slice(1,4).map(v=>(+v).toString(16).padStart(2,'0')).join(''):v||'none';};
  const rects=items.filter(n=>n.tag==='rect'&&!(+n.attrs.width===1920&&+n.attrs.height===1080)).map(n=>({...n,x:+n.attrs.x||0,y:+n.attrs.y||0,w:+n.attrs.width,h:+n.attrs.height}));
  const contains=(a,b)=>a.x<=b.x+.1&&a.y<=b.y+.1&&a.x+a.w>=b.x+b.w-.1&&a.y+a.h>=b.y+b.h-.1;
  const parentOf=(b,self)=>rects.filter(r=>r.id!==self&&contains(r,b)).sort((a,b)=>a.w*a.h-b.w*b.h)[0];
  const parents={};for(const r of rects)parents[r.id]=parentOf(r,r.id);
  function addRect(r){if(cells[r.id])return cells[r.id];const p=parents[r.id];if(p)addRect(p);const rx=+(r.attrs.rx||0);let s=`shape=rectangle;html=0;whiteSpace=nowrap;fillColor=${hex(r.style.fill)};strokeColor=${hex(r.style.stroke)};strokeWidth=${r.style.strokeWidth};rounded=${rx?1:0};absoluteArcSize=1;arcSize=${rx*2};shadow=0;container=0;recursiveResize=0;`;
   if(r.style.dash!=='none')s+=`dashed=1;fixDash=1;dashPattern=${r.style.dash.replaceAll('px','').replaceAll(',',' ').trim().replace(/\s+/g,' ')};`;
   return cells[r.id]=graph.insertVertex(p?cells[p.id]:root,r.id,'',r.x-(p?.x||0),r.y-(p?.y||0),r.w,r.h,s);
  }
  model.beginUpdate();
  try {
   for(const r of rects)addRect(r);
   for(const n of items.filter(n=>n.tag==='text')){
    const b=n.bounds,p=parentOf(b),s=n.style;
    const family=s.fontFamily.split(',')[0].replaceAll('"','').trim();
    let style=`shape=text;html=0;whiteSpace=nowrap;overflow=visible;align=left;verticalAlign=top;spacing=0;spacingTop=0;spacingBottom=0;spacingLeft=0;spacingRight=0;fontFamily=${family};fontSize=${s.fontSize};fontColor=${hex(s.fill)};fontStyle=${+s.fontWeight>=600?1:0};fillColor=none;strokeColor=none;resizable=1;labelPadding=0;`;
    let value=n.value;if(s.letterSpacing!=='normal'&&parseFloat(s.letterSpacing)!==0){style+='html=1;';value='<div style="letter-spacing:'+s.letterSpacing+';white-space:nowrap">'+n.value+'</div>';}
    cells[n.id]=graph.insertVertex(p?cells[p.id]:root,n.id,value,b.x-(p?.x||0),b.y-(p?.y||0),b.w+4,b.h,style);
   }
   for(const n of items.filter(n=>n.tag==='line')){
    const a=n.attrs;let st=`endArrow=none;startArrow=none;strokeColor=${hex(n.style.stroke)};strokeWidth=${n.style.strokeWidth};rounded=0;`;
    if(n.style.dash!=='none')st+=`dashed=1;fixDash=1;dashPattern=${n.style.dash.replaceAll('px','').replaceAll(',',' ').trim().replace(/\s+/g,' ')};`;
    const e=graph.insertEdge(root,n.id,'',null,null,st);const g=e.geometry.clone();g.setTerminalPoint(new mxPoint(+a.x1,+a.y1),true);g.setTerminalPoint(new mxPoint(+a.x2,+a.y2),false);model.setGeometry(e,g);cells[n.id]=e;
   }
   const rect=(x,y)=>cells[rects.find(r=>r.x===x&&r.y===y).id];
   const connections=[
    [380,316,100,420,.5,1,.5,0,0,0,false,false],
    [472,552,816,552,1,.5,0,.5,5,6,false,false],
    [816,552,816,688,.5,1,.5,0,5,5,false,false],
    [816,688,472,688,0,.5,1,.5,5,6,false,false],
    [100,420,350,884,.5,1,.5,0,6,7,false,true],
    [100,420,1294,420,1,.125,0,.5,4,7,true,false],
    [1294,420,1294,580,.5,1,.5,0,6,7,true,false],
    [1294,580,1294,740,.5,1,.5,0,6,7,true,false]
   ];
   connections.forEach((v,i)=>{const [sx,sy,tx,ty,ex,ey,ix,iy,ss,ts,fut,both]=v;let style=`edgeStyle=none;rounded=0;html=0;strokeColor=${fut?'#9A6A24':'#176B5B'};strokeWidth=3;endArrow=open;endFill=0;endSize=16.2;startArrow=${both?'open':'none'};startFill=0;startSize=16.2;exitX=${ex};exitY=${ey};exitDx=0;exitDy=0;exitPerimeter=1;entryX=${ix};entryY=${iy};entryDx=0;entryDy=0;entryPerimeter=1;sourcePerimeterSpacing=${both?ss-3.354:ss};targetPerimeterSpacing=${Math.max(0,ts-3.354)};fixedPointSpacing=1;`;
    if(fut)style+='dashed=1;fixDash=1;dashPattern=9 7;';
    cells['connector-'+i]=graph.insertEdge(root,'connector-'+i,'',rect(sx,sy),rect(tx,ty),style);
   });
  }finally{model.endUpdate();}
  await document.fonts.ready;graph.refresh();
  // SVG text uses baseline coordinates; align the native draw.io text to the source bounds.
  const textItems=items.filter(n=>n.tag==='text');
  const textBounds=el=>{const inner=el.querySelector('div[style*="letter-spacing"]');if(inner){const range=document.createRange();range.selectNodeContents(inner);return range.getBoundingClientRect();}return el.getBoundingClientRect();};
  for(let round=0;round<2;round++){
   model.beginUpdate();try{
    for(const n of textItems){const cell=cells[n.id],state=graph.view.getState(cell);const el=state?.text?.node;if(!el)throw Error('Missing editable text '+n.id);const b=textBounds(el),g=cell.geometry.clone();g.x+=n.bounds.x-b.x;g.y+=n.bounds.y-b.y;model.setGeometry(cell,g);}
   }finally{model.endUpdate();}graph.refresh();
  }
  const diffs=textItems.map(n=>{const b=textBounds(graph.view.getState(cells[n.id]).text.node);return {text:n.value,dx:b.x-n.bounds.x,dy:b.y-n.bounds.y,dw:b.width-n.bounds.w,dh:b.height-n.bounds.h};});
  const codec=new mxCodec();const xml=codec.encode(model);for(const [k,v]of Object.entries({dx:1920,dy:1080,grid:0,gridSize:10,guides:1,tooltips:1,connect:1,arrows:1,fold:1,page:1,pageScale:1,pageWidth:1920,pageHeight:1080,math:0,shadow:0,background:'#FAFBF9'}))xml.setAttribute(k,v);
  const modelXML=mxUtils.getXml(xml);
  const file=document.implementation.createDocument('','mxfile',null);file.documentElement.setAttribute('host','app.diagrams.net');file.documentElement.setAttribute('type','device');file.documentElement.setAttribute('compressed','false');
  const diagram=file.createElement('diagram');diagram.setAttribute('id','juristic-semester-scope');diagram.setAttribute('name','Block Diagram');diagram.appendChild(file.importNode(xml,true));file.documentElement.appendChild(diagram);
  return {xml:new XMLSerializer().serializeToString(file),modelXML,counts:{rectangles:rects.length,texts:textItems.length,connectors:Object.keys(cells).filter(k=>k.startsWith("connector-")).length},diffs};
 },items);
 await writeFile(dir+'/block-diagram-semester-scope.drawio',result.xml,'utf8');
 await writeFile('/tmp/juristic-drawio-model.xml',result.modelXML,'utf8');
 // Decode the saved file in a fresh draw.io graph to verify the deliverable itself.
 const saved=await readFile(dir+'/block-diagram-semester-scope.drawio','utf8');
 const check=await page.evaluate(xml=>{
  window.diagramGraph.destroy();document.getElementById('graph').innerHTML='';
  const doc=mxUtils.parseXml(xml);const node=doc.getElementsByTagName('mxGraphModel')[0];
  const g=new Graph(document.getElementById('graph'));g.background='#FAFBF9';g.gridEnabled=false;
  new mxCodec(doc).decode(node,g.getModel());g.refresh();
  const cells=Object.values(g.getModel().cells),edges=cells.filter(c=>c.edge),vertices=cells.filter(c=>c.vertex);
  const linked=edges.filter(e=>e.source&&e.target);
  if(linked.length!==8||vertices.length!==54)throw Error('Native draw.io cell count mismatch');
  if(cells.some(c=>(c.style||'').includes('shape=image')))throw Error('Unexpected flattened image');
  return {decoded:true,vertices:vertices.length,connectedEdges:linked.length,editableText:vertices.filter(v=>v.value).length};
 },saved);
 await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:dir+'/block-diagram-drawio-preview.png'});
 console.log(JSON.stringify({roundTrip:check}));
 console.log(JSON.stringify({file:dir+'/block-diagram-semester-scope.drawio',...result.counts,textBoundsMaxError:Math.max(...result.diffs.flatMap(d=>[Math.abs(d.dx),Math.abs(d.dy)])),widthDifferences:result.diffs.filter(d=>Math.abs(d.dw)>2)}));
} finally {await browser.close();}
