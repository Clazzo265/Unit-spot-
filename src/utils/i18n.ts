export type AppLanguage = 'en' | 'ny';

export interface LocaleDictionary {
  langName: string;
  tagline: string;
  nav: {
    home: string;
    myGroups: string;
    myPayments: string;
    groupMembers: string;
    checkPayments: string;
    promisesDueDates: string;
    groupExpenses: string;
    sendReminders: string;
    moneyReports: string;
    questionsIssues: string;
    notifications: string;
    settings: string;
  };
  plain: {
    whatYouNeedToContribute: string;
    paidVerified: string;
    waitingVerification: string;
    amountRemaining: string;
    submitPaymentProof: string;
    waitingAdminCheck: string;
    checkTheMoney: string;
    createGroup: string;
    joinGroup: string;
    checkPayment: string;
    setMemberContributions: string;
    askQuestionReportIssue: string;
    groupExpensesTransparency: string;
    verifiedBadge: string;
    partialBadge: string;
    overdueBadge: string;
    dueSoonBadge: string;
    unpaidBadge: string;
  };
  sync: {
    synced: string;
    syncing: string;
    offlineQueued: string;
    error: string;
  };
  auth: {
    signIn: string;
    signUp: string;
    continueWithGoogle: string;
    emailLabel: string;
    passwordLabel: string;
    fullNameLabel: string;
    forgotPassword: string;
    createAccountTitle: string;
    signInTitle: string;
    verifyEmailTitle: string;
    verifyEmailBody: string;
    resendVerification: string;
    iHaveVerified: string;
  };
  landing: {
    heroHeadline: string;
    heroSubhead: string;
    getStarted: string;
    seeHowItWorks: string;
  };
}

export const LOCALES: Record<AppLanguage, LocaleDictionary> = {
  en: {
    langName: 'English',
    tagline: 'Shared money. Clear records. No confusion.',
    nav: {
      home: 'Home',
      myGroups: 'My Groups',
      myPayments: 'My Payments',
      groupMembers: 'Group & Members',
      checkPayments: 'Check Payments',
      promisesDueDates: 'Promises & Due Dates',
      groupExpenses: 'Group Expenses',
      sendReminders: 'Send Reminders',
      moneyReports: 'Money Reports',
      questionsIssues: 'Questions & Issues',
      notifications: 'Notifications',
      settings: 'Settings',
    },
    plain: {
      whatYouNeedToContribute: 'What you need to contribute',
      paidVerified: 'Paid (Verified)',
      waitingVerification: 'Waiting Admin Check',
      amountRemaining: 'Amount remaining',
      submitPaymentProof: 'Submit Payment Proof',
      waitingAdminCheck: 'Waiting for group admin check',
      checkTheMoney: 'Check the money',
      createGroup: 'Create a Group',
      joinGroup: 'Join a Group',
      checkPayment: 'Check Payment',
      setMemberContributions: 'Set Member Contributions',
      askQuestionReportIssue: 'Ask a Question / Report Issue',
      groupExpensesTransparency: 'Group Expenses',
      verifiedBadge: 'Paid',
      partialBadge: 'Partial',
      overdueBadge: 'Overdue',
      dueSoonBadge: 'Due Soon',
      unpaidBadge: 'Unpaid',
    },
    sync: {
      synced: 'Cloud synced',
      syncing: 'Syncing...',
      offlineQueued: 'Offline · Saved locally',
      error: 'Sync needs attention',
    },
    auth: {
      signIn: 'Sign In',
      signUp: 'Create Account',
      continueWithGoogle: 'Continue with Google',
      emailLabel: 'Email address',
      passwordLabel: 'Password',
      fullNameLabel: 'Full name',
      forgotPassword: 'Forgot password?',
      createAccountTitle: 'Create your UNIT SPOT account',
      signInTitle: 'Sign in to UNIT SPOT',
      verifyEmailTitle: 'Check your email to continue',
      verifyEmailBody: 'We sent a verification link to your email address. Click the link, then press "I have verified" below.',
      resendVerification: 'Resend verification email',
      iHaveVerified: 'I have verified — Continue',
    },
    landing: {
      heroHeadline: 'Shared money. Clear records. No confusion.',
      heroSubhead:
        'Track group contributions, upload mobile money receipts, check balances, and share expenses honestly across shared houses, families, chilimba, churches, and teams in Malawi.',
      getStarted: 'Get Started',
      seeHowItWorks: 'See How It Works',
    },
  },
  ny: {
    langName: 'Chichewa',
    tagline: 'Ndalama zogawana. Zolemba zomveka bwino. Palibe chisokonezo.',
    nav: {
      home: 'Poyambira',
      myGroups: 'Magulu Anga',
      myPayments: 'Malipiro Anga',
      groupMembers: 'Gulu & Mamembala',
      checkPayments: 'Onani Malipiro',
      promisesDueDates: 'Malonjezo & Tsiku Lomaliza',
      groupExpenses: 'Zogwiritsidwa Ntchito',
      sendReminders: 'Tumizani Zikumbutso',
      moneyReports: 'Malipoti a Ndalama',
      questionsIssues: 'Mafunso & Mavuto',
      notifications: 'Zidziwitso',
      settings: 'Zosintha',
    },
    plain: {
      whatYouNeedToContribute: 'Zomwe muyenera kupereka',
      paidVerified: 'Zolipira (Zatsimikiziridwa)',
      waitingVerification: 'Zikudikira kutsimikiziridwa',
      amountRemaining: 'Ndalama yotsala',
      submitPaymentProof: 'Tumizani Umboni wa Malipiro',
      waitingAdminCheck: 'Zikudikira woyang’anira gulu',
      checkTheMoney: 'Onani ndalama',
      createGroup: 'Pangani Gulu',
      joinGroup: 'Lowani m’Gulu',
      checkPayment: 'Tsimikizirani Malipiro',
      setMemberContributions: 'Ikani Zopereka za Mamembala',
      askQuestionReportIssue: 'Funsani Funso / Dandaulani',
      groupExpensesTransparency: 'Zogwiritsidwa Ntchito za Gulu',
      verifiedBadge: 'Zolipira',
      partialBadge: 'Zina Zolipira',
      overdueBadge: 'Tsiku Ladutsa',
      dueSoonBadge: 'Tsiku Layandikira',
      unpaidBadge: 'Zisanalipidwe',
    },
    sync: {
      synced: 'Zasungidwa pa mtambo',
      syncing: 'Zikusungidwa...',
      offlineQueued: 'Palibe intaneti · Zasungidwa pafupi',
      error: 'Vuto losunga pa mtambo',
    },
    auth: {
      signIn: 'Lowani',
      signUp: 'Pangani Akaunti',
      continueWithGoogle: 'Pitirizani ndi Google',
      emailLabel: 'Imelo yanu',
      passwordLabel: 'Mawu achinsinsi',
      fullNameLabel: 'Dzina lanu lonse',
      forgotPassword: 'Mwayiwala mawu achinsinsi?',
      createAccountTitle: 'Pangani akaunti ya UNIT SPOT',
      signInTitle: 'Lowani mu UNIT SPOT',
      verifyEmailTitle: 'Onani imelo yanu kuti mupitirize',
      verifyEmailBody: 'Tatumiza ulalo wotsimikizira ku imelo yanu. Dinani ulalowo, kenako dinani batani ili m’munsi.',
      resendVerification: 'Tumizaninso imelo yotsimikizira',
      iHaveVerified: 'Ndatsimikizira — Pitirizani',
    },
    landing: {
      heroHeadline: 'Ndalama zogawana. Zolemba zomveka bwino. Palibe chisokonezo.',
      heroSubhead:
        'Lembani ndalama zopereka za gulu, tumizani zithunzi za Airtel Money kapena Mpamba, ndipo onani ndalama zotsala momveka bwino m’nyumba, m’banja, chilimba, mpingo, ndi magulu ena ku Malawi.',
      getStarted: 'Yambani Tsopano',
      seeHowItWorks: 'Onani Momwe Zimagwirira Ntchito',
    },
  },
};

export function getLocaleStrings(lang: AppLanguage = 'en'): LocaleDictionary {
  return LOCALES[lang] || LOCALES.en;
}
