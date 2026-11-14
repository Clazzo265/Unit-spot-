import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import {
  CheckCircle2,
  RotateCcw,
  Trash2,
  Cloud,
  LogOut,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Search,
} from 'lucide-react';

export const UserSettingsAndProfileView: React.FC = () => {
  const {
    currentUser,
    setCurrentUser,
    auditLogs,
    integrityReport,
    hasPreRepairSnapshot,
    rescanAndRepairRecords,
    restorePreRepairSnapshot,
    clearAllData,
    firebaseAuthUser,
    signOut,
  } = useApp();
  const { showToast } = useToast();

  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [roomNumber, setRoomNumber] = useState(currentUser?.roomNumber || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [auditSearch, setAuditSearch] = useState('');
  const [auditSecurityOnly, setAuditSecurityOnly] = useState(false);
  const [integrityBanner, setIntegrityBanner] = useState<string | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name);
      setEmail(currentUser.email);
      setPhone(currentUser.phone || '');
      setRoomNumber(currentUser.roomNumber || '');
    }
  }, [currentUser]);

  if (!currentUser) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUser({
      ...currentUser,
      name: name.trim() || currentUser.name,
      email: currentUser.email,
      phone: phone.trim() || undefined,
      roomNumber: roomNumber.trim() || undefined,
    });
    setSavedSuccess(true);
    showToast('Profile saved', {
      message: 'Administrator contact details updated.',
      variant: 'success',
    });
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleRescan = () => {
    const report = rescanAndRepairRecords();
    const msg = `Scan completed: ${report.repairedCount} normalized, ${report.flaggedCount} flagged for admin review.`;
    setIntegrityBanner(msg);
    showToast('Integrity scan finished', { message: msg, variant: 'info' });
  };

  const handleRestoreSnapshot = () => {
    const res = restorePreRepairSnapshot();
    if (res.success) {
      setIntegrityBanner('Pre-repair snapshot restored cleanly.');
      showToast('Snapshot restored', {
        message: 'Previous ledger records restored.',
        variant: 'success',
      });
    } else {
      const errMsg = res.error || 'Could not restore snapshot.';
      setIntegrityBanner(errMsg);
      showToast('Restore failed', { message: errMsg, variant: 'error' });
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (auditSecurityOnly && !log.securityEvent) return false;
    const q = auditSearch.trim().toLowerCase();
    if (!q) return true;
    return `${log.action} ${log.actorName} ${log.details} ${log.reason || ''}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
          Administrator Settings, Integrity &amp; Audit Log
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          Authenticated session profile, historical data integrity controls, and immutable audit trail
        </p>
      </div>

      {/* Authenticated Profile Form */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base">
            Administrator Profile &amp; Contact
          </h3>
          <span className="text-xs font-bold uppercase tracking-wider bg-slate-900 dark:bg-blue-600 text-[#E5B93C] dark:text-white px-2.5 py-1 rounded-lg">
            {currentUser.role.replace('_', ' ')}
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Profile details updated successfully.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="settings-name"
                className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="settings-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="settings-email"
                className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Verified Google Account Email
              </label>
              <input
                id="settings-email"
                type="email"
                value={email}
                readOnly
                className="w-full min-h-[44px] bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-600 dark:text-slate-400"
              />
            </div>

            <div>
              <label
                htmlFor="settings-phone"
                className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Malawi Phone Number (+265)
              </label>
              <input
                id="settings-phone"
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+265 999 000 000"
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label
                htmlFor="settings-unit"
                className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
              >
                Office / Unit Assignment
              </label>
              <input
                id="settings-unit"
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. Unit 1A"
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-5 py-2 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      {/* Data Integrity & Snapshot Recovery */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 rounded-xl border border-amber-200 dark:border-amber-800/60 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base">
                Historical Data Integrity &amp; Rollback Snapshot
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Non-destructive validation of integer MWK amounts, duplicate references, and stove classifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleRescan}
              className="min-h-[44px] inline-flex items-center gap-1.5 bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#E5B93C]" />
              <span>Run Integrity Scan</span>
            </button>

            {hasPreRepairSnapshot && (
              <button
                type="button"
                onClick={handleRestoreSnapshot}
                className="min-h-[44px] inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800/60 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Pre-Repair Snapshot</span>
              </button>
            )}
          </div>
        </div>

        {integrityBanner && (
          <div className="p-3 bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200">
            {integrityBanner}
          </div>
        )}

        {integrityReport && integrityReport.findings.length > 0 ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {integrityReport.findings.map((f) => (
              <div key={f.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      f.severity === 'repaired'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 block">{f.issue}</span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                      {f.entityType} #{f.entityId}
                      {f.beforeValue ? ` • ${f.beforeValue} → ${f.afterValue}` : ''}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap w-fit ${
                    f.severity === 'repaired'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                  }`}
                >
                  {f.severity.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              All member classifications, integer MWK ledger entries, and commitment balances passed verification.
            </span>
          </div>
        )}
      </div>

      {/* Immutable Audit Trail Viewer */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base">
              Immutable Audit Log ({filteredLogs.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Append-only history of financial changes, reversals, stove tier updates, and security events
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filter audit log..."
                aria-label="Filter audit log"
                className="w-full sm:w-52 min-h-[44px] bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <label className="min-h-[44px] inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer whitespace-nowrap px-2">
              <input
                type="checkbox"
                checked={auditSecurityOnly}
                onChange={(e) => setAuditSecurityOnly(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 accent-blue-600"
              />
              <span>Security events</span>
            </label>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 dark:text-slate-500">
              No audit events recorded matching your filter.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-3.5 hover:bg-slate-50/70 dark:hover:bg-[#11192C]/60 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                        log.securityEvent
                          ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                          : 'bg-slate-100 dark:bg-[#131D33] text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      {log.actorName}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300">{log.details}</p>
                {(log.beforeValue || log.afterValue) && (
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Delta: {log.beforeValue || '—'} → {log.afterValue || '—'}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Firebase Cloud Connection */}
      <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-50 text-base">
                Firebase Cloud Sync
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {firebaseAuthUser?.email || currentUser.email}
              </p>
            </div>
          </div>

          {firebaseAuthUser && (
            <button
              type="button"
              onClick={signOut}
              className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#131D33] dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Clear Local Cache Action */}
      <div className="bg-slate-50 dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
            Reset Local Workspace Cache
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Clears browser-cached records while leaving authenticated Firebase cloud collections intact.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsConfirmingClear(true)}
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-[#131D33] dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Local Cache</span>
        </button>
      </div>

      <Modal
        isOpen={isConfirmingClear}
        onClose={() => setIsConfirmingClear(false)}
        title="Clear Local Cache?"
        subtitle="Browser-cached data only"
        maxWidthClass="max-w-sm"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            This removes locally cached browser records. Authenticated cloud records in Firestore are not deleted.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsConfirmingClear(false)}
              className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                clearAllData();
                setIsConfirmingClear(false);
                showToast('Local workspace cache cleared', {
                  message: 'Cloud records remain safely stored in Firestore.',
                  variant: 'info',
                });
              }}
              className="min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
            >
              Confirm Reset
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
