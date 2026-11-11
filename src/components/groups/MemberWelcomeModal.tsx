import React, { useState } from 'react';
import { User, Group } from '../../types';
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Send, 
  ExternalLink, 
  UserCheck, 
  X, 
  Sparkles, 
  Mail, 
  Phone, 
  Home, 
  Share2 
} from 'lucide-react';

interface MemberWelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: User | null;
  group: Group | null;
  onSwitchToMember?: (user: User) => void;
}

export const MemberWelcomeModal: React.FC<MemberWelcomeModalProps> = ({
  isOpen,
  onClose,
  member,
  group,
  onSwitchToMember,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  if (!isOpen || !member || !group) return null;

  const appUrl = window.location.origin;
  const inviteLink = `${appUrl}/#group=${group.id}&invite=${group.joinCode}&email=${encodeURIComponent(member.email)}`;

  const welcomeMessage = `*Welcome to ${group.name} on UnitSpot!* 🏠✨\n\n` +
    `Muli bwanji ${member.name},\n\n` +
    `You have been added to our shared accommodation financial hub: *${group.name}*.\n` +
    (member.roomNumber ? `📍 *Unit/Room:* ${member.roomNumber}\n` : '') +
    `🔑 *Group Join Code:* ${group.joinCode}\n\n` +
    `With UnitSpot, you can easily view all shared contributions (Electricity/ESCOM, Water, Rent, WiFi, Security), track your payments, upload screenshot receipts, and set transparent countdown promises.\n\n` +
    `👉 *Open your member profile & dashboard here:* \n${inviteLink}\n\n` +
    `Thank you for being part of ${group.name}!`;

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
    const subject = encodeURIComponent(`Welcome to ${group.name} on UnitSpot — Your Shared Financial Hub`);
    const body = encodeURIComponent(
      `Hello ${member.name},\n\n` +
      `You have been registered as a member of "${group.name}" on UnitSpot.\n\n` +
      (member.roomNumber ? `Assigned Unit/Room: ${member.roomNumber}\n` : '') +
      `Group Code: ${group.joinCode}\n\n` +
      `You can access your obligations, view receipts, and make payment commitments here:\n${inviteLink}\n\n` +
      `Warm regards,\n${group.name} Administration & UnitSpot Team`
    );
    window.location.href = `mailto:${member.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-neutral-100 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header with celebratory icon */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100">
                Member Successfully Enrolled
              </span>
              <h3 className="text-xl font-extrabold text-neutral-900 mt-0.5">
                Welcome to UnitSpot!
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-xl hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Member Profile Badge */}
        <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/80 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-full bg-neutral-900 text-white font-bold text-base flex items-center justify-center shadow-xs">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-neutral-900 truncate">{member.name}</span>
              <span className="text-[10px] bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded-md font-semibold capitalize">
                {member.role.replace('_', ' ')}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500 mt-0.5">
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

        {/* Customized Welcome / Thanks Message Box */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center justify-between">
            <span>Personalized Welcome & Onboarding Message</span>
            <button
              onClick={handleCopyMessage}
              className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              {copiedMessage ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copiedMessage ? 'Copied Message!' : 'Copy Text'}
            </button>
          </label>
          <div className="p-3.5 rounded-2xl bg-neutral-900 text-neutral-200 font-mono text-xs whitespace-pre-line leading-relaxed border border-neutral-800 select-all max-h-48 overflow-y-auto">
            {welcomeMessage}
          </div>
        </div>

        {/* Member Invite Link */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-500">
            Direct Profile & Access Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-700 select-all font-mono"
            />
            <button
              onClick={handleCopyLink}
              className="px-3 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs shrink-0 cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
          <button
            onClick={handleCopyMessage}
            className="w-full sm:flex-1 py-2.5 px-3 bg-[#16A34A] hover:bg-[#15803d] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{copiedMessage ? 'Copied to Clipboard!' : 'Share via WhatsApp / SMS'}</span>
          </button>

          <button
            onClick={handleSendEmail}
            className="w-full sm:w-auto py-2.5 px-3 bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-800 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Send Email</span>
          </button>

          {onSwitchToMember && (
            <button
              onClick={() => {
                onSwitchToMember(member);
                onClose();
              }}
              className="w-full sm:w-auto py-2.5 px-3 bg-neutral-900 hover:bg-black text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="Experience the platform through this new member's view"
            >
              <UserCheck className="w-3.5 h-3.5 text-amber-300" />
              <span>Test as Member</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
