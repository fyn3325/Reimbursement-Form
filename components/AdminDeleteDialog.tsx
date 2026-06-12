import React, { useEffect, useState } from 'react';
import { isAdminPassword } from '../lib/admin';

type AdminDeleteDialogProps = {
  open: boolean;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
};

const AdminDeleteDialog: React.FC<AdminDeleteDialogProps> = ({
  open,
  title,
  message,
  onCancel,
  onConfirm,
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setError('');
  }, [open]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminPassword(password)) {
      setError('Incorrect admin password.');
      return;
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{message}</p>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Admin Password
        </label>
        <input
          autoFocus
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError('');
          }}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-100"
          placeholder="Enter admin password"
        />
        {error && <div className="mt-2 text-xs font-semibold text-red-600">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminDeleteDialog;
