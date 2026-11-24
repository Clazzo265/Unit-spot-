import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { UnitSpotLogo } from '../brand/UnitSpotLogo';
import { AlertCircle, Loader2, LogOut, RefreshCw, X } from 'lucide-react';

type JoinState = 'idle' | 'joining' | 'error';

/**
 * Completes an invite link after authentication.
 *
 * The invite code is kept in AppContext while the user signs up/signs in and
 * verifies their email. Once a verified session exists, this component joins
 * the group automatically. There is deliberately no second "enter your code"
 * step: the user has already followed the admin's link.
 */
export const AutoJoinInvite: React.FC = () => {
  const {
    pendingInviteCode,
    joinGroupByCode,
    setPendingInviteCode,
    firebaseAuthUser,
    signOut,
  } = useApp();
  const { showToast } = useToast();
  const [state, setState] = useState<JoinState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const attemptedRef = useRef<string | null>(null);

  const performJoin = useCallback(
    async (code: string, key: string) => {
      attemptedRef.current = key;
      setState('joining');
      setErrorMessage('');
      try {
        const result = await joinGroupByCode(code);
        if (result.success) {
          setPendingInviteCode(null);
          showToast(
            result.data?.status === 'joined' ? 'Welcome to your group!' : 'Request sent',
            {
              message:
                result.data?.status === 'joined'
                  ? `You are now a member of ${result.data.groupName}.`
                  : `Your request to join ${result.data?.groupName || 'the group'} is waiting for admin approval.`,
              variant: 'success',
            }
          );
          setState('idle');
        } else {
          setErrorMessage(result.error || 'We could not add you to the group.');
          setState('error');
        }
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'We could not add you to the group.');
        setState('error');
      }
    },
    [joinGroupByCode, setPendingInviteCode, showToast]
  );

  useEffect(() => {
    const code = pendingInviteCode?.trim().toUpperCase();
    if (!code || !firebaseAuthUser) return;

    const key = `${firebaseAuthUser.uid}:${code}`;
    if (attemptedRef.current === key) return;
    void performJoin(code, key);
    // The ref guard above prevents duplicate attempts when callbacks change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInviteCode, firebaseAuthUser?.uid]);

  if (state === 'idle') return null;

  const retry = () => {
    const code = pendingInviteCode?.trim().toUpperCase();
    if (!code || !firebaseAuthUser) return;
    attemptedRef.current = null;
    void performJoin(code, `${firebaseAuthUser.uid}:${code}`);
  };

  const cancel = () => {
    setPendingInviteCode(null);
    setErrorMessage('');
    setState('idle');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#F6F8FC]/95 dark:bg-[#070B14]/95 p-5 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-3xl p-7 max-w-sm w-full text-center space-y-5 shadow-xl">
        <div className="flex justify-center">
          <UnitSpotLogo size="md" />
        </div>

        {state === 'joining' ? (
          <>
            <Loader2 className="w-8 h-8 mx-auto text-blue-600 dark:text-cyan-400 animate-spin" />
            <div className="space-y-1.5">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                Adding you to your group
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Your invite link was recognised. Just a moment while we finish setting up your
                workspace…
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
                We could not add you automatically
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {errorMessage}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-500">
                You do not need to enter the code again — it is already saved from the link.
              </p>
            </div>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={retry}
                className="w-full min-h-[46px] flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold rounded-xl text-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#11192C] dark:hover:bg-[#18233D] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign out and back in
              </button>
              <button
                type="button"
                onClick={cancel}
                className="w-full min-h-[38px] flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                Cancel invite
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
