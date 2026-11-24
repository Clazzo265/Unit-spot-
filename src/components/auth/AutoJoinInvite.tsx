import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { UnitSpotLogo } from '../brand/UnitSpotLogo';
import { Loader2 } from 'lucide-react';

interface AutoJoinInviteProps {
  /** Called when automatic joining fails; the app can then show the manual join modal. */
  onError: () => void;
}

/**
 * Completes an invite link after authentication.
 *
 * The invite code is kept in AppContext while the user signs up/signs in and
 * verifies their email. Once a verified session exists, this component joins
 * the group automatically so the invited member never has to copy/paste the
 * code a second time.
 */
export const AutoJoinInvite: React.FC<AutoJoinInviteProps> = ({ onError }) => {
  const { pendingInviteCode, joinGroupByCode, setPendingInviteCode, firebaseAuthUser } = useApp();
  const { showToast } = useToast();
  const [isJoining, setIsJoining] = useState(false);
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    const code = pendingInviteCode?.trim().toUpperCase();
    if (!code || !firebaseAuthUser) return;

    const attemptKey = `${firebaseAuthUser.uid}:${code}`;
    if (attemptedRef.current === attemptKey) return;
    attemptedRef.current = attemptKey;

    let cancelled = false;
    setIsJoining(true);

    void (async () => {
      try {
        const result = await joinGroupByCode(code);
        if (cancelled) return;
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
        } else {
          onError();
        }
      } catch {
        if (!cancelled) onError();
      } finally {
        if (!cancelled) setIsJoining(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // joinGroupByCode and onError are recreated each render; the ref guard above
    // ensures a single attempt per UID + invite code.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInviteCode, firebaseAuthUser?.uid]);

  if (!isJoining) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#F6F8FC]/95 dark:bg-[#070B14]/95 p-6 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-xl">
        <div className="flex justify-center">
          <UnitSpotLogo size="md" />
        </div>
        <Loader2 className="w-8 h-8 mx-auto text-blue-600 dark:text-cyan-400 animate-spin" />
        <div className="space-y-1.5">
          <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
            Adding you to your group
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Your invite code was recognised. Just a moment while we finish setting up your
            workspace…
          </p>
        </div>
      </div>
    </div>
  );
};
