import { withTx } from '../db/tx.js';

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
      'INSERT INTO payments (bill_id, amount, received_by) VALUES (?, ?, ?) RETURNING id',
      [billId, bill.total, userId],
    );
    const paymentId = paymentRows[0].id;
    const receiptNumber = `REC-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(paymentId).padStart(6, '0')}`;
    const [receiptRows] = await connection.execute(
      'INSERT INTO receipts (payment_id, receipt_number) VALUES (?, ?) RETURNING id',
      [paymentId, receiptNumber],
    );
    return {
      payment_id: paymentId,
      receipt_id: receiptRows[0].id,
      receipt_number: receiptNumber,
      amount: bill.total,
    };
  });
}
