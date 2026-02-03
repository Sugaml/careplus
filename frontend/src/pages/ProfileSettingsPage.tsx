import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authApi } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import { User, Save, Lock } from 'lucide-react';

export default function ProfileSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [profileConfirmOpen, setProfileConfirmOpen] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileConfirmOpen(true);
  };

  const handleProfileConfirm = async () => {
    setError('');
    setSuccess(false);
    setSaving(true);
    setProfileConfirmOpen(false);
    try {
      const updated = await authApi.updateProfile({ name: name.trim() });
      setName(updated.name);
      setSuccess(true);
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    setPasswordConfirmOpen(true);
  };

  const handlePasswordConfirm = async () => {
    setPasswordConfirmOpen(false);
    setPasswordSaving(true);
    try {
      await authApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <User className="w-7 h-7 text-careplus-primary" />
        <h1 className="text-2xl font-bold text-gray-800">Profile settings</h1>
      </div>
      <p className="text-gray-600 mb-6">
        Update your display name, password, and view your account details.
      </p>

      <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        {success && (
          <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
            Profile saved successfully.
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2">Account info</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <p className="text-gray-900">{user.email}</p>
            <p className="text-xs text-gray-500 mt-0.5">Email cannot be changed here.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <p className="text-gray-900 capitalize">{user.role}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="Your name"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white hover:bg-careplus-primary/90 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </form>

      <form onSubmit={handleChangePassword} className="max-w-xl mt-8 space-y-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-800 border-b pb-2 flex items-center gap-2">
            <Lock className="w-5 h-5 text-careplus-primary" />
            Change password
          </h2>
          {passwordError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{passwordError}</div>
          )}
          {passwordSuccess && (
            <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm">
              Password changed successfully.
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="Enter current password"
              required
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="At least 6 characters"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-transparent"
              placeholder="Confirm new password"
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={passwordSaving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white hover:bg-careplus-primary/90 disabled:opacity-60"
          >
            <Lock className="w-4 h-4" />
            {passwordSaving ? 'Changing...' : 'Change password'}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={profileConfirmOpen}
        title="Update profile"
        message="Save changes to your display name?"
        confirmLabel="Save"
        cancelLabel="Cancel"
        variant="default"
        loading={saving}
        onConfirm={handleProfileConfirm}
        onCancel={() => setProfileConfirmOpen(false)}
      />

      <ConfirmDialog
        open={passwordConfirmOpen}
        title="Change password"
        message="Are you sure you want to change your password? You will need to sign in again with the new password."
        confirmLabel="Change password"
        cancelLabel="Cancel"
        variant="default"
        loading={passwordSaving}
        onConfirm={handlePasswordConfirm}
        onCancel={() => setPasswordConfirmOpen(false)}
      />
    </div>
  );
}
