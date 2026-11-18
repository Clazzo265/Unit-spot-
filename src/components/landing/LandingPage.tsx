import React from 'react';
import { UnitSpotLogo } from '../brand/UnitSpotLogo';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useApp } from '../../context/AppContext';
import {
  ShieldCheck,
  Clock,
  Receipt,
  CheckCircle2,
  ArrowRight,
  Users,
  FileSpreadsheet,
  Camera,
  Home,
  GraduationCap,
  HeartHandshake,
  Plane,
  Coins,
  Building2,
} from 'lucide-react';
import { RATES } from '../../utils/financialConfig';
import { formatMWK } from '../../utils/financialCalculations';

export const LandingPage: React.FC<{
  onGetStarted: (intent?: 'create' | 'join') => void;
}> = ({ onGetStarted }) => {
  const { strings, language, setLanguage, firebaseAuthUser } = useApp();

  const malawiGroups = [
    {
      icon: Home,
      title: 'Shared Houses & Flats',
      desc: 'Track rent, ESCOM electricity tokens, water, and security contributions transparently.',
    },
    {
      icon: GraduationCap,
      title: 'Student Hostels',
      desc: 'Fairly split electricity and upkeep across roommates with optional electric & non-electric stove rates.',
    },
    {
      icon: HeartHandshake,
      title: 'Families & Households',
      desc: 'Pool money for monthly upkeep, groceries, school fees, or emergency family support.',
    },
    {
      icon: Plane,
      title: 'Friends, Trips & Weddings',
      desc: 'Organize mangochi lake trips, chinkhoswe pledges, birthdays, and send-off committees.',
    },
    {
      icon: Coins,
      title: 'Chilimba & Savings Circles',
      desc: 'Record weekly or monthly member shares, due dates, and payout records without confusion.',
    },
    {
      icon: Building2,
      title: 'Churches, Teams & Community',
      desc: 'Manage choir dues, borehole repairs, workplace tea funds, and club finances.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white transition-colors overflow-x-hidden">
      {/* Ambient top lighting for dark mode */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] opacity-0 dark:opacity-100 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.18),rgba(139,92,246,0.08)_45%,transparent_80%)]"
      />

      {/* Top Navbar (Strictly 3 zones: Brand | Navigation | Primary CTA + ThemeToggle) */}
      <header className="sticky top-0 z-40 bg-white/85 dark:bg-[#070B14]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
          <div className="sm:hidden shrink-0">
            <UnitSpotLogo size="sm" />
          </div>
          <div className="hidden sm:block shrink-0">
            <UnitSpotLogo size="md" />
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a
              href="#groups"
              className="min-h-[44px] inline-flex items-center hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Group Types
            </a>
            <a
              href="#workflow"
              className="min-h-[44px] inline-flex items-center hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#rates"
              className="min-h-[44px] inline-flex items-center hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Splitting Options
            </a>
            <a
              href="#faq"
              className="min-h-[44px] inline-flex items-center hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Questions
            </a>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => onGetStarted('create')}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold px-3.5 sm:px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
            >
              <span>{firebaseAuthUser ? 'Open Workspace' : strings.landing.getStarted}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-14 sm:pt-20 pb-14 sm:pb-20 px-4 sm:px-6 max-w-6xl mx-auto text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-5">
          <span className="whitespace-nowrap">Malawi Kwacha (MWK)</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">For Group Admins &amp; Members</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span className="whitespace-nowrap">Airtel Money &amp; TNM Mpamba Receipts</span>
        </div>

        <h1
          className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-950 dark:text-white max-w-4xl mx-auto leading-[1.15] sm:leading-[1.08]"
          style={{ textWrap: 'balance' }}
        >
          {strings.landing.heroHeadline}
        </h1>

        <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-6 leading-relaxed">
          {strings.landing.heroSubhead}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xl mx-auto">
          <button
            type="button"
            onClick={() => onGetStarted('create')}
            className="w-full sm:w-auto min-h-[48px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold px-7 py-3.5 rounded-2xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
          >
            <span>{firebaseAuthUser ? 'Open My Workspace' : strings.plain.createGroup}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => onGetStarted('join')}
            className="w-full sm:w-auto min-h-[48px] bg-white hover:bg-slate-50 dark:bg-[#0D1424] dark:hover:bg-[#131D33] text-slate-900 dark:text-white font-bold px-6 py-3.5 rounded-2xl text-sm border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer inline-flex items-center justify-center whitespace-nowrap"
          >
            {language === 'ny' ? 'Lowani ndi Khodi' : 'Join with Invite Code'}
          </button>

          <a
            href="#workflow"
            className="w-full sm:w-auto min-h-[48px] text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white font-semibold px-4 py-3.5 rounded-2xl text-sm transition-colors cursor-pointer inline-flex items-center justify-center whitespace-nowrap"
          >
            {strings.landing.seeHowItWorks}
          </a>
        </div>

        {/* Language selector (English / Chichewa) */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            {language === 'ny' ? 'Chilankhulo:' : 'Language:'}
          </span>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`min-h-[36px] px-3 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
              language === 'en'
                ? 'bg-slate-900 dark:bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#11192C]'
            }`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => setLanguage('ny')}
            className={`min-h-[36px] px-3 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
              language === 'ny'
                ? 'bg-slate-900 dark:bg-blue-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-[#11192C]'
            }`}
          >
            Chichewa
          </button>
        </div>
      </section>

      {/* Malawian Group Types Showcase */}
      <section
        id="groups"
        className="py-16 bg-white dark:bg-[#0A101E] border-y border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B68915] dark:text-[#E5B93C]">
              Built for Every Circle
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5">
              One clear money ledger for any Malawian group
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Choose how your group works — from hostel roommates splitting ESCOM bills to families, chilimba savings groups, churches, and wedding committees.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {malawiGroups.map((g) => {
              const Icon = g.icon;
              return (
                <div
                  key={g.title}
                  className="bg-slate-50/70 dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#131D33] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-900 dark:text-cyan-400">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">{g.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {g.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Core Accountability Pillars */}
      <section className="py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 flex items-center justify-center mb-4">
              <Clock className="w-5 h-5 text-[#B68915] dark:text-[#E5B93C]" />
            </div>
            <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
              Clear Partial Promises
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              When someone pays part of their share, record the promised settlement date so everyone sees what was paid and what remains.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
              Verified Receipt Ledger
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Members upload Airtel Money, TNM Mpamba, bank, or cash receipts. Waiting proofs stay separate until the treasurer or admin verifies them.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 flex items-center justify-center mb-4">
              <Receipt className="w-5 h-5 text-blue-600 dark:text-cyan-400" />
            </div>
            <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
              Honest Expense Sharing
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Every approved ESCOM token, water bill, grocery buy, or welfare payout is logged against collected funds so members see where money went.
            </p>
          </div>
        </div>
      </section>

      {/* 3-Step Workflow */}
      <section
        id="workflow"
        className="py-16 bg-white dark:bg-[#0A101E] border-y border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
              Simple 3-Step Flow
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5">
              Start in minutes — whether you run the group or just joined
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50/70 dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold font-mono text-blue-600 dark:text-cyan-400">
                  01. Create or Join
                </span>
                <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Share One Invite Code
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Pick a group preset, invite members via WhatsApp link or code, or register members centrally by email.
              </p>
            </div>

            <div className="bg-slate-50/70 dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold font-mono text-blue-600 dark:text-cyan-400">
                  02. Set Contributions
                </span>
                <FileSpreadsheet className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Percentage, Custom, or Electricity Split
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Split bills by exact member percentages totaling 100%, enter custom MWK amounts, or apply optional stove-tier rates for house/hostel electricity.
              </p>
            </div>

            <div className="bg-slate-50/70 dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold font-mono text-blue-600 dark:text-cyan-400">
                  03. Check &amp; Export
                </span>
                <Camera className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                Upload Receipts &amp; Reconcile
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Members upload screenshot proofs; admins verify with one click, track group expenses, and export clean PDF or CSV statements.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Flexible Splitting & Optional Accommodation Rates */}
      <section id="rates" className="py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B68915] dark:text-[#E5B93C]">
              Flexible Contribution Rules
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Percentage split, custom amounts, or optional electricity stove rates
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Non-accommodation groups (families, chilimba, friends, churches, teams) and non-electricity bills use flexible percentage splits (100% total) or custom MWK amounts without any stove setup. For shared houses and student hostels, an optional preset supports electricity contributions.
            </p>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Strict whole-integer MWK math with zero rounding drift
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Members see their own balance and group expenses transparently
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Works with both member self-service and admin-managed directories
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-[#0D1424] rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Optional Electricity Preset for Houses &amp; Hostels
            </div>
            <div className="bg-slate-50 dark:bg-[#131D33] rounded-xl p-4 border border-slate-200 dark:border-slate-700/70 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Electric Stove Tier
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  Residents using electric cooking appliances
                </div>
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-cyan-300 font-mono tabular-nums whitespace-nowrap">
                {formatMWK(RATES.electric)}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#131D33] rounded-xl p-4 border border-slate-200 dark:border-slate-700/70 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Non-Electric Stove Tier
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  Gas, charcoal, or no electric stove
                </div>
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-[#E5B93C] font-mono tabular-nums whitespace-nowrap">
                {formatMWK(RATES.non_electric)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="py-16 bg-white dark:bg-[#0A101E] border-t border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white text-center mb-8">
            Frequently Asked Questions
          </h3>

          <div className="space-y-4">
            <div className="bg-slate-50/70 dark:bg-[#0D1424] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Can ordinary group members sign in and check their own balances?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Yes. Anyone can create a free account with Email &amp; Password or Google, enter the group&apos;s invite code, view what they need to contribute, upload mobile money receipts for verification, and see group expenses. Administrators can also record offline members directly if preferred.
              </p>
            </div>

            <div className="bg-slate-50/70 dark:bg-[#0D1424] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Do unverified member receipts change the group balance immediately?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                No. When a member submits a proof of payment, it is clearly marked &ldquo;Waiting Admin Check&rdquo;. Balances update only after the administrator or treasurer checks and approves the receipt.
              </p>
            </div>

            <div className="bg-slate-50/70 dark:bg-[#0D1424] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                What happens if a verified payment was recorded by mistake?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Historical transactions are never silently deleted. Administrators record an audited reversal with a required reason, preserving the audit log while immediately recalculating balances.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 dark:bg-[#04070E] text-white py-10 px-4 sm:px-6 border-t border-slate-800 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <UnitSpotLogo variant="dark" size="sm" />
            <p className="text-slate-400 text-[11px] mt-1">{strings.tagline}</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400">
            <span>Currency: MWK</span>
            <span aria-hidden="true">·</span>
            <span>Malawi (+265)</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => onGetStarted('create')}
              className="min-h-[44px] inline-flex items-center text-white hover:text-cyan-300 font-semibold transition-colors cursor-pointer"
            >
              {strings.landing.getStarted}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
