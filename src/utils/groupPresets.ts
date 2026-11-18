import { ExpenseCategory, Group } from '../types';

export type GroupCategoryId = Group['category'];

export interface GroupPreset {
  id: GroupCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  supportsAccommodationRates: boolean;
  defaultAllocationMode: 'stove_rate' | 'percentage' | 'custom';
  suggestedContributionCategories: ExpenseCategory[];
  suggestedExpenseCategories: ExpenseCategory[];
  defaultRulesPlaceholder: string;
  exampleGroupName: string;
  unitLabel: string;
}

export const GROUP_PRESETS: Record<GroupCategoryId, GroupPreset> = {
  house: {
    id: 'house',
    label: 'Shared House',
    shortLabel: 'House',
    description: 'Housemates sharing electricity, water, rent, or security bills.',
    supportsAccommodationRates: true,
    defaultAllocationMode: 'stove_rate',
    suggestedContributionCategories: ['electricity', 'water', 'rent', 'waste', 'internet', 'security', 'maintenance', 'groceries', 'other'],
    suggestedExpenseCategories: ['electricity', 'water', 'rent', 'waste', 'internet', 'security', 'maintenance', 'groceries', 'other'],
    defaultRulesPlaceholder: 'Send Airtel Money or TNM Mpamba ref / receipt photo after payment.',
    exampleGroupName: 'Area 47 House 12',
    unitLabel: 'Room / Unit',
  },
  hostel: {
    id: 'hostel',
    label: 'Student Hostel',
    shortLabel: 'Hostel',
    description: 'Students sharing hostel utilities, tokens, water, or cleaning.',
    supportsAccommodationRates: true,
    defaultAllocationMode: 'stove_rate',
    suggestedContributionCategories: ['electricity', 'water', 'internet', 'waste', 'school', 'security', 'maintenance', 'other'],
    suggestedExpenseCategories: ['electricity', 'water', 'internet', 'waste', 'school', 'security', 'maintenance', 'other'],
    defaultRulesPlaceholder: 'Electric stove MK 10,000 · Non-electric stove MK 5,000 for electricity.',
    exampleGroupName: 'Chichiri Block B Hostel',
    unitLabel: 'Room / Bed',
  },
  family: {
    id: 'family',
    label: 'Family / Household',
    shortLabel: 'Family',
    description: 'Relatives pooling money for upkeep, school fees, or family events.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'percentage',
    suggestedContributionCategories: ['groceries', 'school', 'utilities', 'water', 'electricity', 'emergency', 'event', 'other'],
    suggestedExpenseCategories: ['groceries', 'school', 'utilities', 'electricity', 'water', 'emergency', 'event', 'other'],
    defaultRulesPlaceholder: 'Each member contributes before month-end via mobile money, bank, or cash.',
    exampleGroupName: 'Banda Family Fund',
    unitLabel: 'Role / Household',
  },
  friends: {
    id: 'friends',
    label: 'Friends & Trips',
    shortLabel: 'Friends',
    description: 'Lake trips, birthdays, weddings, or weekend hangout cost-sharing.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'percentage',
    suggestedContributionCategories: ['event', 'groceries', 'transport', 'other'],
    suggestedExpenseCategories: ['event', 'groceries', 'transport', 'other'],
    defaultRulesPlaceholder: 'Agreed member percentages or custom shares before the trip date.',
    exampleGroupName: 'Mangochi Lake Trip',
    unitLabel: 'Role / Note',
  },
  savings_group: {
    id: 'savings_group',
    label: 'Chilimba / Savings Group',
    shortLabel: 'Savings',
    description: 'Village banks, rotating savings (chilimba), or investment circles.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'percentage',
    suggestedContributionCategories: ['savings', 'emergency', 'project', 'other'],
    suggestedExpenseCategories: ['savings', 'emergency', 'project', 'other'],
    defaultRulesPlaceholder: 'Monthly or weekly savings share due before each meeting.',
    exampleGroupName: 'Lilongwe Chilimba Circle',
    unitLabel: 'Share / Seat',
  },
  church: {
    id: 'church',
    label: 'Church / Fellowship',
    shortLabel: 'Church',
    description: 'Choir, youth fellowship, welfare, or ministry building contributions.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'custom',
    suggestedContributionCategories: ['welfare', 'project', 'event', 'maintenance', 'other'],
    suggestedExpenseCategories: ['welfare', 'project', 'event', 'maintenance', 'transport', 'other'],
    defaultRulesPlaceholder: 'Voluntary pledges or agreed group contributions recorded transparently.',
    exampleGroupName: 'Youth Choir Fund',
    unitLabel: 'Department / Group',
  },
  business: {
    id: 'business',
    label: 'Small Business / Partnership',
    shortLabel: 'Business',
    description: 'Partners tracking stock contributions, shop rent, or shared expenses.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'custom',
    suggestedContributionCategories: ['rent', 'utilities', 'transport', 'maintenance', 'project', 'other'],
    suggestedExpenseCategories: ['rent', 'utilities', 'electricity', 'water', 'transport', 'maintenance', 'project', 'other'],
    defaultRulesPlaceholder: 'Record all receipts and mobile money references immediately.',
    exampleGroupName: 'Area 25 Shop Partners',
    unitLabel: 'Role / Desk',
  },
  club: {
    id: 'club',
    label: 'Club / Association',
    shortLabel: 'Club',
    description: 'Sports teams, alumni groups, and social clubs managing dues.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'percentage',
    suggestedContributionCategories: ['dues', 'event', 'transport', 'other'],
    suggestedExpenseCategories: ['dues', 'event', 'transport', 'other'],
    defaultRulesPlaceholder: 'Monthly club dues and match-day expense sharing.',
    exampleGroupName: 'Blantyre Social FC',
    unitLabel: 'Position / Team',
  },
  community: {
    id: 'community',
    label: 'Community / Neighbourhood',
    shortLabel: 'Community',
    description: 'Neighbourhood watch, borehole repair, road upkeep, or funeral fund.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'percentage',
    suggestedContributionCategories: ['security', 'water', 'project', 'maintenance', 'welfare', 'other'],
    suggestedExpenseCategories: ['security', 'water', 'project', 'maintenance', 'welfare', 'other'],
    defaultRulesPlaceholder: 'Transparent community ledger for every household.',
    exampleGroupName: 'Sector 4 Borehole Committee',
    unitLabel: 'Plot / House',
  },
  project: {
    id: 'project',
    label: 'Group Project',
    shortLabel: 'Project',
    description: 'One-off build, fundraising drive, or joint community project.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'custom',
    suggestedContributionCategories: ['project', 'maintenance', 'transport', 'other'],
    suggestedExpenseCategories: ['project', 'maintenance', 'transport', 'other'],
    defaultRulesPlaceholder: 'Track pledges, purchases, and remaining budget clearly.',
    exampleGroupName: 'Mzuzu Maize Mill Project',
    unitLabel: 'Task / Role',
  },
  workplace: {
    id: 'workplace',
    label: 'Office / Workplace Team',
    shortLabel: 'Workplace',
    description: 'Colleagues sharing tea/lunch funds, welfare, or office celebrations.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'percentage',
    suggestedContributionCategories: ['groceries', 'welfare', 'event', 'other'],
    suggestedExpenseCategories: ['groceries', 'welfare', 'event', 'other'],
    defaultRulesPlaceholder: 'Monthly tea fund and colleague welfare contributions.',
    exampleGroupName: 'Finance Dept Welfare',
    unitLabel: 'Department',
  },
  event: {
    id: 'event',
    label: 'Wedding / Event Committee',
    shortLabel: 'Event',
    description: 'Chinkhoswe, wedding, send-off, or celebration committees.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'custom',
    suggestedContributionCategories: ['event', 'groceries', 'transport', 'other'],
    suggestedExpenseCategories: ['event', 'groceries', 'transport', 'other'],
    defaultRulesPlaceholder: 'Track pledges, committee payments, and vendor expenses.',
    exampleGroupName: 'Chisomo & Kondwani Wedding',
    unitLabel: 'Committee Role',
  },
  other: {
    id: 'other',
    label: 'Other Group',
    shortLabel: 'Other',
    description: 'Any shared money group in Malawi.',
    supportsAccommodationRates: false,
    defaultAllocationMode: 'percentage',
    suggestedContributionCategories: ['other', 'utilities', 'event', 'welfare', 'project'],
    suggestedExpenseCategories: ['other', 'utilities', 'event', 'welfare', 'project'],
    defaultRulesPlaceholder: 'Keep shared contributions and expenses clear for everyone.',
    exampleGroupName: 'Shared Group Fund',
    unitLabel: 'Role / Tag',
  },
};

export const GROUP_CATEGORY_LIST: GroupPreset[] = [
  GROUP_PRESETS.house,
  GROUP_PRESETS.hostel,
  GROUP_PRESETS.family,
  GROUP_PRESETS.friends,
  GROUP_PRESETS.savings_group,
  GROUP_PRESETS.church,
  GROUP_PRESETS.event,
  GROUP_PRESETS.community,
  GROUP_PRESETS.business,
  GROUP_PRESETS.club,
  GROUP_PRESETS.workplace,
  GROUP_PRESETS.project,
  GROUP_PRESETS.other,
];

export function getGroupPreset(category?: GroupCategoryId | string | null): GroupPreset {
  if (category && category in GROUP_PRESETS) {
    return GROUP_PRESETS[category as GroupCategoryId];
  }
  return GROUP_PRESETS.other;
}

export function supportsAccommodationRates(category?: GroupCategoryId | string | null): boolean {
  return category === 'house' || category === 'hostel';
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  water: 'Water',
  electricity: 'Electricity / ESCOM',
  rent: 'Rent',
  internet: 'Internet / Wi-Fi',
  groceries: 'Groceries / Food',
  waste: 'Cleaning',
  maintenance: 'Maintenance / Repairs',
  transport: 'Transport / Fuel',
  school: 'School-related expenses',
  event: 'Events',
  project: 'Projects',
  security: 'Security / Guard',
  utilities: 'Shared Utilities',
  savings: 'Savings / Chilimba Share',
  welfare: 'Welfare / Support',
  emergency: 'Emergency Fund',
  dues: 'Membership Dues',
  other: 'Other / Custom expense',
};

export const ORDERED_CONTRIBUTION_CATEGORIES: ExpenseCategory[] = [
  'water',
  'electricity',
  'rent',
  'internet',
  'groceries',
  'waste',
  'maintenance',
  'transport',
  'school',
  'event',
  'project',
  'security',
  'utilities',
  'savings',
  'welfare',
  'emergency',
  'dues',
  'other',
];

export function getExpenseCategoryLabel(
  category: ExpenseCategory | string,
  customLabel?: string
): string {
  const trimmedCustom = (customLabel || '').trim();
  if (trimmedCustom) {
    return trimmedCustom;
  }
  return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] || String(category || 'Other');
}

export const BILL_BASED_CONTRIBUTION_CATEGORIES: ExpenseCategory[] = [
  'electricity',
  'water',
  'rent',
  'internet',
  'maintenance',
  'school',
  'project',
  'utilities',
  'security',
];

export function isBillBasedContributionCategory(category: ExpenseCategory | string): boolean {
  return BILL_BASED_CONTRIBUTION_CATEGORIES.includes(category as ExpenseCategory);
}

export interface ContributionEvidenceRequirement {
  billBased: boolean;
  label: string;
  helper: string;
}

export function getContributionEvidenceRequirement(
  category: ExpenseCategory | string
): ContributionEvidenceRequirement {
  if (isBillBasedContributionCategory(category)) {
    return {
      billBased: true,
      label: 'Supporting Bill, Invoice, or Notice *',
      helper:
        'Formal utility, rent, or project bills require attaching the bill, quotation, or official notice (PDF, JPG, JPEG, or PNG).',
    };
  }
  return {
    billBased: false,
    label: 'Supporting Document or Cost Explanation',
    helper:
      'For everyday group purchases or funds without a formal invoice, you may either attach a photo/quotation OR write a short explanation & estimate for members.',
  };
}


