/* FP&A Work Journal data. This is the only file to edit when an assignment is issued or completed.
   FB_TASKS: one object per assignment, newest first. status: 'active' | 'done'.
     phase:    one of the FB_PHASES keys below.
     assigned, due: for your own tracking only; the site never displays them.
     approach, finding, feedback: plain text; empty string hides the block.
     score:    number out of 10 (manager review) or null.
     links:    [{ label: 'Variance workbook (.xlsx)', href: 'https://...' }]
   FB_COMPANY.booksClosed: bump when a new month is closed. */
const FB_TASKS = [
  {
    id: 'fb-01', num: '01', phase: 'close', status: 'active',
    category: 'Month-End Close', assigned: 'Oct 5, 2026', due: 'Oct 7, 2026',
    title: 'September Close: Budget vs. Actual Variance',
    blurb: 'September operating income landed well below plan. Build the MTD and YTD variance P&L off the GL, explain every material driver, and tell the CFO what it means for Q4.',
    ask: 'Summary P&L for September and YTD with $ / % variance and F/U flags, built off the raw GL with traceable formulas. One page of CFO-ready commentary tagging each driver as timing, one-time, or run-rate, plus 3–5 specific flags for the Q4 reforecast.',
    approach: '', finding: '', feedback: '', score: null,
    skills: ['Variance Analysis', 'SUMIFS / Pivots', 'GL Drill-Down', 'Executive Commentary'],
    links: []
  }
];

const FB_PHASES = [
  ['close', 'Month-End Close'], ['forecast', 'Reforecast'], ['budget', 'Budget Build'],
  ['board', 'Board Deck'], ['adhoc', 'Ad Hoc Analysis']
];

const FB_COMPANY = {
  booksClosed: 'Sep 2026',
  onTheJobSince: "Oct '26"
};
