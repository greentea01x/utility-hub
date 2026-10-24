from svg_overlay import Overlay,TEAL,INK,GREY,EDGE,PALE,CREAM,ORANGE

TAN='#eee3ca'
SOFT='#f4f1e9'

def text_replace(o,x,y,w,h,ss,size=17,fill='white',color=GREY,leading=27):
    o.mask(x,y,w,h,fill)
    o.lines(x+8,y+22,ss,size,color,leading)

# Physical 25 / GF-28: full solid bed base, clarified labels and measured height.
o=Overlay(25)
for y,s in [(285,'หัวเตียง'),(379,'ฟูก'),(456,'ฐาน')]:o.text(1142,y,s,23,TEAL,True,anchor='middle')
o.dimv(1515,404,502,'0.30 m',17)
o.line(1467,227,1467,502,TEAL)
o.line(1459,227,1475,227,TEAL);o.line(1459,502,1475,502,TEAL)
o.mask(828,690,701,125)
o.rect(836,690,611,117,TAN,EDGE)
o.text(1142,755,'ฐานวางเต็มพื้นที่ทึบ',21,TEAL,True,anchor='middle')
o.dimv(1500,690,807,'0.30 m',17)
o.rect(792,557,44,250,TAN,EDGE)
o.dimv(765,557,807,'1.20 m',17)
o.dimh(792,836,541,'หนา 2 นิ้ว',16)
o.note(['BF-17: ฟูก 1.80 × 1.95 m / ฐานสูง 0.30 m / หัวเตียงสูง 1.20 m และหนา 2 นิ้ว',
        'ฐานเต็มตรงถึงพื้น ไม่มีลิ้นชัก / ระยะโครง จุดยึด การระบายอากาศ และความหนาฟูกรอสรุป'])
o.save()

# Physical 26 / GF-29: cove section dimensions and lights.
o=Overlay(26)
text_replace(o,52,119,1260,32,['ห้องนอนใหญ่ / ฝ้าหลุมชั้นเดียว / ไฟเส้นซ่อนในขอบหลุม / แสดงรูปตัดใหม่'],16)
o.dimv(906,359,438,'0.10 m',15)
o.dimh(930,974,457,'0.10 m',14)
o.dimv(1004,439,487,'8 cm',15)
for x in [944,1423]:
    o.rect(x-5,407,10,24,'#f7e4a5',EDGE)
    o.line(x-8,432,x+8,432,'#d5ad41',2)
o.text(1027,365,'ไฟ',18,TEAL,True);o.arrow(1022,371,954,409)
o.box(864,585,699,'ขนาดตามรอยแก้ไข',['ห้องนอนใหญ่ BF-17/1: หลุมชั้นเดียว',
    'ช่วงบนสูง 0.10 m / ช่วงล่างสูง 8 cm',
    'ขอบยื่น 0.10 m / ไฟซ่อนในขอบหลุม',
    'หลุมเสนอ 3.68 × 3.48 m* / ห้องสูง 2.63 m',
    '*ยืนยันจุดวัดขอบในหรือขอบนอกก่อนผลิต'],17,29)
o.save()

# Physical 27 / GF-30: shelf gaps, drawer labels, added open-door comparison.
o=Overlay(27)
o.dimv(176,484,558,'30 cm',16);o.dimv(176,561,620,'25 cm',16)
for x in [254,359,464]:o.text(x,735,'ลิ้นชัก',16,TEAL,anchor='middle')
o.text(800,724,'ตู้แขวนด้านบน / เมื่อเปิดบาน',21,INK,True)
o.rect(851,755,516,146,SOFT,EDGE)
o.line(1023,755,1023,901,EDGE);o.line(1195,755,1195,901,EDGE)
o.path('M 851 755 L 811 778 L 811 922 L 851 901 Z',EDGE,1.3,TAN)
o.path('M 1023 755 L 983 778 L 983 922 L 1023 901 Z',EDGE,1.3,TAN)
o.path('M 1367 755 L 1407 778 L 1407 922 L 1367 901 Z',EDGE,1.3,TAN)
o.text(1110,832,'ภายในตู้แขวน',17,TEAL,anchor='middle')
o.text(1450,810,'เปิดบาน',15,TEAL,anchor='middle');o.text(1450,835,'ซ้าย / ซ้าย / ขวา',14,TEAL,anchor='middle')
o.save()

# Physical 28 / GF-31: labeled door operation and dimensions at their drawn locations.
o=Overlay(28)
o.dimv(58,286,881,'2.63 m',17)
o.text(118,344,'บานสไลด์',14,TEAL,anchor='middle')
o.text(553,397,'บานเปิดปิด',19,TEAL,anchor='middle');o.text(553,426,'ซ้อนทับ',19,TEAL,anchor='middle');o.arrow(541,440,482,493)
o.dimv(1015,286,308,'0.10',13)
o.dimv(1039,308,404,'0.53 m',15)
o.dimv(661,405,882,'2.00 m',17)
o.dimv(1015,858,882,'0.10',13)
o.dimh(891,987,704,'0.43 m',17)
for y in [794,838]:o.text(790,y,'ลิ้นชัก',17,TEAL,anchor='middle')
o.dimv(680,771,813,'0.20',13);o.dimv(680,815,858,'0.20',13)
o.text(1024,449,'ชั้นล็อคตาย',17,TEAL);o.arrow(1020,434,989,406)
o.save()

# Physical 29 / GF-32: shelf size, outlet, tabletop and drawer dimensions.
o=Overlay(29)
o.dimh(207,276,260,'0.30 m',16)
o.text(241,329,'ลึก 0.20 m',15,TEAL,anchor='middle')
o.rect(214,685,15,15,'white',TEAL);o.line(219,689,219,694,TEAL);o.line(224,689,224,694,TEAL)
o.text(248,638,'ปลั๊กไฟ',16,TEAL,anchor='middle');o.arrow(244,644,224,681)
o.line(197,705,207,705,TEAL);o.line(197,711,207,711,TEAL)
o.text(142,699,'0.03 m',14,TEAL);o.arrow(186,698,202,707)
o.dimv(192,711,741,'0.15 m',14)
o.dimv(748,793,833,'0.20 m',15)
o.save()

# Physical 30 / GF-33: remove marked B portions, add slide rail note and dimension labels.
o=Overlay(30)
text_replace(o,53,119,1100,32,['ตัดส่วนซ้าย B1 ตามรอยแก้ทั้งหน้าบานและภายใน / A3 ใช้บานสไลด์'],16)
o.dimv(96,296,580,'2.64 m',17)
o.rect(128,296,561,23,TAN,EDGE);o.rect(128,558,561,22,TAN,EDGE)
o.text(160,313,'0.10 m',13,TEAL);o.text(160,574,'0.10 m',13,TEAL)
for x,s in [(221,'A1'),(408,'A2'),(595,'A3')]:o.text(x,351,s,23,TEAL,True,anchor='middle')
o.mask(622,296,129,284)
o.rect(622,296,129,284,'#e1ece9',TEAL)
o.arrow(728,411,637,411)
o.text(686,463,'บานสไลด์',17,TEAL,True,anchor='middle')
o.text(435,617,'รางบานสไลด์อยู่บนฝ้าหลังตู้ A3',17,TEAL,anchor='middle')
o.mask(805,294,96,289)
o.mask(805,672,95,290)
o.line(900,296,900,580,EDGE);o.line(900,674,900,960,EDGE)
o.rect(901,296,467,23,TAN,EDGE);o.rect(901,558,467,22,TAN,EDGE)
o.rect(900,674,468,13,TAN,EDGE);o.rect(900,943,468,17,TAN,EDGE)
o.text(1380,689,'0.10 m',13,TEAL);o.text(1380,955,'0.10 m',13,TEAL)
o.text(852,480,'ตัดออก',15,TEAL,anchor='middle');o.text(852,865,'ตัดออก',15,TEAL,anchor='middle')
o.mask(797,204,579,42)
o.dimh(902,1368,236,'B / ความกว้างหลังตัดรอยืนยัน',17)
text_replace(o,1411,283,184,285,['สูง A 2.64 m','B สูงรอยืนยัน','ตัดส่วนซ้าย B1','ทั้งหน้าและภายใน','ช่องหน้าต่าง','0.59 m คงเดิม','รางซ่อนบนฝ้า'],16,leading=35,color=ORANGE)
o.mask(66,966,1290,40)
o.text(70,990,'BF-22: ตัดส่วนซ้าย B1 ตามรอยแก้ / A3 บานสไลด์ / ช่องหลังตู้ 0.10 m คงเดิม',17,TEAL)
# Reconstruct the supplied small L plan as editable linework.
o.text(1433,645,'ผังตู้รูปตัว L',19,TEAL,True)
for i,s in enumerate(['A1','A2','A3']):
    o.rect(1428+i*48,688,48,42,'#e1ece9',TEAL);o.text(1452+i*48,715,s,15,TEAL,anchor='middle')
for i,s in enumerate(['B1','B2','B3']):
    o.rect(1524,798+i*41,48,41,'#e1ece9',TEAL);o.text(1548,824+i*41,s,15,TEAL,anchor='middle')
o.text(1430,757,'ช่องหน้าต่าง',14,ORANGE);o.text(1430,780,'0.59 m ไม่มีตู้',14,ORANGE)
o.line(1578,686,1578,730,TEAL,dash='4 3');o.text(1430,671,'เผื่อหลัง A3 0.10 m',14,TEAL)
o.save()

# Physical 31 / GF-34: push opening and individual dimensions; retain conflict flag.
o=Overlay(31)
for xa in [128,807]:
    o.arrow(xa+155,438,xa+35,438)
    o.arrow(xa+213,438,xa+344,438)
    o.arrow(xa+400,438,xa+531,438)
o.text(752,190,'หน้าบานกดเปิด–ปิด',20,TEAL,True,anchor='middle')
o.rect(128,275,560,21,TAN,EDGE);o.rect(128,580,560,26,TAN,EDGE)
o.dimv(85,275,606,'2.44 m',17)
o.text(142,290,'คิ้วบน 0.20 m',13,TEAL);o.text(142,599,'ฐาน 0.10 m',13,TEAL)
for x,w in [(128,560),(807,562)]:
    o.rect(x,649,w,25,TAN,EDGE)
    o.text(x+w-12,667,'คิ้วบน 0.20 m',13,TEAL,anchor='end')
o.dimv(104,674,716,'0.44 m',14)
o.dimv(86,720,984,'2.00 m',17)
o.rect(128,959,560,25,TAN,EDGE);o.text(148,977,'ฐาน 0.10 m',13,TEAL)
o.text(817,702,'0.44 m',14,TEAL)
o.text(1240,982,'ฐาน 0.10 m',14,TEAL)
text_replace(o,1414,284,174,310,['มิติตามรอยแก้','สูงรวม 2.44 m','คิ้วบน 0.20','ช่องบน 0.44','แขวน 2.00','ฐาน 0.10','ผลรวมยังขัดกัน','ยืนยันก่อนผลิต'],16,leading=34,color=ORANGE)
o.mask(64,991,1370,28)
o.text(69,1012,'BF-25: บานกดเปิด–ปิด / B ลิ้นชัก 3 × 3 / A เพิ่มแผงตั้งแนว 2/3 / มิติแนวตั้งยังขัดกัน ต้องยืนยัน',16,TEAL)
o.save()

# Physical 32 / GF-35: 0.10 m top strip on sliding headboard wall.
o=Overlay(32)
o.line(138,318,871,318,EDGE)
o.dimv(122,296,318,'0.10 m',13)
o.text(455,313,'คิ้วบน 0.10 m',14,TEAL,anchor='middle')
o.save()

# Physical 33 / GF-36: identify mattress/base and commit 0.36 m base height.
o=Overlay(33)
o.text(1141,380,'ฟูก',23,TEAL,True,anchor='middle')
o.text(1141,463,'ฐานไม้',23,TEAL,True,anchor='middle')
o.dimv(1500,404,502,'0.36 m',17)
o.mask(1448,718,120,48)
o.dimv(1500,690,807,'0.36 m',17)
o.note(['BF-27/1: ฐานไม้สูง 0.36 m / เตียง 6 ฟุต / ขนาดฐานเสนอ 1.91 × 2.10 m ต้องเทียบฟูกจริง',
        'แสดงโครงเป็นแนวคิด / ระยะโครง ความหนาแผ่น จุดยึด การระบายอากาศ และความหนาฟูกยังรอสรุป'])
o.save()

# Physical 34 / GF-37: overall height now specified with 0.10 + 2.44 + 0.10.
o=Overlay(34)
o.mask(39,318,44,590)
o.dimv(84,326,898,'2.64 m',17)
o.line(111,349,954,349,EDGE);o.line(111,877,954,877,EDGE)
o.text(129,344,'คิ้วบน 0.10 m',14,TEAL)
o.text(129,894,'ฐาน 0.10 m',13,TEAL)
o.note(['BF-28 + BF-29: สูงรวม 2.64 m = คิ้วบน 0.10 m + ช่วงใช้สอย 2.44 m + ฐาน 0.10 m',
        'BF-28 หน้าบานไม้ทึบ 6 บาน / BF-29 ตู้กระจก 6 ระดับ / ความกว้างรวม 3.90 m คงเดิม'])
o.save()

# Physical 35 / GF-38: top strip, window and side widths explicitly called out.
o=Overlay(35)
o.line(138,320,940,320,EDGE)
o.dimv(123,296,320,'0.10 m',13)
o.dimh(139,337,280,'0.845 m',17)
o.dimh(338,738,468,'1.695 m',18)
o.text(538,548,'หน้าต่าง',22,TEAL,True,anchor='middle')
o.dimv(126,637,919,'1.20 m',17)
text_replace(o,1081,239,489,201,['ระดับตามรอยแก้ไข','สูงรวม 2.64 m / แผงล่าง 1.20 m','คิ้วบน 0.10 m','ช่องหน้าต่าง 1.695 m คงเดิม','ช่วงซ้ายระบุ 0.845 m / ขวา 0.845 m','ความกว้างรวมเดิม 3.395 m รอประสาน'],17,fill=PALE,leading=29)
o.save()

# Physical 36 / GF-39: 5-foot bed base at marked 0.36 m.
o=Overlay(36)
o.dimv(1500,404,502,'0.36 m',17)
o.mask(1448,718,120,48)
o.dimv(1500,690,807,'0.36 m',17)
o.note(['BF-31/1: เตียง 5 ฟุต / ฐานเต็มตรงถึงพื้น สูง 0.36 m / ขนาดฐานเสนอ 1.60 × 2.10 m ต้องเทียบฟูกจริง',
        'แสดงโครงเป็นแนวคิด / ระยะโครง ความหนาแผ่น จุดยึด การระบายอากาศ และความหนาฟูกยังรอสรุป'])
o.save()
