import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import {
  Observable,
  Subscription,
  interval,
  map,
  of,
  startWith,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ApiService } from '../api/api.service';
import { ApiError, ApiModel } from '../api/api.types';
import { AuthService } from '../auth/auth.service';
import { DemoStateService } from '../state/demo-state.service';

export type ApiConversation = ApiModel<'Conversation'>;
export type ApiMessage = ApiModel<'Message'>;

export interface MessagesPage {
  messages: ApiMessage[];
  hasMore: boolean;
}

/** Cât de des verificăm mesajele noi (decis: polling, fără WebSocket). */
export const CHAT_POLL_MS = 4_000;
export const INBOX_POLL_MS = 15_000;
export const MESSAGES_PAGE_SIZE = 50;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mesageria, prin `/api/conversations` și `/api/messages`.
 *
 * Ține lista de conversații și numărul de mesaje necitite (badge-ul din meniu), reîmprospătate
 * prin polling cât timp utilizatorul e logat. Mesajele conversației deschise le încarcă pagina.
 *
 * Alte pagini deschid un chat navigând la `/messages?with=<userId>`.
 */
@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly demoStore = inject(DemoStateService);

  private readonly conversationList = signal<ApiConversation[]>([]);
  private readonly unread = signal(0);

  readonly conversations = this.conversationList.asReadonly();
  readonly totalUnreadCount = this.unread.asReadonly();

  private inboxPolling?: Subscription;

  constructor() {
    // Badge-ul de necitite: polling doar cât timp există o sesiune.
    effect(() => {
      this.inboxPolling?.unsubscribe();
      this.inboxPolling = undefined;
      if (!this.auth.isAuthenticated()) {
        this.conversationList.set([]);
        this.unread.set(0);
        return;
      }
      this.inboxPolling = interval(INBOX_POLL_MS)
        .pipe(
          startWith(0),
          switchMap(() => this.api.get<{ count: number }>('/messages/unread-count')),
        )
        .subscribe({ next: (res) => this.unread.set(res.count), error: () => undefined });
    });
    inject(DestroyRef).onDestroy(() => this.inboxPolling?.unsubscribe());
  }

  /** Reîncarcă lista de conversații (cele cu activitate recentă primele). */
  loadConversations(): Observable<ApiConversation[]> {
    return this.api.get<ApiConversation[]>('/conversations').pipe(
      tap((list) => {
        this.conversationList.set(list);
        this.unread.set(list.reduce((sum, c) => sum + c.unreadCount, 0));
      }),
    );
  }

  getConversation(conversationId: string): Observable<ApiConversation> {
    return this.api.get<ApiConversation>(`/conversations/${conversationId}`);
  }

  /** Deschide conversația cu un utilizator sau o întoarce pe cea existentă. */
  startConversation(userId: string): Observable<ApiConversation> {
    return this.resolveUserId(userId).pipe(
      switchMap((id) => this.api.post<ApiConversation>('/conversations', { userId: id })),
    );
  }

  /** Ultimele mesaje, sau cele dinainte de `before` (scroll în sus), sau cele după `after` (polling). */
  listMessages(
    conversationId: string,
    cursor: { before?: string; after?: string } = {},
  ): Observable<MessagesPage> {
    return this.api
      .getPage<ApiMessage, { hasMore: boolean; limit: number }>(
        `/conversations/${conversationId}/messages`,
        { ...cursor, limit: MESSAGES_PAGE_SIZE },
      )
      .pipe(map((page) => ({ messages: page.items, hasMore: page.meta.hasMore })));
  }

  sendMessage(conversationId: string, content: string): Observable<ApiMessage> {
    return this.api.post<ApiMessage>(`/conversations/${conversationId}/messages`, { content });
  }

  markAsRead(conversationId: string): Observable<void> {
    return this.api.post<void>(`/conversations/${conversationId}/read`).pipe(
      tap(() => {
        const list = this.conversationList();
        const target = list.find((c) => c.id === conversationId);
        if (!target || target.unreadCount === 0) return;
        this.unread.update((n) => Math.max(0, n - target.unreadCount));
        this.conversationList.set(
          list.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
        );
      }),
    );
  }

  /**
   * PUNTE TEMPORARĂ (se scoate la pasul „Final” din planul de integrare).
   * Paginile încă pe mock-uri dau id-uri demo (`user-elena`), nu UUID-uri.
   * Găsim utilizatorul real după nume, prin căutarea de câini (conturile demo au aceleași nume
   * în mock-uri și în seed-ul backend-ului). Merge doar pentru utilizatori care au câini.
   */
  private resolveUserId(userId: string): Observable<string> {
    if (UUID_RE.test(userId)) return of(userId);

    const mockUser = this.demoStore.state().users.find((u) => u.id === userId);
    if (!mockUser) {
      return throwError(() => new ApiError(404, 'NOT_FOUND', 'User not found'));
    }
    return this.api
      .getPage<{ owner: { id: string; firstName: string; lastName: string } }>('/search/dogs', {
        q: mockUser.lastName,
        pageSize: 100,
      })
      .pipe(
        map((page) => {
          const owner = page.items
            .map((dog) => dog.owner)
            .find((o) => o.firstName === mockUser.firstName && o.lastName === mockUser.lastName);
          if (!owner) throw new ApiError(404, 'NOT_FOUND', 'User not found');
          return owner.id;
        }),
      );
  }
}
