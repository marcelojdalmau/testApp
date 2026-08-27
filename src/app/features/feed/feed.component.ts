import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';

import { AuthService } from '../../core/services/auth.service';
import { MockFeedService } from '../../mock-data/services/mock-feed.service';
import { FeedItem, DashboardStat, QuickAction } from '../../core/models/feed.model';
import { UserRole } from '../../core/models/user.model';
import { MOCK_ATHLETES } from '../../mock-data/athletes.data';

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
  ],
  templateUrl: './feed.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './feed.component.scss',
})
export class FeedComponent implements OnInit {
  private authService = inject(AuthService);
  private feedService = inject(MockFeedService);

  feedItems = signal<FeedItem[]>([]);
  stats = signal<DashboardStat[]>([]);
  quickActions = signal<QuickAction[]>([]);

  userName = signal('');
  userRole = signal<UserRole>('athlete');
  greeting = signal('');

  ngOnInit(): void {
    let user = this.authService.currentUser();

    // If no user logged in, load a demo user
    if (!user) {
      this.authService.switchUser(MOCK_ATHLETES[0]);
      user = MOCK_ATHLETES[0];
    }

    const role: UserRole = user.role;

    this.userName.set(user.fullName);
    this.userRole.set(role);
    this.greeting.set(this.getGreeting());

    this.feedService.getFeedItems(role).subscribe(items => this.feedItems.set(items));
    this.feedService.getDashboardStats(role).subscribe(stats => this.stats.set(stats));
    this.feedService.getQuickActions(role).subscribe(actions => this.quickActions.set(actions));
  }

  getRoleLabel(): string {
    switch (this.userRole()) {
      case 'athlete': return 'Deportista';
      case 'health-professional': return 'Profesional de Salud';
      case 'coach': return 'Entrenador';
      case 'institution': return 'Institución';
      case 'management': return 'Gestión';
      default: return '';
    }
  }

  private getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  }
}
