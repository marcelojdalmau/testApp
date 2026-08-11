import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Conversation, Message, ServiceRequest, CalendarEvent } from '../../core/models/communication.model';
import { MOCK_CONVERSATIONS, MOCK_MESSAGES, MOCK_SERVICE_REQUESTS, MOCK_CALENDAR_EVENTS } from '../communication.data';

@Injectable({
  providedIn: 'root'
})
export class MockCommunicationService {

  /** Get all conversations for a user */
  getConversations(userId: string): Observable<Conversation[]> {
    return of(MOCK_CONVERSATIONS.filter(c =>
      c.participants.some(p => p.userId === userId)
    ));
  }

  /** Get all conversations (no filter - for demo) */
  getAllConversations(): Observable<Conversation[]> {
    return of(MOCK_CONVERSATIONS);
  }

  /** Get messages for a conversation */
  getMessages(conversationId: string): Observable<Message[]> {
    return of(MOCK_MESSAGES.filter(m => m.conversationId === conversationId));
  }

  /** Get service requests for a user (as sender or receiver) */
  getServiceRequests(userId: string): Observable<ServiceRequest[]> {
    return of(MOCK_SERVICE_REQUESTS.filter(sr =>
      sr.fromUserId === userId || sr.toUserId === userId
    ));
  }

  /** Get all service requests (for demo) */
  getAllServiceRequests(): Observable<ServiceRequest[]> {
    return of(MOCK_SERVICE_REQUESTS);
  }

  /** Get calendar events for a user */
  getCalendarEvents(userId: string): Observable<CalendarEvent[]> {
    return of(MOCK_CALENDAR_EVENTS.filter(e =>
      e.participants?.includes(userId)
    ));
  }

  /** Get all calendar events (for demo) */
  getAllCalendarEvents(): Observable<CalendarEvent[]> {
    return of(MOCK_CALENDAR_EVENTS);
  }

  /** Get events for a specific date */
  getEventsByDate(date: string): Observable<CalendarEvent[]> {
    return of(MOCK_CALENDAR_EVENTS.filter(e => e.date === date));
  }
}
