import { useCallback, useEffect, useState } from 'react';
import { paymentApi, Payment } from '@/lib/api';
import Loader from '@/components/Loader';
import { CreditCard, RefreshCw } from 'lucide-react';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadPayments = useCallback(() => {
    setLoading(true);
    setError('');
    paymentApi
      .list()
      .then(setPayments)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load payments'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPayments();
  };

  if (loading && payments.length === 0) return <Loader variant="page" message="Loading payments…" />;
  if (error && payments.length === 0) return <p className="text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Payments</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {payments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No payments yet.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Amount</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Method</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.currency} {p.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.method}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(p.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
