export const mockAnalytics = {
  totalTasks: 23,
  completedTasks: 18,
  failedTasks: 3,
  cancelledTasks: 2,
  avgExecutionTime: '4m 32s',
  totalLinesChanged: 2847,
  totalFilesModified: 67,
  successRate: 78,
  weeklyData: [
    { week: 'Aug 5', tasks: 2, success: 2 },
    { week: 'Aug 12', tasks: 4, success: 3 },
    { week: 'Aug 19', tasks: 3, success: 3 },
    { week: 'Aug 26', tasks: 5, success: 4 },
    { week: 'Sep 2', tasks: 6, success: 4 },
  ],
  recentPRs: [
    { id: 'pr_001', title: 'feat: JWT token refresh', repo: 'web-platform', status: 'merged', number: 44, createdAt: '2026-09-01T10:35:00Z' },
    { id: 'pr_002', title: 'fix: CORS headers', repo: 'web-platform', status: 'open', number: 43, createdAt: '2026-08-28T15:00:00Z' },
    { id: 'pr_003', title: 'refactor: error handling', repo: 'web-platform', status: 'merged', number: 41, createdAt: '2026-08-25T12:00:00Z' },
  ],
};
