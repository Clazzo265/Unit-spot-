import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { User } from '../../types';
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
  Sparkles,
  LogOut 
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
    addMemberToGroup, 
    removeMemberFromGroup,
    currentUser,
    setCurrentUser 
  } = useApp();

  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<any>('house');
  const [description, setDescription] = useState('');
  const [paymentRules, setPaymentRules] = useState('All monthly contributions due by the agreed deadline. Partial payments require a clear commitment deadline.');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Add Member Modal State
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('+265 ');
  const [newMemberRole, setNewMemberRole] = useState<'admin' | 'treasurer' | 'member'>('member');
  const [newMemberRoom, setNewMemberRoom] = useState('');

  // Welcome Modal State
  const [newlyAddedMember, setNewlyAddedMember] = useState<User | null>(null);
  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);

  // Member Removal State
  const [memberToRemove, setMemberToRemove] = useState<{ memberId: string; userId: string; name: string } | null>(null);
  const [removalReason, setRemovalReason] = useState('Tenant moved out / lease ended');

  // Directory filter: active vs departed
  const [directoryFilter, setDirectoryFilter] = useState<'active' | 'departed'>('active');

  const activeMembers = currentGroup 
    ? groupMembers
        .filter(gm => gm.groupId === currentGroup.id && gm.status === 'active')
        .map(gm => ({
          member: gm,
          user: users.find(u => u.id === gm.userId)
        }))
        .filter(item => Boolean(item.user))
    : [];

  const departedMembers = currentGroup 
    ? groupMembers
        .filter(gm => gm.groupId === currentGroup.id && gm.status === 'departed')
        .map(gm => ({
          member: gm,
          user: users.find(u => u.id === gm.userId)
        }))
        .filter(item => Boolean(item.user))
    : [];

  const displayedMembers = directoryFilter === 'active' ? activeMembers : departedMembers;

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
  };

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberEmail.trim()) return;

    const result = addMemberToGroup({
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      phone: newMemberPhone.trim(),
      role: newMemberRole,
      roomNumber: newMemberRoom.trim() || undefined,
    });

    if (result.success && result.user) {
      setNewlyAddedMember(result.user);
      setIsWelcomeModalOpen(true);
      setNewMemberName('');
      setNewMemberEmail('');
      setNewMemberPhone('+265 ');
      setNewMemberRoom('');
      setIsAddingMember(false);
    }
  };

  const handleConfirmRemove = () => {
    if (!memberToRemove) return;
    removeMemberFromGroup(memberToRemove.userId, removalReason);
    setMemberToRemove(null);
    setRemovalReason('Tenant moved out / lease ended');
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
            Manage shared houses, student hostels, workplaces and financial circles
          </p>
        </div>

        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-2 bg-neutral-900 hover:bg-black text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Create New Group
        </button>
      </div>

      {/* Group Selector Cards */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-10 text-center text-xs text-neutral-500">
          <Building2 className="w-10 h-10 text-neutral-300 mx-auto mb-2" />
          <h4 className="font-bold text-neutral-800 text-sm">No Financial Groups Yet</h4>
          <p className="mt-1 max-w-sm mx-auto text-neutral-500">
            Create your first group to manage shared utilities, accommodation bills, or department funds.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="mt-4 bg-neutral-900 text-white font-bold px-4 py-2 rounded-xl text-xs"
          >
            Create First Group
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map(g => {
            const isSelected = currentGroup?.id === g.id;
            const membersCount = groupMembers.filter(gm => gm.groupId === g.id).length;

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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
                      isSelected ? 'bg-white/10 text-white' : 'bg-neutral-100 text-neutral-900'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base leading-tight">
                        {g.name}
                      </h3>
                      <span className={`text-[11px] uppercase tracking-wider font-semibold ${
                        isSelected ? 'text-neutral-400' : 'text-neutral-500'
                      }`}>
                        {g.category} • Default {g.defaultCurrency}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="bg-[#16A34A] text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Active Group
                    </span>
                  )}
                </div>

                <p className={`text-xs mt-3 line-clamp-2 ${
                  isSelected ? 'text-neutral-300' : 'text-neutral-600'
                }`}>
                  {g.description || 'No description provided.'}
                </p>

                <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs ${
                  isSelected ? 'border-white/10 text-neutral-300' : 'border-neutral-100 text-neutral-500'
                }`}>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>{membersCount} enrolled members</span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(g.joinCode);
                    }}
                    className={`inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded-md border ${
                      isSelected 
                        ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' 
                        : 'border-neutral-200 bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
                    }`}
                    title="Click to copy invitation code"
                  >
                    {copiedCode === g.joinCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
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
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-neutral-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  Directory
                </span>
                <span className="text-xs text-neutral-300">•</span>
                <span className="text-xs font-semibold text-neutral-600">
                  {currentGroup.name}
                </span>
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mt-1">
                Group Members & Financial Roles
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAddingMember(true)}
                className="inline-flex items-center gap-1.5 bg-neutral-900 hover:bg-black text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Member
              </button>

              <button
                onClick={() => handleCopy(currentGroup.joinCode)}
                className="inline-flex items-center gap-1.5 bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border border-neutral-200 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                Invite Code: <span className="font-mono">{currentGroup.joinCode}</span>
              </button>
            </div>
          </div>

          {/* Directory Tabs */}
          <div className="flex items-center gap-2 mt-4 border-b border-neutral-100 pb-2">
            <button
              onClick={() => setDirectoryFilter('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                directoryFilter === 'active'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              Active Residents & Members ({activeMembers.length})
            </button>
            <button
              onClick={() => setDirectoryFilter('departed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                directoryFilter === 'departed'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100'
              }`}
            >
              Moved Out / Departed ({departedMembers.length})
            </button>
          </div>

          {/* Members Table */}
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-neutral-100 text-neutral-400 uppercase tracking-wider text-[11px]">
                  <th className="pb-3 font-semibold">Member</th>
                  <th className="pb-3 font-semibold">Role</th>
                  <th className="pb-3 font-semibold">Contact (Malawi +265)</th>
                  <th className="pb-3 font-semibold">Accommodation / Room</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-neutral-800">
                {displayedMembers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-neutral-400">
                      {directoryFilter === 'active' 
                        ? 'No active members currently in this group.' 
                        : 'No departed members recorded. When members move out, their history is archived here.'}
                    </td>
                  </tr>
                ) : (
                  displayedMembers.map(({ member, user }) => {
                    if (!user) return null;
                    const isUserCurrent = user.id === currentUser.id;
                    const isGroupAdmin = currentUser.role === 'group_admin' || currentUser.role === 'super_admin';

                    return (
                      <tr key={member.id} className="hover:bg-neutral-50/50 transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-2.5">
                            {user.avatarUrl ? (
                              <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-neutral-200" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-neutral-200 text-neutral-800 font-bold flex items-center justify-center text-xs">
                                {user.name ? user.name.charAt(0) : 'M'}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-neutral-900 flex items-center gap-1.5">
                                {user.name}
                                {isUserCurrent && (
                                  <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.2 rounded font-normal">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-neutral-400">{user.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${
                            member.roleInGroup === 'admin' 
                              ? 'bg-neutral-900 text-white' 
                              : member.roleInGroup === 'treasurer'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-neutral-100 text-neutral-700'
                          }`}>
                            {member.roleInGroup}
                          </span>
                        </td>

                        <td className="py-3.5 font-mono text-[11px]">
                          {user.phone}
                        </td>

                        <td className="py-3.5 text-neutral-600">
                          {user.roomNumber || 'Main building'}
                        </td>

                        <td className="py-3.5">
                          {member.status === 'active' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-neutral-500 font-medium" title={member.departureReason}>
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                              Moved Out
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 text-right">
                          {member.status === 'active' ? (
                            (!isUserCurrent && isGroupAdmin) && (
                              <button
                                onClick={() => setMemberToRemove({ memberId: member.id, userId: user.id, name: user.name })}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                title="Remove member if they moved out"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            )
                          ) : (
                            isGroupAdmin && (
                              <button
                                onClick={() => {
                                  addMemberToGroup({
                                    name: user.name,
                                    email: user.email,
                                    phone: user.phone,
                                    role: member.roleInGroup,
                                    roomNumber: user.roomNumber,
                                  });
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                              >
                                <span>Re-enroll</span>
                              </button>
                            )
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

      {/* Add Member Modal */}
      {isAddingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h3 className="font-bold text-neutral-900 text-base">
                Add Member to {currentGroup?.name}
              </h3>
              <button 
                onClick={() => setIsAddingMember(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="p-6 space-y-4 text-xs">
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

              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Phone Number (Malawi +265) *
                </label>
                <input
                  type="text"
                  placeholder="+265 999 123 456"
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm font-mono text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                    Role in Group *
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as any)}
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
                  className="px-4 py-2 font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-5 py-2 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Add Member
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
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <h3 className="font-bold text-neutral-900 text-base">
                Create New Group
              </h3>
              <button 
                onClick={() => setIsCreating(false)}
                className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Area 10 Shared Flat, Hostel Block C, Project Circle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-neutral-600 mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
                  placeholder="Describe group purpose, location or members..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
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
                  className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 font-semibold text-neutral-600 hover:text-neutral-900 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-neutral-900 hover:bg-black text-white px-5 py-2 font-bold rounded-xl transition-colors cursor-pointer"
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Removal Confirmation Modal */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
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
                Are you sure you want to remove <strong className="text-neutral-900">{memberToRemove.name}</strong> from the active group directory?
              </p>
              <div className="text-[11px] text-neutral-500 flex items-start gap-1.5 bg-white p-2.5 rounded-xl border border-neutral-100">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>All historical contributions, verified payments, and past audit records remain permanently stored for transparent accounting.</span>
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
                placeholder="e.g. Moved out to another flat, lease ended, room transfer"
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Confirm Removal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Welcome & Thanks Modal */}
      <MemberWelcomeModal
        isOpen={isWelcomeModalOpen}
        onClose={() => {
          setIsWelcomeModalOpen(false);
          setNewlyAddedMember(null);
        }}
        member={newlyAddedMember}
        group={currentGroup}
        onSwitchToMember={(user) => setCurrentUser(user)}
      />
    </div>
  );
};
