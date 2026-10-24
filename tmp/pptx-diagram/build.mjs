import fs from 'node:fs/promises';
import path from 'node:path';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const base = '/Users/initia-army/Documents/juristic-platform';
const tmp = path.join(base, 'tmp/pptx-diagram');
const source = JSON.parse(await fs.readFile(path.join(tmp,'source.json'),'utf8'));
const p = Presentation.create({slideSize:{width:1920,height:1080}});
const slide = p.slides.add();
slide.background.fill = '#FAFBF9';
const byId = new Map(source.map(x => [x.id,x]));
const native = new Map();
const arrowPositions = [
  [622,386,622,420], [777,598,810,598], [966,649,966,683],
  [811,734,778,734], [622,826,622,877], [1148,470,1287,470],
  [1544,526,1544,573], [1544,686,1544,733],
];
function lineStyle(c){
  return {style:c.style.dashed==='1'?'dashed':'solid',fill:c.style.strokeColor||'none',width:Number(c.style.strokeWidth||0)};
}
for(const c of source.filter(x=>!x.edge)){
  const s=c.style;
  if(s.shape==='text'){
    const font=Number(s.fontSize);
    const sh = slide.shapes.add({
      geometry:'textbox',name:c.id+' '+c.value,
      position:{left:c.x,top:c.y,width:c.width+16,height:Math.max(c.height,font*1.5)},
      fill:'none',line:{fill:'none',width:0,style:'solid'},
    });
    sh.text=c.value;
    sh.text.style={typeface:s.fontFamily,fontSize:font,bold:s.fontStyle==='1',
      color:s.fontColor,alignment:'left',verticalAlignment:'top',insets:0,
      autoFit:'none',wrap:'none'};
    native.set(c.id,sh);
  }else{
    const sh=slide.shapes.add({
      geometry:s.rounded==='1'?'roundRect':'rect',name:c.id,
      position:{left:c.x,top:c.y,width:c.width,height:c.height},
      fill:s.fillColor||'none',line:lineStyle(c),
      ...(s.rounded==='1'?{borderRadius:Number(s.arcSize)/2}:{}),
    });
    native.set(c.id,sh);
  }
}
for(const c of source.filter(x=>x.edge)){
  let x1,y1,x2,y2;
  if(c.id.startsWith('connector-')){
    [x1,y1,x2,y2]=arrowPositions[Number(c.id.split('-')[1])];
  }else{
    ({x:x1,y:y1}=c.points.sourcePoint);
    ({x:x2,y:y2}=c.points.targetPoint);
  }
  const conn=slide.shapes.add({geometry:'connector',kind:'straight',
    position:{left:Math.min(x1,x2),top:Math.min(y1,y2),width:Math.abs(x2-x1),height:Math.abs(y2-y1),horizontalFlip:x1>x2,verticalFlip:y1>y2},
    line:lineStyle(c),
    head:{type:c.style.startArrow==='open'?'arrow':'none',width:'lg',length:'lg'},
    tail:{type:c.style.endArrow==='open'?'arrow':'none',width:'lg',length:'lg'},
  });
  native.set(c.id,conn);
  conn.bringToFront();
}
await fs.writeFile(path.join(tmp,'slide.layout.json'),await (await slide.export({format:'layout'})).text());
const pptx=await PresentationFile.exportPptx(p);
await pptx.save(path.join(tmp,'candidate.pptx'));
console.log('Exported editable candidate',p.slides.items.length,'slide,',native.size,'native objects');
await fs.writeFile(path.join(tmp,'slide.png'),new Uint8Array(await (await p.export({slide,format:'png',scale:1})).arrayBuffer()));
console.log('Rendered',path.join(tmp,'slide.png'));
