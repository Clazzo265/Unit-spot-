import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
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
  X,
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
    } else if (type === 'financial_reminder') {
      setTargetAudience('outstanding_only');
      setSubject(`Financial Balance Reminder — ${currentGroup.name}`);
      setMessage(
        `Hello,\n\n` +
          `This is a confidential reminder regarding your pending contribution balance.\n` +
          `Prompt settlement keeps shared utilities active without interruption.\n\n` +
          `Please review your balance below and settle with the administrator.`
      );
    } else if (type === 'cleared_balance') {
      setTargetAudience('paid_only');
      setSubject(`All Balances Settled — ${currentGroup.name}`);
      setMessage(
        `Dear Member,\n\n` +
          `Thank you for settling your contribution obligations in full. Your account is in good standing.`
      );
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
      setDispatchSuccess(
        `Dispatched "${effectiveSubject}" to ${result.recipientCount} active recipient(s).`
      );
      setSubject('');
      setMessage('');
      setTimeout(() => setDispatchSuccess(null), 6000);
    } else {
      setDispatchError('Could not dispatch communication. Check audience selection.');
    }
  };

  const openMailtoClient = () => {
    if (targetMembers.length === 0) return;
    const bccList = targetMembers.map((m) => m.email).join(',');
    const encodedSubj = encodeURIComponent(subject || previewData.subject);
    const encodedBody = encodeURIComponent(previewData.personalizedSnippet);
    window.location.href = `mailto:?bcc=${bccList}&subject=${encodedSubj}&body=${encodedBody}`;
  };

  if (!currentGroup) {
    return (
      <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center text-neutral-500">
        <Mail className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-neutral-900 mb-1">No Active Financial Group</h3>
        <p className="max-w-md mx-auto text-xs text-neutral-500">
          Select or create an administrator group to compose notices and balance reminders.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cohesive KLARENCY Header Card */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs mb-1">
              <span className="uppercase tracking-widest font-extrabold text-[#D5A52B]">
                Communications Engine
              </span>
              <span className="text-neutral-300">•</span>
              <span className="font-semibold text-neutral-600">{currentGroup.name}</span>
            </div>
            <h1 className="text-2xl font-extrabold text-neutral-900 tracking-tight">
              Email Communications Hub
            </h1>
            <p className="text-xs text-neutral-500 mt-1 max-w-2xl">
              Send group announcements or strictly private balance reminders without exposing one member’s figures to another.
            </p>
          </div>

          <div className="flex items-center gap-3 tabular-nums">
            <div className="bg-neutral-50 border border-neutral-200 px-4 py-2.5 rounded-xl text-center">
              <span className="text-[11px] text-neutral-500 block font-medium">
                Active Directory
              </span>
              <span className="text-base font-bold text-neutral-900">
                {activeMembers.length} members
              </span>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 px-4 py-2.5 rounded-xl text-center">
              <span className="text-[11px] text-neutral-500 block font-medium">
                Dispatches Logged
              </span>
              <span className="text-base font-bold text-neutral-900">
                {groupCommunications.length} sent
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-5 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'compose'
                ? 'bg-neutral-900 text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Compose & Dispatch</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-neutral-900 text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Delivery History ({groupCommunications.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('automation')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'automation'
                ? 'bg-neutral-900 text-white font-bold'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Automation Rules</span>
          </button>
        </div>
      </div>

      {dispatchSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-emerald-900 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{dispatchSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setDispatchSuccess(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {dispatchError && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-900 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{dispatchError}</span>
          </div>
          <button
            type="button"
            onClick={() => setDispatchError(null)}
            className="text-rose-700 hover:text-rose-950 font-bold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: COMPOSE & DISPATCH */}
      {activeTab === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                <h2 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#D5A52B]" />
                  <span>Notice Configuration</span>
                </h2>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-neutral-500">Templates:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('announcement')}
                    className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-semibold cursor-pointer"
                  >
                    General
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('financial_reminder')}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold border border-amber-200 cursor-pointer"
                  >
                    Reminder
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate('cleared_balance')}
                    className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200 cursor-pointer"
                  >
                    Cleared
                  </button>
                </div>
              </div>

              <form onSubmit={handleDispatch} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
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
                        className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
                          commType === opt.id
                            ? 'bg-neutral-900 border-neutral-900 text-white'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                        }`}
                      >
                        <span className="font-bold block">{opt.title}</span>
                        <span
                          className={`text-[10px] ${
                            commType === opt.id ? 'text-neutral-300' : 'text-neutral-500'
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
                    <label className="font-semibold uppercase tracking-wider text-neutral-600">
                      Target Audience
                    </label>
                    <span className="font-bold text-neutral-900 flex items-center gap-1 tabular-nums">
                      <Users className="w-3.5 h-3.5 text-[#D5A52B]" />
                      {targetMembers.length} active recipient(s)
                    </span>
                  </div>
                  <select
                    value={targetAudience}
                    onChange={(e) => {
                      setTargetAudience(e.target.value as AudienceType);
                      setPreviewMemberIndex(0);
                    }}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
                    <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                      Select Registered Member
                    </label>
                    <select
                      value={selectedMemberId}
                      onChange={(e) => {
                        setSelectedMemberId(e.target.value);
                        setPreviewMemberIndex(0);
                      }}
                      className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900"
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
                  <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Associated Contribution (Optional)
                  </label>
                  <select
                    value={selectedContributionId}
                    onChange={(e) => setSelectedContributionId(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900"
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
                  <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={previewData.subject}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                    Message Body
                  </label>
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your notice here. Individual member balances and references are automatically attached privately."
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3.5 py-2.5 text-sm text-neutral-900"
                  />
                </div>

                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs text-neutral-600 mb-2">
                    <span className="font-semibold text-neutral-900">
                      Matched Active Recipients ({targetMembers.length})
                    </span>
                    <span className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Suspended/removed excluded
                    </span>
                  </div>
                  {targetMembers.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {targetMembers.map((m, idx) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPreviewMemberIndex(idx)}
                          className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            previewMemberIndex === idx
                              ? 'bg-neutral-900 border-neutral-900 text-white font-semibold'
                              : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-amber-700">
                      No active members match this filter.
                    </p>
                  )}
                </div>

                <div className="pt-2 flex flex-col sm:flex-row gap-3">
                  <button
                    type="submit"
                    disabled={targetMembers.length === 0}
                    className="flex-1 bg-neutral-900 hover:bg-black disabled:bg-neutral-300 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-[#D5A52B]" />
                    <span>Log & Dispatch Notice ({targetMembers.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={openMailtoClient}
                    disabled={targetMembers.length === 0}
                    className="bg-white hover:bg-neutral-50 disabled:opacity-50 text-neutral-800 px-4 py-3 rounded-xl border border-neutral-200 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap"
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
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-[#D5A52B]" />
                  <span className="text-sm font-bold text-neutral-900">
                    Live Recipient Preview
                  </span>
                </div>
                {targetMembers.length > 1 && (
                  <span className="text-[11px] text-neutral-500 tabular-nums">
                    {previewMemberIndex + 1} / {targetMembers.length}
                  </span>
                )}
              </div>

              <div className="border border-neutral-200 rounded-xl overflow-hidden">
                <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200 space-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-500">To:</span>
                    <span className="font-semibold text-neutral-900 truncate">
                      {currentPreviewMember?.name || 'Member'} &lt;
                      {currentPreviewMember?.email || 'member@example.mw'}&gt;
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-neutral-500">Subject:</span>
                    <span className="font-bold text-neutral-900 truncate">
                      {previewData.subject}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3 bg-white text-xs text-neutral-800 leading-relaxed">
                  <div>
                    <h3 className="font-bold text-neutral-900 text-sm">
                      Hello {currentPreviewMember?.name || 'Member'},
                    </h3>
                    <p className="text-[11px] text-neutral-500">
                      Ref:{' '}
                      <span className="font-mono font-semibold text-neutral-800">
                        {currentPreviewMember?.memberRefId || 'MEM-2026'}
                      </span>
                      {currentPreviewMember?.roomNumber
                        ? ` • Unit ${currentPreviewMember.roomNumber}`
                        : ''}
                    </p>
                  </div>

                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 whitespace-pre-line text-neutral-700">
                    {previewData.personalizedSnippet}
                  </div>

                  {commType === 'financial_reminder' &&
                    previewData.outstandingAmount !== undefined && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between tabular-nums">
                        <div>
                          <span className="text-[10px] text-amber-800 uppercase tracking-wider font-bold block">
                            Current Outstanding Balance
                          </span>
                          <span className="text-base font-extrabold text-amber-950">
                            {formatMWK(previewData.outstandingAmount)}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          Private Notice
                        </span>
                      </div>
                    )}

                  <div className="pt-3 border-t border-neutral-100 text-[10px] text-neutral-500">
                    Dispatched privately by administrator{' '}
                    {currentUser?.name || 'Administrator'} via UnitSpot. Member balances are never disclosed to other residents.
                  </div>
                </div>
              </div>

              {targetMembers.length > 1 && (
                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    disabled={previewMemberIndex === 0}
                    onClick={() => setPreviewMemberIndex((prev) => Math.max(0, prev - 1))}
                    className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 text-neutral-800 font-semibold cursor-pointer"
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
                    className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 disabled:opacity-40 text-neutral-800 font-semibold cursor-pointer"
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
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div>
              <h2 className="text-base font-bold text-neutral-900">
                Communication Dispatch Log
              </h2>
              <p className="text-xs text-neutral-500">
                Audited history of group notices, payment confirmations, and reminders
              </p>
            </div>
            <span className="text-xs font-bold bg-neutral-100 text-neutral-800 px-3 py-1 rounded-lg tabular-nums">
              {groupCommunications.length} Sent
            </span>
          </div>

          {groupCommunications.length === 0 ? (
            <div className="text-center py-12 text-neutral-400 text-xs">
              <Mail className="w-8 h-8 mx-auto text-neutral-300 mb-2" />
              <p>No communications dispatched yet for {currentGroup.name}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groupCommunications.map((item) => (
                <div
                  key={item.id}
                  className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="px-2 py-0.5 rounded font-bold uppercase bg-neutral-900 text-white">
                        {item.type.replace('_', ' ')}
                      </span>
                      <span className="text-neutral-500 tabular-nums">
                        {new Date(item.sentAt).toLocaleString()}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-neutral-900">{item.subject}</h4>
                    <p className="text-xs text-neutral-600 line-clamp-1">{item.message}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 tabular-nums">
                    <div className="text-right text-xs">
                      <span className="font-bold text-neutral-900 block">
                        {item.deliveredCount} / {item.recipientCount} Delivered
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryItem(item)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-800 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <span>Recipients</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedHistoryItem && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-neutral-200 rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                  <div>
                    <span className="text-[11px] font-bold text-[#D5A52B] uppercase tracking-wider block">
                      Dispatch Recipients
                    </span>
                    <h3 className="text-lg font-bold text-neutral-900">
                      {selectedHistoryItem.subject}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedHistoryItem(null)}
                    className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedHistoryItem.recipients.map((r) => (
                    <div
                      key={r.memberId}
                      className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-neutral-900">{r.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {r.deliveryStatus}
                        </span>
                      </div>
                      <p className="text-neutral-500">
                        {r.email} {r.phone ? `• ${r.phone}` : ''}
                      </p>
                      {r.outstandingAmount !== undefined && (
                        <p className="text-amber-800 font-semibold tabular-nums">
                          Balance Referenced: {formatMWK(r.outstandingAmount)}
                        </p>
                      )}
                      <div className="bg-white border border-neutral-200 p-2.5 rounded text-[11px] text-neutral-700 whitespace-pre-line">
                        {r.personalizedSnippet}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUTOMATION RULES */}
      {activeTab === 'automation' && (
        <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="pb-3 border-b border-neutral-100">
            <h2 className="text-base font-bold text-neutral-900">
              Automated Notification Triggers
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
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
                className="flex items-start justify-between p-4 rounded-xl bg-neutral-50 border border-neutral-200"
              >
                <div className="space-y-1 pr-4">
                  <span className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                    <Icon className="w-4 h-4 text-[#D5A52B]" />
                    <span>{rule.title}</span>
                  </span>
                  <p className="text-xs text-neutral-600">{rule.desc}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={notificationConfig[rule.key]}
                    onChange={(e) =>
                      updateNotificationConfig({ [rule.key]: e.target.checked })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neutral-900" />
                </label>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
