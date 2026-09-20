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
    if (bill.status !== 'Unpaid' && bill.status !== 'Draft') {
      const error = new Error('บิลนี้ชำระเงินแล้ว');
      error.status = 409;
      error.code = 'BILL_ALREADY_PAID';
      throw error;
    }
    await connection.execute("UPDATE bills SET status = 'Paid' WHERE id = ?", [billId]);
    const [payment] = await connection.execute(
      'INSERT INTO payments (bill_id, amount, received_by) VALUES (?, ?, ?)',
      [billId, bill.total, userId],
    );
    const receiptNumber = `REC-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(payment.insertId).padStart(6, '0')}`;
    await connection.execute('INSERT INTO receipts (payment_id, receipt_number) VALUES (?, ?)', [
      payment.insertId,
      receiptNumber,
    ]);
    return { payment_id: payment.insertId, receipt_number: receiptNumber, amount: bill.total };
  });
}
