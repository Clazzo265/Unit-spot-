import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatMWK, computeMemberPerformance } from '../../utils/financialCalculations';
import { 
  User as UserIcon, 
  ShieldCheck, 
  CheckCircle2, 
  RotateCcw, 
  Trash2,
  Phone, 
  Mail, 
  Home,
  Cloud,
  Database,
  LogIn,
  LogOut 
} from 'lucide-react';

export const UserSettingsAndProfileView: React.FC = () => {
  const { 
    currentUser, 
    setCurrentUser, 
    users, 
    assignments, 
    payments, 
    commitments, 
    clearAllData,
    firebaseAuthUser,
    signInWithGoogle,
    signOut,
    isFirebaseReady 
  } = useApp();

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phone);
  const [roomNumber, setRoomNumber] = useState(currentUser.roomNumber || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const performance = computeMemberPerformance(currentUser.id, assignments, payments, commitments);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentUser({
      ...currentUser,
      name,
      email,
      phone,
      roomNumber,
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
          Account Settings & Profile
        </h2>
        <p className="text-sm text-neutral-500 mt-0.5">
          Manage your personal profile, role permissions, and contact details
        </p>
      </div>

      {/* Role and User Switcher */}
      {users.length > 1 && (
        <div className="bg-neutral-900 text-white rounded-2xl p-5 border border-neutral-800 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-[#D5A52B]">
                Active User Session
              </div>
              <p className="text-xs text-neutral-300 mt-0.5">
                Switch session to another registered platform user:
              </p>
            </div>
            <span className="text-[11px] bg-white/10 px-2 py-0.5 rounded text-neutral-300">
              Current: <strong className="text-white capitalize">{currentUser.role.replace('_', ' ')}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
            {users.map(u => {
              const isSelected = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u);
                    setName(u.name);
                    setEmail(u.email);
                    setPhone(u.phone);
                    setRoomNumber(u.roomNumber || '');
                  }}
                  className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-[#D5A52B] bg-white/15 text-white ring-1 ring-[#D5A52B]' 
                      : 'border-white/10 bg-white/5 text-neutral-300 hover:bg-white/10'
                  }`}
                >
                  <div className="font-bold text-xs truncate">{u.name}</div>
                  <div className="text-[10px] text-neutral-400 capitalize">{u.role.replace('_', ' ')}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Financial Accountability Scorecard */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs">
        <h3 className="font-bold text-neutral-900 text-base mb-1">
          Individual Performance & Accountability
        </h3>
        <p className="text-xs text-neutral-500 mb-4">
          Factual metrics based on actual obligations, payments and commitment history
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-100">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Total Expected</span>
            <div className="text-xl font-extrabold text-neutral-900 mt-0.5">{formatMWK(performance.totalExpected)}</div>
          </div>
          <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-100">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Verified Paid</span>
            <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{formatMWK(performance.totalVerifiedPaid)}</div>
          </div>
          <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-100">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Current Balance</span>
            <div className={`text-xl font-extrabold mt-0.5 ${performance.totalOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatMWK(performance.totalOutstanding)}
            </div>
          </div>
          <div className="bg-neutral-50 p-3.5 rounded-xl border border-neutral-100">
            <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">Commitments Honoured</span>
            <div className="text-xl font-extrabold text-neutral-900 mt-0.5">
              {performance.commitmentsHonoured} / {performance.commitmentsCount}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs">
        <h3 className="font-bold text-neutral-900 text-base mb-4">
          Personal Profile & Contact
        </h3>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {savedSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Profile details updated successfully!</span>
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
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                Room Number / Flat Unit
              </label>
              <input
                type="text"
                value={roomNumber}
                onChange={(e) => setRoomNumber(e.target.value)}
                placeholder="e.g. Unit 1A, Room 3"
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

      {/* Firebase Cloud Integration Status Card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-neutral-900 text-base">
                Firebase Cloud Integration
              </h3>
              <p className="text-xs text-neutral-500">
                Firestore Database & Google Authentication connection details
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold w-fit">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Database Provisioned & Ready</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200/80 space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Firebase Project ID
            </div>
            <div className="font-mono text-neutral-800 font-semibold">dev-media-nkpm1</div>
          </div>

          <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200/80 space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
              Firestore Database ID
            </div>
            <div className="font-mono text-neutral-800 font-semibold truncate" title="ai-studio-klarency-3c2a1a2c-44c8-4b62-a9d7-a0f143ff43ec">
              ai-studio-klarency-3c2a1a2c-44c8-4b62-a9d7-a0f143ff43ec
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {firebaseAuthUser ? (
              <div className="flex items-center gap-2">
                {firebaseAuthUser.photoURL ? (
                  <img src={firebaseAuthUser.photoURL} alt="" className="w-8 h-8 rounded-full border border-neutral-200 object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral-900 text-white flex items-center justify-center font-bold text-xs">
                    {(firebaseAuthUser.displayName || 'G').charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-bold text-xs text-neutral-900">
                    {firebaseAuthUser.displayName || 'Google Account'}
                  </div>
                  <div className="text-[11px] text-neutral-500 font-mono">
                    {firebaseAuthUser.email}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-neutral-500">
                You are currently running in local session mode. Connect Google to sync state across members.
              </div>
            )}
          </div>

          {firebaseAuthUser ? (
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out of Google
            </button>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In with Google
            </button>
          )}
        </div>
      </div>

      {/* Clear Database Reset Action */}
      <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-neutral-900 text-sm">
            Clear Local Cache
          </h4>
          <p className="text-xs text-neutral-500 mt-0.5">
            Reset any stored browser cache to keep the workspace completely clean.
          </p>
        </div>

        <button
          onClick={() => {
            if (confirm('Clear local storage and start with a clean slate?')) {
              clearAllData();
            }
          }}
          className="inline-flex items-center gap-1.5 bg-neutral-200 hover:bg-neutral-300 text-neutral-800 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear All Data
        </button>
      </div>
    </div>
  );
};
