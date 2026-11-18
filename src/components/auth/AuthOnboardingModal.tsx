import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { GroupInvite } from '../../types';
import { getGroupPreset } from '../../utils/groupPresets';
import { Modal } from '../ui/Modal';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Mail,
  Lock,
  User as UserIcon,
  KeyRound,
  Users,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';

interface AuthPanelProps {
  initialIntent?: 'create' | 'join';
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Reusable Auth + Create/Join Onboarding card used on the Sign-In gate
 */
export const AuthOnboardingCard: React.FC<AuthPanelProps> = ({
  initialIntent,
  onSuccess,
}) => {
  const {
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithEmailAccount,
    signUpWithEmailAccount,
    sendPasswordReset,
    pendingInviteCode,
    setPendingInviteCode,
    lookupInviteByCode,
    firebaseAuthUser,
    strings,
  } = useApp();
  const { showToast } = useToast();

  const [intent, setIntent] = useState<'create' | 'join'>(
    initialIntent || (pendingInviteCode ? 'join' : 'create')
  );
  const [authTab, setAuthTab] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [inviteCodeInput, setInviteCodeInput] = useState(pendingInviteCode || '');
  const [invitePreview, setInvitePreview] = useState<GroupInvite | null>(null);
  const [inviteLookupError, setInviteLookupError] = useState<string | null>(null);
  const [lookingUpInvite, setLookingUpInvite] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (pendingInviteCode) {
      setIntent('join');
      setInviteCodeInput(pendingInviteCode);
    }
  }, [pendingInviteCode]);

  const handleLookupInvite = async (codeToCheck?: string) => {
    const clean = (codeToCheck ?? inviteCodeInput).trim().toUpperCase();
    setInviteLookupError(null);
    setInvitePreview(null);
    if (!clean) {
      setInviteLookupError('Enter the group invite code shared by your administrator.');
      return;
    }
    setLookingUpInvite(true);
    const res = await lookupInviteByCode(clean);
    setLookingUpInvite(false);
    if (!res.success || !res.data) {
      setInviteLookupError(res.error || 'Group code not found.');
      return;
    }
    setInvitePreview(res.data);
    setPendingInviteCode(clean);
  };

  useEffect(() => {
    if (firebaseAuthUser && pendingInviteCode) {
      handleLookupInvite(pendingInviteCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseAuthUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalValidationError(null);
    setResetSent(false);

    if (authTab === 'signup' && password !== confirmPassword) {
      setLocalValidationError(strings.auth.passwordsDoNotMatch);
      return;
    }

    if (intent === 'join' && inviteCodeInput.trim()) {
      setPendingInviteCode(inviteCodeInput.trim().toUpperCase());
    }

    setSubmitting(true);
    if (authTab === 'reset') {
      const ok = await sendPasswordReset(email);
      setSubmitting(false);
      if (ok) {
        setResetSent(true);
        showToast('Password reset email sent', {
          message: `Check ${email.trim()} for reset instructions.`,
        });
      }
      return;
    }

    const ok =
      authTab === 'signup'
        ? await signUpWithEmailAccount(fullName, email, password)
        : await signInWithEmailAccount(email, password);
    setSubmitting(false);

    if (ok) {
      onSuccess?.();
    }
  };

  const handleGoogle = async () => {
    clearAuthError();
    if (intent === 'join' && inviteCodeInput.trim()) {
      setPendingInviteCode(inviteCodeInput.trim().toUpperCase());
    }
    const ok = await signInWithGoogle();
    if (ok) {
      onSuccess?.();
    }
  };

  return (
    <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50 dark:shadow-black/40 space-y-6">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span>UNIT SPOT · Malawi Shared Money</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          {authTab === 'signup'
            ? strings.auth.createAccountTitle
            : authTab === 'reset'
              ? 'Reset your password'
              : strings.auth.signInTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {intent === 'join'
            ? 'Join your group with an invite code to track your contributions, upload receipts, and check shared expenses.'
            : 'Sign in to create a group, invite members with one link, track MWK contributions, and verify receipts.'}
        </p>
      </div>

      {/* Dual Intent Selector */}
      <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Choose how you want to start">
        <button
          type="button"
          onClick={() => {
            setIntent('create');
            setPendingInviteCode(null);
          }}
          className={`min-h-[56px] p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
            intent === 'create'
              ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#11192C] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#18233D]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{strings.plain.createGroup}</span>
          </div>
          <div
            className={`text-[11px] mt-0.5 ${
              intent === 'create' ? 'text-slate-300 dark:text-blue-100' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            For treasurers &amp; organizers
          </div>
        </button>

        <button
          type="button"
          onClick={() => setIntent('join')}
          className={`min-h-[56px] p-3 rounded-2xl border text-left transition-colors cursor-pointer ${
            intent === 'join'
              ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#11192C] text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#18233D]'
          }`}
        >
          <div className="flex items-center gap-1.5 font-bold text-xs">
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>{strings.plain.joinGroup}</span>
          </div>
          <div
            className={`text-[11px] mt-0.5 ${
              intent === 'join' ? 'text-slate-300 dark:text-blue-100' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            I have a group invite code
          </div>
        </button>
      </div>

      {/* Invite Code Preview Box when joining */}
      {intent === 'join' && (
        <div className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5">
          <label
            htmlFor="onboarding-invite-code"
            className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
          >
            Group Invite Code
          </label>
          <div className="flex items-center gap-2">
            <input
              id="onboarding-invite-code"
              type="text"
              value={inviteCodeInput}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                setInviteCodeInput(v);
                setInviteLookupError(null);
              }}
              placeholder="e.g. US-8421-A4"
              className="flex-1 min-h-[44px] bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white uppercase"
            />
            {firebaseAuthUser && (
              <button
                type="button"
                onClick={() => handleLookupInvite()}
                disabled={lookingUpInvite}
                className="min-h-[44px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                {lookingUpInvite ? 'Checking...' : 'Check'}
              </button>
            )}
          </div>
          {!firebaseAuthUser && inviteCodeInput.trim() && (
            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
              Invite code saved — sign in or create an account below to verify and join this group.
            </p>
          )}
          {inviteLookupError && (
            <p className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
              {inviteLookupError}
            </p>
          )}
          {invitePreview && (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/70 text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="font-bold block truncate">{invitePreview.groupName}</span>
                <span className="text-[11px] text-emerald-800 dark:text-emerald-300">
                  {getGroupPreset(invitePreview.category).label} ·{' '}
                  {invitePreview.joinPolicy === 'admin_approval'
                    ? 'Admin approval required'
                    : 'Instant join after sign-in'}
                </span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            </div>
          )}
        </div>
      )}

      {/* Auth Error */}
      {(localValidationError || authError) && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/70 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{localValidationError || authError}</div>
          <button
            type="button"
            onClick={() => {
              setLocalValidationError(null);
              clearAuthError();
            }}
            className="min-h-[36px] px-2 text-rose-700 dark:text-rose-300 hover:text-rose-950 dark:hover:text-white font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {resetSent && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Password reset email sent. Check your inbox and spam folder.</span>
        </div>
      )}

      {/* Auth Mode Segmented Switcher */}
      <div className="inline-flex w-full p-1 bg-slate-100 dark:bg-[#11192C] rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => {
            setAuthTab('signin');
            clearAuthError();
            setLocalValidationError(null);
            setResetSent(false);
          }}
          className={`flex-1 min-h-[38px] rounded-lg font-semibold transition-colors cursor-pointer ${
            authTab === 'signin'
              ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {strings.auth.signIn}
        </button>
        <button
          type="button"
          onClick={() => {
            setAuthTab('signup');
            clearAuthError();
            setLocalValidationError(null);
            setResetSent(false);
          }}
          className={`flex-1 min-h-[38px] rounded-lg font-semibold transition-colors cursor-pointer ${
            authTab === 'signup'
              ? 'bg-white dark:bg-blue-600 text-slate-900 dark:text-white shadow-xs font-bold'
              : 'text-slate-600 dark:text-slate-400'
          }`}
        >
          {strings.auth.signUp}
        </button>
      </div>

      {/* Email/Password Form */}
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {authTab === 'signup' && (
          <div>
            <label
              htmlFor="auth-full-name"
              className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1"
            >
              {strings.auth.fullNameLabel}
            </label>
            <div className="relative">
              <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="auth-full-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Chimwemwe Phiri"
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="auth-email"
            className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1"
          >
            {strings.auth.emailLabel}
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-3.5 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {authTab !== 'reset' && (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="auth-password"
                  className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                >
                  {strings.auth.passwordLabel}
                </label>
                {authTab === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthTab('reset');
                      clearAuthError();
                      setLocalValidationError(null);
                    }}
                    className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    {strings.auth.forgotPassword}
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setLocalValidationError(null);
                  }}
                  placeholder={authTab === 'signup' ? 'At least 6 characters' : 'Your password'}
                  className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-12 py-2 text-sm text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? strings.auth.hidePasswordLabel : strings.auth.showPasswordLabel}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {authTab === 'signup' && (
              <div>
                <label
                  htmlFor="auth-confirm-password"
                  className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1"
                >
                  {strings.auth.confirmPasswordLabel}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setLocalValidationError(null);
                    }}
                    placeholder="Re-enter your password"
                    className={`w-full min-h-[44px] bg-white dark:bg-[#11192C] border rounded-xl pl-10 pr-12 py-2 text-sm text-slate-900 dark:text-white ${
                      confirmPassword && confirmPassword !== password
                        ? 'border-rose-400 dark:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword
                        ? `${strings.auth.hidePasswordLabel} confirmation`
                        : `${strings.auth.showPasswordLabel} confirmation`
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[46px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-sm"
        >
          <span>
            {submitting
              ? 'Please wait...'
              : authTab === 'signup'
                ? strings.auth.signUp
                : authTab === 'reset'
                  ? 'Send Password Reset Email'
                  : strings.auth.signIn}
          </span>
          <ArrowRight className="w-4 h-4" />
        </button>

        {authTab === 'reset' && (
          <button
            type="button"
            onClick={() => setAuthTab('signin')}
            className="w-full min-h-[38px] text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            Back to Sign In
          </button>
        )}
      </form>

      <div className="relative flex items-center">
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
        <span className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
          or
        </span>
        <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
      </div>

      {/* Continue with Google */}
      <button
        type="button"
        onClick={handleGoogle}
        className="w-full min-h-[46px] flex items-center justify-center gap-2.5 bg-white hover:bg-slate-50 dark:bg-[#11192C] dark:hover:bg-[#18233D] text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>{strings.auth.continueWithGoogle}</span>
      </button>
    </div>
  );
};

/**
 * Email verification gate shown when signed in via Email/Password without verified email yet
 */
export const EmailVerificationGate: React.FC = () => {
  const {
    currentUser,
    strings,
    authError,
    clearAuthError,
    resendVerification,
    refreshAuthVerification,
    signOut,
  } = useApp();
  const { showToast } = useToast();
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    const verified = await refreshAuthVerification();
    setChecking(false);
    if (verified) {
      showToast('Email verified', { message: 'Welcome to UNIT SPOT!' });
    } else {
      showToast('Not verified yet', {
        message: 'Click the verification link sent to your email, then press Continue.',
        variant: 'info',
      });
    }
  };

  const handleResend = async () => {
    setResending(true);
    const ok = await resendVerification();
    setResending(false);
    if (ok) {
      showToast('Verification email sent', {
        message: `Check ${currentUser?.email || 'your inbox'}.`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070B14] flex items-center justify-center p-4 sm:p-6">
      <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-xl">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-cyan-400">
          <Mail className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            {strings.auth.verifyEmailTitle}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {strings.auth.verifyEmailBody}
          </p>
          {currentUser?.email && (
            <p className="text-xs font-mono font-bold text-slate-900 dark:text-cyan-300 pt-1">
              {currentUser.email}
            </p>
          )}
        </div>

        {authError && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-start justify-between gap-2">
            <span>{authError}</span>
            <button
              type="button"
              onClick={clearAuthError}
              className="font-bold cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="w-full min-h-[46px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking...' : strings.auth.iHaveVerified}</span>
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="w-full min-h-[44px] bg-slate-100 hover:bg-slate-200 dark:bg-[#11192C] dark:hover:bg-[#18233D] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
          >
            {resending ? 'Sending...' : strings.auth.resendVerification}
          </button>

          <button
            type="button"
            onClick={signOut}
            className="w-full min-h-[40px] text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
          >
            Sign out and use another account
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * In-app Join Group Modal when authenticated user wants to join another group by invite code
 */
export const JoinGroupModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  defaultCode?: string | null;
}> = ({ isOpen, onClose, defaultCode }) => {
  const { lookupInviteByCode, joinGroupByCode, setPendingInviteCode } = useApp();
  const { showToast } = useToast();

  const [code, setCode] = useState(defaultCode || '');
  const [preview, setPreview] = useState<GroupInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && defaultCode) {
      setCode(defaultCode);
      handleCheck(defaultCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultCode]);

  const handleCheck = async (target?: string) => {
    const clean = (target ?? code).trim().toUpperCase();
    setError(null);
    setPreview(null);
    if (!clean) {
      setError('Enter the invite code shared by your group administrator.');
      return;
    }
    setLoading(true);
    const res = await lookupInviteByCode(clean);
    setLoading(false);
    if (!res.success || !res.data) {
      setError(res.error || 'Group invite code not found.');
      return;
    }
    setPreview(res.data);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await joinGroupByCode(code);
    setLoading(false);

    if (!res.success || !res.data) {
      setError(res.error || 'Could not join group.');
      return;
    }

    setPendingInviteCode(null);
    showToast(
      res.data.status === 'joined' ? 'Joined Group' : 'Join Request Sent',
      {
        message:
          res.data.status === 'joined'
            ? `You are now a member of ${res.data.groupName}.`
            : `Your request to join ${res.data.groupName} is waiting for admin approval.`,
      }
    );
    setCode('');
    setPreview(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setPendingInviteCode(null);
        onClose();
      }}
      title="Join a Group with Invite Code"
      subtitle="Enter the invite code shared via WhatsApp or email"
      maxWidthClass="max-w-md"
    >
      <form onSubmit={handleJoin} className="space-y-4 text-xs">
        {error && (
          <div
            role="alert"
            className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label
            htmlFor="modal-join-code"
            className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300"
          >
            Group Invite Code *
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="modal-join-code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. US-8421-A4"
                required
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm font-mono font-bold text-slate-900 dark:text-white uppercase"
              />
            </div>
            <button
              type="button"
              onClick={() => handleCheck()}
              disabled={loading}
              className="min-h-[44px] px-3.5 py-2 bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold cursor-pointer"
            >
              Verify
            </button>
          </div>
        </div>

        {preview && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 space-y-1">
            <div className="font-bold text-sm text-emerald-950 dark:text-emerald-100">
              {preview.groupName}
            </div>
            <div className="text-[11px] text-emerald-800 dark:text-emerald-300">
              {getGroupPreset(preview.category).label} · Code {preview.inviteCode}
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold pt-0.5">
              {preview.joinPolicy === 'admin_approval'
                ? 'Requires administrator approval before showing full balances.'
                : 'Auto-join enabled — you will enter this group immediately.'}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={() => {
              setPendingInviteCode(null);
              onClose();
            }}
            className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 font-bold rounded-xl cursor-pointer flex items-center gap-1.5"
          >
            <span>{loading ? 'Joining...' : 'Join Group'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </Modal>
  );
};
