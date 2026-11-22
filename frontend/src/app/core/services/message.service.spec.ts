import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from '../api/auth.interceptor';
import { AuthService, AuthUser } from '../auth/auth.service';
import { MessagesPageComponent } from '../../features/messages/messages-page';
import {
  ApiConversation,
  ApiMessage,
  CHAT_POLL_MS,
  INBOX_POLL_MS,
  MessageService,
} from './message.service';

const ANA_ID = '11111111-1111-4111-8111-111111111111';
const ELENA_ID = '22222222-2222-4222-8222-222222222222';
const CONV_ID = '33333333-3333-4333-8333-333333333333';

const ana: AuthUser = {
  id: ANA_ID,
  email: 'ana.pop@demo.dogapp',
  emailVerified: true,
  firstName: 'Ana',
  lastName: 'Pop',
  avatarUrl: null,
  bio: null,
  approxLatitude: 46.77,
  approxLongitude: 23.59,
  consentAt: '2026-10-05T09:00:00.000Z',
  createdAt: '2026-10-05T09:00:00.000Z',
  updatedAt: '2026-10-05T09:00:00.000Z',
};

const conversation = (overrides: Partial<ApiConversation> = {}): ApiConversation => ({
  id: CONV_ID,
  createdAt: '2026-11-20T10:00:00.000Z',
  otherParticipants: [{ id: ELENA_ID, firstName: 'Elena', lastName: 'Rusu', avatarUrl: null }],
  lastMessage: null,
  unreadCount: 0,
  ...overrides,
});

const message = (id: string, senderId: string | null, content: string): ApiMessage => ({
  id,
  conversationId: CONV_ID,
  senderId,
  content,
  sentAt: '2026-11-20T10:00:00.000Z',
});

describe('Messaging (API)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  async function signIn(): Promise<void> {
    const login = firstValueFrom(TestBed.inject(AuthService).login(ana.email, 'pass1'));
    http.expectOne('/api/auth/login').flush({ data: { token: 'tok', user: ana } });
    await login;
  }

  describe('MessageService', () => {
    it('polls the unread count only while signed in', async () => {
      vi.useFakeTimers();
      const service = TestBed.inject(MessageService);
      TestBed.tick();
      http.expectNone('/api/messages/unread-count');

      await signIn();
      TestBed.tick();
      http.expectOne('/api/messages/unread-count').flush({ data: { count: 3 } });
      expect(service.totalUnreadCount()).toBe(3);

      vi.advanceTimersByTime(INBOX_POLL_MS);
      http.expectOne('/api/messages/unread-count').flush({ data: { count: 1 } });
      expect(service.totalUnreadCount()).toBe(1);

      TestBed.inject(AuthService).logout();
      TestBed.tick();
      vi.advanceTimersByTime(INBOX_POLL_MS * 2);
      http.expectNone('/api/messages/unread-count');
      expect(service.totalUnreadCount()).toBe(0);
    });

    it('starts a conversation with a real user id', async () => {
      const service = TestBed.inject(MessageService);
      const result = firstValueFrom(service.startConversation(ELENA_ID));
      const req = http.expectOne('/api/conversations');
      expect(req.request.body).toEqual({ userId: ELENA_ID });
      req.flush({ data: conversation() }, { status: 201, statusText: 'Created' });
      expect((await result).id).toBe(CONV_ID);
    });

    it('resolves a demo user id to the real user before starting (temporary bridge)', async () => {
      const service = TestBed.inject(MessageService);
      const result = firstValueFrom(service.startConversation('user-elena'));

      const search = http.expectOne((r) => r.url === '/api/search/dogs');
      expect(search.request.params.get('q')).toBe('Rusu');
      search.flush({
        data: [{ owner: { id: ELENA_ID, firstName: 'Elena', lastName: 'Rusu' } }],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      });

      const start = http.expectOne('/api/conversations');
      expect(start.request.body).toEqual({ userId: ELENA_ID });
      start.flush({ data: conversation() });
      await result;
    });

    it('uses cursors and reads hasMore from the messages meta', async () => {
      const service = TestBed.inject(MessageService);
      const result = firstValueFrom(service.listMessages(CONV_ID, { before: 'm-10' }));
      const req = http.expectOne((r) => r.url === `/api/conversations/${CONV_ID}/messages`);
      expect(req.request.params.get('before')).toBe('m-10');
      expect(req.request.params.has('after')).toBe(false);
      req.flush({ data: [message('m-9', ELENA_ID, 'hei')], meta: { hasMore: true, limit: 50 } });
      expect(await result).toEqual({ messages: [message('m-9', ELENA_ID, 'hei')], hasMore: true });
    });

    it('lowers the unread badge when a conversation is marked as read', async () => {
      const service = TestBed.inject(MessageService);
      const load = firstValueFrom(service.loadConversations());
      http.expectOne('/api/conversations').flush({ data: [conversation({ unreadCount: 2 })] });
      await load;
      expect(service.totalUnreadCount()).toBe(2);

      const read = firstValueFrom(service.markAsRead(CONV_ID));
      http
        .expectOne(`/api/conversations/${CONV_ID}/read`)
        .flush(null, { status: 204, statusText: 'No Content' });
      await read;
      expect(service.totalUnreadCount()).toBe(0);
      expect(service.conversations()[0].unreadCount).toBe(0);
    });
  });

  describe('MessagesPageComponent', () => {
    function openPage(id?: string) {
      const fixture = TestBed.createComponent(MessagesPageComponent);
      if (id) fixture.componentRef.setInput('id', id);
      fixture.detectChanges();
      return fixture;
    }

    function flushConversationList(list: ApiConversation[] = [conversation()]) {
      http.expectOne({ url: '/api/conversations', method: 'GET' }).flush({ data: list });
    }

    function flushOpenConversation(messages: ApiMessage[], hasMore = false) {
      http.expectOne(`/api/conversations/${CONV_ID}`).flush({ data: conversation() });
      http
        .expectOne(
          (r) => r.url === `/api/conversations/${CONV_ID}/messages` && !r.params.has('after'),
        )
        .flush({ data: messages, meta: { hasMore, limit: 50 } });
      http
        .expectOne(`/api/conversations/${CONV_ID}/read`)
        .flush(null, { status: 204, statusText: 'No Content' });
    }

    it('loads the conversation, marks it read and shows who wrote what', async () => {
      await signIn();
      const page = openPage(CONV_ID).componentInstance;
      flushConversationList();
      flushOpenConversation([message('m1', ELENA_ID, 'Salut!'), message('m2', ANA_ID, 'Hei!')]);
      http.match('/api/messages/unread-count').forEach((r) => r.flush({ data: { count: 0 } }));

      expect(page.activeMessages().map((m) => m.content)).toEqual(['Salut!', 'Hei!']);
      expect(page.getSenderLabel(ELENA_ID)).toBe('Elena Rusu');
      expect(page.getSenderLabel(ANA_ID)).toBe('Ana (You)');
      expect(page.getSenderLabel(null)).toBe('Deleted user');
    });

    it('polls for new messages after the last one', async () => {
      vi.useFakeTimers();
      await signIn();
      const page = openPage(CONV_ID).componentInstance;
      flushConversationList();
      flushOpenConversation([message('m1', ELENA_ID, 'Salut!')]);
      http.match('/api/messages/unread-count').forEach((r) => r.flush({ data: { count: 0 } }));

      vi.advanceTimersByTime(CHAT_POLL_MS);
      const poll = http.expectOne((r) => r.params.get('after') === 'm1');
      poll.flush({
        data: [message('m2', ELENA_ID, 'Ești acolo?')],
        meta: { hasMore: false, limit: 50 },
      });
      // Mesaj nou de la Elena → se marchează din nou ca citit
      http
        .expectOne(`/api/conversations/${CONV_ID}/read`)
        .flush(null, { status: 204, statusText: 'No Content' });

      expect(page.activeMessages().map((m) => m.id)).toEqual(['m1', 'm2']);
    });

    it('sends a message and shows API errors in the chat', async () => {
      await signIn();
      const page = openPage(CONV_ID).componentInstance;
      flushConversationList();
      flushOpenConversation([]);
      http.match('/api/messages/unread-count').forEach((r) => r.flush({ data: { count: 0 } }));

      page.draftMessage.set('  Ne vedem duminică  ');
      page.onSendMessage(CONV_ID);
      const send = http.expectOne(`/api/conversations/${CONV_ID}/messages`);
      expect(send.request.body).toEqual({ content: 'Ne vedem duminică' });
      send.flush(
        { data: message('m3', ANA_ID, 'Ne vedem duminică') },
        { status: 201, statusText: 'Created' },
      );
      flushConversationList();
      expect(page.activeMessages().map((m) => m.id)).toEqual(['m3']);
      expect(page.draftMessage()).toBe('');

      page.draftMessage.set('Încă unul');
      page.onSendMessage(CONV_ID);
      http
        .expectOne(`/api/conversations/${CONV_ID}/messages`)
        .flush(
          { error: { code: 'BLOCKED', message: 'blocked' } },
          { status: 403, statusText: 'Forbidden' },
        );
      expect(page.sendError()).toBe('You cannot exchange messages with this user.');
      expect(page.draftMessage()).toBe('Încă unul');
    });

    it('opens the chat from ?with=<userId> and replaces the URL', async () => {
      await signIn();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      const fixture = TestBed.createComponent(MessagesPageComponent);
      fixture.componentRef.setInput('with', ELENA_ID);
      fixture.detectChanges();

      flushConversationList([]);
      http
        .expectOne((r) => r.url === '/api/conversations' && r.method === 'POST')
        .flush({ data: conversation() });
      flushConversationList();
      http.match('/api/messages/unread-count').forEach((r) => r.flush({ data: { count: 0 } }));

      expect(navigate).toHaveBeenCalledWith(['/messages', CONV_ID], { replaceUrl: true });
    });
  });
});
