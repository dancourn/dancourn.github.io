/* FP&A Training Desk data. This is the only file to edit when an assignment is issued or completed.
   FB_TASKS: one object per assignment, newest first. status: 'active' | 'done'.
     phase:    one of the FB_PHASES keys below.
     assigned, due: for your own tracking only; the site never displays them.
     approach, finding, feedback: plain text; empty string hides the block.
     score:    number out of 10 (manager review) or null.
     links:    [{ label: 'Variance workbook (.xlsx)', href: 'https://...' }]
     page:     optional link to the task's deep dive on training-desk.html
     summary, highlights: the newest completed task fills the homepage "Latest assignment" card with these
               (2-sentence summary; up to 3 [value, label] stats)
   FB_COMPANY.booksClosed: bump when a new month is closed.
   FB_COMPANY.status: 'paused' blurs the section behind an "In progress" label; 'active' shows it normally. */
const FB_TASKS = [
  {
    id: 'fb-01', num: '01', phase: 'close', status: 'done',
    category: 'Month-End Close', assigned: 'Oct 5, 2026', due: 'Oct 7, 2026',
    title: 'September Close: Budget vs. Actual Variance',
    blurb: 'September operating income landed well below plan. Build the MTD and YTD variance P&L off the GL, explain every material driver, and tell the CFO what it means for Q4.',
    ask: 'Summary P&L for September and YTD with $ / % variance and F/U flags, built off the raw GL with traceable formulas. One page of CFO-ready commentary tagging each driver as timing, one-time, or run-rate, plus 3–5 specific flags for the Q4 reforecast.',
    approach: 'Built the September and YTD budget-vs-actual P&L with SUMIFS off the raw GL, with a tie-out check that returns zero. Split it into 48 department/account lines, flagged the six over $50K and 10%, and traced each one to its journal entries to tag it timing, one-time or run-rate.',
    finding: 'YTD operating income looked on plan (+$38K) only because R&D was $1.35M under budget on unfilled roles; without it, the business was about $1.3M behind. The biggest run-rate risk sat below the materiality threshold: a lost customer worth $1.4M ARR, about $350K of Q4 revenue.',
    feedback: 'This is a package I would forward to [the CFO] after a light edit. The analysis is right, the structure is right, and the judgment calls (YTD masking, below-threshold churn) are what separate an analyst from a report-builder.',
    score: 8,
    skills: ['Variance Analysis', 'SUMIFS', 'GL Drill-Down', 'Executive Commentary', 'Reforecast Inputs'],
    page: 'training-desk.html#task-01',
    summary: 'Built the September budget-vs-actual package off a raw general ledger and traced six material variances to their journal entries. Found that a flat-looking YTD hid a $1.3M shortfall, and that the biggest Q4 risk sat below the materiality threshold.',
    highlights: [['8/10', 'Review score'], ['82%', 'Of the miss fixes itself'], ['$350K', 'Q4 revenue risk found']],
    links: [
      { label: 'Variance workbook (.xlsx)', href: 'training-desk/Quillmere_Sep26_Variance.xlsx' },
      { label: 'CFO commentary (PDF)', href: 'training-desk/Quillmere_Sep26_Commentary.pdf' }
    ]
  }
];

const FB_PHASES = [
  ['close', 'Month-End Close'], ['forecast', 'Reforecast'], ['budget', 'Budget Build'],
  ['board', 'Board Deck'], ['adhoc', 'Ad Hoc Analysis']
];

const FB_COMPANY = {
  status: 'active',
  booksClosed: 'Sep 2026',
  onTheJobSince: "Oct '26"
};
