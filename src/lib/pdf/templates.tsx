import * as React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { PBCItem, EngagementSettings, AccessRequest, Walkthrough, TSC } from '@/types';

const NAVY = '#1F4E78';
const GOLD = '#BF8F00';
const INK_500 = '#64748B';
const INK_700 = '#334155';
const INK_900 = '#0F172A';
const RULE = '#E5E7EB';
const SUCCESS = '#548235';
const DANGER = '#9C2A2A';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9.5, color: INK_900, lineHeight: 1.4 },
  headerBar: { borderBottomWidth: 1, borderBottomColor: NAVY, paddingBottom: 8, marginBottom: 18, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  brand: { color: NAVY, fontSize: 8, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold' },
  title: { color: INK_900, fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  subtitle: { color: INK_500, fontSize: 9 },
  rightHeader: { textAlign: 'right' },
  client: { fontSize: 11, color: INK_900, fontFamily: 'Helvetica-Bold' },
  period: { fontSize: 9, color: INK_500 },
  sectionLabel: { fontSize: 8, color: INK_500, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpiTile: { flex: 1, borderWidth: 1, borderColor: RULE, padding: 10, borderRadius: 4 },
  kpiLabel: { fontSize: 7, color: INK_500, letterSpacing: 1.2, fontFamily: 'Helvetica-Bold' },
  kpiValue: { fontSize: 18, color: INK_900, fontFamily: 'Helvetica-Bold', marginTop: 4 },
  kpiSub: { fontSize: 7.5, color: INK_500, marginTop: 2 },
  table: { width: '100%', marginTop: 4 },
  th: { fontSize: 7.5, color: INK_500, letterSpacing: 0.8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', borderBottomWidth: 1, borderBottomColor: RULE, paddingBottom: 4, paddingTop: 4 },
  td: { fontSize: 9, color: INK_700, paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: RULE },
  pill: { fontSize: 7.5, paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 2, fontFamily: 'Helvetica-Bold', alignSelf: 'flex-start' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: INK_500, borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 6 },
  twoCol: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  card: { borderWidth: 1, borderColor: RULE, padding: 12, borderRadius: 4, flex: 1 },
  bar: { height: 9, borderRadius: 1, flexDirection: 'row', overflow: 'hidden', backgroundColor: '#F1F5F9' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 7, height: 7, borderRadius: 1 },
  catRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 1.5, gap: 6 },
  catName: { width: 110, fontSize: 8, color: INK_700 },
  catBar: { flex: 1 },
  catCount: { width: 36, textAlign: 'right', fontSize: 7.5, color: INK_500 },
});

const STATUS_COLORS: Record<string, string> = {
  Received: SUCCESS, Reviewed: '#3a5c25', 'In Progress': GOLD, Requested: '#5687b0', 'Not Started': '#cbd5e1', 'N/A': '#94a3b8',
};
const STATUS_ORDER = ['Reviewed', 'Received', 'In Progress', 'Requested', 'Not Started', 'N/A'];

interface ReportProps {
  settings: EngagementSettings;
  items: PBCItem[];
  access?: AccessRequest[];
  walkthroughs?: Walkthrough[];
  variant: 'client' | 'full';
  tscFilter?: TSC[];
}

function Header({ settings, kind, tscFilter }: { settings: EngagementSettings; kind: string; tscFilter?: TSC[] }) {
  return (
    <View style={styles.headerBar}>
      <View>
        <Text style={styles.brand}>{settings.projectTitle.toUpperCase()}</Text>
        <Text style={styles.title}>{kind}</Text>
        {tscFilter && tscFilter.length > 0 && (
          <Text style={[styles.subtitle, { marginTop: 1 }]}>Filtered to TSC: {tscFilter.join(', ')}</Text>
        )}
      </View>
      <View style={styles.rightHeader}>
        <Text style={styles.client}>{settings.clientName}</Text>
        <Text style={styles.period}>{settings.auditPeriod} · {new Date().toISOString().slice(0, 10)}</Text>
      </View>
    </View>
  );
}

function Footer({ settings, variant }: { settings: EngagementSettings; variant: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{settings.clientName} · {settings.auditPeriod}</Text>
      <Text>{variant === 'client' ? 'Client status report' : 'Internal status report'} · Confidential</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function StatusBar({ counts, total }: { counts: Record<string, number>; total: number }) {
  return (
    <View style={styles.bar}>
      {STATUS_ORDER.map(s => {
        const v = counts[s] || 0;
        if (v === 0) return null;
        const w = (v / total) * 100;
        return <View key={s} style={{ width: `${w}%`, backgroundColor: STATUS_COLORS[s] }} />;
      })}
    </View>
  );
}

function CategoryBars({ items }: { items: PBCItem[] }) {
  const map = new Map<string, Record<string, number>>();
  for (const i of items) {
    if (!map.has(i.category)) map.set(i.category, {});
    map.get(i.category)![i.status] = (map.get(i.category)![i.status] || 0) + 1;
  }
  const arr = Array.from(map.entries()).map(([cat, counts]) => {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const received = (counts['Received'] || 0) + (counts['Reviewed'] || 0);
    const outstanding = total - received - (counts['N/A'] || 0);
    const pct = total === 0 ? 0 : outstanding / Math.max(total - (counts['N/A'] || 0), 1);
    return { cat, counts, total, received, pct };
  });
  arr.sort((a, b) => b.pct - a.pct);
  return (
    <View>
      {arr.map(c => (
        <View key={c.cat} style={styles.catRow}>
          <Text style={styles.catName}>{c.cat}</Text>
          <View style={styles.catBar}><StatusBar counts={c.counts} total={c.total} /></View>
          <Text style={styles.catCount}>{c.received}/{c.total}</Text>
        </View>
      ))}
      <View style={styles.legend}>
        {STATUS_ORDER.map(s => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS[s] }]} />
            <Text style={{ fontSize: 7.5, color: INK_500 }}>{s}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ClientStatusReport({ settings, items, walkthroughs, tscFilter }: ReportProps) {
  const total = items.length;
  const received = items.filter(i => ['Received', 'Reviewed'].includes(i.status)).length;
  const inProgress = items.filter(i => ['In Progress', 'Requested'].includes(i.status)).length;
  const outstanding = items.filter(i => !['Received', 'Reviewed', 'N/A'].includes(i.status)).length;
  const pct = total === 0 ? 0 : Math.round(received / total * 100);
  const outstandingHigh = items.filter(i => i.priority === 'High' && !['Received', 'Reviewed', 'N/A'].includes(i.status));
  const upcomingWalks = (walkthroughs || [])
    .filter(w => w.proposedDate)
    .sort((a, b) => (a.proposedDate || '').localeCompare(b.proposedDate || ''));

  // Tightened single-page layout: smaller pads, dense rows, capped item list, compact walkthroughs.
  const pageStyle = { ...styles.page, padding: 28, fontSize: 8.5 };
  const tightKpiTile = { ...styles.kpiTile, padding: 6 };
  const tightCard = { ...styles.card, padding: 6 };
  const HIGH_CAP = 8;
  const WALK_CAP = 5;

  return (
    <Document>
      <Page size="A4" style={pageStyle}>
        <Header settings={settings} kind="Client Status Report" tscFilter={tscFilter} />

        <View style={[styles.kpiRow, { marginBottom: 10, gap: 6 }]}>
          <View style={tightKpiTile}><Text style={styles.kpiLabel}>TOTAL</Text><Text style={[styles.kpiValue, { fontSize: 15, marginTop: 2 }]}>{total}</Text></View>
          <View style={tightKpiTile}><Text style={styles.kpiLabel}>RECEIVED</Text><Text style={[styles.kpiValue, { color: SUCCESS, fontSize: 15, marginTop: 2 }]}>{received}</Text><Text style={styles.kpiSub}>{pct}%</Text></View>
          <View style={tightKpiTile}><Text style={styles.kpiLabel}>IN PROGRESS</Text><Text style={[styles.kpiValue, { fontSize: 15, marginTop: 2 }]}>{inProgress}</Text></View>
          <View style={tightKpiTile}><Text style={styles.kpiLabel}>OUTSTANDING</Text><Text style={[styles.kpiValue, { color: outstanding > total * 0.5 ? DANGER : INK_900, fontSize: 15, marginTop: 2 }]}>{outstanding}</Text></View>
          <View style={tightKpiTile}><Text style={styles.kpiLabel}>OUTST. HIGH</Text><Text style={[styles.kpiValue, { color: outstandingHigh.length > 0 ? DANGER : SUCCESS, fontSize: 15, marginTop: 2 }]}>{outstandingHigh.length}</Text></View>
        </View>

        <Text style={[styles.sectionLabel, { marginBottom: 4 }]}>STATUS BY CATEGORY</Text>
        <View style={[tightCard, { marginBottom: 8 }]}><CategoryBars items={items} /></View>

        <Text style={[styles.sectionLabel, { marginBottom: 4 }]}>OUTSTANDING HIGH-PRIORITY ITEMS ({outstandingHigh.length})</Text>
        <View style={[tightCard, { padding: 6, marginBottom: 8 }]}>
          <View style={styles.table}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={[styles.th, { width: 18 }]}>#</Text>
              <Text style={[styles.th, { width: 96 }]}>Category</Text>
              <Text style={[styles.th, { flex: 1 }]}>Item</Text>
              <Text style={[styles.th, { width: 64 }]}>Status</Text>
            </View>
            {outstandingHigh.length === 0 && <Text style={[styles.td, { fontStyle: 'italic', color: INK_500, paddingVertical: 6 }]}>No outstanding high-priority items.</Text>}
            {outstandingHigh.slice(0, HIGH_CAP).map(i => (
              <View key={i.id} style={{ flexDirection: 'row' }} wrap={false}>
                <Text style={[styles.td, { width: 18, fontSize: 8 }]}>{i.num}</Text>
                <Text style={[styles.td, { width: 96, fontSize: 7.5 }]}>{i.category}</Text>
                <Text style={[styles.td, { flex: 1, fontSize: 8 }]}>{i.itemRequested.slice(0, 110)}</Text>
                <Text style={[styles.td, { width: 64, fontSize: 7.5, color: NAVY, fontFamily: 'Helvetica-Bold' }]}>{i.status}</Text>
              </View>
            ))}
            {outstandingHigh.length > HIGH_CAP && (
              <Text style={[styles.td, { color: INK_500, fontStyle: 'italic', paddingTop: 3, fontSize: 7.5 }]}>+ {outstandingHigh.length - HIGH_CAP} more — see full list</Text>
            )}
          </View>
        </View>

        <Text style={[styles.sectionLabel, { marginBottom: 4 }]}>WALKTHROUGH SCHEDULE</Text>
        <View style={[tightCard, { padding: 6 }]}>
          {upcomingWalks.length === 0 ? (
            <Text style={[styles.td, { fontStyle: 'italic', color: INK_500, paddingVertical: 4 }]}>No walkthroughs scheduled yet.</Text>
          ) : (
            <View style={styles.table}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[styles.th, { width: 56 }]}>Date</Text>
                <Text style={[styles.th, { width: 110 }]}>Process Area</Text>
                <Text style={[styles.th, { flex: 1 }]}>Topics</Text>
                <Text style={[styles.th, { width: 64 }]}>Status</Text>
              </View>
              {upcomingWalks.slice(0, WALK_CAP).map(w => (
                <View key={w.id} style={{ flexDirection: 'row' }} wrap={false}>
                  <Text style={[styles.td, { width: 56, fontSize: 7.5 }]}>{w.proposedDate?.slice(0, 10)}</Text>
                  <Text style={[styles.td, { width: 110, fontSize: 7.5 }]}>{w.processArea}</Text>
                  <Text style={[styles.td, { flex: 1, fontSize: 7.5 }]}>{w.keyTopics.slice(0, 90)}</Text>
                  <Text style={[styles.td, { width: 64, fontSize: 7.5 }]}>{w.status}</Text>
                </View>
              ))}
              {upcomingWalks.length > WALK_CAP && (
                <Text style={[styles.td, { color: INK_500, fontStyle: 'italic', paddingTop: 3, fontSize: 7.5 }]}>+ {upcomingWalks.length - WALK_CAP} more</Text>
              )}
            </View>
          )}
        </View>

        <Footer settings={settings} variant="client" />
      </Page>
    </Document>
  );
}

export function FullStatusReport({ settings, items, access, walkthroughs, tscFilter }: ReportProps) {
  const total = items.length;
  const received = items.filter(i => ['Received', 'Reviewed'].includes(i.status)).length;
  const inProgress = items.filter(i => ['In Progress', 'Requested'].includes(i.status)).length;
  const outstanding = items.filter(i => !['Received', 'Reviewed', 'N/A'].includes(i.status)).length;
  const pct = total === 0 ? 0 : Math.round(received / total * 100);
  const outstandingHigh = items.filter(i => i.priority === 'High' && !['Received', 'Reviewed', 'N/A'].includes(i.status));

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Header settings={settings} kind="Internal Status Report" tscFilter={tscFilter} />

        <View style={styles.kpiRow}>
          <View style={styles.kpiTile}><Text style={styles.kpiLabel}>TOTAL</Text><Text style={styles.kpiValue}>{total}</Text></View>
          <View style={styles.kpiTile}><Text style={styles.kpiLabel}>RECEIVED</Text><Text style={[styles.kpiValue, { color: SUCCESS }]}>{received}</Text></View>
          <View style={styles.kpiTile}><Text style={styles.kpiLabel}>IN PROGRESS</Text><Text style={styles.kpiValue}>{inProgress}</Text></View>
          <View style={styles.kpiTile}><Text style={styles.kpiLabel}>OUTSTANDING</Text><Text style={[styles.kpiValue, { color: outstanding > total * 0.5 ? DANGER : INK_900 }]}>{outstanding}</Text></View>
          <View style={styles.kpiTile}><Text style={styles.kpiLabel}>% COMPLETE</Text><Text style={[styles.kpiValue, { color: NAVY }]}>{pct}%</Text></View>
          <View style={styles.kpiTile}><Text style={styles.kpiLabel}>OUTST. HIGH</Text><Text style={[styles.kpiValue, { color: outstandingHigh.length > 0 ? DANGER : SUCCESS }]}>{outstandingHigh.length}</Text></View>
        </View>

        <Text style={styles.sectionLabel}>STATUS BY CATEGORY</Text>
        <View style={[styles.card, { marginBottom: 12 }]}><CategoryBars items={items} /></View>

        <Text style={styles.sectionLabel}>FULL PBC ITEM STATE</Text>
        <View style={styles.table}>
          <View style={{ flexDirection: 'row' }}>
            <Text style={[styles.th, { width: 22 }]}>#</Text>
            <Text style={[styles.th, { width: 96 }]}>Category</Text>
            <Text style={[styles.th, { flex: 1 }]}>Item</Text>
            <Text style={[styles.th, { width: 50 }]}>Prio</Text>
            <Text style={[styles.th, { width: 60 }]}>Owner</Text>
            <Text style={[styles.th, { width: 70 }]}>Status</Text>
          </View>
          {items.map(i => (
            <View key={i.id} style={{ flexDirection: 'row' }} wrap={false}>
              <Text style={[styles.td, { width: 22 }]}>{i.num}</Text>
              <Text style={[styles.td, { width: 96, fontSize: 7.5 }]}>{i.category}</Text>
              <Text style={[styles.td, { flex: 1 }]}>{i.itemRequested.slice(0, 110)}</Text>
              <Text style={[styles.td, { width: 50, fontSize: 7.5 }]}>{i.priority}</Text>
              <Text style={[styles.td, { width: 60, fontSize: 7.5 }]}>{i.ownerClient || '—'}</Text>
              <Text style={[styles.td, { width: 70, fontSize: 7.5 }]}>{i.status}</Text>
            </View>
          ))}
        </View>
        <Footer settings={settings} variant="full" />
      </Page>

      {(access && access.length > 0) && (
        <Page size="A4" style={styles.page}>
          <Header settings={settings} kind="Access Provisioning" />
          <View style={styles.table}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={[styles.th, { width: 22 }]}>#</Text>
              <Text style={[styles.th, { width: 130 }]}>System</Text>
              <Text style={[styles.th, { width: 90 }]}>Type</Text>
              <Text style={[styles.th, { flex: 1 }]}>Role / permissions</Text>
              <Text style={[styles.th, { width: 80 }]}>Status</Text>
            </View>
            {access.map(a => (
              <View key={a.id} style={{ flexDirection: 'row' }} wrap={false}>
                <Text style={[styles.td, { width: 22 }]}>{a.num}</Text>
                <Text style={[styles.td, { width: 130 }]}>{a.system}</Text>
                <Text style={[styles.td, { width: 90, fontSize: 7.5 }]}>{a.accessType}</Text>
                <Text style={[styles.td, { flex: 1, fontSize: 7.5 }]}>{a.rolePermissions.slice(0, 200)}</Text>
                <Text style={[styles.td, { width: 80, fontSize: 7.5 }]}>{a.status}</Text>
              </View>
            ))}
          </View>
          <Footer settings={settings} variant="full" />
        </Page>
      )}

      {(walkthroughs && walkthroughs.length > 0) && (
        <Page size="A4" style={styles.page}>
          <Header settings={settings} kind="Walkthrough Schedule" />
          <View style={styles.table}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={[styles.th, { width: 22 }]}>#</Text>
              <Text style={[styles.th, { width: 110 }]}>Process Area</Text>
              <Text style={[styles.th, { flex: 1 }]}>Topics</Text>
              <Text style={[styles.th, { width: 65 }]}>Date</Text>
              <Text style={[styles.th, { width: 40 }]}>Dur</Text>
              <Text style={[styles.th, { width: 80 }]}>Status</Text>
            </View>
            {walkthroughs.map(w => (
              <View key={w.id} style={{ flexDirection: 'row' }} wrap={false}>
                <Text style={[styles.td, { width: 22 }]}>{w.num}</Text>
                <Text style={[styles.td, { width: 110 }]}>{w.processArea}</Text>
                <Text style={[styles.td, { flex: 1, fontSize: 7.5 }]}>{w.keyTopics.slice(0, 200)}</Text>
                <Text style={[styles.td, { width: 65, fontSize: 7.5 }]}>{w.proposedDate?.slice(0, 10) || '—'}</Text>
                <Text style={[styles.td, { width: 40, fontSize: 7.5 }]}>{w.durationMin || '—'}</Text>
                <Text style={[styles.td, { width: 80, fontSize: 7.5 }]}>{w.status}</Text>
              </View>
            ))}
          </View>
          <Footer settings={settings} variant="full" />
        </Page>
      )}
    </Document>
  );
}
