import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { certificateAPI } from '../../api';

export default function VerifyCertificate() {
  const [serial, setSerial] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = 'Verify Certificate | JT NextGen Tech Hub'; }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const res = await certificateAPI.verify(serial.trim());
      setResult(res.data);
    } catch (err) {
      setError(err.response?.status === 404 ? 'Certificate not found. Please check the serial number and try again.' : 'Verification service unavailable. Please try again.');
    }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
    <section className="min-h-screen bg-gray-50 dark:bg-gray-800/50 py-12 md:py-20 px-4 md:px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-brand-800">Certificate <span className="text-brand-600">Verification</span></h1>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verify the authenticity of a JT NextGen Tech Hub certificate.</p>
        </motion.div>
        <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
          className="accent-card bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm mb-10">
          <label className="block text-gray-700 dark:text-gray-300 font-medium mb-2">Certificate Serial Number</label>
          <input type="text" placeholder="e.g. JTNG-0001" value={serial} onChange={(e) => setSerial(e.target.value)} required className="input-field mb-4" />
          <motion.button type="submit" disabled={loading} className="btn-primary w-full py-3" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {loading ? 'Verifying...' : 'Verify Certificate'}
          </motion.button>
        </motion.form>
        <AnimatePresence>
          {result && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="bg-green-50 border-l-4 border-green-500 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-green-800 mb-2">&#10003; Certificate Verified</h3>
              <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                <p><strong>Serial Number:</strong> {result.serial_number}</p>
                <p><strong>Student:</strong> {result.student_name}</p>
                <p><strong>Program:</strong> {result.program_title}</p>
                <p><strong>Issue Date:</strong> {new Date(result.issue_date).toLocaleDateString()}</p>
                <p><strong>Status:</strong> <span className="text-green-600 font-semibold">{result.status}</span></p>
              </div>
            </motion.div>
          )}
          {error && (
            <motion.div key="error" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="bg-red-50 border-l-4 border-red-500 p-6 rounded-lg text-red-700">{error}</motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
    </motion.div>
  );
}

