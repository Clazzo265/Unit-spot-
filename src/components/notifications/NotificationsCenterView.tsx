import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { EmptyState } from '../ui/EmptyState';
import {
  Bell,
  CheckCheck,
  Clock,
  CreditCard,
  AlertTriangle,
  DollarSign,
} from 'lucide-react';

export const NotificationsCenterView: React.FC = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead, currentUser } = useApp();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const userNotifications = notifications.filter(
    (n) => !n.userId || (currentUser && n.userId === currentUser.id)
  );
  const unreadCount = userNotifications.filter((n) => !n.read).length;
  const filtered = userNotifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getIcon = (category: string) => {
    switch (category) {
      case 'payment':
        return <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'commitment':
        return <Clock className="w-4 h-4 text-[#D5A52B] dark:text-[#E5B93C]" />;
      case 'dispute':
        return <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
      case 'expense':
        return <DollarSign className="w-4 h-4 text-blue-600 dark:text-cyan-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
            Notification &amp; Reminder Centre
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Alerts for recorded payments, commitment milestones, disputes, and group expenses
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            markAllNotificationsRead();
            if (unreadCount > 0) {
              showToast('Notifications cleared', {
                message: `Marked ${unreadCount} unread notification(s) as read.`,
                variant: 'success',
              });
            }
          }}
          disabled={unreadCount === 0}
          className="min-h-[44px] inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-[#131D33] dark:hover:bg-[#1A2744] disabled:opacity-50 border border-slate-200 dark:border-slate-700 px-4 py-2 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Mark all as read</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`min-h-[44px] px-4 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
            filter === 'all'
              ? 'bg-slate-900 dark:bg-blue-600 text-white font-bold shadow-xs'
              : 'bg-slate-100 dark:bg-[#131D33] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-[#1A2744]'
          }`}
        >
          All ({userNotifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`min-h-[44px] px-4 py-2 rounded-xl font-medium transition-colors cursor-pointer ${
            filter === 'unread'
              ? 'bg-slate-900 dark:bg-blue-600 text-white font-bold shadow-xs'
              : 'bg-slate-100 dark:bg-[#131D33] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-[#1A2744]'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'All Caught Up' : 'No Notifications'}
            description={
              filter === 'unread'
                ? 'You have zero unread financial alerts.'
                : 'Notifications for payments, commitments, and expenses will appear here.'
            }
            actionLabel={filter === 'unread' && userNotifications.length > 0 ? 'Show All Alerts' : undefined}
            onAction={filter === 'unread' && userNotifications.length > 0 ? () => setFilter('all') : undefined}
          />
        ) : (
          filtered.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => markNotificationRead(n.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                n.read
                  ? 'bg-white dark:bg-[#0D1424] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                  : 'bg-blue-50/50 dark:bg-[#111B31] border-blue-200 dark:border-blue-800/60 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    n.read
                      ? 'bg-slate-100 dark:bg-[#131D33] border-slate-200 dark:border-slate-700'
                      : 'bg-white dark:bg-[#0D1424] border-blue-200 dark:border-blue-700/60 shadow-xs'
                  }`}
                >
                  {getIcon(n.category)}
                </div>
                <div>
                  <h4
                    className={`text-sm ${
                      n.read
                        ? 'font-semibold text-slate-800 dark:text-slate-200'
                        : 'font-bold text-slate-900 dark:text-slate-50'
                    }`}
                  >
                    {n.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                    {n.message}
                  </p>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 block tabular-nums">
                    {new Date(n.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}{' '}
                    • {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {!n.read && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-md shrink-0">
                  Unread
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
