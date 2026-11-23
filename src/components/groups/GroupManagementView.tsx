import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { Group, GroupJoinPolicy, GroupMember, StoveType, User } from '../../types';
import { formatMWK } from '../../utils/financialCalculations';
import {
  RATES,
  STOVE_TYPE_LABELS,
  buildInviteUrl,
  isAccommodationGroup,
  isInviteExpired,
  isValidStoveType,
  resolveMemberInfo,
} from '../../utils/financialConfig';
import {
  GROUP_CATEGORY_LIST,
  getGroupPreset,
} from '../../utils/groupPresets';
import {
  canManageGroupRole,
  validateLeaveGroupEligibility,
} from '../../utils/centralizedFinancialAdmin';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import {
  Building2,
  Users,
  Plus,
  Copy,
  Check,
  UserPlus,
  UserMinus,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Edit3,
  Archive,
  ArrowRightLeft,
  Flame,
  Zap,
  UserCheck,
  PauseCircle,
  Search,
  MessageCircle,
  RefreshCw,
  Link2,
  Lock,
  Unlock,
  Clock,
  X,
  Share2,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';
import { MemberWelcomeModal } from './MemberWelcomeModal';

export const GroupManagementView: React.FC<{
  onOpenJoinGroup?: () => void;
  onNavigateDashboard?: () => void;
}> = ({ onOpenJoinGroup, onNavigateDashboard }) => {
  const {
    groups,
    currentGroup,
    setCurrentGroup,
    groupMembers,
    users,
    joinRequests,
    createGroup,
    updateGroup,
    archiveGroup,
    transferGroupOwnership,
    leaveGroup,
    approveJoinRequest,
    regenerateGroupInvite,
    addMemberToGroup,
    updateMemberStoveType,
    suspendMember,
    reinstateMember,
    changeMemberRole,
    removeMemberFromGroup,
    currentUser,
    effectiveRole,
  } = useApp();
  const { showToast } = useToast();

  const isGroupAdmin = canManageGroupRole(effectiveRole);
  const showStoveFeatures = isAccommodationGroup(currentGroup);
  const currentGroupPreset = useMemo(
    () => getGroupPreset(currentGroup?.category),
    [currentGroup?.category]
  );

  // Create Group Modal (streamlined to 3 core inputs + post-creation invite prompt)
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Group['category']>('house');
  const [description, setDescription] = useState('');
  const [postCreateGroupId, setPostCreateGroupId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState(false);
  const [inviteActionBusy, setInviteActionBusy] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Edit Group Modal (includes joinPolicy & payment rules)
  const [isEditingGroup, setIsEditingGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupRules, setEditGroupRules] = useState('');
  const [editJoinPolicy, setEditJoinPolicy] = useState<GroupJoinPolicy>('code_auto');

  // Archive Group Modal
  const [isArchivingGroup, setIsArchivingGroup] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');

  // Transfer Ownership Modal
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferCandidateId, setTransferCandidateId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  // Add Member Modal State (clean directory entry — no stove fields)
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('+265 ');
  const [newMemberRoom, setNewMemberRoom] = useState('');
  const [newMemberNotes, setNewMemberNotes] = useState('');
  const [addMemberError, setAddMemberError] = useState<string | null>(null);

  // Accommodation-Only Electricity Stove Settings & Single-Member Modal
  const [isStoveSettingsOpen, setIsStoveSettingsOpen] = useState(false);
  const [stoveModalMember, setStoveModalMember] = useState<GroupMember | null>(null);
  const [stoveModalType, setStoveModalType] = useState<StoveType>('non_electric');
  const [stoveModalReason, setStoveModalReason] = useState('');
  const [stoveModalError, setStoveModalError] = useState('');

  // Leave Group Confirmation Modal State
  const [isLeavingGroup, setIsLeavingGroup] = useState(false);
  const [leaveTransferCandidateId, setLeaveTransferCandidateId] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

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
  const [removalReason, setRemovalReason] = useState('Member left the group');

  const [memberToSuspend, setMemberToSuspend] = useState<{
    memberId: string;
    name: string;
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  // Directory filter (all 5 membership states) & live search
  const [directoryFilter, setDirectoryFilter] = useState<
    'active' | 'invited' | 'left' | 'removed' | 'suspended'
  >('active');
  const [memberSearch, setMemberSearch] = useState('');

  const activeGroups = useMemo(
    () => groups.filter((g) => g.status !== 'archived'),
    [groups]
  );

  const postCreatedGroup = useMemo(
    () => (postCreateGroupId ? groups.find((g) => g.id === postCreateGroupId) || null : null),
    [groups, postCreateGroupId]
  );

  const pendingJoinRequests = useMemo(() => {
    if (!currentGroup) return [];
    return joinRequests.filter((r) => r.groupId === currentGroup.id && r.status === 'pending');
  }, [currentGroup, joinRequests]);

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

  const leftMembers = useMemo(() => {
    if (!currentGroup) return [];
    return groupMembers.filter(
      (gm) => gm.groupId === currentGroup.id && gm.status === 'departed'
    );
  }, [currentGroup, groupMembers]);

  const removedMembers = useMemo(() => {
    if (!currentGroup) return [];
    return groupMembers.filter(
      (gm) => gm.groupId === currentGroup.id && gm.status === 'removed'
    );
  }, [currentGroup, groupMembers]);

  const leaveEligibility = useMemo(() => {
    if (!currentGroup || !currentUser) return null;
    return validateLeaveGroupEligibility({
      userId: currentUser.id,
      group: currentGroup,
      groupMembers,
      transferToMemberId: leaveTransferCandidateId || undefined,
    });
  }, [currentGroup, currentUser, groupMembers, leaveTransferCandidateId]);

  const displayedMembers = useMemo(() => {
    if (directoryFilter === 'invited') return [];
    const base =
      directoryFilter === 'active'
        ? activeMembers
        : directoryFilter === 'suspended'
          ? suspendedMembers
          : directoryFilter === 'left'
            ? leftMembers
            : removedMembers;

    const q = memberSearch.trim().toLowerCase();
    if (!q) return base;

    return base.filter((m) =>
      `${m.name} ${m.email} ${m.roomNumber || ''} ${m.memberRefId || ''} ${m.phone || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [directoryFilter, activeMembers, suspendedMembers, leftMembers, removedMembers, memberSearch]);

  const filteredInvitedRequests = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return pendingJoinRequests;
    return pendingJoinRequests.filter((r) =>
      `${r.name} ${r.email} ${r.phone || ''}`.toLowerCase().includes(q)
    );
  }, [pendingJoinRequests, memberSearch]);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast('Invite Code Copied', { message: `Invite code ${code} copied to clipboard.` });
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyInviteLink = (code: string) => {
    const url = buildInviteUrl(code);
    navigator.clipboard.writeText(url);
    setCopiedInviteUrl(true);
    showToast('Invite Link Copied', { message: 'Share this link on WhatsApp or SMS.' });
    setTimeout(() => setCopiedInviteUrl(false), 2000);
  };

  const handleShareInviteLink = async (group: Group) => {
    const url = buildInviteUrl(group.joinCode);
    const shareText = `Join "${group.name}" on UNIT SPOT.\nInvite code: ${group.joinCode}\nLink: ${url}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Join ${group.name} on UNIT SPOT`,
          text: shareText,
          url,
        });
        return;
      } catch {
        // User cancelled or share unsupported — fall back to clipboard copy
      }
    }
    navigator.clipboard.writeText(shareText);
    setCopiedInviteUrl(true);
    showToast('Invitation Ready to Share', {
      message: 'Copied invitation message & link to your clipboard.',
    });
    setTimeout(() => setCopiedInviteUrl(false), 2000);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const createdId = createGroup({
      name: name.trim(),
      category,
      joinPolicy: 'code_auto',
      description: description.trim(),
      paymentRules: '',
      defaultCurrency: 'MWK',
    });

    showToast('Group Created', {
      message: `${name.trim()} is active. Invite members by link or code.`,
    });
    setName('');
    setDescription('');
    setIsCreating(false);
    if (createdId) {
      setPostCreateGroupId(createdId);
    }
  };

  const openEditGroup = () => {
    if (!currentGroup) return;
    setEditGroupName(currentGroup.name);
    setEditGroupDesc(currentGroup.description);
    setEditGroupRules(currentGroup.paymentRules);
    setEditJoinPolicy(currentGroup.joinPolicy || 'code_auto');
    setIsEditingGroup(true);
  };

  const handleSaveGroupEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;
    const res = updateGroup(currentGroup.id, {
      name: editGroupName.trim(),
      description: editGroupDesc.trim(),
      paymentRules: editGroupRules.trim(),
      joinPolicy: editJoinPolicy,
    });
    if (!res.success) {
      setErrorBanner(res.error || 'Could not update group.');
      return;
    }
    setIsEditingGroup(false);
    showToast('Group Updated', { message: `Changes saved for "${editGroupName.trim()}".` });
  };

  const handleConfirmArchive = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup) return;
    const groupTitle = currentGroup.name;
    const res = archiveGroup(currentGroup.id, archiveReason);
    if (!res.success) {
      setErrorBanner(res.error || 'Could not archive group.');
      return;
    }
    setIsArchivingGroup(false);
    setArchiveReason('');
    showToast('Group Archived', {
      message: `"${groupTitle}" moved to archived state with ledgers preserved.`,
      variant: 'info',
    });
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
    showToast('Ownership Transferred', {
      message: `Ownership of "${currentGroup.name}" updated and audited.`,
    });
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    setAddMemberError(null);

    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      setAddMemberError('Full name and email address are required.');
      return;
    }

    const result = addMemberToGroup({
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      phone: newMemberPhone.trim(),
      role: 'member',
      roomNumber: newMemberRoom.trim() || undefined,
      notes: newMemberNotes.trim() || undefined,
    });

    if (!result.success) {
      setAddMemberError(result.error || 'Failed to register member. Please check details.');
      return;
    }

    if (result.user) {
      showToast('Member Added', {
        message: `${result.user.name} added to ${currentGroup?.name}.`,
      });
      setNewlyAddedMember(result.user);
      setNewlyAddedStoveType(undefined);
      setIsWelcomeModalOpen(true);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPhone('+265 ');
      setNewMemberRoom('');
      setNewMemberNotes('');
      setIsAddingMember(false);
    }
  };

  const handleConfirmLeaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentGroup || leaveBusy) return;
    setLeaveError(null);
    setLeaveBusy(true);
    const groupTitle = currentGroup.name;
    const res = await leaveGroup(currentGroup.id, {
      transferToMemberId: leaveTransferCandidateId || undefined,
      reason: leaveReason,
    });
    setLeaveBusy(false);
    if (!res.success) {
      setLeaveError(res.error || 'Could not leave group right now.');
      return;
    }
    setIsLeavingGroup(false);
    setLeaveTransferCandidateId('');
    setLeaveReason('');
    showToast('Left Group', {
      message: `You have left "${groupTitle}". Your historical payment records remain preserved.`,
      variant: 'info',
    });
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
    showToast('Stove Tier Updated', {
      message: `${stoveModalMember.name}: ${STOVE_TYPE_LABELS[stoveModalType]} (${formatMWK(RATES[stoveModalType])}).`,
    });
    setStoveModalMember(null);
    setStoveModalReason('');
  };

  const handleConfirmRemove = () => {
    if (!memberToRemove) return;
    const ok = removeMemberFromGroup(memberToRemove.memberId, removalReason);
    if (ok) {
      showToast('Member Marked Departed', {
        message: `${memberToRemove.name} moved to Moved Out / Removed. Financial history preserved.`,
        variant: 'info',
      });
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
      showToast('Member Suspended', {
        message: `${memberToSuspend.name} moved to Suspended directory.`,
        variant: 'info',
      });
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
      showToast('Role Updated', {
        message: `${roleModalMember.name} is now ${roleModalValue}.`,
      });
    }
    setRoleModalMember(null);
    setRoleModalReason('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isGroupAdmin ? 'Group & Members' : 'My Groups'}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage your groups, invite members by link or code, and view directory roles
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-[#E5B93C] dark:text-white" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {errorBanner && (
        <div
          role="alert"
          className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-center justify-between text-xs text-rose-900 dark:text-rose-200"
        >
          <span className="font-semibold">{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            className="min-h-[36px] px-2 font-bold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Group Selector Cards */}
      {activeGroups.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No Groups Joined Yet"
          description="Create your first group in Malawi Kwacha or join an existing group using an invite code."
          actionLabel="Create First Group"
          onAction={() => setIsCreating(true)}
          secondaryActionLabel={onOpenJoinGroup ? 'Join with Invite Code' : undefined}
          onSecondaryAction={onOpenJoinGroup}
        />
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
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setCurrentGroup(g)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setCurrentGroup(g);
                  }
                }}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
                  isSelected
                    ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-[#131D33] text-white shadow-md ring-1 ring-slate-900 dark:ring-blue-500/60'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0D1424] hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-slate-100'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                        isSelected
                          ? 'bg-white/10 dark:bg-blue-500/20 text-white'
                          : 'bg-slate-100 dark:bg-[#11192C] text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base leading-tight truncate">{g.name}</h3>
                      <span
                        className={`text-[11px] uppercase tracking-wider font-semibold ${
                          isSelected
                            ? 'text-slate-300 dark:text-cyan-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {getGroupPreset(g.category).label} · {g.defaultCurrency}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="text-[11px] font-bold text-emerald-400 whitespace-nowrap">
                      Active
                    </span>
                  )}
                </div>

                <p
                  className={`text-xs mt-3 line-clamp-2 ${
                    isSelected ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {g.description || 'No description provided.'}
                </p>

                <div
                  className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                    isSelected
                      ? 'border-white/10 text-slate-300'
                      : 'border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-1.5 tabular-nums">
                    <Users className="w-3.5 h-3.5" />
                    <span>{membersCount} active members</span>
                  </div>

                  <span className={`text-[11px] font-semibold ${isSelected ? 'text-cyan-200' : 'text-slate-500 dark:text-slate-400'}`}>
                    {isSelected ? 'Currently selected' : 'Select group'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Group Details & Member Directory */}
      {currentGroup && (
        <div className="bg-white dark:bg-[#0D1424] rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Directory
                </span>
                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                  ·
                </span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {currentGroup.name}
                </span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {showStoveFeatures ? 'Group Members & Stove Tiers' : 'Group Members & Roles'}
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
                    className="min-h-[44px] inline-flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add roster member</span>
                  </button>
                  {showStoveFeatures && (
                    <button
                      type="button"
                      onClick={() => setIsStoveSettingsOpen(true)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Flame className="w-3.5 h-3.5" />
                      <span>Electricity Stove Settings</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openEditGroup}
                    className="min-h-[44px] inline-flex items-center gap-1.5 bg-white dark:bg-[#11192C] hover:bg-slate-50 dark:hover:bg-[#18233D] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Group</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsTransferring(true)}
                    className="min-h-[44px] inline-flex items-center gap-1.5 bg-white dark:bg-[#11192C] hover:bg-slate-50 dark:hover:bg-[#18233D] text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Transfer Ownership</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsArchivingGroup(true)}
                    className="min-h-[44px] inline-flex items-center gap-1.5 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  setLeaveError(null);
                  setLeaveTransferCandidateId('');
                  setLeaveReason('');
                  setIsLeavingGroup(true);
                }}
                className="min-h-[44px] inline-flex items-center gap-1.5 bg-white dark:bg-[#11192C] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Group</span>
              </button>
            </div>
          </div>

          {/* Invite & Join Requests Panel */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Invite Members by Link or Code
                  </span>
                  {currentGroup.inviteRevoked ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                      <Lock className="w-3 h-3" />
                      Invites Paused
                    </span>
                  ) : isInviteExpired(currentGroup.inviteExpiresAt, currentGroup.inviteExpiresAtMs) ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                      <Clock className="w-3 h-3" />
                      Invite Expired — Generate a new code
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <Unlock className="w-3 h-3" />
                      {currentGroup.joinPolicy === 'admin_approval'
                        ? 'Admin approval required'
                        : 'Instant join active'}
                      {currentGroup.inviteExpiresAt && (
                        <span className="text-slate-500 dark:text-slate-400 font-normal ml-1">
                          (Expires {new Date(currentGroup.inviteExpiresAt).toLocaleDateString()})
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                  {buildInviteUrl(currentGroup.joinCode)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(currentGroup.joinCode)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  {copiedCode === currentGroup.joinCode ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{currentGroup.joinCode}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyInviteLink(currentGroup.joinCode)}
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  {copiedInviteUrl ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedInviteUrl ? 'Copied Link' : 'Copy Link'}</span>
                </button>

                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Join "${currentGroup.name}" on UNIT SPOT.\nInvite code: ${currentGroup.joinCode}\nLink: ${buildInviteUrl(
                      currentGroup.joinCode
                    )}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[38px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </a>
              </div>
            </div>

            {isGroupAdmin && (
              <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={inviteActionBusy}
                    onClick={async () => {
                      setInviteActionBusy(true);
                      const nextPolicy: GroupJoinPolicy =
                        currentGroup.joinPolicy === 'admin_approval' ? 'code_auto' : 'admin_approval';
                      const res = await regenerateGroupInvite(currentGroup.id, {
                        joinPolicy: nextPolicy,
                      });
                      setInviteActionBusy(false);
                      if (res.success) {
                        showToast('Join Policy Updated', {
                          message:
                            nextPolicy === 'admin_approval'
                              ? 'New members will wait for your approval before joining.'
                              : 'Anyone with the invite code can join immediately.',
                        });
                      }
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-[#18233D] cursor-pointer"
                  >
                    Switch to{' '}
                    {currentGroup.joinPolicy === 'admin_approval'
                      ? 'Instant Join'
                      : 'Admin Approval'}
                  </button>

                  <button
                    type="button"
                    disabled={inviteActionBusy}
                    onClick={async () => {
                      setInviteActionBusy(true);
                      const res = await regenerateGroupInvite(currentGroup.id, {
                        regenerate: true,
                      });
                      setInviteActionBusy(false);
                      if (res.success) {
                        showToast('New Invite Code Generated', {
                          message: 'Previous invite link has been replaced.',
                        });
                      }
                    }}
                    className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-[#18233D] cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>New Code</span>
                  </button>

                  <button
                    type="button"
                    disabled={inviteActionBusy}
                    onClick={async () => {
                      setInviteActionBusy(true);
                      const nextRevoke = !currentGroup.inviteRevoked;
                      const res = await regenerateGroupInvite(currentGroup.id, {
                        revoke: nextRevoke,
                      });
                      setInviteActionBusy(false);
                      if (res.success) {
                        showToast(nextRevoke ? 'Invites Paused' : 'Invites Re-enabled', {
                          variant: 'info',
                        });
                      }
                    }}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-100 dark:hover:bg-[#18233D] cursor-pointer"
                  >
                    {currentGroup.inviteRevoked ? 'Enable Invite' : 'Pause Invite'}
                  </button>
                </div>

                {pendingJoinRequests.length > 0 && (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
                    <Clock className="w-3.5 h-3.5" />
                    {pendingJoinRequests.length} waiting approval
                  </span>
                )}
              </div>
            )}

            {isGroupAdmin && pendingJoinRequests.length > 0 && (
              <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pending Join Requests ({pendingJoinRequests.length})
                </div>
                <div className="space-y-2">
                  {pendingJoinRequests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-xl bg-white dark:bg-[#0D1424] border border-amber-200 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {req.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {req.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await approveJoinRequest(currentGroup.id, req.id, false);
                            if (res.success) {
                              showToast('Request Declined', { variant: 'info' });
                            }
                          }}
                          className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await approveJoinRequest(currentGroup.id, req.id, true);
                            if (res.success) {
                              showToast('Member Approved', {
                                message: `${req.name} can now access ${currentGroup.name}.`,
                              });
                            }
                          }}
                          className="min-h-[36px] inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Directory Tabs (all 5 states) + Live Member Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'active', label: `Active (${activeMembers.length})` },
                  { id: 'invited', label: `Invited (${pendingJoinRequests.length})` },
                  { id: 'left', label: `Left group (${leftMembers.length})` },
                  { id: 'removed', label: `Removed (${removedMembers.length})` },
                  { id: 'suspended', label: `Suspended (${suspendedMembers.length})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDirectoryFilter(tab.id)}
                  className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    directoryFilter === tab.id
                      ? 'bg-slate-900 dark:bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#131D33]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search name, email, room, ID..."
                aria-label="Search members"
                className="w-full min-h-[40px] bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {directoryFilter === 'invited' ? (
            filteredInvitedRequests.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  {memberSearch.trim()
                    ? `No invited requests match "${memberSearch.trim()}".`
                    : 'No pending invite requests awaiting approval. Share your group invite link above so members can join.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredInvitedRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#11192C] border border-amber-200/80 dark:border-amber-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {req.name}
                        </span>
                        <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                          Invited
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {req.email} {req.phone ? `· ${req.phone}` : ''}
                      </div>
                    </div>
                    {isGroupAdmin && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await approveJoinRequest(currentGroup.id, req.id, false);
                            if (res.success) {
                              showToast('Request Declined', { variant: 'info' });
                            }
                          }}
                          className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Decline</span>
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const res = await approveJoinRequest(currentGroup.id, req.id, true);
                            if (res.success) {
                              showToast('Member Approved', {
                                message: `${req.name} can now access ${currentGroup.name}.`,
                              });
                            }
                          }}
                          className="min-h-[38px] inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : displayedMembers.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                {memberSearch.trim()
                  ? `No members match "${memberSearch.trim()}".`
                  : directoryFilter === 'active'
                    ? 'No active members enrolled in this group yet.'
                    : directoryFilter === 'suspended'
                      ? 'No suspended members.'
                      : directoryFilter === 'left'
                        ? 'No members have voluntarily left this group.'
                        : 'No removed members recorded.'}
              </p>
              {memberSearch.trim() && (
                <button
                  type="button"
                  onClick={() => setMemberSearch('')}
                  className="text-blue-600 dark:text-cyan-400 font-semibold hover:underline cursor-pointer"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Card View (< md) */}
              <div className="md:hidden space-y-3">
                {displayedMembers.map((member) => {
                  const resolved = resolveMemberInfo(member.id, groupMembers, users);
                  const isSelf =
                    member.userId === currentUser?.id || member.id === currentUser?.id;
                  const hasStove = isValidStoveType(member.stoveType);

                  return (
                    <div
                      key={member.id}
                      className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {resolved?.avatarUrl ? (
                            <img
                              src={resolved.avatarUrl}
                              alt={member.name}
                              referrerPolicy="no-referrer"
                              className="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-[#18233D] text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center text-xs shrink-0">
                              {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                              {member.name} {isSelf ? '(You)' : ''}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {member.email}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[11px] font-semibold capitalize text-slate-600 dark:text-slate-300">
                            {member.roleInGroup}
                          </span>
                          {member.status === 'active' ? (
                            <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                              Active
                            </span>
                          ) : member.status === 'suspended' ? (
                            <span
                              className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                              title={member.suspensionReason}
                            >
                              Suspended
                            </span>
                          ) : member.status === 'departed' ? (
                            <span
                              className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              title={member.departureReason}
                            >
                              Left group
                            </span>
                          ) : (
                            <span
                              className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                              title={member.removalReason}
                            >
                              Removed
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                        {showStoveFeatures && (
                          <>
                            {hasStove ? (
                              <span className="inline-flex items-center gap-1 font-semibold">
                                {member.stoveType === 'electric' ? (
                                  <Zap className="w-3.5 h-3.5 text-[#D5A52B]" />
                                ) : (
                                  <Flame className="w-3.5 h-3.5 text-slate-500" />
                                )}
                                {STOVE_TYPE_LABELS[member.stoveType!]} ·{' '}
                                {formatMWK(RATES[member.stoveType!])}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                Stove tier optional
                              </span>
                            )}
                            <span aria-hidden="true">·</span>
                          </>
                        )}
                        <span>{member.roomNumber || currentGroupPreset.shortLabel}</span>
                        {member.phone && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono text-[11px]">{member.phone}</span>
                          </>
                        )}
                      </div>

                      {isGroupAdmin && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                          {member.status === 'active' && (
                            <>
                              {showStoveFeatures && (
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
                                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                                >
                                  {hasStove ? 'Stove Tier' : 'Set Stove Tier'}
                                </button>
                              )}
                              {!isSelf && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRoleModalMember(member);
                                      setRoleModalValue(member.roleInGroup);
                                      setRoleModalReason('');
                                    }}
                                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#0D1424] border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
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
                                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs font-semibold text-amber-800 dark:text-amber-300 cursor-pointer"
                                  >
                                    Suspend
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setMemberToRemove({
                                        memberId: member.id,
                                        name: member.name,
                                      })
                                    }
                                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-700 dark:text-rose-300 cursor-pointer"
                                  >
                                    Remove
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
                                  showToast('Member Reinstated', {
                                    message: `${member.name} is active again.`,
                                  });
                                }
                              }}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                            >
                              Reinstate
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
                                setNewMemberRoom(member.roomNumber || '');
                                setAddMemberError(null);
                                setIsAddingMember(true);
                              }}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold text-emerald-700 dark:text-emerald-300 cursor-pointer"
                            >
                              Re-enroll
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (>= md) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                      <th className="pb-3 font-semibold">Member</th>
                      {showStoveFeatures && <th className="pb-3 font-semibold">Stove Tier &amp; Rate</th>}
                      <th className="pb-3 font-semibold">Role</th>
                      <th className="pb-3 font-semibold">Phone</th>
                      <th className="pb-3 font-semibold">{currentGroupPreset.unitLabel}</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-800 dark:text-slate-200">
                    {displayedMembers.map((member) => {
                      const resolved = resolveMemberInfo(member.id, groupMembers, users);
                      const isSelf =
                        member.userId === currentUser?.id || member.id === currentUser?.id;
                      const hasStove = isValidStoveType(member.stoveType);

                      return (
                        <tr
                          key={member.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-[#11192C]/70 transition-colors"
                        >
                          <td className="py-3.5 pr-3">
                            <div className="flex items-center gap-2.5">
                              {resolved?.avatarUrl ? (
                                <img
                                  src={resolved.avatarUrl}
                                  alt={member.name}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-[#131D33] text-slate-800 dark:text-slate-100 font-bold flex items-center justify-center text-xs shrink-0">
                                  {member.name ? member.name.charAt(0).toUpperCase() : 'M'}
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                  <span>{member.name}</span>
                                  {member.memberRefId && (
                                    <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                      · {member.memberRefId}
                                    </span>
                                  )}
                                  {isSelf && (
                                    <span className="text-[10px] text-blue-600 dark:text-cyan-400 font-bold">
                                      (You)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {member.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {showStoveFeatures && (
                            <td className="py-3.5 pr-3 tabular-nums">
                              {hasStove ? (
                                <span
                                  className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${
                                    member.stoveType === 'electric'
                                      ? 'text-amber-700 dark:text-[#E5B93C]'
                                      : 'text-slate-700 dark:text-slate-300'
                                  }`}
                                >
                                  {member.stoveType === 'electric' ? (
                                    <Zap className="w-3.5 h-3.5" />
                                  ) : (
                                    <Flame className="w-3.5 h-3.5" />
                                  )}
                                  {STOVE_TYPE_LABELS[member.stoveType!]} ·{' '}
                                  {formatMWK(RATES[member.stoveType!])}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                  Optional / Unset
                                </span>
                              )}
                            </td>
                          )}

                          <td className="py-3.5 pr-3 capitalize font-semibold text-slate-700 dark:text-slate-300">
                            {member.roleInGroup}
                          </td>

                          <td className="py-3.5 pr-3 font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {member.phone || '—'}
                          </td>

                          <td className="py-3.5 pr-3 text-slate-600 dark:text-slate-400">
                            {member.roomNumber || '—'}
                          </td>

                          <td className="py-3.5 pr-3">
                            {member.status === 'active' ? (
                              <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                Active
                              </span>
                            ) : member.status === 'suspended' ? (
                              <span
                                className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                                title={member.suspensionReason}
                              >
                                Suspended
                              </span>
                            ) : member.status === 'departed' ? (
                              <span
                                className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                                title={member.departureReason}
                              >
                                Left group
                              </span>
                            ) : (
                              <span
                                className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60"
                                title={member.removalReason}
                              >
                                Removed
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 text-right">
                            {isGroupAdmin && (
                              <div className="inline-flex items-center gap-1.5 justify-end flex-wrap">
                                {member.status === 'active' && (
                                  <>
                                    {showStoveFeatures && (
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
                                        className="min-h-[34px] text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A2744] px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap"
                                      >
                                        {hasStove ? 'Stove Tier' : 'Set Stove Tier'}
                                      </button>
                                    )}

                                    {!isSelf && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setRoleModalMember(member);
                                            setRoleModalValue(member.roleInGroup);
                                            setRoleModalReason('');
                                          }}
                                          className="min-h-[34px] text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white bg-slate-100 dark:bg-[#131D33] hover:bg-slate-200 dark:hover:bg-[#1A2744] px-2.5 py-1 rounded-lg cursor-pointer whitespace-nowrap"
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
                                          className="min-h-[34px] inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800 cursor-pointer whitespace-nowrap"
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
                                          className="min-h-[34px] inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800 cursor-pointer whitespace-nowrap"
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
                                        showToast('Member Reinstated', {
                                          message: `${member.name} reinstated to Active.`,
                                        });
                                      }
                                    }}
                                    className="min-h-[34px] inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer whitespace-nowrap"
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
                                      setNewMemberRoom(member.roomNumber || '');
                                      setAddMemberError(null);
                                      setIsAddingMember(true);
                                    }}
                                    className="min-h-[34px] inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 cursor-pointer whitespace-nowrap"
                                  >
                                    <span>Re-enroll</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add Member Modal (Stove tier optional and shown only for Shared House / Hostel) */}
      <Modal
        isOpen={isAddingMember}
        onClose={() => setIsAddingMember(false)}
        title={`Add Member to ${currentGroup?.name || 'Group'}`}
        subtitle="Add a roster record, then share the group invite link so they can create or access their own account"
      >
        <form onSubmit={handleAddMember} className="space-y-4 text-xs">
          <div className="bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-slate-700 dark:text-slate-300">
            <span className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#D5A52B]" />
              Member Record
            </span>
            This adds the person to your group list for planning and record-keeping. It does not create a UnitSpot login or give them access to private group information. They must sign in and join using your group invite link or code.
          </div>

          {addMemberError && (
            <div
              role="alert"
              className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl p-3 text-rose-800 dark:text-rose-200 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{addMemberError}</span>
            </div>
          )}

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Kondwani Banda"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Email Address *
            </label>
            <input
              type="email"
              placeholder="e.g. kbanda@example.mw"
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Phone Number (Malawi +265)
            </label>
            <input
              type="text"
              placeholder="+265 999 123 456"
              value={newMemberPhone}
              onChange={(e) => setNewMemberPhone(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-mono text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">Account access</div>
              <div className="min-h-[44px] flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#11192C] px-3 text-xs font-semibold text-slate-700 dark:text-slate-200">Roster only · Member</div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">Admin and treasurer access can only be assigned to a linked account.</p>
            </div>

            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                {currentGroupPreset.unitLabel}
              </label>
              <input
                type="text"
                placeholder={showStoveFeatures ? 'e.g. Room 1' : 'Optional tag'}
                value={newMemberRoom}
                onChange={(e) => setNewMemberRoom(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Optional Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Joined in May cycle"
              value={newMemberNotes}
              onChange={(e) => setNewMemberNotes(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsAddingMember(false)}
              className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-5 py-2 font-bold rounded-xl transition-colors cursor-pointer"
            >
              Add Member
            </button>
          </div>
        </form>
      </Modal>

      {/* Update Stove Classification Modal */}
      <Modal
        isOpen={Boolean(stoveModalMember)}
        onClose={() => setStoveModalMember(null)}
        title={`Classify Stove Rate — ${stoveModalMember?.name || ''}`}
      >
        <form onSubmit={handleSaveStoveType} className="space-y-4 text-xs">
          {stoveModalError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl">
              {stoveModalError}
            </div>
          )}
          <div className="p-3 bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-300">
            Updating a member&apos;s stove rate applies to future contributions and logs an immutable audit entry. Historical payments and closed contributions remain untouched.
          </div>
          <div className="grid grid-cols-2 gap-2.5 tabular-nums">
            {(['electric', 'non_electric'] as const).map((tier) => (
              <label
                key={tier}
                className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                  stoveModalType === tier
                    ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11192C] hover:bg-slate-50 dark:hover:bg-[#18233D] text-slate-800 dark:text-slate-200'
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
                <div className="mt-1 font-extrabold font-mono">{formatMWK(RATES[tier])}</div>
              </label>
            ))}
          </div>
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Audit Reason *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Initial verification of room appliance or switched to hotplate"
              value={stoveModalReason}
              onChange={(e) => setStoveModalReason(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setStoveModalMember(null)}
              className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-5 py-2 font-bold rounded-xl cursor-pointer"
            >
              Save Classification
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Group Modal (Streamlined 3-field intake) */}
      <Modal
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        title="Create a Group"
        subtitle="Set up a shared ledger in Malawi Kwacha (MWK) in seconds"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              placeholder={`e.g. ${getGroupPreset(category).exampleGroupName}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
              required
            />
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Group Type *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Group['category'])}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              {GROUP_CATEGORY_LIST.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label} — {preset.description}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="What is this group for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-5 py-2 font-bold rounded-xl cursor-pointer"
            >
              Create Group
            </button>
          </div>
        </form>
      </Modal>

      {/* Post-Creation Invite Members Modal */}
      <Modal
        isOpen={Boolean(postCreatedGroup)}
        onClose={() => setPostCreateGroupId(null)}
        title={postCreatedGroup ? `Group Ready — ${postCreatedGroup.name}` : 'Group Created'}
        subtitle="Your group is ready. Share one invitation with members so they can join."
      >
        {postCreatedGroup && (
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Group Invite Code
                </span>
                {postCreatedGroup.inviteExpiresAt && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Valid until {new Date(postCreatedGroup.inviteExpiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="font-mono text-lg font-extrabold text-slate-900 dark:text-white tracking-wider">
                {postCreatedGroup.joinCode}
              </div>
              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 break-all">
                {buildInviteUrl(postCreatedGroup.joinCode)}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleShareInviteLink(postCreatedGroup)}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Link</span>
              </button>
              <button
                type="button"
                onClick={() => handleCopy(postCreatedGroup.joinCode)}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedCode === postCreatedGroup.joinCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[11px] text-slate-500 dark:text-slate-400 self-center">
                  You can add roster members from the group directory.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPostCreateGroupId(null);
                    openEditGroup();
                  }}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#131D33] text-slate-800 dark:text-slate-200 font-semibold cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Group Settings</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPostCreateGroupId(null);
                  onNavigateDashboard?.();
                }}
                className="min-h-[40px] inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-bold cursor-pointer"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Go to Dashboard</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Accommodation-Only Electricity Stove Settings Modal */}
      <Modal
        isOpen={Boolean(isStoveSettingsOpen && showStoveFeatures && currentGroup)}
        onClose={() => setIsStoveSettingsOpen(false)}
        title={`Electricity Stove Settings — ${currentGroup?.name || ''}`}
        subtitle="Optional accommodation tiers (Electric MK 10,000 · Non-Electric MK 5,000)"
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            Configure stove classifications per member for Electricity Stove Tier billing. Changes only apply to future electricity bills and preserve all historical records.
          </div>

          {activeMembers.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-4">
              No active members in this group yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {activeMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-3 bg-white dark:bg-[#0D1424] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {member.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {member.roomNumber || 'Room unset'} · {member.email}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {isValidStoveType(member.stoveType)
                        ? `${STOVE_TYPE_LABELS[member.stoveType]} (${formatMWK(RATES[member.stoveType])})`
                        : 'Unset'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsStoveSettingsOpen(false);
                        setStoveModalMember(member);
                        setStoveModalType(
                          isValidStoveType(member.stoveType) ? member.stoveType : 'non_electric'
                        );
                        setStoveModalReason('');
                        setStoveModalError('');
                      }}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-900 dark:bg-blue-600 text-white font-semibold cursor-pointer"
                    >
                      Set Tier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setIsStoveSettingsOpen(false)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#131D33] text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Group Modal (includes Join Policy & Payment Rules) */}
      <Modal
        isOpen={Boolean(isEditingGroup && currentGroup)}
        onClose={() => setIsEditingGroup(false)}
        title="Edit Group Settings"
      >
        <form onSubmit={handleSaveGroupEdit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Group Name *
            </label>
            <input
              type="text"
              required
              value={editGroupName}
              onChange={(e) => setEditGroupName(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              How Members Join
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditJoinPolicy('code_auto')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                  editJoinPolicy === 'code_auto'
                    ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11192C] text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="font-bold">Instant with Code</div>
                <div className="text-[11px] opacity-80 mt-0.5">Anyone with invite joins fast</div>
              </button>
              <button
                type="button"
                onClick={() => setEditJoinPolicy('admin_approval')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                  editJoinPolicy === 'admin_approval'
                    ? 'border-slate-900 dark:border-blue-500 bg-slate-900 dark:bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#11192C] text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="font-bold">Admin Approval</div>
                <div className="text-[11px] opacity-80 mt-0.5">You approve each join request</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={editGroupDesc}
              onChange={(e) => setEditGroupDesc(e.target.value)}
              className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Payment Rules
            </label>
            <textarea
              rows={2}
              placeholder={currentGroupPreset.defaultRulesPlaceholder}
              value={editGroupRules}
              onChange={(e) => setEditGroupRules(e.target.value)}
              className="w-full bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditingGroup(false)}
              className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-5 py-2 font-bold rounded-xl cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* Archive Group Confirmation Modal */}
      <Modal
        isOpen={Boolean(isArchivingGroup && currentGroup)}
        onClose={() => setIsArchivingGroup(false)}
        title={`Archive Group — ${currentGroup?.name || ''}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Archiving hides this group from active operations while preserving all historical financial ledgers and audit logs.
          </p>
          <form onSubmit={handleConfirmArchive} className="space-y-3">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Reason for Archiving *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Lease term completed / Group dissolved"
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsArchivingGroup(false)}
                className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
              >
                Confirm Archive
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Transfer Ownership Modal */}
      <Modal
        isOpen={Boolean(isTransferring && currentGroup)}
        onClose={() => setIsTransferring(false)}
        title="Transfer Group Ownership"
      >
        <form onSubmit={handleConfirmTransfer} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Select Active Member *
            </label>
            <select
              required
              value={transferCandidateId}
              onChange={(e) => setTransferCandidateId(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
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
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Transfer Reason *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Incoming house captain handover"
              value={transferReason}
              onChange={(e) => setTransferReason(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsTransferring(false)}
              className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
            >
              Confirm Transfer
            </button>
          </div>
        </form>
      </Modal>

      {/* Role Change Modal */}
      <Modal
        isOpen={Boolean(roleModalMember)}
        onClose={() => setRoleModalMember(null)}
        title={`Change Member Role — ${roleModalMember?.name || ''}`}
      >
        <form onSubmit={handleSaveRoleChange} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              New Role *
            </label>
            <select
              value={roleModalValue}
              onChange={(e) =>
                setRoleModalValue(e.target.value as 'admin' | 'treasurer' | 'member')
              }
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="member">Regular Member</option>
              <option value="treasurer">Treasurer / Collector</option>
              <option value="admin">Group Administrator</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
              Audit Reason *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Elected new treasurer"
              value={roleModalReason}
              onChange={(e) => setRoleModalReason(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setRoleModalMember(null)}
              className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
            >
              Update Role
            </button>
          </div>
        </form>
      </Modal>

      {/* Suspend Member Modal */}
      <Modal
        isOpen={Boolean(memberToSuspend)}
        onClose={() => setMemberToSuspend(null)}
        title={`Suspend Member — ${memberToSuspend?.name || ''}`}
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Suspended members retain their historical ledger records and are excluded from routine group broadcasts until reinstated.
          </p>
          <form onSubmit={handleConfirmSuspend} className="space-y-3">
            <div>
              <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Suspension Reason *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Temporary leave / pending arrears review"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMemberToSuspend(null)}
                className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
              >
                Confirm Suspension
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Member Removal Confirmation Modal */}
      <Modal
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
        title="Remove Member / Record Departure"
        subtitle={`Manage tenant departure from ${currentGroup?.name || 'group'}`}
      >
        <div className="space-y-4 text-xs">
          <div className="bg-slate-50 dark:bg-[#11192C] rounded-2xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-2">
            <p className="text-slate-700 dark:text-slate-200">
              Confirm removing{' '}
              <strong className="text-slate-900 dark:text-white">
                {memberToRemove?.name}
              </strong>{' '}
              from the active directory?
            </p>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5 bg-white dark:bg-[#0D1424] p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                All historical contributions, verified payments, and audit logs remain permanently preserved.
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Departure Reason
            </label>
            <input
              type="text"
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value)}
              className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setMemberToRemove(null)}
              className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmRemove}
              className="min-h-[44px] px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <UserMinus className="w-3.5 h-3.5" />
              <span>Confirm Removal</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Leave Group Confirmation Modal */}
      <Modal
        isOpen={Boolean(isLeavingGroup && currentGroup)}
        onClose={() => !leaveBusy && setIsLeavingGroup(false)}
        title={`Leave Group — ${currentGroup?.name || ''}`}
      >
        {currentGroup && (
          <form onSubmit={handleConfirmLeaveGroup} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed font-medium">
                You will lose access to this group&apos;s shared information. Your historical payment records will remain preserved. Leaving does not automatically settle outstanding contributions.
              </p>
            </div>

            {leaveError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <span>{leaveError}</span>
              </div>
            )}

            {leaveEligibility?.requiresTransfer && leaveEligibility.otherActiveMembers.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#11192C] border border-slate-200 dark:border-slate-800 space-y-2.5">
                <p className="font-semibold text-slate-800 dark:text-slate-200">
                  {leaveEligibility.error}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsLeavingGroup(false);
                    setIsArchivingGroup(true);
                  }}
                  className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archive Group Instead</span>
                </button>
              </div>
            ) : (
              <>
                {leaveEligibility?.requiresTransfer && (
                  <div>
                    <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                      Transfer Admin Ownership Before Leaving *
                    </label>
                    <select
                      required
                      value={leaveTransferCandidateId}
                      onChange={(e) => setLeaveTransferCandidateId(e.target.value)}
                      className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                    >
                      <option value="">Select new group administrator...</option>
                      {leaveEligibility.otherActiveMembers.map((m) => {
                        const uid = m.linkedUserId || (!m.userId.startsWith('mem_') ? m.userId : '');
                        return (
                          <option key={m.id} value={m.id} disabled={!uid}>
                            {m.name} ({m.email}){!uid ? ' — needs app sign-in first' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Moved out / semester ended"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    className="w-full min-h-[44px] bg-white dark:bg-[#11192C] border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    disabled={leaveBusy}
                    onClick={() => setIsLeavingGroup(false)}
                    className="min-h-[44px] px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      leaveBusy ||
                      (Boolean(leaveEligibility?.requiresTransfer) && !leaveTransferCandidateId)
                    }
                    className="min-h-[44px] inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 font-bold rounded-xl cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{leaveBusy ? 'Leaving...' : 'Confirm Leave Group'}</span>
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </Modal>

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
