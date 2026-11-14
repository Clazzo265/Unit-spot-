import React from 'react';
import { UnitSpotLogo } from '../brand/UnitSpotLogo';
import { ThemeToggle } from '../ui/ThemeToggle';
import {
  ShieldCheck,
  Clock,
  Receipt,
  CheckCircle2,
  ArrowRight,
  Users,
  FileSpreadsheet,
  Camera,
} from 'lucide-react';
import { RATES } from '../../utils/financialConfig';
import { formatMWK } from '../../utils/financialCalculations';

export const LandingPage: React.FC<{
  onGetStarted: () => void;
}> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-[#F6F8FC] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white transition-colors overflow-x-hidden">
      {/* Ambient top lighting for dark mode */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] opacity-0 dark:opacity-100 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(59,130,246,0.18),rgba(139,92,246,0.08)_45%,transparent_80%)]"
      />

      {/* Top Navbar (3 zones per Top Bar Contract) */}
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
              href="#problem"
              className="min-h-[44px] inline-flex items-center hover:text-slate-950 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Accountability
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
              Rate Rules
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
              onClick={onGetStarted}
              className="min-h-[44px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold px-3 sm:px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs"
            >
              <span className="sm:hidden">Sign In</span>
              <span className="hidden sm:inline">Administrator Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-14 sm:pt-20 pb-16 sm:pb-20 px-4 sm:px-6 max-w-6xl mx-auto text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-5">
          <span className="whitespace-nowrap">Malawi Kwacha (MWK)</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">Shared Accommodation &amp; Group Finance</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">Administrator Operated</span>
        </div>

        <h1
          className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-950 dark:text-white max-w-4xl mx-auto leading-[1.18] sm:leading-[1.08]"
          style={{ textWrap: 'balance' }}
        >
          Every Contribution.{' '}
          <span className="text-slate-950 dark:text-white border-b-[3px] sm:border-b-4 border-[#D5A52B] pb-0.5 inline-block">
            Every Transaction. Clear.
          </span>
        </h1>

        <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mt-6 leading-relaxed">
          Centralized financial management for shared houses, student hostels, workplaces, and community circles. Track obligations, verify mobile money receipts, enforce transparent electricity rates, and audit every Kwacha.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <button
            type="button"
            onClick={onGetStarted}
            className="w-full sm:w-auto min-h-[48px] bg-slate-900 hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
          >
            Open Administrator Workspace
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#workflow"
            className="w-full sm:w-auto min-h-[48px] bg-white hover:bg-slate-50 dark:bg-[#0D1424] dark:hover:bg-[#131D33] text-slate-800 dark:text-slate-200 font-semibold px-6 py-3.5 rounded-2xl text-sm border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer inline-flex items-center justify-center whitespace-nowrap"
          >
            See How It Works
          </a>
        </div>
      </section>

      {/* Core Problem & Solution Section */}
      <section
        id="problem"
        className="py-16 bg-white dark:bg-[#0A101E] border-y border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B68915] dark:text-[#E5B93C]">
              Financial Clarity
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5">
              Built to eliminate shared money disputes
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              In shared accommodations and community groups, manual ledgers break down when partial payments, lost screenshots, and unclear allocations collide.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50/70 dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/60 dark:border-amber-500/20 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5 text-[#B68915] dark:text-[#E5B93C]" />
              </div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Tracked Partial Commitments
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                When a member settles partially, administrators record the remaining promised date and track countdown reminders until the balance reaches MK 0.
              </p>
            </div>

            <div className="bg-slate-50/70 dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200/60 dark:border-emerald-500/20 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Verified Receipt &amp; Reference Ledger
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Airtel Money, TNM Mpamba, bank transfer, and cash receipts are stored with captured receipt images, duplicate protection, and audited reversals.
              </p>
            </div>

            <div className="bg-slate-50/70 dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 dark:border-blue-500/20 flex items-center justify-center mb-4">
                <Receipt className="w-5 h-5 text-blue-600 dark:text-cyan-400" />
              </div>
              <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-white">
                Inflow-to-Expense Reconciliation
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                Every approved ESCOM token, water utility, rent, or maintenance disbursement is reconciled directly against verified member inflows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Administrator Workflow */}
      <section id="workflow" className="py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
            Simple 3-Step Flow
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mt-1.5">
            From setup to transparent monthly close
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold font-mono text-blue-600 dark:text-cyan-400">
                01. Directory
              </span>
              <Users className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Register Group &amp; Stove Tiers
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Create your hostel or house circle, add residents with their email and stove tier, and send a customized welcome card in one click.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold font-mono text-blue-600 dark:text-cyan-400">
                02. Obligations
              </span>
              <FileSpreadsheet className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Assign Monthly Contributions
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Launch an ESCOM or utility cycle. Each member&apos;s expected MWK obligation is computed automatically from their locked rate snapshot.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0D1424] p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold font-mono text-blue-600 dark:text-cyan-400">
                03. Verification
              </span>
              <Camera className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Capture Receipts &amp; Reconcile
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
              Attach transaction photos for full or partial payments, track remaining commitment countdowns, and export printable audit reports.
            </p>
          </div>
        </div>
      </section>

      {/* Authoritative Utility Rate Transparency */}
      <section
        id="rates"
        className="py-16 bg-white dark:bg-[#0A101E] border-y border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B68915] dark:text-[#E5B93C]">
              Single Authoritative Rate Configuration
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Fair stove-based utility allocation
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Every active resident is explicitly classified at registration and locked with an immutable rate snapshot at contribution assignment time. Historical records never change retroactively if rates are revised later.
            </p>
            <ul className="space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Strict whole-integer MWK calculations with zero rounding drift
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Confidential member email notices without exposing other members&apos; balances
              </li>
              <li className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                Members never need passwords or login accounts
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 dark:bg-[#0D1424] rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="bg-white dark:bg-[#131D33] rounded-xl p-4 border border-slate-200 dark:border-slate-700/70 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Electric Stove Tier
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                  Standard electric cooking appliance
                </div>
              </div>
              <div className="text-lg font-extrabold text-slate-900 dark:text-cyan-300 font-mono tabular-nums whitespace-nowrap">
                {formatMWK(RATES.electric)}
              </div>
            </div>

            <div className="bg-white dark:bg-[#131D33] rounded-xl p-4 border border-slate-200 dark:border-slate-700/70 flex items-center justify-between gap-4">
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
      <section id="faq" className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white text-center mb-8">
            Frequently Asked Questions
          </h3>

          <div className="space-y-4">
            <div className="bg-white dark:bg-[#0D1424] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                Do group members need to create accounts or remember passwords?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                No. UnitSpot is a centralized, administrator-operated platform. Administrators manage the member directory and dispatch personalized notices, receipts, and reminders directly to each member&apos;s email address.
              </p>
            </div>

            <div className="bg-white dark:bg-[#0D1424] p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                What happens if a verified payment was recorded by mistake?
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                Historical payments are never deleted or overwritten. Administrators record an audited reversal with a required reason, preserving the original transaction while immediately recalculating remaining balances.
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
            <p className="text-slate-400 text-[11px] mt-1">
              Every Contribution · Every Transaction · Clear
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-400">
            <span>Currency: MWK</span>
            <span aria-hidden="true">·</span>
            <span>Malawi (+265)</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={onGetStarted}
              className="min-h-[44px] inline-flex items-center text-white hover:text-cyan-300 font-semibold transition-colors cursor-pointer"
            >
              Administrator Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
