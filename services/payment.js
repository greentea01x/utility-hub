import { withTx } from '../db/tx.js';
import { recordAudit } from '../lib/audit.js';

export async function confirmPayment(billId, userId) {
  return withTx(async (connection) => {
    const [[bill]] = await connection.execute(
      'SELECT id, total, status FROM bills WHERE id = ? FOR UPDATE',
      [billId],
    );
    if (!bill) {
      const error = new Error('ไม่พบบิล');
      error.status = 404;
      error.code = 'BILL_NOT_FOUND';
      throw error;
    }
    if (bill.status !== 'Unpaid') {
      const error = new Error('บิลนี้ยังไม่พร้อมรับชำระหรือชำระแล้ว');
      error.status = 409;
      error.code = 'BILL_ALREADY_PAID';
      throw error;
    }
    await connection.execute("UPDATE bills SET status = 'Paid' WHERE id = ?", [billId]);
    const [paymentRows] = await connection.execute(
      'INSERT INTO payments (bill_id, amount, received_by) VALUES (?, ?, ?) RETURNING id, bill_id, amount, method, received_by, received_at',
      [billId, bill.total, userId],
    );
    const paymentId = paymentRows[0].id;
    const receiptNumber = `REC-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(paymentId).padStart(6, '0')}`;
    const [receiptRows] = await connection.execute(
      'INSERT INTO receipts (payment_id, receipt_number) VALUES (?, ?) RETURNING id',
      [paymentId, receiptNumber],
    );
    const result = {
      payment_id: paymentId,
      receipt_id: receiptRows[0].id,
      receipt_number: receiptNumber,
      amount: bill.total,
    };
    await recordAudit(connection, {
      entityType: 'payment',
      entityId: paymentId,
      billId,
      action: 'PAYMENT_CONFIRM',
      actorUserId: userId,
      before: { bill_id: bill.id, bill_status: bill.status, total: bill.total },
      after: {
        ...paymentRows[0],
        receipt_id: result.receipt_id,
        receipt_number: receiptNumber,
        bill_status: 'Paid',
      },
    });
    return result;
  });
}
