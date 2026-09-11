import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { paymentAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [payAmount, setPayAmount] = useState({});
  const [paying, setPaying] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      const res = await paymentAPI.getAll();
      setPayments(res.data.payments || []);
      setOutstanding(res.data.outstanding || 0);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (id) => {
    const amount = parseFloat(payAmount[id]);
    if (!amount || amount <= 0) return;
    setPaying(id);
    setMessage({ text: '', type: '' });
    try {
      await paymentAPI.pay(id, amount);
      setPayAmount(p => ({ ...p, [id]: '' }));
      setMessage({ text: 'Payment recorded successfully', type: 'success' });
      loadPayments();
    } catch {
      setMessage({ text: 'Only an authorized admin can record payments', type: 'error' });
    } finally {
      setPaying(null);
    }
  };

  const statusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-700';
      case 'partial': return 'bg-yellow-100 text-yellow-700';
      case 'overpaid': return 'bg-blue-100 text-blue-700';
      default: return 'bg-red-100 text-red-700';
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payments & Fees</h1>
        <p className="text-gray-500 text-sm mt-1">{user?.role === 'admin' ? 'Record verified payments and review invoices' : 'Track your invoices and verified payments'}</p>
      </motion.div>

      {user?.role === 'student' && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card mb-6 text-center">
          <p className="text-sm text-gray-500">Total Outstanding Balance</p>
          <p className={`text-4xl font-bold mt-1 ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ${outstanding.toFixed(2)}
          </p>
          {outstanding === 0 && <p className="text-sm text-green-600 mt-1">You're all caught up!</p>}
          {outstanding > 0 && <p className="text-xs text-gray-500 mt-3">Payments are updated after admin or provider verification.</p>}
        </motion.div>
      )}

      {message.text && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm border ${message.type === 'success' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {payments.length === 0 && <p className="text-center py-8 text-gray-400">No payment records found.</p>}
        {payments.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1 w-full sm:w-auto">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">${p.amount.toFixed(2)}</h3>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor(p.status)}`}>{p.status}</span>
                </div>
                {p.program_name && <p className="text-sm text-gray-500">{p.program_name}</p>}
                <p className="text-xs text-gray-400 mt-1">Paid: ${p.paid_amount.toFixed(2)} | Due: {p.due_date ? new Date(p.due_date).toLocaleDateString() : 'N/A'}</p>
                {p.notes && <p className="text-xs text-gray-400 mt-0.5">{p.notes}</p>}
                {user?.role === 'admin' && p.student_name && <p className="text-xs text-gray-400 mt-0.5">Student: {p.student_name}</p>}
              </div>
              {user?.role === 'admin' && p.status !== 'paid' && p.status !== 'overpaid' && (
                <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
                  <input type="number" min="0.01" step="0.01" placeholder="Amount" value={payAmount[p.id] || ''} onChange={(e) => setPayAmount(pa => ({ ...pa, [p.id]: e.target.value }))} className="input-field w-full sm:w-28 text-sm" />
                  <button onClick={() => handlePay(p.id)} disabled={paying === p.id} className="btn-primary text-sm px-3 py-1.5">{paying === p.id ? '...' : 'Pay'}</button>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
