import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatBadgeModule } from '@angular/material/badge';

import { MockCommunicationService } from '../../mock-data/services/mock-communication.service';
import { AuthService } from '../../core/services/auth.service';
import { Conversation, Message, ServiceRequest, CalendarEvent } from '../../core/models/communication.model';

@Component({
  selector: 'app-communication',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatBadgeModule,
  ],
  templateUrl: './communication.component.html',
  styleUrl: './communication.component.scss',
})
export class CommunicationComponent implements OnInit {
  private commService = inject(MockCommunicationService);
  private authService = inject(AuthService);

  currentUserId = '';
  conversations = signal<Conversation[]>([]);
  activeConversation = signal<Conversation | null>(null);
  messages = signal<Message[]>([]);
  serviceRequests = signal<ServiceRequest[]>([]);
  calendarEvents = signal<CalendarEvent[]>([]);
  newMessage = '';

  ngOnInit(): void {
    const user = this.authService.currentUser();
    this.currentUserId = user?.id ?? '';

    // Conversations: only where this user is a participant
    this.commService.getConversations(this.currentUserId).subscribe(convs => {
      this.conversations.set(convs);
      if (convs.length > 0) {
        this.selectConversation(convs[0]);
      }
    });

    // Service requests: only where this user is sender or receiver
    this.commService.getServiceRequests(this.currentUserId).subscribe(reqs => {
      this.serviceRequests.set(reqs);
    });

    // Calendar events: only where this user is a participant
    this.commService.getCalendarEvents(this.currentUserId).subscribe(events => {
      this.calendarEvents.set(events);
    });
  }

  selectConversation(conv: Conversation): void {
    this.activeConversation.set(conv);
    this.commService.getMessages(conv.id).subscribe(msgs => {
      this.messages.set(msgs);
    });
  }

  sendMessage(): void {
    if (!this.newMessage.trim()) return;
    const user = this.authService.currentUser();
    const msg: Message = {
      id: 'msg_new_' + Date.now(),
      conversationId: this.activeConversation()?.id ?? '',
      senderId: this.currentUserId,
      senderName: user?.fullName ?? 'Yo',
      content: this.newMessage,
      timestamp: new Date().toISOString(),
      read: true,
    };
    this.messages.update(msgs => [...msgs, msg]);
    this.newMessage = '';
  }

  getConversationName(conv: Conversation): string {
    if (conv.isGroup && conv.groupName) return conv.groupName;
    const other = conv.participants.find(p => p.userId !== this.currentUserId);
    return other?.name ?? conv.participants[0]?.name ?? 'Chat';
  }

  getConversationAvatar(conv: Conversation): string {
    if (conv.isGroup) return '';
    const other = conv.participants.find(p => p.userId !== this.currentUserId);
    return other?.avatar ?? conv.participants[0]?.avatar ?? '';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'warn';
      case 'accepted': return 'primary';
      case 'rejected': return '';
      case 'completed': return 'accent';
      default: return '';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'accepted': return 'Aceptado';
      case 'rejected': return 'Rechazado';
      case 'completed': return 'Completado';
      default: return status;
    }
  }

  getEventIcon(type: string): string {
    switch (type) {
      case 'training': return 'fitness_center';
      case 'match': return 'sports_soccer';
      case 'medical': return 'medical_services';
      case 'meeting': return 'groups';
      case 'consultation': return 'event';
      default: return 'event';
    }
  }

  getEventColor(type: string): string {
    switch (type) {
      case 'training': return '#1565c0';
      case 'match': return '#e65100';
      case 'medical': return '#2e7d32';
      case 'meeting': return '#6a1b9a';
      case 'consultation': return '#00838f';
      default: return '#616161';
    }
  }

  updateRequestStatus(request: ServiceRequest, newStatus: 'accepted' | 'rejected'): void {
    this.serviceRequests.update(reqs =>
      reqs.map(r => r.id === request.id ? { ...r, status: newStatus } : r)
    );
  }
}
