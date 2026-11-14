import React from 'react';
import { KlarencyLogo } from '../brand/KlarencyLogo';
import {
  ShieldCheck,
  Clock,
  Receipt,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { RATES } from '../../utils/financialConfig';
import { formatMWK } from '../../utils/financialCalculations';

export const LandingPage: React.FC<{
  onGetStarted: () => void;
}> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* Top Navbar (3 zones per Top Bar Contract) */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-8">
          <KlarencyLogo size="md" />

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-neutral-600">
            <a href="#problem" className="hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0">
              Accountability
            </a>
            <a href="#rates" className="hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0">
              Rate Rules
            </a>
            <a href="#faq" className="hover:text-neutral-900 transition-colors whitespace-nowrap shrink-0">
              Questions
            </a>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onGetStarted}
              className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-3.5 sm:px-4 py-2 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span className="sm:hidden">Sign In</span>
              <span className="hidden sm:inline">Administrator Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-14 sm:pt-16 pb-20 px-4 sm:px-6 max-w-6xl mx-auto text-center">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs font-semibold text-neutral-500 mb-5">
          <span className="whitespace-nowrap">Malawi Kwacha (MWK)</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">Shared Accommodation &amp; Group Finance</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">Administrator Operated</span>
        </div>

        <h1
          className="text-4xl sm:text-6xl font-black tracking-tight text-neutral-950 max-w-4xl mx-auto leading-[1.16] sm:leading-[1.08]"
          style={{ textWrap: 'balance' }}
        >
          Every Contribution.{' '}
          <span className="text-[#111111] underline decoration-[#D5A52B] decoration-[3px] sm:decoration-4 underline-offset-[5px] sm:underline-offset-8">
            Every Transaction. Clear.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto mt-6 leading-relaxed">
          Centralized financial management for shared houses, student hostels, workplaces and community circles. Track obligations, verify mobile money receipts, enforce transparent electricity rates, and audit every Kwacha.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto bg-neutral-900 hover:bg-black text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
          >
            Open Administrator Workspace
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#problem"
            className="w-full sm:w-auto bg-neutral-50 hover:bg-neutral-100 text-neutral-800 font-semibold px-6 py-3.5 rounded-2xl text-sm border border-neutral-200 transition-colors cursor-pointer text-center whitespace-nowrap"
          >
            How It Works
          </a>
        </div>
      </section>

      {/* Core Problem & Solution Section */}
      <section id="problem" className="py-16 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D5A52B]">
              Financial Clarity
            </span>
            <h2 className="text-3xl font-extrabold text-neutral-900 mt-1">
              Built to eliminate shared money disputes
            </h2>
            <p className="text-sm text-neutral-600 mt-2">
              In shared accommodations and community groups, manual ledgers break down when partial payments, lost screenshots, and unclear allocations collide.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-neutral-200">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-900 mb-4">
                <Clock className="w-5 h-5 text-[#D5A52B]" />
              </div>
              <h3 className="font-bold text-lg text-neutral-900">
                Tracked Partial Commitments
              </h3>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                When a member settles partially, administrators record the remaining promised date and track automated countdown reminders until the balance reaches MK 0.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-neutral-200">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-900 mb-4">
                <ShieldCheck className="w-5 h-5 text-[#16A34A]" />
              </div>
              <h3 className="font-bold text-lg text-neutral-900">
                Verified Receipt &amp; Reference Ledger
              </h3>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                Airtel Money, TNM Mpamba, bank transfer, and cash receipts are stored with immutable transaction references, duplicate protection, and non-destructive reversals.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-neutral-200">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-900 mb-4">
                <Receipt className="w-5 h-5 text-neutral-900" />
              </div>
              <h3 className="font-bold text-lg text-neutral-900">
                Inflow-to-Expense Reconciliation
              </h3>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                Every approved ESCOM token, water utility, rent, or maintenance disbursement is reconciled directly against verified member inflows.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Authoritative Utility Rate Transparency */}
      <section id="rates" className="py-16 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D5A52B]">
              Single Authoritative Rate Configuration
            </span>
            <h3 className="text-2xl font-black text-neutral-900">
              Fair stove-based utility allocation
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Every active resident is explicitly classified at registration and locked with an immutable rate snapshot at contribution assignment time. Historical records never change retroactively if rates are revised later.
            </p>
            <ul className="space-y-2 text-xs text-neutral-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                Strict whole-integer MWK calculations with zero rounding drift
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                Confidential member email notices without exposing other members&apos; balances
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#16A34A] shrink-0" />
                Members never need passwords or login accounts
              </li>
            </ul>
          </div>

          <div className="bg-neutral-50 rounded-2xl p-6 border border-neutral-200 space-y-4">
            <div className="bg-white rounded-xl p-4 border border-neutral-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-neutral-500">Electric Stove Tier</div>
                <div className="text-sm font-bold text-neutral-900 mt-0.5">Standard electric cooking appliance</div>
              </div>
              <div className="text-lg font-extrabold text-neutral-900 font-mono tabular-nums">
                {formatMWK(RATES.electric)}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 border border-neutral-200 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-neutral-500">Non-Electric Stove Tier</div>
                <div className="text-sm font-bold text-neutral-900 mt-0.5">Gas, charcoal, or no electric stove</div>
              </div>
              <div className="text-lg font-extrabold text-neutral-900 font-mono tabular-nums">
                {formatMWK(RATES.non_electric)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-16 bg-neutral-50 border-t border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h3 className="text-2xl font-black text-neutral-900 text-center mb-8">
            Frequently Asked Questions
          </h3>

          <div className="space-y-4 text-xs">
            <div className="bg-white p-5 rounded-xl border border-neutral-200">
              <h4 className="font-bold text-neutral-900 text-sm">
                Do group members need to create accounts or remember passwords?
              </h4>
              <p className="text-neutral-600 mt-1 leading-relaxed">
                No. UnitSpot is a centralized, administrator-operated platform. Administrators manage the member directory and dispatch personalized notices, receipts, and reminders directly to each member&apos;s email address.
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border border-neutral-200">
              <h4 className="font-bold text-neutral-900 text-sm">
                What happens if a verified payment was recorded by mistake?
              </h4>
              <p className="text-neutral-600 mt-1 leading-relaxed">
                Historical payments are never deleted or overwritten. Administrators record an audited reversal with a required reason, preserving the original transaction while immediately recalculating remaining balances.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-950 text-white py-10 px-4 sm:px-6 border-t border-neutral-800 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <KlarencyLogo variant="dark" size="sm" />
            <p className="text-neutral-400 text-[11px] mt-1">
              Every Contribution · Every Transaction · Clear
            </p>
          </div>

          <div className="flex items-center gap-4 text-neutral-400">
            <span>Currency: MWK</span>
            <span aria-hidden="true">·</span>
            <span>Malawi (+265)</span>
            <span aria-hidden="true">·</span>
            <button onClick={onGetStarted} className="text-white hover:underline cursor-pointer">
              Administrator Sign In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
