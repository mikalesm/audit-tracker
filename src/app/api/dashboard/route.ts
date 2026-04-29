import { NextResponse } from 'next/server';
import {
  pbcStatusCounts, pbcCategoryStatus, pbcPriorityCounts,
  pbcOutstandingHigh, pbcReceivedTrend, pbcOverdue, listPBC,
} from '@/lib/repository/pbc';
import { recentPBCActivityWithTitles } from '@/lib/repository/activity';
import { upcomingWalkthroughs } from '@/lib/repository/walkthroughs';
import { entitiesInScope } from '@/lib/repository/entities';

export const dynamic = 'force-dynamic';

function dateOnly(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

export async function GET() {
  const [status, all, categoryStatus, priorityCounts, outstandingHigh, receivedTrend, overdue, activity, upcoming, scope] =
    await Promise.all([
      pbcStatusCounts(),
      listPBC(),
      pbcCategoryStatus(),
      pbcPriorityCounts(),
      pbcOutstandingHigh(),
      pbcReceivedTrend(14),
      pbcOverdue(),
      recentPBCActivityWithTitles(10),
      upcomingWalkthroughs(14),
      entitiesInScope(),
    ]);

  const total = all.length;
  const received = all.filter(i => i.status === 'Received' || i.status === 'Reviewed').length;
  const inProgress = all.filter(i => i.status === 'In Progress' || i.status === 'Requested').length;
  const outstanding = all.filter(i => !['Received', 'Reviewed', 'N/A'].includes(i.status)).length;
  const pctComplete = total === 0 ? 0 : Math.round((received / total) * 100);

  return NextResponse.json({
    kpi: {
      total, received, inProgress, outstanding, pctComplete,
      outstandingHighPriority: outstandingHigh,
    },
    statusCounts: status,
    categoryStatus,
    priorityCounts,
    receivedTrend,
    overdue: overdue.map(o => ({
      id: Number(o.id), num: Number(o.num), category: o.category, item: o.item_requested,
      priority: o.priority,
      dateRequested: dateOnly(o.date_requested),
      status: o.status,
    })),
    recentActivity: activity,
    upcoming: upcoming.map(u => ({
      id: Number(u.id), num: Number(u.num), process_area: u.process_area,
      proposed_date: dateOnly(u.proposed_date),
      duration_min: u.duration_min === null ? null : Number(u.duration_min),
      status: u.status,
    })),
    entityScope: scope,
  });
}
