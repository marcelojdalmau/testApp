/** Feed item for the dashboard */
export interface FeedItem {
  id: string;
  type: 'training' | 'news' | 'recommendation' | 'match' | 'achievement' | 'convocatoria';
  title: string;
  description: string;
  icon: string;
  timestamp: string;
  actionLabel?: string;
  actionRoute?: string;
  metadata?: Record<string, string>;
}

/** Dashboard stats widget */
export interface DashboardStat {
  label: string;
  value: string | number;
  icon: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
}

/** Quick action button for dashboard */
export interface QuickAction {
  label: string;
  icon: string;
  route: string;
  color?: string;
}
