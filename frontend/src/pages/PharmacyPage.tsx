import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Mail, Phone, MapPin, RefreshCw } from 'lucide-react';

export default function PharmacyPage() {
  const { user, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Pharmacy</h1>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors disabled:opacity-50"
          title="Refresh"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 p-6 max-w-2xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 rounded-lg bg-careplus-primary text-white">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Your Pharmacy</h2>
            <p className="text-sm text-gray-500">Pharmacy ID: {user?.pharmacy_id}</p>
          </div>
        </div>
        <p className="text-gray-600">
          Pharmacy management and settings can be configured here. Use the API to create and
          update pharmacy details (name, license, address, phone, email).
        </p>
        <div className="mt-4 flex gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Mail className="w-4 h-4" />
            {user?.email}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            Pharmacy info from API
          </span>
          <span className="flex items-center gap-1">
            <Phone className="w-4 h-4" />
            —
          </span>
        </div>
      </div>
    </div>
  );
}
