import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Clock, 
  CreditCard, 
  AlertTriangle, 
  DollarSign, 
  FileText 
} from 'lucide-react';

export const NotificationsCenterView: React.FC = () => {
  const { notifications, markNotificationRead, markAllNotificationsRead, currentUser } = useApp();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const userNotifications = notifications.filter(n => n.userId === currentUser.id || !n.userId);
  const filtered = userNotifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getIcon = (category: string) => {
    switch (category) {
      case 'payment':
        return <CreditCard className="w-4 h-4 text-emerald-600" />;
      case 'commitment':
        return <Clock className="w-4 h-4 text-[#D5A52B]" />;
      case 'dispute':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      case 'expense':
        return <DollarSign className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-neutral-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Notification & Reminder Centre
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Idempotent notifications for payments, commitment countdown milestones and group expenses
          </p>
        </div>

        <button
          onClick={markAllNotificationsRead}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
        >
          <CheckCheck className="w-4 h-4" />
          Mark all as read
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
            filter === 'all' ? 'bg-neutral-900 text-white font-bold' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          All ({userNotifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
            filter === 'unread' ? 'bg-neutral-900 text-white font-bold' : 'bg-neutral-100 text-neutral-600'
          }`}
        >
          Unread ({userNotifications.filter(n => !n.read).length})
        </button>
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center text-neutral-400">
            <Bell className="w-8 h-8 mx-auto mb-2 text-neutral-300" />
            <p className="font-semibold text-neutral-700">No notifications</p>
            <p className="text-xs text-neutral-400 mt-1">
              You are all caught up on financial alerts.
            </p>
          </div>
        ) : (
          filtered.map(n => (
            <div
              key={n.id}
              onClick={() => markNotificationRead(n.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                n.read 
                  ? 'bg-white border-neutral-200 text-neutral-600' 
                  : 'bg-neutral-50/80 border-neutral-300 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  n.read ? 'bg-neutral-100 border-neutral-200' : 'bg-white border-neutral-300 shadow-xs'
                }`}>
                  {getIcon(n.category)}
                </div>
                <div>
                  <h4 className={`text-sm ${n.read ? 'font-semibold text-neutral-800' : 'font-bold text-neutral-900'}`}>
                    {n.title}
                  </h4>
                  <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">
                    {n.message}
                  </p>
                  <span className="text-[10px] text-neutral-400 mt-1 block">
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(n.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-[#16A34A] shrink-0 mt-1.5" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
