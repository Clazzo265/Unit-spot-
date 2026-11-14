import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Group, GroupMember, StoveType, User } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import {
  RATES,
  STOVE_TYPE_LABELS,
  isValidStoveType,
  resolveMemberInfo,
} from '../../utils/financialConfig';
import { canUserManageGroup } from '../../utils/centralizedFinancialAdmin';
import {
  Building2,
  Users,
  Plus,
  Share2,
  Copy,
  Check,
  UserPlus,
  UserMinus,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  X,
  Edit3,
  Archive,
  ArrowRightLeft,
  Flame,
  Zap,
  UserCheck,
  PauseCircle,
} from 'lucide-react';
import { MemberWelcomeModal } from './MemberWelcomeModal';

export const GroupManagementView: React.FC = () => {
  const {
    groups,
    currentGroup,
    setCurrentGroup,
    groupMembers,
    users,
    createGroup,
    updateGroup,
    archiveGroup,
    transferGroupOwnership,
    addMemberToGroup,
    updateMemberStoveType,
    suspendMember,
    reinstateMember,
    changeMemberRole,
    removeMemberFromGroup,
    currentUser,
  } = useApp();

  const isGroupAdmin = canUserManageGroup(currentUser?.role);

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Group['category']>('house');
  const [description, setDescription] = useState('');
  const [paymentRules, setPaymentRules] = useState(
    'All monthly contributions due by the agreed deadline. Partial payments require a clear commitment deadline.'
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Edit Group Modal
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupRules, setEditGroupRules] = useState('');

  // Archive Group Modal
  const [isArchivingGroup, setIsArchivingGroup] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  // Transfer Ownership Modal
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferCandidateId, setTransferCandidateId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Add Member Modal State
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('+265 ');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'treasurer' | 'member'>('member');
  const [newMemberStoveType, setNewMemberStoveType] = useState<StoveType | ''>('');
  const [newMemberRoom, setNewMemberRoom] = useState('');
  const [newMemberNotes, setNewMemberNotes] = useState('');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  // Stove Update Modal
  const [stoveModalMember, setStoveModalMember] = useState<GroupMember | null>(null);
  const [stoveModalType, setStoveModalType] = useState<StoveType>('non_electric');
  const [stoveModalReason, setStoveModalReason] = useState('');
  const [stoveModalError, setStoveModalError] = useState('');

  // Role Change Modal
  const [roleModalMember, setRoleModalMember] = useState<GroupMember | null>(null);
  const [roleModalValue, setRoleModalValue] = useState<'admin' | 'treasurer' | 'member'>('member');
  const [roleModalReason, setRoleModalReason] = useState('');

  // Welcome Modal State
  const [newlyAddedMember, setNewlyAddedMember] = useState<User | null>(null);
  const [newlyAddedStoveType, setNewlyAddedStoveType] = useState<StoveType | undefined>(undefined);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);

  // Member Removal / Suspension State
  const [memberToRemove, setMemberToRemove] = useState<{
    memberId: string;
    name: string;
  } | null>(null);
  const [removalReason, setRemovalReason] = useState('Tenant moved out / lease ended');

  const [memberToSuspend, setMemberToSuspend] = useState<{
    memberId: string;
    name: string;
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  // Directory filter
  const [directoryFilter, setDirectoryFilter] = useState<'active' | 'suspended' | 'departed'>(
    'active'
  );

  const activeGroups = useMemo(
    () => groups.filter((g) => g.status !== 'archived'),
    [groups]
  );

  const activeMembers = useMemo(() => {
    if (!currentGroup) return [];
    return groupMembers.filter(
      (gm) => gm.groupId === currentGroup.id && gm.status === 'active'
    );
  }, [currentGroup, groupMembers]);

  const suspendedMembers = useMemo(() => {
    if (!currentGroup) return [];
    return groupMembers.filter(
      (gm) => gm.groupId === currentGroup.id && gm.status === 'suspended'
    );
  }, [currentGroup, groupMembers]);

  const departedMembers = useMemo(() => {
    if (!currentGroup) return [];
    return groupMembers.filter(
      (gm) =>
        gm.groupId === currentGroup.id &&
        (gm.status === 'departed' || gm.status === 'removed')
    );
  }, [currentGroup, groupMembers]);

  const displayedMembers =
    directoryFilter === 'active'
      ? activeMembers
      : directoryFilter === 'suspended'
        ? suspendedMembers
        : departedMembers;

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createGroup({
      name: name.trim(),
      category,
      description: description.trim(),
      paymentRules: paymentRules.trim(),
      defaultCurrency: 'MWK',
    });

    setName('');
    setDescription('');
    setIsCreating(false);
    setFeedbackBanner('New financial group created successfully.');
  };

  const openEditGroup = () => {
    if (!currentGroup) return;
    setEditGroupName(currentGroup.name);
    setEditGroupDesc(currentGroup.description);
    setEditGroupRules(currentGroup.paymentRules);
    setIsEditingGroup(true);
  };

  const handleSaveGroupEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;
    const res = updateGroup(currentGroup.id, {
      name: editGroupName.trim(),
      description: editGroupDesc.trim(),
      paymentRules: editGroupRules.trim(),
    });
    if (!res.success) {
      setErrorBanner(res.error || 'Could not update group.');
      return;
    }
    setIsEditingGroup(false);
    setFeedbackBanner(`Group "${editGroupName.trim()}" updated.`);
  };

  const handleConfirmArchive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;
    const res = archiveGroup(currentGroup.id, archiveReason);
    if (!res.success) {
      setErrorBanner(res.error || 'Could not archive group.');
      return;
    }
    setIsArchivingGroup(false);
    setArchiveReason('');
    setFeedbackBanner(`Group "${currentGroup.name}" archived safely.`);
  };

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || !transferCandidateId) return;
    const res = transferGroupOwnership(currentGroup.id, transferCandidateId, transferReason);
    if (!res.success) {
      setErrorBanner(res.error || 'Ownership transfer failed.');
      return;
    }
    setIsTransferring(false);
    setTransferCandidateId('');
    setTransferReason('');
    setFeedbackBanner(`Ownership of "${currentGroup.name}" transferred and logged.`);
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setAddMemberError(null);

    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      setAddMemberError('Full name and email address are required.');
      return;
    }

    if (!isValidStoveType(newMemberStoveType)) {
      setAddMemberError(
        'Please select a stove classification (Electric Stove — MK 10,000 or Non-Electric Stove — MK 5,000).'
      );
      return;
    }

    const result = addMemberToGroup({
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      phone: newMemberPhone.trim(),
      role: newMemberRole,
      stoveType: newMemberStoveType,
      roomNumber: newMemberRoom.trim() || undefined,
      notes: newMemberNotes.trim() || undefined,
    });

    if (!result.success) {
      setAddMemberError(result.error || 'Failed to register member. Please check details.');
      return;
    }

    if (result.user) {
      setNewlyAddedMember(result.user);
      setNewlyAddedStoveType(newMemberStoveType);
      setIsWelcomeModalOpen(true);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPhone('+265 ');
      setNewMemberStoveType('');
      setNewMemberRoom('');
      setNewMemberNotes('');
      setIsAddingMember(false);
    }
  };

  const handleSaveStoveType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stoveModalMember) return;
    setStoveModalError('');
    const res = updateMemberStoveType(stoveModalMember.id, stoveModalType, stoveModalReason);
    if (!res.success) {
      setStoveModalError(res.error || 'Failed to update stove classification.');
      return;
    }
    setFeedbackBanner(
      `Stove classification for ${stoveModalMember.name} set to ${STOVE_TYPE_LABELS[stoveModalType]} (${formatMWK(RATES[stoveModalType])}).`
    );
    setStoveModalMember(null);
    setStoveModalReason('');
  };

  const handleConfirmRemove = () => {
    if (!memberToRemove) return;
    const ok = removeMemberFromGroup(memberToRemove.memberId, removalReason);
    if (ok) {
      setFeedbackBanner(
        `${memberToRemove.name} moved to Departed / Removed. Financial history preserved.`
      );
    }
    setMemberToRemove(null);
    setRemovalReason('Tenant moved out / lease ended');
  };

  const handleConfirmSuspend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberToSuspend) return;
    const res = suspendMember(memberToSuspend.memberId, suspendReason);
    if (!res.success) {
      setErrorBanner(res.error || 'Could not suspend member.');
    } else {
      setFeedbackBanner(`${memberToSuspend.name} suspended.`);
    }
    setMemberToSuspend(null);
    setSuspendReason('');
  };

  const handleSaveRoleChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleModalMember) return;
    const res = changeMemberRole(roleModalMember.id, roleModalValue, roleModalReason);
    if (!res.success) {
      setErrorBanner(res.error || 'Could not change role.');
    } else {
      setFeedbackBanner(`Updated role for ${roleModalMember.name} to ${roleModalValue}.`);
    }
    setRoleModalMember(null);
    setRoleModalReason('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Group Management & Directory
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Manage shared houses, student hostels, stove contribution tiers, and resident lifecycles
          </p>
        </div>

        {isGroupAdmin && (
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#D5A52B]" />
            <span>Create New Group</span>
          </button>
        )}
      </div>

      {feedbackBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900">
          <span className="font-semibold">{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="font-bold text-emerald-700 hover:text-emerald-950 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900">
          <span className="font-semibold">{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="font-bold text-rose-700 hover:text-rose-950 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Group Selector Cards */}
      {activeGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-xs text-neutral-500">
          <Building2 className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
          <h4 className="font-bold text-neutral-800 text-sm">No Active Financial Groups</h4>
          <p className="mt-1 max-w-sm mx-auto text-neutral-500">
            Create your first group to manage shared utilities, accommodation bills, or department funds.
          </p>
          {isGroupAdmin && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="mt-4 bg-neutral-900 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
            >
              Create First Group
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeGroups.map((g) => {
            const isSelected = currentGroup?.id === g.id;
            const membersCount = groupMembers.filter(
              (gm) => gm.groupId === g.id && gm.status === 'active'
            ).length;

            return (
              <div
                key={g.id}
                onClick={() => setCurrentGroup(g)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-md ring-2 ring-neutral-900'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-900'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                        isSelected ? 'bg-white/10 text-white' : 'bg-neutral-100 text-neutral-900'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight">{g.name}</h3>
                      <span
                        className={`text-[11px] uppercase tracking-wider font-semibold ${
                          isSelected ? 'text-neutral-400' : 'text-neutral-500'
                        }`}
                      >
                        {g.category} • {g.defaultCurrency}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md uppercase tracking-wider whitespace-nowrap">
                      Active Group
                    </span>
                  )}
                </div>

                <p
                  className={`text-xs mt-3 line-clamp-2 ${
                    isSelected ? 'text-neutral-300' : 'text-neutral-600'
                  }`}
                >
                  {g.description || 'No description provided.'}
                </p>

                <div
                  className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                    isSelected ? 'border-white/10 text-neutral-300' : 'border-neutral-100 text-neutral-500'
                  }`}
                >
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <Users className="w-3.5 h-3.5" />
                    <span>{membersCount} active members</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(g.joinCode);
                    }}
                    className={`inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-md border cursor-pointer ${
                      isSelected
                        ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                    title="Click to copy group code"
                  >
                    {copiedCode === g.joinCode ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    {g.joinCode}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Group Details & Member Directory */}
      {currentGroup && (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold uppercase tracking-wider text-neutral-400">
                  Directory
                </span>
                <span className="text-neutral-300">•</span>
                <span className="font-semibold text-neutral-600">{currentGroup.name}</span>
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mt-1">
                Group Members & Stove Rate Tiers
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isGroupAdmin && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAddMemberError(null);
                      setIsAddingMember(true);
                    }}
                    className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Member</span>
                  </button>
                  <button
                    type="button"
                    onClick={openEditGroup}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Group</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTransferring(true)}
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transfer Ownership</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsArchivingGroup(true)}
                    className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive</span>
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => handleCopy(currentGroup.joinCode)}
                className="inline-flex items-center gap-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>
                  Code: <span className="font-mono">{currentGroup.joinCode}</span>
                </span>
              </button>
            </div>
          </div>

          {/* Directory Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 pb-3">
            <button
              type="button"
              onClick={() => setDirectoryFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                directoryFilter === 'active'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              Active ({activeMembers.length})
            </button>
            <button
              type="button"
              onClick={() => setDirectoryFilter('suspended')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                directoryFilter === 'suspended'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              Suspended ({suspendedMembers.length})
            </button>
            <button
              type="button"
              onClick={() => setDirectoryFilter('departed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                directoryFilter === 'departed'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              Moved Out / Removed ({departedMembers.length})
            </button>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 uppercase tracking-wider text-[11px]">
                  <th className="pb-3 font-semibold">Member</th>
                  <th className="pb-3 font-semibold">Stove Tier & Rate</th>
                  <th className="pb-3 font-semibold">Role</th>
                  <th className="pb-3 font-semibold">Phone</th>
                  <th className="pb-3 font-semibold">Unit / Room</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {displayedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-400">
                      {directoryFilter === 'active'
                        ? 'No active members enrolled in this group yet.'
                        : directoryFilter === 'suspended'
                          ? 'No suspended members.'
                          : 'No departed or removed members recorded.'}
                    </td>
                  </tr>
                ) : (
                  displayedMembers.map((member) => {
                    const resolved = resolveMemberInfo(member.id, groupMembers, users);
                    const isSelf = member.userId === currentUser?.id || member.id === currentUser?.id;
                    const hasStove = isValidStoveType(member.stoveType);

                    return (
                      <tr key={member.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="py-3.5 pr-3">
                          <div className="flex items-center gap-2.5">
                            {resolved?.avatarUrl ? (
                              <img
                                src={resolved.avatarUrl}
                                alt={member.name}
                                className="w-8 h-8 rounded-full object-cover border border-neutral-200"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center text-xs shrink-0">
                                {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-neutral-900 flex items-center gap-1.5 flex-wrap">
                                <span>{member.name}</span>
                                {member.memberRefId && (
                                  <span className="font-mono text-[10px] bg-neutral-100 text-neutral-700 border border-neutral-200 px-1.5 py-0.5 rounded font-semibold">
                                    {member.memberRefId}
                                  </span>
                                )}
                                {isSelf && (
                                  <span className="text-[10px] bg-neutral-900 text-white px-1.5 py-0.5 rounded font-semibold">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-500">{member.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 pr-3 tabular-nums">
                          {hasStove ? (
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${
                                  member.stoveType === 'electric'
                                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : 'bg-neutral-100 text-neutral-800 border-neutral-200'
                                }`}
                              >
                                {member.stoveType === 'electric' ? (
                                  <Zap className="w-3 h-3 text-amber-600" />
                                ) : (
                                  <Flame className="w-3 h-3 text-neutral-600" />
                                )}
                                {STOVE_TYPE_LABELS[member.stoveType!]} •{' '}
                                {formatMWK(RATES[member.stoveType!])}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
                              <AlertTriangle className="w-3 h-3" />
                              Review Needed
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 pr-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${
                              member.roleInGroup === 'admin'
                                ? 'bg-neutral-900 text-white'
                                : member.roleInGroup === 'treasurer'
                                  ? 'bg-amber-100 text-amber-900'
                                  : 'bg-neutral-100 text-neutral-700'
                            }`}
                          >
                            {member.roleInGroup}
                          </span>
                        </td>

                        <td className="py-3.5 pr-3 font-mono text-[11px] text-neutral-600 whitespace-nowrap">
                          {member.phone || '—'}
                        </td>

                        <td className="py-3.5 pr-3 text-neutral-600">
                          {member.roomNumber || 'Main unit'}
                        </td>

                        <td className="py-3.5 pr-3">
                          {member.status === 'active' ? (
                            <span className="text-emerald-700 font-semibold">Active</span>
                          ) : member.status === 'suspended' ? (
                            <span
                              className="text-amber-700 font-semibold"
                              title={member.suspensionReason}
                            >
                              Suspended
                            </span>
                          ) : (
                            <span
                              className="text-neutral-500 font-semibold"
                              title={member.removalReason || member.departureReason}
                            >
                              {member.status === 'departed' ? 'Moved Out' : 'Removed'}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 text-right">
                          {isGroupAdmin && (
                            <div className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                              {member.status === 'active' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStoveModalMember(member);
                                      setStoveModalType(
                                        isValidStoveType(member.stoveType)
                                          ? member.stoveType
                                          : 'non_electric'
                                      );
                                      setStoveModalReason('');
                                      setStoveModalError('');
                                    }}
                                    className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                                  >
                                    {hasStove ? 'Stove Tier' : 'Classify Stove'}
                                  </button>

                                  {!isSelf && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setRoleModalMember(member);
                                          setRoleModalValue(member.roleInGroup);
                                          setRoleModalReason('');
                                        }}
                                        className="text-[11px] font-semibold text-neutral-700 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200 px-2 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                                      >
                                        Role
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMemberToSuspend({
                                            memberId: member.id,
                                            name: member.name,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg border border-amber-200 cursor-pointer whitespace-nowrap"
                                      >
                                        <PauseCircle className="w-3 h-3" />
                                        <span>Suspend</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMemberToRemove({
                                            memberId: member.id,
                                            name: member.name,
                                          })
                                        }
                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg border border-rose-200 cursor-pointer whitespace-nowrap"
                                      >
                                        <UserMinus className="w-3 h-3" />
                                        <span>Remove</span>
                                      </button>
                                    </>
                                  )}
                                </>
                              )}

                              {member.status === 'suspended' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const res = reinstateMember(
                                      member.id,
                                      'Reinstated by administrator'
                                    );
                                    if (res.success) {
                                      setFeedbackBanner(`${member.name} reinstated to Active.`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer whitespace-nowrap"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Reinstate</span>
                                </button>
                              )}

                              {(member.status === 'departed' || member.status === 'removed') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewMemberName(member.name);
                                    setNewMemberEmail(member.email);
                                    setNewMemberPhone(member.phone || '+265 ');
                                    setNewMemberRole(member.roleInGroup);
                                    setNewMemberStoveType(
                                      isValidStoveType(member.stoveType) ? member.stoveType : ''
                                    );
                                    setNewMemberRoom(member.roomNumber || '');
                                    setAddMemberError(null);
                                    setIsAddingMember(true);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 cursor-pointer whitespace-nowrap"
                                >
                                  <span>Re-enroll</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Member Modal (Requires explicit Stove Type) */}
      {isAddingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <h3 className="font-bold text-neutral-900 text-base">
                Register Member in {currentGroup?.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingMember(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4 text-xs overflow-y-auto">
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-neutral-700">
                <span className="font-bold flex items-center gap-1.5 text-neutral-900 mb-0.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D5A52B]" />
                  Centralized Member Registration
                </span>
                Members do not log in. Administrators record their stove rate tier and email for receipts and statements.
              </div>

              {addMemberError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{addMemberError}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Kondwani Banda"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  placeholder="e.g. kbanda@example.mw"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              {/* Mandatory Stove Classification */}
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Stove Classification (Contribution Rate) *
                </label>
                <div className="grid grid-cols-2 gap-2.5 tabular-nums">
                  {(['electric', 'non_electric'] as const).map((tier) => (
                    <label
                      key={tier}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        newMemberStoveType === tier
                          ? 'border-neutral-900 bg-neutral-900 text-white shadow-xs'
                          : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="stoveType"
                        value={tier}
                        checked={newMemberStoveType === tier}
                        onChange={() => setNewMemberStoveType(tier)}
                        className="sr-only"
                      />
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        {tier === 'electric' ? (
                          <Zap className="w-3.5 h-3.5 text-[#D5A52B]" />
                        ) : (
                          <Flame className="w-3.5 h-3.5 text-[#D5A52B]" />
                        )}
                        <span>{STOVE_TYPE_LABELS[tier]}</span>
                      </div>
                      <div
                        className={`text-xs font-extrabold mt-1 ${
                          newMemberStoveType === tier ? 'text-emerald-300' : 'text-neutral-600'
                        }`}
                      >
                        {formatMWK(RATES[tier])} / cycle
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Phone Number (Malawi +265)
                </label>
                <input
                  type="text"
                  placeholder="+265 999 123 456"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Role in Group *
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={(e) =>
                      setNewMemberRole(e.target.value as 'admin' | 'treasurer' | 'member')
                    }
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="member">Regular Member</option>
                    <option value="treasurer">Treasurer / Collector</option>
                    <option value="admin">Group Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Room / Unit
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room 1"
                    value={newMemberRoom}
                    onChange={(e) => setNewMemberRoom(e.target.value)}
                    className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddingMember(false)}
                  className="px-4 py-2 font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-5 py-2 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Register Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Stove Classification Modal */}
      {stoveModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <h3 className="font-bold text-neutral-900 text-base">
                Classify Stove Rate — {stoveModalMember.name}
              </h3>
              <button
                type="button"
                onClick={() => setStoveModalMember(null)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveStoveType} className="p-6 space-y-4 text-xs">
              {stoveModalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl">
                  {stoveModalError}
                </div>
              )}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-600">
                Updating a member’s stove rate applies to future contributions and logs an immutable audit entry. Historical payments and closed contributions remain untouched.
              </div>
              <div className="grid grid-cols-2 gap-2.5 tabular-nums">
                {(['electric', 'non_electric'] as const).map((tier) => (
                  <label
                    key={tier}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      stoveModalType === tier
                        ? 'border-neutral-900 bg-neutral-900 text-white'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modalStove"
                      value={tier}
                      checked={stoveModalType === tier}
                      onChange={() => setStoveModalType(tier)}
                      className="sr-only"
                    />
                    <div className="font-bold">{STOVE_TYPE_LABELS[tier]}</div>
                    <div className="mt-1 font-extrabold">{formatMWK(RATES[tier])}</div>
                  </label>
                ))}
              </div>
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Audit Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Initial verification of room appliance or switched to hotplate"
                  value={stoveModalReason}
                  onChange={(e) => setStoveModalReason(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStoveModalMember(null)}
                  className="px-4 py-2 font-semibold text-neutral-600 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-5 py-2 font-bold rounded-xl cursor-pointer"
                >
                  Save Classification
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <h3 className="font-bold text-neutral-900 text-base">Create New Group</h3>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Area 10 Shared Flat, Hostel Block C"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900"
                  required
                />
              </div>
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Group['category'])}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900"
                >
                  <option value="house">Shared House / Flat</option>
                  <option value="hostel">University Student Hostel</option>
                  <option value="workplace">Office / Workplace Team</option>
                  <option value="community">Community Water & Electricity</option>
                  <option value="church">Church / Fellowship Group</option>
                  <option value="project">Project / Event Committee</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe group purpose or location..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800"
                />
              </div>
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Payment Rules & Policies
                </label>
                <textarea
                  rows={2}
                  value={paymentRules}
                  onChange={(e) => setPaymentRules(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800"
                />
              </div>
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 font-semibold text-neutral-600 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-5 py-2 font-bold rounded-xl cursor-pointer"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Group Modal */}
      {isEditingGroup && currentGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70">
              <h3 className="font-bold text-neutral-900 text-base">Edit Group Settings</h3>
              <button
                type="button"
                onClick={() => setIsEditingGroup(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveGroupEdit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900"
                />
              </div>
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={editGroupDesc}
                  onChange={(e) => setEditGroupDesc(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800"
                />
              </div>
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Payment Rules
                </label>
                <textarea
                  rows={2}
                  value={editGroupRules}
                  onChange={(e) => setEditGroupRules(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingGroup(false)}
                  className="px-4 py-2 font-semibold text-neutral-600 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-5 py-2 font-bold rounded-xl cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Group Confirmation Modal */}
      {isArchivingGroup && currentGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-4 text-xs">
            <h4 className="font-bold text-neutral-900 text-base">
              Archive Group — {currentGroup.name}
            </h4>
            <p className="text-neutral-600">
              Archiving hides this group from active operations while preserving all historical financial ledgers and audit logs.
            </p>
            <form onSubmit={handleConfirmArchive} className="space-y-3">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Reason for Archiving *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lease term completed / Group dissolved"
                  value={archiveReason}
                  onChange={(e) => setArchiveReason(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsArchivingGroup(false)}
                  className="px-4 py-2 font-semibold text-neutral-600 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
                >
                  Confirm Archive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {isTransferring && currentGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-4 text-xs">
            <h4 className="font-bold text-neutral-900 text-base">
              Transfer Group Ownership
            </h4>
            <form onSubmit={handleConfirmTransfer} className="space-y-3">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Select Active Member *
                </label>
                <select
                  required
                  value={transferCandidateId}
                  onChange={(e) => setTransferCandidateId(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2"
                >
                  <option value="">Choose new group administrator...</option>
                  {activeMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Transfer Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incoming house captain handover"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferring(false)}
                  className="px-4 py-2 font-semibold text-neutral-600 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
                >
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Change Modal */}
      {roleModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-4 text-xs">
            <h4 className="font-bold text-neutral-900 text-base">
              Change Member Role — {roleModalMember.name}
            </h4>
            <form onSubmit={handleSaveRoleChange} className="space-y-3">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  New Role *
                </label>
                <select
                  value={roleModalValue}
                  onChange={(e) =>
                    setRoleModalValue(e.target.value as 'admin' | 'treasurer' | 'member')
                  }
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2"
                >
                  <option value="member">Regular Member</option>
                  <option value="treasurer">Treasurer / Collector</option>
                  <option value="admin">Group Administrator</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Audit Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elected new treasurer"
                  value={roleModalReason}
                  onChange={(e) => setRoleModalReason(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRoleModalMember(null)}
                  className="px-4 py-2 font-semibold text-neutral-600 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
                >
                  Update Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend Member Modal */}
      {memberToSuspend && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 p-6 space-y-4 text-xs">
            <h4 className="font-bold text-neutral-900 text-base">
              Suspend Member — {memberToSuspend.name}
            </h4>
            <p className="text-neutral-600">
              Suspended members retain their historical ledger records and are excluded from routine group broadcasts until reinstated.
            </p>
            <form onSubmit={handleConfirmSuspend} className="space-y-3">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Suspension Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Temporary leave / pending arrears review"
                  value={suspendReason}
                  onChange={(e) => setSuspendReason(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberToSuspend(null)}
                  className="px-4 py-2 font-semibold text-neutral-600 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
                >
                  Confirm Suspension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Removal Confirmation Modal */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-neutral-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-extrabold text-neutral-900 text-base">
                  Remove Member / Record Departure
                </h4>
                <p className="text-xs text-neutral-500">
                  Manage tenant departure from {currentGroup?.name}
                </p>
              </div>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-3.5 border border-neutral-200/80 text-xs space-y-2">
              <p className="text-neutral-700">
                Confirm removing <strong className="text-neutral-900">{memberToRemove.name}</strong> from the active directory?
              </p>
              <div className="text-[11px] text-neutral-500 flex items-start gap-1.5 bg-white p-2.5 rounded-xl border border-neutral-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  All historical contributions, verified payments, and audit logs remain permanently preserved.
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700">
                Departure Reason
              </label>
              <input
                type="text"
                value={removalReason}
                onChange={(e) => setRemovalReason(e.target.value)}
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Confirm Removal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Welcome Modal */}
      <MemberWelcomeModal
        isOpen={isWelcomeModalOpen}
        onClose={() => {
          setIsWelcomeModalOpen(false);
          setNewlyAddedMember(null);
          setNewlyAddedStoveType(undefined);
        }}
        member={newlyAddedMember}
        group={currentGroup}
        stoveType={newlyAddedStoveType}
      />
    </div>
  );
};
