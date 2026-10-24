from pathlib import Path
import html,json,math
W,H=1654,1170
TEAL='#276d69';INK='#273438';GREY='#657173';WOOD='#e5e3dc';EDGE='#927347';PALE='#f0f5f3';ORANGE='#aa6328';CREAM='#fcf2e5'
class Overlay:
 def __init__(self,page):self.page=page;self.parts=[];self.masks=[]
 def raw(self,s):self.parts.append(s)
 def rect(self,x,y,w,h,fill='white',stroke='none',sw=1):
  self.raw(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
 def mask(self,x,y,w,h,fill='white'):
  self.masks.append([x,y,w,h]);self.rect(x,y,w,h,fill)
 def line(self,x1,y1,x2,y2,color=EDGE,sw=1.3,dash=None):
  self.raw(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{sw}" '+(f'stroke-dasharray="{dash}"' if dash else '')+'/>')
 def path(self,d,stroke=EDGE,sw=1.3,fill='none',dash=None):
  self.raw(f'<path d="{d}" stroke="{stroke}" stroke-width="{sw}" fill="{fill}" '+(f'stroke-dasharray="{dash}"' if dash else '')+'/>')
 def text(self,x,y,s,size=17,color=GREY,bold=False,anchor='start',rotate=None):
  self.raw(f'<text x="{x}" y="{y}" font-family="Thonburi, sans-serif" font-size="{size}" fill="{color}" font-weight="{700 if bold else 400}" text-anchor="{anchor}" '+(f'transform="rotate({rotate} {x} {y})"' if rotate else '')+f'>{html.escape(s)}</text>')
 def lines(self,x,y,ss,size=17,color=GREY,leading=29,bold=False):
  for j,s in enumerate(ss):self.text(x,y+j*leading,s,size,color,bold)
 def arrow(self,x1,y1,x2,y2,color=TEAL,sw=1.5):
  self.line(x1,y1,x2,y2,color,sw);a=math.atan2(y2-y1,x2-x1);L=8
  self.line(x2,y2,x2-L*math.cos(a-.5),y2-L*math.sin(a-.5),color,sw)
  self.line(x2,y2,x2-L*math.cos(a+.5),y2-L*math.sin(a+.5),color,sw)
 def dimh(self,x1,x2,y,label,size=17):
  self.line(x1,y,x2,y,TEAL);self.line(x1-4,y+7,x1+4,y-7,TEAL);self.line(x2-4,y+7,x2+4,y-7,TEAL);self.text((x1+x2)/2,y-10,label,size,TEAL,anchor='middle')
 def dimv(self,x,y1,y2,label,size=17):
  self.line(x,y1,x,y2,TEAL);self.line(x-7,y1+4,x+7,y1-4,TEAL);self.line(x-7,y2+4,x+7,y2-4,TEAL);self.text(x-12,(y1+y2)/2,label,size,TEAL,anchor='middle',rotate=-90)
 def box(self,x,y,w,title,ss,size=17,leading=29):
  h=58+len(ss)*leading;self.mask(x,y,w,h,PALE);self.text(x+14,y+26,title,19,TEAL,True);self.lines(x+14,y+60,ss,size,leading=leading)
 def note(self,ss,x=70,y=955,w=1515,h=75,size=16):
  self.mask(x,y,w,h,CREAM);self.lines(x+16,y+27,ss,size,ORANGE,27)
 def door(self,x,y,w,h,hinge='left',fill=WOOD):
  self.rect(x,y,w,h,fill,EDGE)
  if hinge=='left': self.path(f'M {x+w-5} {y+5} L {x+5} {y+h/2} L {x+w-5} {y+h-5}',TEAL,1.2,dash='6 4')
  elif hinge=='right': self.path(f'M {x+5} {y+5} L {x+w-5} {y+h/2} L {x+5} {y+h-5}',TEAL,1.2,dash='6 4')
  elif hinge=='down': self.arrow(x+w/2,y+15,x+w/2,y+h-15)
  elif hinge=='up': self.arrow(x+w/2,y+h-15,x+w/2,y+15)
 def save(self):
  path=Path(__file__).parent/'overlays'/f'page-{self.page:02}.svg';path.parent.mkdir(exist_ok=True)
  path.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" width="1654" height="1170" viewBox="0 0 1654 1170">'+''.join(self.parts)+'</svg>')
  path.with_suffix('.json').write_text(json.dumps({'page':self.page,'masks':self.masks},ensure_ascii=False))
  return str(path)
