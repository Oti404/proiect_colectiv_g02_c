import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { EMPTY, Subscription, catchError, interval, startWith, switchMap, timer } from 'rxjs';
import { ApiError } from '../../core/api/api.types';
import { AuthService } from '../../core/auth/auth.service';
import { UserService } from '../../core/services';
import {
  ApiConversation,
  ApiMessage,
  CHAT_POLL_MS,
  INBOX_POLL_MS,
  MessageService,
} from '../../core/services/message.service';

/** Mesajele pentru utilizator, după codul erorii din API. */
function chatErrorMessage(err: unknown): string {
  switch (ApiError.from(err).code) {
    case 'BLOCKED':
      return 'You cannot exchange messages with this user.';
    case 'CONVERSATION_CLOSED':
      return 'This user has deleted their account. You can no longer send messages here.';
    case 'CANNOT_MESSAGE_SELF':
      return 'You cannot start a conversation with yourself.';
    case 'NOT_FOUND':
      return 'This conversation or user was not found.';
    case 'NETWORK_ERROR':
      return 'The server cannot be reached. Check your connection.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

@Component({
  selector: 'app-messages-page',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './messages-page.html',
})
export class MessagesPageComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly messageService = inject(MessageService);
  // Temporar: lista pentru „Start new chat” vine din datele demo (API-ul nu are o listă de utilizatori).
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);

  /** Conversația deschisă (`/messages/:id`). */
  readonly id = input<string>();
  /** `/messages?with=<userId>`: deschide (sau creează) conversația cu acel utilizator. */
  readonly withUser = input<string | undefined>(undefined, { alias: 'with' });

  readonly currentUser = this.auth.user;
  readonly conversations = this.messageService.conversations;
  readonly totalUnread = this.messageService.totalUnreadCount;
  readonly otherUsers = computed(() => this.userService.getOtherUsers());

  readonly listLoading = signal(true);
  readonly listError = signal<string | null>(null);

  readonly activeConversation = signal<ApiConversation | null>(null);
  readonly activeMessages = signal<ApiMessage[]>([]);
  readonly chatLoading = signal(false);
  readonly chatError = signal<string | null>(null);
  readonly hasOlder = signal(false);
  readonly loadingOlder = signal(false);

  readonly draftMessage = signal('');
  readonly sending = signal(false);
  readonly sendError = signal<string | null>(null);
  readonly selectedNewChatUserId = signal('');
  readonly opening = signal(false);

  private chatPolling?: Subscription;

  constructor() {
    // Lista de conversații: la intrare și apoi periodic.
    interval(INBOX_POLL_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.messageService.loadConversations().pipe(
            catchError((err: unknown) => {
              this.listError.set(chatErrorMessage(err));
              this.listLoading.set(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        this.listError.set(null);
        this.listLoading.set(false);
      });

    // `?with=<userId>` → deschidem conversația și trecem la `/messages/:id`.
    effect(() => {
      const userId = this.withUser();
      if (userId) untracked(() => this.openConversationWith(userId));
    });

    // Conversația din URL: încărcăm mesajele și pornim polling-ul pentru cele noi.
    effect(() => {
      const conversationId = this.id();
      untracked(() => this.openConversation(conversationId));
    });

    this.destroyRef.onDestroy(() => this.chatPolling?.unsubscribe());
  }

  getParticipantNames(conversation: ApiConversation): string {
    if (conversation.otherParticipants.length === 0) {
      return 'Deleted user';
    }
    return conversation.otherParticipants.map((u) => `${u.firstName} ${u.lastName}`).join(', ');
  }

  getSenderLabel(senderId: string | null): string {
    if (senderId === null) {
      return 'Deleted user';
    }
    const me = this.currentUser();
    if (me && senderId === me.id) {
      return `${me.firstName} (You)`;
    }
    const sender = this.activeConversation()?.otherParticipants.find((u) => u.id === senderId);
    return sender ? `${sender.firstName} ${sender.lastName}` : 'Deleted user';
  }

  isMine(message: ApiMessage): boolean {
    return message.senderId !== null && message.senderId === this.currentUser()?.id;
  }

  onStartNewChat(): void {
    const targetId = this.selectedNewChatUserId();
    if (targetId) {
      this.openConversationWith(targetId);
    }
  }

  onLoadOlder(): void {
    const conversation = this.activeConversation();
    const oldest = this.activeMessages()[0];
    if (!conversation || !oldest || this.loadingOlder()) return;

    this.loadingOlder.set(true);
    this.messageService.listMessages(conversation.id, { before: oldest.id }).subscribe({
      next: (page) => {
        this.activeMessages.update((current) => [...page.messages, ...current]);
        this.hasOlder.set(page.hasMore);
        this.loadingOlder.set(false);
      },
      error: (err: unknown) => {
        this.chatError.set(chatErrorMessage(err));
        this.loadingOlder.set(false);
      },
    });
  }

  onSendMessage(conversationId: string): void {
    const content = this.draftMessage().trim();
    if (!content || this.sending()) return;

    this.sendError.set(null);
    this.sending.set(true);
    this.messageService.sendMessage(conversationId, content).subscribe({
      next: (message) => {
        this.appendMessages([message]);
        this.draftMessage.set('');
        this.sending.set(false);
        this.refreshList();
      },
      error: (err: unknown) => {
        this.sendError.set(chatErrorMessage(err));
        this.sending.set(false);
      },
    });
  }

  private openConversationWith(userId: string): void {
    this.opening.set(true);
    this.chatError.set(null);
    this.messageService.startConversation(userId).subscribe({
      next: (conversation) => {
        this.opening.set(false);
        this.selectedNewChatUserId.set('');
        this.refreshList();
        void this.router.navigate(['/messages', conversation.id], { replaceUrl: true });
      },
      error: (err: unknown) => {
        this.opening.set(false);
        this.chatError.set(chatErrorMessage(err));
      },
    });
  }

  private openConversation(conversationId: string | undefined): void {
    this.chatPolling?.unsubscribe();
    this.activeConversation.set(null);
    this.activeMessages.set([]);
    this.hasOlder.set(false);
    this.sendError.set(null);
    this.draftMessage.set('');
    if (!conversationId) return;

    this.chatLoading.set(true);
    this.chatError.set(null);
    this.messageService
      .getConversation(conversationId)
      .pipe(
        switchMap((conversation) => {
          this.activeConversation.set(conversation);
          return this.messageService.listMessages(conversationId);
        }),
      )
      .subscribe({
        next: (page) => {
          this.activeMessages.set(page.messages);
          this.hasOlder.set(page.hasMore);
          this.chatLoading.set(false);
          this.markRead(conversationId);
          this.startChatPolling(conversationId);
        },
        error: (err: unknown) => {
          this.chatLoading.set(false);
          this.chatError.set(chatErrorMessage(err));
        },
      });
  }

  /** Mesajele noi, după ultimul mesaj afișat. */
  private startChatPolling(conversationId: string): void {
    this.chatPolling = timer(CHAT_POLL_MS, CHAT_POLL_MS)
      .pipe(
        switchMap(() => {
          const last = this.activeMessages().at(-1);
          return this.messageService
            .listMessages(conversationId, last ? { after: last.id } : {})
            .pipe(catchError(() => EMPTY));
        }),
      )
      .subscribe((page) => {
        const fresh = this.appendMessages(page.messages);
        if (fresh.some((m) => !this.isMine(m))) {
          this.markRead(conversationId);
        }
      });
  }

  /** Adaugă mesajele care nu sunt deja afișate și le întoarce pe cele noi. */
  private appendMessages(messages: ApiMessage[]): ApiMessage[] {
    const known = new Set(this.activeMessages().map((m) => m.id));
    const fresh = messages.filter((m) => !known.has(m.id));
    if (fresh.length > 0) {
      this.activeMessages.update((current) => [...current, ...fresh]);
    }
    return fresh;
  }

  private markRead(conversationId: string): void {
    this.messageService.markAsRead(conversationId).subscribe({ error: () => undefined });
  }

  private refreshList(): void {
    this.messageService.loadConversations().subscribe({ error: () => undefined });
  }
}
