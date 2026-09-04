import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { CurrentUserService } from '../../core/services/current-user.service';
import { MockTaskService } from '../../mock-data/services/mock-task.service';
import { TaskAssignment } from '../../core/models/management.model';
import { ItemsManagerComponent } from './items-manager.component';
import { TasksManagerComponent } from './tasks-manager.component';
import { TaskAssignmentComponent } from './task-assignment.component';
import { AssignmentProgressComponent } from './assignment-progress.component';

/**
 * Professional workspace shell hosted at the `/management` route.
 *
 * Standalone, OnPush, signal-driven. Composes the four professional-facing
 * child areas in a tabbed layout ({@link MatTabsModule}):
 * - Items ({@link ItemsManagerComponent}, Requirement 4.1)
 * - Tasks ({@link TasksManagerComponent}, Requirement 5.1)
 * - Assignment ({@link TaskAssignmentComponent})
 * - Progress ({@link AssignmentProgressComponent}, one per assignment)
 *
 * The signed-in professional's id is resolved from {@link CurrentUserService}
 * (Requirement 3.2). The former athlete recommendation view previously hosted
 * here has been migrated to `ControlCenterComponent` / `RecommendationTabsComponent`.
 */
@Component({
  selector: 'app-management',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ItemsManagerComponent,
    TasksManagerComponent,
    TaskAssignmentComponent,
    AssignmentProgressComponent,
  ],
  templateUrl: './management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './management.component.scss',
})
export class ManagementComponent implements OnInit {
  private readonly currentUser = inject(CurrentUserService);
  private readonly taskService = inject(MockTaskService);

  /** The signed-in professional's id, resolved from CurrentUserService. */
  readonly professionalId = computed(() => this.currentUser.userId());

  /** The professional's TaskAssignments, one Progress panel is shown per record. */
  readonly assignments = signal<TaskAssignment[]>([]);

  /** True while the professional's assignments are being loaded. */
  readonly loading = signal<boolean>(false);

  ngOnInit(): void {
    this.reloadAssignments();
  }

  /** Re-read the professional's assignments from the store. */
  reloadAssignments(): void {
    this.loading.set(true);
    this.taskService.getAssignmentsForProfessional(this.professionalId()).subscribe({
      next: assignments => {
        this.assignments.set(assignments);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
