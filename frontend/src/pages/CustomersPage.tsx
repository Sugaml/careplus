import { useCallback, useEffect, useState } from 'react';
import { referralApi, type Customer } from '@/lib/api';
import Loader from '@/components/Loader';
import { Users, RefreshCw, Phone } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [phoneLookup, setPhoneLookup] = useState('');
  const [lookupResult, setLookupResult] = useState<Customer | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const loadCustomers = useCallback(() => {
    setLoading(true);
    const offset = (page - 1) * limit;
    referralApi
      .listCustomers({ limit, offset })
      .then((res) => {
        setCustomers(res.items);
        setTotal(res.total);
      })
      .catch(() => {
        setCustomers([]);
        setTotal(0);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [page, limit]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadCustomers();
  };

  const handleLookup = () => {
    const phone = phoneLookup.trim();
    if (!phone) return;
    setLookupLoading(true);
    setLookupResult(null);
    referralApi
      .getCustomerByPhone(phone)
      .then(setLookupResult)
      .catch(() => setLookupResult(null))
      .finally(() => setLookupLoading(false));
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="w-7 h-7 text-careplus-primary" />
          <h1 className="text-2xl font-bold text-gray-800">Customers</h1>
        </div>
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
      <p className="text-gray-600 mb-6">
        Customers are created when they place an order (identified by phone). Each has a referral code and points balance for the referral & points program.
      </p>

      <div className="mb-6 flex flex-wrap items-end gap-2">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Lookup by phone"
            value={phoneLookup}
            onChange={(e) => setPhoneLookup(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="border border-gray-300 rounded-lg px-3 py-2 w-48"
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={lookupLoading || !phoneLookup.trim()}
            className="px-3 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50 text-sm font-medium"
          >
            {lookupLoading ? 'Looking up...' : 'Lookup'}
          </button>
        </div>
        {lookupResult && (
          <div className="ml-4 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
            <strong>{lookupResult.name || '—'}</strong> · {lookupResult.phone}
            {lookupResult.email && ` · ${lookupResult.email}`}
            <br />
            Referral code: <code className="bg-gray-200 px-1 rounded">{lookupResult.referral_code}</code> · Points: {lookupResult.points_balance}
          </div>
        )}
      </div>

      {loading ? (
        <Loader variant="page" message="Loading customers…" />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referral code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Points</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Referred by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {customers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                        No customers yet. Customers are added when they place an order with a phone number.
                      </td>
                    </tr>
                  ) : (
                    customers.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{c.name || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.phone}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.email || '—'}</td>
                        <td className="px-4 py-3">
                          <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{c.referral_code}</code>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.points_balance}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{c.referred_by_id ? 'Yes' : '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {total > limit && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
              <span>
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-3 py-1 rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
