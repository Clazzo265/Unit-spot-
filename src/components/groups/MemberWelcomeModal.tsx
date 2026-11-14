import React, { useState } from 'react';
import { User, Group, StoveType } from '../../types';
import { RATES, STOVE_TYPE_LABELS } from '../../utils/financialConfig';
import { formatMWK } from '../../utils/financialCalculations';
import {
  Copy,
  Check,
  X,
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
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(welcomeMessage);
    setCopiedMessage(true);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-neutral-200 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5 text-[#D5A52B]" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Member Enrolled
              </span>
              <h3 className="text-xl font-extrabold text-neutral-900">
                Directory Confirmation
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-neutral-900 text-white font-bold text-base flex items-center justify-center shadow-xs shrink-0">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-neutral-900 truncate">{member.name}</span>
              <span className="text-[10px] bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded-md font-semibold capitalize">
                {member.role.replace('_', ' ')}
              </span>
              {stoveType && (
                <span className="text-[10px] bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-semibold tabular-nums">
                  {STOVE_TYPE_LABELS[stoveType]} • {formatMWK(RATES[stoveType])}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500 mt-1">
              <span className="flex items-center gap-1">
                <Mail className="w-3 h-3 text-neutral-400" />
                {member.email}
              </span>
              {member.phone && (
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-neutral-400" />
                  {member.phone}
                </span>
              )}
              {member.roomNumber && (
                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                  <Home className="w-3 h-3 text-emerald-600" />
                  {member.roomNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Welcome Message
            </span>
            <button
              type="button"
              onClick={handleCopyMessage}
              className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              {copiedMessage ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedMessage ? 'Copied Message' : 'Copy Text'}
            </button>
          </div>
          <div className="p-3.5 rounded-2xl bg-neutral-900 text-neutral-200 font-mono text-xs whitespace-pre-line leading-relaxed border border-neutral-800 select-all max-h-48 overflow-y-auto">
            {welcomeMessage}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Group Reference Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-700 select-all font-mono"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-3 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
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
            className="w-full sm:flex-1 py-2.5 px-3 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[#D5A52B]" />
            <span>{copiedMessage ? 'Copied to Clipboard' : 'Copy WhatsApp / SMS Notice'}</span>
          </button>

          <button
            type="button"
            onClick={handleSendEmail}
            className="w-full sm:w-auto py-2.5 px-3 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Open Email Client</span>
          </button>
        </div>
      </div>
    </div>
  );
};
