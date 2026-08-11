import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { FeedItem, DashboardStat, QuickAction } from '../../core/models/feed.model';
import { UserRole } from '../../core/models/user.model';
import {
  ATHLETE_FEED_ITEMS, ATHLETE_DASHBOARD_STATS, ATHLETE_QUICK_ACTIONS,
  PROFESSIONAL_FEED_ITEMS, PROFESSIONAL_DASHBOARD_STATS, PROFESSIONAL_QUICK_ACTIONS,
  INSTITUTION_FEED_ITEMS, INSTITUTION_DASHBOARD_STATS, INSTITUTION_QUICK_ACTIONS,
  MANAGEMENT_FEED_ITEMS, MANAGEMENT_DASHBOARD_STATS, MANAGEMENT_QUICK_ACTIONS,
} from '../feed.data';

@Injectable({
  providedIn: 'root'
})
export class MockFeedService {

  /** Get feed items based on user role */
  getFeedItems(role: UserRole): Observable<FeedItem[]> {
    switch (role) {
      case 'athlete':
        return of(ATHLETE_FEED_ITEMS);
      case 'health-professional':
      case 'coach':
        return of(PROFESSIONAL_FEED_ITEMS);
      case 'institution':
        return of(INSTITUTION_FEED_ITEMS);
      case 'management':
        return of(MANAGEMENT_FEED_ITEMS);
      default:
        return of(ATHLETE_FEED_ITEMS);
    }
  }

  /** Get dashboard stats based on user role */
  getDashboardStats(role: UserRole): Observable<DashboardStat[]> {
    switch (role) {
      case 'athlete':
        return of(ATHLETE_DASHBOARD_STATS);
      case 'health-professional':
      case 'coach':
        return of(PROFESSIONAL_DASHBOARD_STATS);
      case 'institution':
        return of(INSTITUTION_DASHBOARD_STATS);
      case 'management':
        return of(MANAGEMENT_DASHBOARD_STATS);
      default:
        return of(ATHLETE_DASHBOARD_STATS);
    }
  }

  /** Get quick actions based on user role */
  getQuickActions(role: UserRole): Observable<QuickAction[]> {
    switch (role) {
      case 'athlete':
        return of(ATHLETE_QUICK_ACTIONS);
      case 'health-professional':
      case 'coach':
        return of(PROFESSIONAL_QUICK_ACTIONS);
      case 'institution':
        return of(INSTITUTION_QUICK_ACTIONS);
      case 'management':
        return of(MANAGEMENT_QUICK_ACTIONS);
      default:
        return of(ATHLETE_QUICK_ACTIONS);
    }
  }
}
