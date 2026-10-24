(function () {
  'use strict';

  window.ResidentData = {
    brand: 'ศุภาลัย เรสซิเดนซ์',
    simulationDate: '2026-09-01',
    resident: {
      name: 'คุณพิมพ์ชนก',
      room: '205',
      building: 'A',
      floor: '2',
      area: 30,
      occupancy: 'พักอาศัยอยู่',
      linkedAt: '2026-08-31',
      lineLinked: true
    },
    office: {
      name: 'สำนักงานนิติบุคคล',
      location: 'อาคาร A ชั้น 1',
      days: 'วันจันทร์–ศุกร์',
      hours: '09:00–17:00 น.',
      paymentMethod: 'เงินสดที่สำนักงานนิติบุคคล'
    },
    bills: [
      {
        id: 'BILL-202609-205', period: '2026-09', label: 'กันยายน 2026',
        status: 'pending', issueDate: '2026-09-01', dueDate: '2026-09-05',
        paidDate: null, total: 1790, receiptId: null,
        water: { previous: 1250, current: 1260, units: 10, rate: 18, amount: 180 },
        electricity: { previous: 5280, current: 5350, units: 70, rate: 8, amount: 560 },
        common: { area: 30, rate: 35, amount: 1050 }
      },
      {
        id: 'BILL-202608-205', period: '2026-08', label: 'สิงหาคม 2026',
        status: 'paid', issueDate: '2026-08-01', dueDate: '2026-08-05',
        paidDate: '2026-08-03', total: 1732, receiptId: 'REC-202608-000728',
        water: { previous: 1241, current: 1250, units: 9, rate: 18, amount: 162 },
        electricity: { previous: 5215, current: 5280, units: 65, rate: 8, amount: 520 },
        common: { area: 30, rate: 35, amount: 1050 }
      },
      {
        id: 'BILL-202607-205', period: '2026-07', label: 'กรกฎาคม 2026',
        status: 'paid', issueDate: '2026-07-01', dueDate: '2026-07-05',
        paidDate: '2026-07-03', total: 1710, receiptId: 'REC-202607-000605',
        water: { previous: 1231, current: 1241, units: 10, rate: 18, amount: 180 },
        electricity: { previous: 5155, current: 5215, units: 60, rate: 8, amount: 480 },
        common: { area: 30, rate: 35, amount: 1050 }
      },
      {
        id: 'BILL-202606-205', period: '2026-06', label: 'มิถุนายน 2026',
        status: 'paid', issueDate: '2026-06-01', dueDate: '2026-06-05',
        paidDate: '2026-06-04', total: 1768, receiptId: 'REC-202606-000482',
        water: { previous: 1220, current: 1231, units: 11, rate: 18, amount: 198 },
        electricity: { previous: 5090, current: 5155, units: 65, rate: 8, amount: 520 },
        common: { area: 30, rate: 35, amount: 1050 }
      }
    ],
    receipts: [
      { id: 'REC-202608-000728', billId: 'BILL-202608-205', date: '2026-08-03', amount: 1732, method: 'เงินสด' },
      { id: 'REC-202607-000605', billId: 'BILL-202607-205', date: '2026-07-03', amount: 1710, method: 'เงินสด' },
      { id: 'REC-202606-000482', billId: 'BILL-202606-205', date: '2026-06-04', amount: 1768, method: 'เงินสด' }
    ],
    announcements: [
      {
        id: 'water-20260904', category: 'maintenance', categoryLabel: 'ซ่อมบำรุง', icon: '💧',
        title: 'แจ้งหยุดจ่ายน้ำชั่วคราว', date: '2026-09-01',
        summary: 'อาคาร A วันที่ 4 กันยายน เวลา 10:00–12:00 น. เพื่อบำรุงรักษาระบบน้ำ',
        paragraphs: [
          'สำนักงานนิติบุคคลขอแจ้งหยุดจ่ายน้ำชั่วคราวในอาคาร A วันที่ 4 กันยายน 2026 เวลา 10:00–12:00 น. เพื่อบำรุงรักษาระบบน้ำส่วนกลาง',
          'กรุณาสำรองน้ำสำหรับใช้งานก่อนช่วงเวลาดังกล่าว เมื่อดำเนินการเสร็จจะเปิดจ่ายน้ำตามปกติ',
          'หากต้องการข้อมูลเพิ่มเติม สามารถติดต่อสำนักงานนิติบุคคลในเวลาทำการ ขออภัยในความไม่สะดวก'
        ]
      },
      {
        id: 'bill-202609', category: 'payment', categoryLabel: 'ค่าใช้จ่าย', icon: '🧾',
        title: 'บิลเดือนกันยายนพร้อมตรวจสอบแล้ว', date: '2026-09-01',
        summary: 'ตรวจสอบรายละเอียดค่าใช้จ่าย และชำระเงินสดที่สำนักงานภายในวันที่ 5 กันยายน',
        paragraphs: [
          'บิลค่าใช้จ่ายประจำเดือนกันยายน 2026 พร้อมให้ตรวจสอบแล้ว กรุณาตรวจสอบค่าน้ำ ค่าไฟฟ้า และค่าส่วนกลางในเมนูบิลประจำเดือน',
          'กำหนดชำระวันที่ 5 กันยายน 2026 โดยรับชำระเป็นเงินสดที่สำนักงานนิติบุคคล อาคาร A ชั้น 1 วันจันทร์–ศุกร์ เวลา 09:00–17:00 น.',
          'เนื่องจากวันที่ 5 กันยายนเป็นวันเสาร์ กรุณาติดต่อชำระในวันทำการภายในวันที่ 4 กันยายน เมื่อเจ้าหน้าที่ยืนยันรับเงินแล้วจึงจะมีใบเสร็จในระบบ'
        ]
      },
      {
        id: 'shared-area-20260828', category: 'general', categoryLabel: 'ทั่วไป', icon: '🌿',
        title: 'ร่วมดูแลพื้นที่ส่วนกลาง', date: '2026-08-28',
        summary: 'เว้นทางเดินให้โล่ง และแยกขยะก่อนนำไปทิ้งที่จุดรับขยะประจำอาคาร',
        paragraphs: [
          'ขอความร่วมมือผู้อยู่อาศัยไม่วางสิ่งของบริเวณทางเดินหน้าห้อง บันได และประตูหนีไฟ เพื่อให้ทุกคนใช้พื้นที่ร่วมกันได้สะดวก',
          'กรุณาแยกขยะทั่วไปและขยะรีไซเคิลก่อนนำไปทิ้งที่จุดรับขยะประจำอาคาร และปิดถุงขยะให้เรียบร้อย',
          'ขอบคุณผู้อยู่อาศัยทุกท่านที่ช่วยดูแลบ้านของเราให้น่าอยู่'
        ]
      }
    ]
  };
}());
