import { z } from 'zod';

export const billingPeriod = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const technicianNameMessage = 'กรุณากรอกชื่อช่างผู้จดมิเตอร์ 2–100 ตัวอักษร';
export const technicianName = z.string().trim().min(2).max(100);
