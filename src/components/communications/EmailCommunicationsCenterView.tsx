import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import {
  CommunicationType,
  AudienceType,
  EmailCommunication,
} from '../../types';
import {
  filterTargetAudience,
  buildPersonalizedCommunication,
} from '../../utils/centralizedFinancialAdmin';
import { formatMWK } from '../../utils/financialCalculations';
import {
  Mail,
  Send,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Calendar,
  Sliders,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  FileText,
  AlertCircle,
} from 'lucide-react';

export const EmailCommunicationsCenterView: React.FC = () => {
  const {
    currentGroup,
    groupMembers,
    contributions,
    assignments,
    payments,
    currentUser,
    communications,
    sendCommunication,
    notificationConfig,
    updateNotificationConfig,
  } = useApp();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'compose' | 'history' | 'automation'>('compose');
  const [commType, setCommType] = useState<CommunicationType>('announcement');
  const [targetAudience, setTargetAudience] = useState<AudienceType>('all_active');
  const [selectedContributionId, setSelectedContributionId] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [previewMemberIndex, setPreviewMemberIndex] = useState<number>(0);
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<EmailCommunication | null>(null);

  const activeMembers = useMemo(() => {
    if (!currentGroup) return [];
    return groupMembers.filter((m) => m.groupId === currentGroup.id && m.status === 'active');
  }, [currentGroup, groupMembers]);

  const groupCommunications = useMemo(() => {
    if (!currentGroup) return communications;
    return communications.filter((c) => c.groupId === currentGroup.id);
  }, [communications, currentGroup]);

  const targetMembers = useMemo(() => {
    if (!currentGroup) return [];
    return filterTargetAudience(
      currentGroup.id,
      targetAudience,
      groupMembers,
      assignments,
      payments,
      selectedContributionId || undefined,
      selectedMemberId || undefined
    );
  }, [
    currentGroup,
    targetAudience,
    groupMembers,
    assignments,
    payments,
    selectedContributionId,
    selectedMemberId,
  ]);

  const selectedContribution = useMemo(
    () => contributions.find((c) => c.id === selectedContributionId),
    [contributions, selectedContributionId]
  );

  const currentPreviewMember =
    targetMembers[previewMemberIndex] || targetMembers[0] || activeMembers[0];

  const previewData = useMemo(() => {
    if (!currentGroup || !currentPreviewMember) {
      return {
        subject: subject || 'Notice from Administrator',
        personalizedSnippet: message || 'Message content...',
        outstandingAmount: undefined,
      };
    }

    return buildPersonalizedCommunication(
      currentPreviewMember,
      currentGroup,
      commType,
      subject,
      message,
      assignments,
      payments,
      selectedContribution
    );
  }, [
    currentPreviewMember,
    currentGroup,
    commType,
    subject,
    message,
    assignments,
    payments,
    selectedContribution,
  ]);

  const handleApplyTemplate = (type: CommunicationType) => {
    setCommType(type);
    setDispatchError(null);
    if (!currentGroup) return;

    const adminLabel = currentUser?.name || 'Group Administrator';

    if (type === 'announcement') {
      setTargetAudience('all_active');
      setSubject(`Important Group Notice — ${currentGroup.name}`);
      setMessage(
        `Dear Residents,\n\n` +
          `This is a general announcement regarding our shared responsibilities.\n` +
          `Please observe all agreed contribution timelines and shared facility guidelines.\n\n` +
          `Warm regards,\n${adminLabel}\nAdministrator, ${currentGroup.name}`
      );
      showToast('Template applied', { message: 'Loaded general announcement template.', variant: 'info' });
    } else if (type === 'financial_reminder') {
      setTargetAudience('outstanding_only');
      setSubject(`Financial Balance Reminder — ${currentGroup.name}`);
      setMessage(
        `Hello,\n\n` +
          `This is a confidential reminder regarding your pending contribution balance.\n` +
          `Prompt settlement keeps shared utilities active without interruption.\n\n` +
          `Please review your balance below and settle with the administrator.`
      );
      showToast('Template applied', { message: 'Loaded private balance reminder template.', variant: 'info' });
    } else if (type === 'cleared_balance') {
      setTargetAudience('paid_only');
      setSubject(`All Balances Settled — ${currentGroup.name}`);
      setMessage(
        `Dear Member,\n\n` +
          `Thank you for settling your contribution obligations in full. Your account is in good standing.`
      );
      showToast('Template applied', { message: 'Loaded cleared balance template.', variant: 'info' });
    }
  };

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchError(null);
    if (!currentGroup) return;

    if (targetMembers.length === 0) {
      setDispatchError('No active members matched the selected audience criteria.');
      return;
    }

    const effectiveSubject = subject.trim() || previewData.subject;
    const effectiveMessage = message.trim() || previewData.personalizedSnippet;

    const result = sendCommunication({
      type: commType,
      targetAudience,
      subject: effectiveSubject,
      message: effectiveMessage,
      contributionId: selectedContributionId || undefined,
      individualMemberId: targetAudience === 'individual' ? selectedMemberId : undefined,
    });

    if (result) {
      const msg = `Dispatched "${effectiveSubject}" to ${result.recipientCount} active recipient(s).`;
      setDispatchSuccess(msg);
      showToast('Communication dispatched', { message: msg, variant: 'success' });
      setSubject('');
      setMessage('');
      setTimeout(() => setDispatchSuccess(null), 6000);
    } else {
      const errMsg = 'Could not dispatch communication. Check audience selection.';
      setDispatchError(errMsg);
      showToast('Dispatch failed', { message: errMsg, variant: 'error' });
    }
  };

  const openMailtoClient = () => {
    if (targetMembers.length === 0) return;
    const bccList = targetMembers.map((m) => m.email).join(',');
    const encodedSubj = encodeURIComponent(subject || previewData.subject);
    const encodedBody = encodeURIComponent(previewData.personalizedSnippet);
    window.location.href = `mailto:?bcc=${bccList}&subject=${encodedSubj}&body=${encodedBody}`;
    showToast('Opening email client', {
      message: `Prepared BCC draft for ${targetMembers.length} recipient(s).`,
      variant: 'info',
    });
  };

  if (!currentGroup) {
    return (
      <EmptyState
        icon={Mail}
        title="No Active Financial Group"
        description="Select or create an administrator group to compose notices and private balance reminders."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs mb-1">
              <span className="uppercase tracking-widest font-extrabold text-[#B78816] dark:text-[#E5B93C]">
                Communications Engine
              </span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">{currentGroup.name}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">
              Email Communications Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Send group announcements or strictly private balance reminders without exposing one member’s figures to another.
            </p>
          </div>

          <div className="flex items-center gap-3 tabular-nums">
            <div className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                Active Directory
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-50">
                {activeMembers.length} members
              </span>
            </div>
            <div className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl text-center">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">
                Dispatches Logged
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-slate-50">
                {groupCommunications.length} sent
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-5 border-t border-slate-100 dark:border-slate-800/80 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'compose'
                ? 'bg-slate-900 dark:bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose &amp; Dispatch</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-slate-900 dark:bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Delivery History ({groupCommunications.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('automation')}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'automation'
                ? 'bg-slate-900 dark:bg-blue-600 text-white font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Automation Rules</span>
          </button>
        </div>
      </div>

      {dispatchSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-4 flex items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">{dispatchSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setDispatchSuccess(null)}
            className="min-h-[36px] px-2 text-emerald-700 dark:text-emerald-300 hover:underline font-bold cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {dispatchError && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl p-4 flex items-center justify-between gap-3 text-rose-900 dark:text-rose-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="font-semibold">{dispatchError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDispatchError(null)}
            className="min-h-[36px] px-2 text-rose-700 dark:text-rose-300 hover:underline font-bold cursor-pointer shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: COMPOSE & DISPATCH */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#D5A52B] dark:text-[#E5B93C]" />
                  <span>Notice Configuration</span>
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 mr-1">Templates:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('announcement')}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-[#131D33] dark:hover:bg-[#1A2744] text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
                  >
                    General
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('financial_reminder')}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 font-semibold border border-amber-200 dark:border-amber-800/60 cursor-pointer"
                  >
                    Reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('cleared_balance')}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800/60 cursor-pointer"
                  >
                    Cleared
                  </button>
                </div>
              </div>

              <form onSubmit={handleDispatch} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                    Communication Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'announcement', title: 'Announcement', sub: 'Group memo' },
                      { id: 'financial_reminder', title: 'Reminder', sub: 'Private dues' },
                      { id: 'payment_confirmation', title: 'Receipt', sub: 'Confirmation' },
                      { id: 'cleared_balance', title: 'Zero Balance', sub: 'Good standing' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCommType(opt.id as CommunicationType)}
                        className={`min-h-[48px] p-2.5 rounded-xl text-left border transition cursor-pointer ${
                          commType === opt.id
                            ? 'bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-500 text-white'
                            : 'bg-slate-50 dark:bg-[#11192C] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#17223B]'
                        }`}
                      >
                        <span className="font-bold block">{opt.title}</span>
                        <span
                          className={`text-[10px] ${
                            commType === opt.id ? 'text-slate-300 dark:text-blue-100' : 'text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {opt.sub}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="comm-target-audience"
                      className="font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400"
                    >
                      Target Audience
                    </label>
                    <span className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1 tabular-nums">
                      <Users className="w-3.5 h-3.5 text-[#D5A52B] dark:text-[#E5B93C]" />
                      {targetMembers.length} active recipient(s)
                    </span>
                  </div>
                  <select
                    id="comm-target-audience"
                    value={targetAudience}
                    onChange={(e) => {
                      setTargetAudience(e.target.value as AudienceType);
                      setPreviewMemberIndex(0);
                    }}
                    className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all_active">
                      All Active Group Members ({activeMembers.length})
                    </option>
                    <option value="outstanding_only">
                      Members with Outstanding Balances Only
                    </option>
                    <option value="overdue_only">Members with Overdue Balances Only</option>
                    <option value="paid_only">Members Who Have Paid in Full</option>
                    <option value="individual">Specific Individual Member Record</option>
                  </select>
                </div>

                {targetAudience === 'individual' && (
                  <div>
                    <label
                      htmlFor="comm-individual-member"
                      className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
                    >
                      Select Registered Member
                    </label>
                    <select
                      id="comm-individual-member"
                      value={selectedMemberId}
                      onChange={(e) => {
                        setSelectedMemberId(e.target.value);
                        setPreviewMemberIndex(0);
                      }}
                      className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Choose active member...</option>
                      {activeMembers.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="comm-contribution-scope"
                    className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
                  >
                    Associated Contribution (Optional)
                  </label>
                  <select
                    id="comm-contribution-scope"
                    value={selectedContributionId}
                    onChange={(e) => setSelectedContributionId(e.target.value)}
                    className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Entire Group Scope</option>
                    {contributions
                      .filter((c) => c.groupId === currentGroup.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title} (Target: {formatMWK(c.totalTargetAmount)})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="comm-subject"
                    className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
                  >
                    Subject Line
                  </label>
                  <input
                    id="comm-subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={previewData.subject}
                    className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label
                    htmlFor="comm-body"
                    className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5"
                  >
                    Message Body
                  </label>
                  <textarea
                    id="comm-body"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your notice here. Individual member balances and references are automatically attached privately."
                    className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400 mb-2.5">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Matched Active Recipients ({targetMembers.length})
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Suspended/removed excluded
                    </span>
                  </div>
                  {targetMembers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                      {targetMembers.map((m, idx) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPreviewMemberIndex(idx)}
                          className={`min-h-[34px] text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            previewMemberIndex === idx
                              ? 'bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-500 text-white font-semibold'
                              : 'bg-white dark:bg-[#0D1424] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#17223B]'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      No active members match this filter.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={targetMembers.length === 0}
                    className="flex-1 min-h-[44px] bg-slate-900 hover:bg-black dark:bg-blue-600 dark:hover:bg-blue-500 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-[#E5B93C]" />
                    <span>Log &amp; Dispatch Notice ({targetMembers.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={openMailtoClient}
                    disabled={targetMembers.length === 0}
                    className="min-h-[44px] bg-white dark:bg-[#11192C] hover:bg-slate-50 dark:hover:bg-[#17223B] disabled:opacity-50 text-slate-800 dark:text-slate-200 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Mailto</span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Right Column: Live Recipient Preview */}
          <div className="lg:col-span-5">
            <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#D5A52B] dark:text-[#E5B93C]" />
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-50">
                    Live Recipient Preview
                  </span>
                </div>
                {targetMembers.length > 1 && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {previewMemberIndex + 1} / {targetMembers.length}
                  </span>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <div className="bg-slate-50 dark:bg-[#11192C] px-4 py-3 border-b border-slate-200 dark:border-slate-800 space-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">To:</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {currentPreviewMember?.name || 'Member'} &lt;
                      {currentPreviewMember?.email || 'member@example.mw'}&gt;
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Subject:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                      {previewData.subject}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3 bg-white dark:bg-[#0B1120] text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-slate-50 text-sm">
                      Hello {currentPreviewMember?.name || 'Member'},
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ref:{' '}
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {currentPreviewMember?.memberRefId || 'MEM-2026'}
                      </span>
                      {currentPreviewMember?.roomNumber
                        ? ` • Unit ${currentPreviewMember.roomNumber}`
                        : ''}
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-lg p-3 whitespace-pre-line text-slate-700 dark:text-slate-300">
                    {previewData.personalizedSnippet}
                  </div>

                  {commType === 'financial_reminder' &&
                    previewData.outstandingAmount !== undefined && (
                      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl p-3 flex items-center justify-between tabular-nums">
                        <div>
                          <span className="text-[10px] text-amber-800 dark:text-amber-300 uppercase tracking-wider font-bold block">
                            Current Outstanding Balance
                          </span>
                          <span className="text-base font-extrabold text-amber-950 dark:text-amber-200">
                            {formatMWK(previewData.outstandingAmount)}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                          Private Notice
                        </span>
                      </div>
                    )}

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400">
                    Dispatched privately by administrator{' '}
                    {currentUser?.name || 'Administrator'} via UnitSpot. Member balances are never disclosed to other residents.
                  </div>
                </div>
              </div>

              {targetMembers.length > 1 && (
                <div className="flex items-center justify-between text-xs gap-2">
                  <button
                    type="button"
                    disabled={previewMemberIndex === 0}
                    onClick={() => setPreviewMemberIndex((prev) => Math.max(0, prev - 1))}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#131D33] dark:hover:bg-[#1A2744] disabled:opacity-40 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={previewMemberIndex >= targetMembers.length - 1}
                    onClick={() =>
                      setPreviewMemberIndex((prev) =>
                        Math.min(targetMembers.length - 1, prev + 1)
                      )
                    }
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#131D33] dark:hover:bg-[#1A2744] disabled:opacity-40 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
                  >
                    Next Recipient
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: DELIVERY HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Communication Dispatch Log
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Audited history of group notices, payment confirmations, and reminders
              </p>
            </div>
            <span className="text-xs font-bold bg-slate-100 dark:bg-[#131D33] text-slate-800 dark:text-slate-200 px-3 py-1.5 rounded-lg tabular-nums">
              {groupCommunications.length} Sent
            </span>
          </div>

          {groupCommunications.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No Dispatches Recorded Yet"
              description={`Compose and send your first announcement or payment reminder for ${currentGroup.name}.`}
              actionLabel="Compose First Notice"
              onAction={() => setActiveTab('compose')}
            />
          ) : (
            <div className="space-y-3">
              {groupCommunications.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded font-bold uppercase bg-slate-900 dark:bg-blue-600 text-white">
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {new Date(item.sentAt).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                      {item.subject}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">
                      {item.message}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 tabular-nums">
                    <div className="text-left sm:text-right text-xs">
                      <span className="font-bold text-slate-900 dark:text-slate-100 block">
                        {item.deliveredCount} / {item.recipientCount} Delivered
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryItem(item)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-[#17223B] text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Recipients</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Modal
            isOpen={Boolean(selectedHistoryItem)}
            onClose={() => setSelectedHistoryItem(null)}
            title={selectedHistoryItem?.subject || 'Dispatch Recipients'}
            subtitle="Confidential per-recipient delivery summary"
            maxWidthClass="max-w-2xl"
          >
            {selectedHistoryItem && (
              <div className="space-y-2.5">
                {selectedHistoryItem.recipients.map((r) => (
                  <div
                    key={r.memberId}
                    className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-slate-100">{r.name}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                        {r.deliveryStatus}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      {r.email} {r.phone ? `• ${r.phone}` : ''}
                    </p>
                    {r.outstandingAmount !== undefined && (
                      <p className="text-amber-800 dark:text-amber-300 font-semibold tabular-nums">
                        Balance Referenced: {formatMWK(r.outstandingAmount)}
                      </p>
                    )}
                    <div className="bg-white dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line">
                      {r.personalizedSnippet}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        </div>
      )}

      {/* TAB 3: AUTOMATION RULES */}
      {activeTab === 'automation' && (
        <div className="bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800/80">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-50">
              Automated Notification Triggers
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control automatic email logging when payments, cleared balances, or obligations occur
            </p>
          </div>

          {[
            {
              key: 'autoPaymentConfirmations' as const,
              icon: CheckCircle2,
              title: 'Instant Payment Receipt Acknowledgement',
              desc: 'Log a confirmation receipt notice whenever a payment is recorded or verified.',
            },
            {
              key: 'autoClearedBalanceNotes' as const,
              icon: Sparkles,
              title: 'Zero-Balance Settlement Confirmation',
              desc: 'Generate a thank-you confirmation when an obligation reaches MK 0 remaining.',
            },
            {
              key: 'autoObligationNotice' as const,
              icon: Calendar,
              title: 'New Contribution & Member Onboarding Notices',
              desc: 'Create welcome & reference dispatches when registering members or assigning obligations.',
            },
            {
              key: 'autoOverdueAlerts' as const,
              icon: AlertTriangle,
              title: 'Overdue Balance Escalations',
              desc: 'Flag overdue balances exclusively to members with unpaid shares past the deadline.',
            },
          ].map((rule) => {
            const Icon = rule.icon;
            return (
              <div
                key={rule.key}
                className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 gap-4"
              >
                <div className="space-y-1">
                  <span className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[#D5A52B] dark:text-[#E5B93C] shrink-0" />
                    <span>{rule.title}</span>
                  </span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{rule.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 min-h-[44px] px-1">
                  <input
                    type="checkbox"
                    checked={notificationConfig[rule.key]}
                    onChange={(e) => {
                      updateNotificationConfig({ [rule.key]: e.target.checked });
                      showToast('Automation rule updated', {
                        message: `${rule.title} ${e.target.checked ? 'enabled' : 'paused'}.`,
                        variant: 'info',
                      });
                    }}
                    className="sr-only peer"
                    aria-label={rule.title}
                  />
                  <div className="w-11 h-6 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[11px] after:left-[6px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
