from svg_overlay import *
from pathlib import Path

# Shared clean architectural details, with dimensions copied only from handwriting.
def circle(o,cx,cy,r,stroke=TEAL,fill='none',sw=1.3):
 o.raw(f'<circle cx="{cx}" cy="{cy}" r="{r}" stroke="{stroke}" stroke-width="{sw}" fill="{fill}"/>')
def section(o,x,y,w,h):
 # One cove, upper drop 0.10 m, ledge 0.10 m, lower lip 0.08 m.
 o.path(f'M {x} {y+h} H {x+85} V {y+80} H {x+45} V {y} H {x+w-45} V {y+80} H {x+w-85} V {y+h} H {x+w}',EDGE,4)
 o.line(x+51,y+72,x+67,y+72,'#dcb452',4);o.line(x+w-67,y+72,x+w-51,y+72,'#dcb452',4)
 o.dimv(x+15,y,y+80,'0.10 m',15);o.dimv(x+105,y+80,y+h,'0.08 m',14)
 o.dimh(x+45,x+85,y+100,'0.10 m',13)
 o.text(x+w/2,y-20,'ฝ้ากลาง',19,TEAL,anchor='middle')
 o.text(x+w/2,y+h+43,'ไฟเส้นซ่อนในขอบหลุม',18,TEAL,anchor='middle')
 o.arrow(x+w-3,y+20,x+w-57,y+72);o.text(x+w+2,y+15,'ไฟซ่อน',15,TEAL)
def chamfer(o,x,y,w,h,fill=WOOD,c=16):
 o.path(f'M{x+c} {y} H{x+w-c} L{x+w} {y+c} V{y+h-c} L{x+w-c} {y+h} H{x+c} L{x} {y+h-c} V{y+c} Z',EDGE,1.5,fill)

# Physical 03 / GF-03: labels at precisely the marked fixed shelves.
o=Overlay(3)
o.text(317,920,'บานเปิด-ปิด 3 บาน',21,TEAL,True,anchor='middle')
for yy in (384,617):
 o.arrow(1090,yy,1008,yy);o.text(1095,yy+5,'ชั้นตาย',17,TEAL)
o.save()

# Physical 04 / GF-04: remove the two under-seat partitions; add marked dimensions/open version.
o=Overlay(4)
for xx in (271,374):o.mask(xx-2,825,4,47,WOOD)
o.mask(1122,343,425,28,PALE);o.text(1122,361,'ใต้ที่นั่งไม่แบ่งช่อง / เปิดล่าง 0.15 m',17,GREY)
o.dimv(145,286,370,'0.35 m',14)
o.dimv(503,818,910,'0.40 m',15)
o.dimv(560,374,910,'1.80 m ตามวงเล็บในลายมือ',15)
o.text(868,221,'เปิดบานตู้ด้านบน',20,TEAL,True)
o.rect(867,250,180,87,WOOD,EDGE)
o.line(957,250,957,337)
o.path('M867 250 L825 265 V351 L867 337 Z',EDGE,1.4,'#f6f1e8')
o.path('M1047 250 L1085 265 V351 L1047 337 Z',EDGE,1.4,'#f6f1e8')
o.line(825,296,829,318,TEAL);o.line(1081,296,1081,318,TEAL)
o.text(957,377,'บานเปิดคู่ / ช่องบนสูง 0.35 m',14,TEAL,anchor='middle')
o.note(['เพิ่มรูปเปิดบานตู้บน และยกเลิกเส้นแบ่งใต้ที่นั่งตามลายมือ',
        'ระยะ 1.80 m คงตำแหน่งวงเล็บตามภาพ / จุดเริ่ม-สิ้นสุดต้องยืนยันก่อนกำหนดขนาดกระจก'],size=16)
o.save()

# Physical 05 / GF-05: dimensions, crown, concealed-handle door and a corrected little plan.
o=Overlay(5)
o.dimv(108,286,798,'สูงรวม 2.54 m',18)
for x1,x2,lab in [(167,375,'1.03 m'),(375,627,'1.25 m'),(627,803,'0.87 m'),(803,1035,'1.15 m')]:o.dimh(x1,x2,278,lab,13)
o.line(167,306,1035,306,EDGE,1)
o.dimv(1056,286,306,'0.10',12);o.text(1075,302,'คอตู้ 0.10 m',14,TEAL)
o.dimh(167,195,846,'0.14 m',13);o.text(224,850,'รวมอยู่ในช่วง BF-02/2 = 1.03 m',14,TEAL)
o.mask(657,402,129,25,'#eee2c8');o.lines(647,595,['บานเปิด','มือจับซ่อนในบาน'],17,TEAL,28,True)
for xx in (460,544):o.mask(xx-2,728,4,38,WOOD)
# Plane behind the doors shows the sliding route; hinged BF02/1 swings to the hall.
o.text(1110,733,'ผังย่อ / รางสไลด์ซ่อนหลัง BF-02',18,INK,True)
xs=[1110,1180,1280,1350,1450]
for i,lab in enumerate(['BF-02/2','BF-02','BF-02/1','BF-01']):
 o.rect(xs[i],770,xs[i+1]-xs[i],38,'#e0edeb',TEAL)
 o.text((xs[i]+xs[i+1])/2,794,lab,12,TEAL,anchor='middle')
o.line(1110,760,1280,760,TEAL,1,'5 3');o.line(1110,754,1280,754,TEAL,1,'5 3')
o.arrow(1125,842,1260,842)
o.path('M1280 808 A70 70 0 0 0 1350 878',TEAL,1);o.line(1350,808,1350,878,TEAL)
o.text(1165,870,'เลื่อนขวาเก็บหลังที่นั่ง',13,TEAL)
o.note(['BF-02/2: 0.14 + 0.89 = 1.03 m / รวมทั้งแนว 4.30 m / คอตู้ 0.10 m',
        'BF-02/1 เป็นบานเปิดมือจับซ่อน / ราง BF-02/2 อยู่หลัง BF-02 และซ่อนบนฝ้า'],size=16)
o.save()

# Physical 06 / GF-07: retain low drawer details, add the full-height upper cabinet requested.
o=Overlay(6)
o.mask(55,175,1545,855)
o.text(420,217,'รายละเอียดลิ้นชักฐานวางศาลเจ้าที่',24,INK,True,anchor='middle')
o.dimh(130,810,277,'กว้าง 1.06 m',20)
o.rect(130,318,680,137,'#d7c7a5',EDGE)
o.rect(135,336,670,100,'#e6dabc',EDGE)
o.text(470,392,'ลิ้นชักไม้ 1 ใบ / มือจับซ่อนในขอบบาน',21,TEAL,True,anchor='middle')
o.dimv(94,318,455,'รวม 0.21 m',17)
for yy1,yy2,lab in [(318,336,'0.03 m'),(336,436,'0.15 m'),(436,455,'0.03 m')]:
 o.line(815,yy1,865,yy1,GREY,1);o.line(815,yy2,865,yy2,GREY,1)
 o.text(884,(yy1+yy2)/2+6,lab,15,TEAL)
o.text(470,490,'หน้าเดียวตลอดแนว / วางชิดพื้น ±0.00',18,TEAL,anchor='middle')
o.text(130,572,'ผังมองจากด้านบน',21,INK,True)
o.rect(130,605,680,126,'#eee3cb',EDGE)
o.text(470,675,'BF-03 / ท็อปไม้',24,TEAL,anchor='middle')
o.dimv(852,605,731,'ลึก 0.20 m',17)
o.text(130,762,'เปิดลิ้นชักออกจากผนัง / คงตำแหน่งใกล้ BF-02/2',16,GREY)
o.box(110,809,790,'รายละเอียดที่คงไว้',['แถบบน 0.03 + หน้าลิ้นชัก 0.15 + แถบล่าง 0.03 = 0.21 m',
'ขนาดโครง รางรับน้ำหนัก และความหนาวัสดุ ต้องสรุปก่อนผลิต'],16,27)
o.text(1250,217,'รูปด้านเพิ่มตามลายมือ',23,INK,True,anchor='middle')
x,y,w,h=1084,270,330,640
o.rect(x,y,w,h,'#f5f1e9',EDGE,1.6)
o.door(x+1,y+1,w/2-1,122,'left');o.door(x+w/2,y+1,w/2-1,122,'right')
o.text(x+w/4,y+68,'ตู้บานเปิด',15,TEAL,anchor='middle');o.text(x+w*.75,y+68,'ตู้บานเปิด',15,TEAL,anchor='middle')
o.text(x+w/2,y+333,'ช่องกลาง',19,TEAL,anchor='middle')
bottom=y+h; bh=53
o.rect(x,bottom-bh,w,8,'#d7c7a5',EDGE)
o.rect(x,bottom-bh+8,w,37,'#e6dabc',EDGE)
o.rect(x,bottom-8,w,8,'#d7c7a5',EDGE)
o.text(x+w/2,bottom-27,'ลิ้นชักฐานวางศาลเจ้าที่',14,TEAL,anchor='middle')
o.dimv(1460,y,bottom,'สูงรวม 2.54 m',20)
o.text(x+w/2,946,'สัดส่วนช่องบนตามภาพร่าง / ขนาดช่องรอสรุป',14,GREY,anchor='middle')
o.mask(55,1040,1350,28);o.text(55,1059,'BF-03: เพิ่มตู้บนบานเปิดคู่และช่องกลาง / ลิ้นชักฐาน 0.21 m / ความสูงรวม 2.54 m ตามลายมือ',15,GREY)
o.save()

# Physical 07 / GF-08: main elevation and extra open-door and drawer-side diagrams.
o=Overlay(7)
# Framed left cabinet shown as a display cabinet as in the inserted reference.
o.mask(123,305,181,485,'#eee2c8')
chamfer(o,134,315,158,462,'#eee2c8',14)
for yy in (431,550,670):o.rect(141,yy,144,5,'#e3d4b4',EDGE)
o.text(213,744,'ตู้โชว์',17,TEAL,anchor='middle')
# Chamfered TV back panel.
o.mask(320,339,502,431,'#eee7d5')
chamfer(o,320,339,502,431,'#eee7d5',23)
o.rect(354,425,434,244,'#242d30','#11191b',1.5);o.text(571,555,'TV',31,'#aeb5b2',True,anchor='middle')
o.dimh(123,303,291,'0.80 m',14);o.dimh(838,1019,291,'0.80 m',14)
o.mask(878,441,104,33,'#eee2c8');o.lines(928,452,['เซาะร่อง','กดกระเด้ง'],15,TEAL,24,False)
# Drawer dimensions are shown above their respective face, avoiding the drawer numbers.
for x1,x2,lab in [(147,251,'0.47'),(255,356,'0.47'),(362,568,'0.94'),(576,781,'0.94'),(786,887,'0.47'),(893,995,'0.47')]:
 o.dimh(x1+4,x2-4,811,lab,11)
o.dimv(108,790,857,'0.30 m',12);o.dimv(108,857,880,'0.10 m',11)
# Separate open cabinet elevation.
o.mask(1090,205,500,701)
o.text(1110,232,'รูปเพิ่ม: เปิดบานตู้ / ชั้นวางฝั่งละ 3 ชั้น',19,INK,True)
# Compact composition gives a clear open-door view for both cabinets.
for xx,hinge in [(1124,'left'),(1474,'right')]:
 o.rect(xx,269,73,230,'#f6f1e8',EDGE)
 for yy in (325,381,437):o.rect(xx+3,yy,67,4,'#dfceb0',EDGE)
 if hinge=='left':o.path(f'M{xx} 269 L{xx-24} 284 V514 L{xx} 499 Z',EDGE,1.2,'#eee2c8')
 else:o.path(f'M{xx+73} 269 L{xx+98} 284 V514 L{xx+73} 499 Z',EDGE,1.2,'#eee2c8')
o.rect(1210,269,250,230,'#f2eddf',EDGE)
o.rect(1237,321,198,113,'#242d30','#11191b');o.text(1336,385,'TV',22,'#aeb5b2',True,anchor='middle')
o.text(1159,543,'3 ชั้น',15,TEAL,anchor='middle');o.text(1510,543,'3 ชั้น',15,TEAL,anchor='middle')
o.lines(1110,584,['ตู้ข้างกว้างข้างละ 0.80 m / ลึก 0.40 m',
'บานขวาหน้าไม้เซาะร่อง / เปิดด้วยกดกระเด้ง',
'ลิ้นชัก 6 ใบ มือจับในตัว / ลึก 0.40 m'],16,GREY,27)
# Top plan and side section requested.
o.text(1100,703,'ผังด้านบน / ปลายตู้หักมุม',18,INK,True)
chamfer(o,1105,723,440,55,'#eee2c8',13);o.text(1325,758,'ลึก 0.40 m',17,TEAL,anchor='middle')
o.text(1100,814,'รูปด้านข้างลิ้นชัก / มือจับในตัว',18,INK,True)
o.rect(1270,838,215,79,'#eee7d5',EDGE)
o.path('M1270 838 V917 L1240 933 V854 Z',EDGE,1.5,'#e5d6b8')
o.line(1270,847,1485,847,EDGE,3);o.arrow(1515,830,1474,847)
o.text(1520,833,'ร่องจับ',14,TEAL)
o.dimh(1270,1485,942,'ลึก 0.40 m',14)
o.note(['แนวชุด 3.96 m / หน้าลิ้นชัก 0.47 + 0.47 + 0.94 + 0.94 + 0.47 + 0.47 = 3.76 m และปลาย 2 × 0.10 m',
'เพิ่มรูปเปิดตู้ข้างฝั่งละ 3 ชั้น และรูปด้านข้างลิ้นชัก / มือจับในตัว / ฐาน 0.10 m'],size=15)
o.save()

# Physical 08 / GF-09: plan furnishings, all four border dimensions, and exact cove details.
o=Overlay(8)
o.mask(290,532,334,41)
o.path('M247 393 H622 V474 H337 V689 H247 Z',TEAL,1.5,'#f5f3ec')
circle(o,476,543,39,TEAL,'#f5f3ec')
o.rect(347,697,245,14,'#e1ebe7',TEAL)
o.text(486,648,'หลุมเดียว / ไฟซ่อนรอบขอบ',17,TEAL,anchor='middle')
o.dimv(171,286,364,'0.40 m',14);o.dimh(133,211,543,'0.40 m',14)
o.dimh(664,743,543,'0.40 m',14);o.dimv(710,729,807,'0.40 m',14)
o.mask(825,296,758,272)
section(o,875,359,620,128)
o.box(864,585,699,'ขนาดตามลายมือ',['ขอบฝ้าในแปลนทั้ง 4 ด้าน 0.40 m',
'รูปตัด: สูงช่วงบน 0.10 m / ยื่นขอบ 0.10 m / ขอบบังไฟ 0.08 m',
'ไฟเส้นซ่อนในขอบหลุม / วาดผังเฟอร์นิเจอร์ประกอบแล้ว'],16,30)
o.note(['ขอบฝ้าในหน้านี้ 0.40 m / GF-01 ระบุ 0.50 m: คงตามลายมือแต่ละหน้า รอยืนยันก่อนผลิต',
'BF-04/1, BF-05/1 และ BF-17/1 ใช้หลุมชั้นเดียวตามภาพแก้ / ระดับฝ้าจริงและช่องซ่อมรอสรุป'],size=15)
o.save()

# Physical 09 / GF-11: integrated push latch, crown/base and adjustable shelves.
o=Overlay(9)
o.text(424,276,'บานเปิด-ปิดแบบกดกระเด้ง',21,TEAL,True,anchor='middle')
o.text(424,317,'คิ้วบน 0.10 m',15,TEAL,anchor='middle')
o.text(424,870,'ฐาน 0.10 m',15,TEAL,anchor='middle')
for yy in (416,510,762):
 o.arrow(1510,yy-7,1368,yy);o.text(1535,yy-16,'ชั้นปรับระดับได้',15,TEAL,anchor='middle')
o.note(['BF-05: บานเปิด-ปิดแบบกดกระเด้ง / ชั้นภายในปรับระดับได้ / กว้าง 2.61 m ลึก 0.40 m',
'คิ้วบน 0.10 + ตู้บน 1.24 + ช่องโปร่ง 0.30 + ตู้ล่าง 0.80 + ฐาน 0.10 = สูงรวม 2.54 m'],size=16)
o.save()

# Physical 10 / GF-12: requested replacement of the dining cove with a single level.
o=Overlay(10)
o.mask(54,72,1248,82)
o.text(54,110,'BF-05/1 - ฝ้าหลุมชั้นเดียว - ส่วนรับประทานอาหาร',38,INK,True)
o.text(55,140,'ปรับเป็นหลุมชั้นเดียวตามภาพอ้างอิง / ไฟเส้นซ่อนในขอบหลุม',18,GREY)
o.mask(142,276,661,547,'#f0eee5')
o.rect(142,276,661,547,'#eee9df',EDGE,1.5)
o.rect(241,375,463,349,'#fffefa',EDGE,1.3)
o.rect(248,382,449,335,'none','#dcb452',2)
o.dimh(142,241,550,'0.40 m',15);o.dimh(704,803,550,'0.40 m',15)
o.dimv(478,276,375,'0.40 m',15);o.dimv(478,724,823,'0.40 m',15)
# Keep an eight-place dining table centered within the single cove.
o.rect(397,446,154,213,'none',GREY,1)
for yy in (453,505,558,610):
 o.rect(360,yy,25,34,'none',GREY,1);o.rect(563,yy,25,34,'none',GREY,1)
o.text(475,409,'หลุมเดียว / ไฟเส้นรอบขอบ',17,TEAL,anchor='middle')
o.mask(916,190,647,667)
o.text(926,220,'รูปตัด A-A / หลุมชั้นเดียว',25,INK,True)
section(o,914,348,620,128)
o.lines(930,622,['ขอบฝ้าในผังทั้ง 4 ด้าน 0.40 m',
'รูปตัดตาม GF-09: ช่วงบน 0.10 m',
'ยื่นขอบ 0.10 m / ขอบบังไฟ 0.08 m',
'ไฟซ่อนรอบขอบหลุมชั้นเดียว',
'ความสูงห้องอ้างอิง 2.54 m / ระดับฝ้าจริงรอวัด'],18,GREY,37)
o.note(['BF-05/1 เปลี่ยนจากหลุมสองระดับเป็นหลุมชั้นเดียว ตามภาพที่เขียนแก้และอ้างอิง GF-09',
'ผังหลุมตรงกลางโต๊ะ / คง 8 ที่นั่ง / ขนาดโครง ระดับฝ้า และช่องซ่อมบำรุงต้องประสานหน้างาน'],x=126,y=930,w=1391,h=111,size=16)
o.save()

# Physical 11 / GF-13: correct 2.59 and add upper corner plus new interior and corner details.
o=Overlay(11)
o.mask(398,184,179,28);o.text(449,210,'ตู้บน 2.59 m',18,TEAL,anchor='middle')
o.mask(55,121,923,30);o.text(55,144,'ตู้บน 2.59 × สูง 0.92 / ช่องผนัง 0.80 / เคาน์เตอร์สูง 0.855 m',18,GREY)
o.rect(758,253,22,224,'#cebb94',EDGE)
o.dimh(758,780,495,'0.10 m',13)
o.dimh(754,780,906,'0.10 m',13)
o.mask(975,198,620,744)
o.text(997,224,'ภายในตู้แขวน / เปิดบานให้เห็นชั้น',21,INK,True)
# Five bays with the shelf in the last bay continued through the fixed corner.
ix,iy,bw,ih=1005,260,102,125
for j in range(5):
 o.rect(ix+j*bw,iy,bw,ih,'#f8f4ed' if j!=2 else '#e4efeb',EDGE)
 o.line(ix+j*bw+3,iy+63,ix+(j+1)*bw-3,iy+63,EDGE,3)
 o.text(ix+j*bw+bw/2,iy-12,f'บาน {j+1}' if j!=2 else 'ช่อง 3 โปร่ง',13,TEAL,anchor='middle')
o.rect(ix+5*bw,iy,30,ih,'#ceb991',EDGE)
o.line(ix+4*bw+3,iy+63,ix+5*bw+27,iy+63,EDGE,3)
o.lines(997,416,['ชั้นบาน 5 ต่อถึงส่วนหักมุม / หยิบผ่านบาน 5',
'ตู้บนลึก 0.40 m / แผงมุมปิดตาย / มือจับในตัว'],15,GREY,25)
o.text(997,489,'ภายในตู้ล่าง / ลิ้นชักและชั้นวาง',21,INK,True)
iy=519;ih=124
for j in range(5):
 xx=ix+j*bw;o.rect(xx,iy,bw,ih,'#f8f4ed',EDGE)
 if j in (0,2):
  for k in range(3):o.rect(xx+7,iy+7+k*39,bw-14,30,'#eaddc4',EDGE)
 else:o.line(xx+3,iy+62,xx+bw-3,iy+62,EDGE,3)
 o.text(xx+bw/2,iy-10,('ลิ้นชัก 3 ชั้น' if j in (0,2) else f'บาน {j+1}'),12,TEAL,anchor='middle')
o.rect(ix+5*bw,iy,30,ih,'#ceb991',EDGE)
o.line(ix+4*bw+3,iy+62,ix+5*bw+27,iy+62,EDGE,3)
o.lines(997,671,['ช่อง 1 และ 3: ลิ้นชักช่องละ 3 ใบ / ช่อง 2, 4, 5: ช่องละ 2 ชั้น',
'ตู้ล่างลึก 0.60 m / ลิ้นชักและบานตู้มือจับในตัว'],14,GREY,25)
o.text(997,747,'ผังปลายตู้หักมุม / มุม 0.10 × 0.10 m',19,INK,True)
o.path('M1010 778 H1220 V877 H1030 L1010 857 Z',EDGE,1.5,'#eee2c8')
o.line(1220,773,1220,880,INK,4)
o.dimv(980,857,877,'0.10 m',12);o.dimh(1010,1030,910,'0.10 m',12)
o.text(1070,835,'ด้านชิดผนังคงเดิม',14,TEAL)
o.lines(1262,789,['ตรวจจุดวัดก่อนผลิต',
'2.59 + มุม 0.10 = 2.69 m',
'แนวตั้ง 0.92 + 0.80 + 0.855',
'= 2.575 m / ห้องเดิม 2.54 m',
'ส่วนต่าง 0.035 m รอประสาน'],14,GREY,26)
o.note(['ตู้บนแก้เป็น 2.59 m และเพิ่มปลายมุม 0.10 m / ตู้บน 4 บานและช่องโปร่งกลาง / ตู้ล่าง 6 ลิ้นชักกับ 3 บาน',
'มือจับบานและลิ้นชักในตัว / คงตัวเลขความสูงเดิม 0.855 m โดยไม่บีบช่องเพื่อให้ผลรวมลงตัว'],size=15)
o.save()

# Physical 12 / GF-14 has no fresh handwriting.
o=Overlay(12);o.save()
