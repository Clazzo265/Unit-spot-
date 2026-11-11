import React from 'react';
import { KlarencyLogo } from '../brand/KlarencyLogo';
import { 
  ShieldCheck, 
  Clock, 
  Receipt, 
  CheckCircle2, 
  ArrowRight, 
  Users, 
  Building2, 
  CreditCard,
  ChevronRight,
  HelpCircle 
} from 'lucide-react';
import { formatMWK } from '../../utils/financialCalculations';

export const LandingPage: React.FC<{
  onGetStarted: () => void;
}> = ({ onGetStarted }) => {
  return (
    <div className="min-h-screen bg-white text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <KlarencyLogo size="md" />

          <div className="flex items-center gap-3">
            <button
              onClick={onGetStarted}
              className="text-xs font-semibold text-neutral-600 hover:text-neutral-900 px-3 py-1.5 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={onGetStarted}
              className="bg-neutral-900 hover:bg-black text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              Get Started Free
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-16 pb-20 px-4 sm:px-6 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-xs font-semibold text-neutral-800 mb-6">
          <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
          Malawi Kwacha (MWK) • Shared Accommodation & Group Finance
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-neutral-950 max-w-4xl mx-auto leading-[1.08]">
          Every Contribution. <br className="hidden sm:inline" />
          Every Commitment. <br className="hidden sm:inline" />
          <span className="text-[#111111] underline decoration-[#D5A52B] decoration-4 underline-offset-8">
            Every Transaction. Clear.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-neutral-600 max-w-2xl mx-auto mt-6 leading-relaxed">
          Take control of shared house bills, hostel utilities, workplace contributions and community funds. Transparent records, partial payment tracking with real-time countdowns, and automatic reconciliation.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 max-w-md mx-auto">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto bg-neutral-900 hover:bg-black text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition-all shadow-lg hover:shadow-xl cursor-pointer flex items-center justify-center gap-2"
          >
            Launch KLARENCY App
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#features"
            className="w-full sm:w-auto bg-neutral-50 hover:bg-neutral-100 text-neutral-800 font-semibold px-6 py-3.5 rounded-2xl text-sm border border-neutral-200 transition-colors cursor-pointer text-center"
          >
            Explore How It Works
          </a>
        </div>

        {/* Live Interactive Hero Mockup Card */}
        <div className="mt-14 max-w-3xl mx-auto bg-neutral-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-neutral-800 text-left relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800">
            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-[#D5A52B]">
                Live Showcase Demonstration
              </span>
              <h3 className="text-xl font-extrabold mt-1">
                Area 47 Shared House (House A) — November 2026
              </h3>
            </div>
            <span className="inline-flex items-center gap-1.5 bg-[#16A34A]/20 text-[#16A34A] border border-[#16A34A]/30 px-3 py-1 rounded-full text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              ESCOM Prepaid Electricity
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-b border-neutral-800">
            <div>
              <span className="text-xs text-neutral-400">Total Expected</span>
              <div className="text-xl font-black mt-0.5">{formatMWK(50000)}</div>
            </div>
            <div>
              <span className="text-xs text-neutral-400">Verified Paid</span>
              <div className="text-xl font-black text-emerald-400 mt-0.5">{formatMWK(35000)}</div>
            </div>
            <div>
              <span className="text-xs text-neutral-400">Remaining</span>
              <div className="text-xl font-black text-rose-400 mt-0.5">{formatMWK(15000)}</div>
            </div>
            <div>
              <span className="text-xs text-neutral-400">Promise Deadline</span>
              <div className="text-xl font-black text-[#D5A52B] mt-0.5">7 Days Left</div>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between text-xs text-neutral-400">
            <span>Peter Chimphepo made partial payment MK 7,000; MK 3,000 promised by 18 Nov.</span>
            <span className="text-white font-mono font-semibold">TNM Mpamba verified</span>
          </div>
        </div>
      </section>

      {/* The Problem & Solution Section */}
      <section id="features" className="py-16 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#D5A52B]">
              The Shared Money Problem
            </span>
            <h2 className="text-3xl font-extrabold text-neutral-900 mt-1">
              Why shared contributions break down
            </h2>
            <p className="text-sm text-neutral-500 mt-2">
              In shared houses, hostels, and work circles, money collection causes awkward arguments, missing money and forgotten promises.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-900 mb-4">
                <Clock className="w-5 h-5 text-[#D5A52B]" />
              </div>
              <h3 className="font-bold text-lg text-neutral-900">
                Forgotten Partial Payments
              </h3>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                Someone pays MK 7,000 of their MK 10,000 share and promises the rest &ldquo;next week.&rdquo; Without automated tracking, that MK 3,000 is forgotten or disputed.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-900 mb-4">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-bold text-lg text-neutral-900">
                Lost Mobile Money SMS Receipts
              </h3>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                Airtel Money and TNM Mpamba texts get deleted from collectors&apos; phones. KLARENCY preserves permanent transaction codes and verification states.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-neutral-200 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center font-bold text-neutral-900 mb-4">
                <Receipt className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg text-neutral-900">
                Expenditure Suspicion
              </h3>
              <p className="text-xs text-neutral-600 mt-2 leading-relaxed">
                Members wonder: &ldquo;Did the collector actually buy the ESCOM units or pay the water bill?&rdquo; KLARENCY reconciles collected cash against uploaded bills and receipts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Signature Features Grid */}
      <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-wider text-[#D5A52B]">
            Engineered For Clarity
          </span>
          <h2 className="text-3xl font-extrabold text-neutral-900 mt-1">
            Built for Malawian Group Living & Finance
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#D5A52B] bg-[#D5A52B]/10 px-3 py-1 rounded-full">
              Signature Feature #1
            </div>
            <h3 className="text-2xl font-black text-neutral-900">
              Payment Commitments & Live Countdowns
            </h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              When a member underpays, the collector records when the remaining amount is promised. A clean countdown starts. Members receive non-confrontational automated reminders, keeping commitments transparent and respected.
            </p>
            <ul className="space-y-2 text-xs text-neutral-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Automatic remaining balance calculation (Expected - Verified)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                3-day, 7-day, 14-day and custom promise periods
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Preserves original commitment history even if extended
              </li>
            </ul>
          </div>

          <div className="bg-neutral-50 rounded-3xl p-6 border border-neutral-200 space-y-4">
            <div className="bg-white rounded-2xl p-4 border border-neutral-200 shadow-xs">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-neutral-500">Member: Peter Chimphepo</span>
                <span className="font-bold text-amber-600">Active Promise</span>
              </div>
              <div className="text-lg font-black text-neutral-900">MK 3,000 remaining</div>
              <div className="mt-2 grid grid-cols-4 gap-1 text-center font-mono text-xs bg-neutral-900 text-white p-2 rounded-xl">
                <div>07 <span className="text-[9px] block text-neutral-400">DAYS</span></div>
                <div>08 <span className="text-[9px] block text-neutral-400">HOURS</span></div>
                <div>42 <span className="text-[9px] block text-neutral-400">MINS</span></div>
                <div>19 <span className="text-[9px] block text-neutral-400">SECS</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="py-16 bg-neutral-50 border-t border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h3 className="text-2xl font-black text-neutral-900 text-center mb-8">
            Frequently Asked Questions
          </h3>

          <div className="space-y-4 text-xs">
            <div className="bg-white p-4 rounded-xl border border-neutral-200">
              <h4 className="font-bold text-neutral-900 text-sm">
                Does KLARENCY hold our money like a bank?
              </h4>
              <p className="text-neutral-600 mt-1 leading-relaxed">
                No. In this release, KLARENCY is a financial management, verification and accountability platform. Members pay directly to the group treasurer via Airtel Money, TNM Mpamba, bank transfer or cash. KLARENCY verifies, records and audits every Kwacha.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-200">
              <h4 className="font-bold text-neutral-900 text-sm">
                Can different members have different expected contribution amounts?
              </h4>
              <p className="text-neutral-600 mt-1 leading-relaxed">
                Yes! KLARENCY supports both equal split and custom allocations. For instance, members with larger rooms or air conditioners can be assigned MK 12,000 while others pay MK 10,000.
              </p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-neutral-200">
              <h4 className="font-bold text-neutral-900 text-sm">
                What happens if someone pays in 3 installments?
              </h4>
              <p className="text-neutral-600 mt-1 leading-relaxed">
                Each payment is logged as an immutable transaction (e.g. MK 7,000 then MK 1,000 then MK 2,000). The balance decreases automatically until it hits zero and the obligation is marked as fully settled.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-neutral-950 text-white py-12 px-4 sm:px-6 border-t border-neutral-800 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start gap-1">
            <KlarencyLogo variant="dark" size="sm" />
            <p className="text-neutral-400 text-[11px] mt-1">
              Every Contribution. Every Commitment. Every Transaction. Clear.
            </p>
          </div>

          <div className="flex items-center gap-4 text-neutral-400">
            <span>Default Currency: MWK</span>
            <span>•</span>
            <span>Malawi (+265)</span>
            <span>•</span>
            <button onClick={onGetStarted} className="text-white hover:underline cursor-pointer">
              Launch App
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
