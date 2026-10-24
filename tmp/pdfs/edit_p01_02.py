from svg_overlay import *
o=Overlay(1)
# Exact handwritten dining cove 0.40 on four sides; replace earlier printed .50.
o.mask(117,632,16,105,'#f8f9f5');o.text(128,689,'ขอบฝ้า 0.40 m',12,TEAL,anchor='middle',rotate=-90)
o.dimh(137,170,682,'0.40',11)
o.dimv(245,633,657,'0.40',11)
o.dimh(302,329,716,'0.40',11)
o.dimv(178,792,814,'0.40',11)
# Living cove: handwritten .50 at four positions.
o.dimv(509,638,662,'0.50',11)
o.dimh(369,402,733,'0.50',11)
o.dimh(578,608,798,'0.50',11)
o.dimv(484,849,879,'0.50',11)
o.mask(480,869,87,12,'#f8f9f5');o.text(480,879,'ขอบฝ้า 0.50 m',11,TEAL)
# BF13/1 partition length.
o.dimv(342,551,638,'1.27 m',12)
# Updated sheet-specific conflict and preserved coordination remarks.
o.mask(1208,878,391,166,CREAM)
o.text(1225,902,'การประสานระยะในชุดแบบ',16,ORANGE,True)
o.lines(1225,929,[
'BF-06: 2.59 + มุม 0.10 = 2.69 m',
'BF-09: แนวรวม 2.21 / ระยะย่อย 2.00 m',
'ส่วนต่าง 0.21 m รอจัดสรร / ดู GF-02',
'ขอบฝ้านั่งเล่น: GF-01 = 0.50 m',
'GF-09 = 0.40 m / คงตามลายมือแต่ละหน้า',
'ระยะขอบฝ้านั่งเล่นรอยืนยันก่อนผลิต'],13,ORANGE,20)
o.save()
o=Overlay(2)
# Add explicit direction arrows where fresh handwriting points.
o.arrow(653,374,653,303,TEAL,1.6)
o.arrow(647,838,647,888,TEAL,1.6)
o.text(695,975,'ลูกศรแสดงทิศเลื่อนบานหน้าต่าง',13,TEAL)
o.save()
