import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
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
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleRescan = () => {
    const report = rescanAndRepairRecords();
    setIntegrityBanner(
      `Scan completed: ${report.repairedCount} normalized, ${report.flaggedCount} flagged for admin review.`
    );
  };

  const handleRestoreSnapshot = () => {
    const res = restorePreRepairSnapshot();
    if (res.success) {
      setIntegrityBanner('Pre-repair snapshot restored cleanly.');
    } else {
      setIntegrityBanner(res.error || 'Could not restore snapshot.');
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
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
          Administrator Settings, Integrity & Audit Log
        </h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Authenticated session profile, historical data integrity controls, and immutable audit trail
        </p>
      </div>

      {/* Authenticated Profile Form */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-neutral-900 text-base">
            Administrator Profile & Contact
          </h3>
          <span className="text-xs font-bold uppercase tracking-wider bg-neutral-900 text-[#D5A52B] px-2.5 py-1 rounded-lg">
            {currentUser.role.replace('_', ' ')}
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Profile details updated successfully.</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                Verified Google Account Email
              </label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-600"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                Malawi Phone Number (+265)
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+265 999 000 000"
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                Office / Unit Assignment
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. Unit 1A"
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="bg-neutral-900 hover:bg-black text-white px-5 py-2 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      {/* Data Integrity & Snapshot Recovery */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">
                Historical Data Integrity & Rollback Snapshot
              </h3>
              <p className="text-xs text-neutral-500">
                Non-destructive validation of integer MWK amounts, duplicate references, and stove classifications
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleRescan}
              className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#D5A52B]" />
              <span>Run Integrity Scan</span>
            </button>

            {hasPreRepairSnapshot && (
              <button
                type="button"
                onClick={handleRestoreSnapshot}
                className="inline-flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Pre-Repair Snapshot</span>
              </button>
            )}
          </div>
        </div>

        {integrityBanner && (
          <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800">
            {integrityBanner}
          </div>
        )}

        {integrityReport && integrityReport.findings.length > 0 ? (
          <div className="border border-neutral-200 rounded-xl overflow-hidden divide-y divide-neutral-100 text-xs">
            {integrityReport.findings.map((f) => (
              <div key={f.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={`w-4 h-4 shrink-0 mt-0.5 ${
                      f.severity === 'repaired' ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  />
                  <div>
                    <span className="font-bold text-neutral-900 block">{f.issue}</span>
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {f.entityType} #{f.entityId}
                      {f.beforeValue ? ` • ${f.beforeValue} → ${f.afterValue}` : ''}
                    </span>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase whitespace-nowrap w-fit ${
                    f.severity === 'repaired'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-900 border border-amber-200'
                  }`}
                >
                  {f.severity.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>All member classifications, integer MWK ledger entries, and commitment balances passed verification.</span>
          </div>
        )}
      </div>

      {/* Immutable Audit Trail Viewer */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-neutral-900 text-base">
              Immutable Audit Log ({filteredLogs.length})
            </h3>
            <p className="text-xs text-neutral-500">
              Append-only history of financial changes, reversals, stove tier updates, and security events
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Filter audit log..."
                className="bg-neutral-50 border border-neutral-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-neutral-900"
              />
            </div>
            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={auditSecurityOnly}
                onChange={(e) => setAuditSecurityOnly(e.target.checked)}
                className="rounded border-neutral-300"
              />
              <span>Security events</span>
            </label>
          </div>
        </div>

        <div className="border border-neutral-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-neutral-100 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-neutral-400">
              No audit events recorded matching your filter.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-3.5 hover:bg-neutral-50/70 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                        log.securityEvent
                          ? 'bg-rose-50 text-rose-800 border border-rose-200'
                          : 'bg-neutral-100 text-neutral-800'
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="font-semibold text-neutral-900">{log.actorName}</span>
                  </div>
                  <span className="text-[11px] text-neutral-400 tabular-nums">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-neutral-700">{log.details}</p>
                {(log.beforeValue || log.afterValue) && (
                  <p className="text-[11px] font-mono text-neutral-500">
                    Delta: {log.beforeValue || '—'} → {log.afterValue || '—'}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Firebase Cloud Connection */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">
                Firebase Cloud Sync
              </h3>
              <p className="text-xs text-neutral-500">
                {firebaseAuthUser?.email || currentUser.email}
              </p>
            </div>
          </div>

          {firebaseAuthUser && (
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Clear Local Cache Action */}
      <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-neutral-900 text-sm">Reset Local Workspace Cache</h4>
          <p className="text-xs text-neutral-500 mt-0.5">
            Clears browser-cached records while leaving authenticated Firebase cloud collections intact.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsConfirmingClear(true)}
          className="inline-flex items-center gap-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear Local Cache</span>
        </button>
      </div>

      {isConfirmingClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-4 text-xs">
            <h4 className="font-bold text-neutral-900 text-base">Clear Local Cache?</h4>
            <p className="text-neutral-600">
              This removes locally cached browser records. Authenticated cloud records in Firestore are not deleted.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsConfirmingClear(false)}
                className="px-4 py-2 font-semibold text-neutral-600 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllData();
                  setIsConfirmingClear(false);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
