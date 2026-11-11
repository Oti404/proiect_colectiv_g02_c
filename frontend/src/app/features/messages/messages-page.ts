import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ConversationSummary } from '../../core/models';
import { DemoAuthService, MessageService, UserService } from '../../core/services';

@Component({
  selector: 'app-messages-page',
  imports: [RouterLink, FormsModule, DatePipe],
  templateUrl: './messages-page.html',
})
export class MessagesPageComponent {
  private readonly router = inject(Router);
  private readonly auth = inject(DemoAuthService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);

  readonly id = input<string>();

  readonly currentUser = this.auth.currentUser;
  readonly conversations = computed(() => this.messageService.getConversations());
  readonly totalUnread = this.messageService.totalUnreadCount;
  readonly otherUsers = computed(() => this.userService.getOtherUsers());

  readonly activeConversation = computed(() => {
    const cid = this.id();
    return cid ? this.messageService.getConversationById(cid) : undefined;
  });

  readonly activeMessages = computed(() => {
    const cid = this.id();
    return cid ? this.messageService.getMessages(cid) : [];
  });

  readonly draftMessage = signal('');
  readonly includeSimulatedReply = signal(false);
  readonly sendError = signal<string | null>(null);
  readonly selectedNewChatUserId = signal('');

  private lastReadCheckKey: string | null = null;

  constructor() {
    effect(() => {
      const cid = this.id();
      const uid = this.currentUser()?.id;
      if (!cid || !uid) {
        return;
      }
      const key = `${uid}:${cid}`;
      const conv = this.messageService.getConversationById(cid);
      if (conv && (conv.unreadCount > 0 || key !== this.lastReadCheckKey)) {
        this.lastReadCheckKey = key;
        untracked(() => this.messageService.markAsRead(cid));
      }
    });
  }

  getParticipantNames(summary: ConversationSummary): string {
    if (summary.otherParticipants.length === 0) {
      return 'Deleted user';
    }
    return summary.otherParticipants
      .map((u) => `${u.firstName} ${u.lastName}`)
      .join(', ');
  }

  getSenderLabel(senderId: string | null): string {
    const me = this.currentUser();
    if (senderId === null) {
      return 'Deleted user';
    }
    if (me && senderId === me.id) {
      return `${me.firstName} (You)`;
    }
    const sender = this.userService.getUserById(senderId);
    return sender ? `${sender.firstName} ${sender.lastName}` : 'Deleted user';
  }

  onStartNewChat(): void {
    const targetId = this.selectedNewChatUserId();
    if (!targetId) {
      return;
    }
    const res = this.messageService.startOrOpenConversation(targetId);
    if (res.ok && res.data) {
      this.selectedNewChatUserId.set('');
      void this.router.navigate(['/messages', res.data.id]);
    }
  }

  onSendMessage(conversationId: string): void {
    this.sendError.set(null);
    const res = this.messageService.sendMessage(conversationId, this.draftMessage(), {
      includeSimulatedReply: this.includeSimulatedReply(),
    });
    if (res.ok) {
      this.draftMessage.set('');
    } else {
      this.sendError.set(res.error ?? 'Could not send message.');
    }
  }
}
