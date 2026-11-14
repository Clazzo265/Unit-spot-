import React, { useState } from 'react';
import { User, Group, StoveType } from '../../types';
import { RATES, STOVE_TYPE_LABELS } from '../../utils/financialConfig';
import { formatMWK } from '../../utils/financialCalculations';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import {
  Copy,
  Check,
  Sparkles,
  Mail,
  Phone,
  Home,
  Share2,
} from 'lucide-react';

interface MemberWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: User | null;
  group: Group | null;
  stoveType?: StoveType;
}

export const MemberWelcomeModal: React.FC<MemberWelcomeModalProps> = ({
  isOpen,
  onClose,
  member,
  group,
  stoveType,
}) => {
  const { showToast } = useToast();
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  if (!isOpen || !member || !group) return null;

  const appUrl = window.location.origin;
  const inviteLink = `${appUrl}/#group=${group.id}&code=${group.joinCode}`;
  const stoveLine = stoveType
    ? `• Stove Tier: ${STOVE_TYPE_LABELS[stoveType]} (${formatMWK(RATES[stoveType])})\n`
    : '';

  const welcomeMessage =
    `Welcome to ${group.name} on UnitSpot!\n\n` +
    `Hello ${member.name},\n\n` +
    `You have been registered in the financial directory for ${group.name}.\n` +
    (member.roomNumber ? `• Unit/Room: ${member.roomNumber}\n` : '') +
    stoveLine +
    `• Group Code: ${group.joinCode}\n\n` +
    `All contribution assignments, verified payment receipts, and balance statements will be delivered directly to your registered email (${member.email}).\n\n` +
    `Group Hub Link: ${inviteLink}\n\n` +
    `Thank you for keeping our shared accommodation transparent and accountable.`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    showToast('Group link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(welcomeMessage);
    setCopiedMessage(true);
    showToast('Welcome notice copied — ready to paste into WhatsApp or SMS');
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(
      `Welcome to ${group.name} on UnitSpot — Member Directory Confirmation`
    );
    const body = encodeURIComponent(welcomeMessage);
    window.location.href = `mailto:${member.email}?subject=${subject}&body=${body}`;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Member Enrolled — Directory Confirmation"
      subtitle={`Ready to share welcome details with ${member.name}`}
      maxWidthClass="max-w-lg"
    >
      <div className="space-y-5">
        <div className="bg-slate-50 dark:bg-[#11192C] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-slate-900 dark:bg-blue-600 text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                {member.name}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                · {member.role.replace('_', ' ')}
              </span>
              {stoveType && (
                <span className="text-xs text-amber-700 dark:text-[#E5B93C] font-semibold tabular-nums">
                  · {STOVE_TYPE_LABELS[stoveType]} ({formatMWK(RATES[stoveType])})
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {member.email}
              </span>
              {member.phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3" />
                  {member.phone}
                </span>
              )}
              {member.roomNumber && (
                <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <Home className="w-3 h-3" />
                  {member.roomNumber}
                </span>
              )}
            </div>
          </div>
          <Sparkles className="w-5 h-5 text-[#D5A52B] shrink-0" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Welcome Message
            </span>
            <button
              type="button"
              onClick={handleCopyMessage}
              className="min-h-[36px] px-2 text-xs text-blue-600 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              {copiedMessage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedMessage ? 'Copied Message' : 'Copy Text'}
            </button>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950 text-slate-200 font-mono text-xs whitespace-pre-line leading-relaxed border border-slate-800 select-all max-h-48 overflow-y-auto">
            {welcomeMessage}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Group Reference Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="w-full min-h-[44px] bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-700 dark:text-slate-300 select-all font-mono"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="min-h-[44px] px-3.5 py-2 bg-white dark:bg-[#131D33] hover:bg-slate-50 dark:hover:bg-[#1A2744] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={handleCopyMessage}
            className="w-full sm:flex-1 min-h-[44px] py-2.5 px-4 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[#E5B93C] dark:text-white" />
            <span>{copiedMessage ? 'Copied to Clipboard' : 'Copy WhatsApp / SMS Notice'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            className="w-full sm:w-auto min-h-[44px] py-2.5 px-4 bg-white dark:bg-[#131D33] hover:bg-slate-50 dark:hover:bg-[#1A2744] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Open Email Client</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
