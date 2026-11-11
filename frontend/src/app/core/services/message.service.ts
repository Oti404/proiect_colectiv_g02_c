import { Injectable, computed, inject } from '@angular/core';
import { ActionResult, Conversation, ConversationSummary, Message, User } from '../models';
import { DemoStateService } from '../state/demo-state.service';
import { DemoAuthService } from './demo-auth.service';
import { UserService } from './user.service';

@Injectable({ providedIn: 'root' })
export class MessageService {
  private readonly store = inject(DemoStateService);
  private readonly auth = inject(DemoAuthService);
  private readonly userService = inject(UserService);

  readonly totalUnreadCount = computed<number>(() =>
    this.getConversations().reduce((sum, conv) => sum + conv.unreadCount, 0),
  );

  getConversations(): ConversationSummary[] {
    const me = this.auth.currentUser();
    if (!me) {
      return [];
    }
    const state = this.store.state();

    const summaries: ConversationSummary[] = [];

    for (const conv of state.conversations) {
      if (!conv.participantIds.includes(me.id)) {
        continue;
      }

      const otherIds = conv.participantIds.filter((id) => id !== me.id);
      const hasBlockedParticipant = otherIds.some((id) =>
        this.userService.isBlockedEitherWay(me.id, id),
      );
      if (hasBlockedParticipant) {
        continue;
      }

      const otherParticipants = otherIds
        .map((id) => state.users.find((u) => u.id === id))
        .filter((u): u is User => u !== undefined);

      const convMessages = state.messages
        .filter((m) => m.conversationId === conv.id)
        .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

      const lastMessage = convMessages.length > 0 ? convMessages[convMessages.length - 1] : null;
      const lastReadIso = conv.lastReadByUser[me.id] ?? null;
      const lastReadMs = lastReadIso ? new Date(lastReadIso).getTime() : 0;

      const unreadCount = convMessages.filter(
        (m) => m.senderId !== me.id && new Date(m.sentAt).getTime() > lastReadMs,
      ).length;

      summaries.push({
        conversation: conv,
        otherParticipants,
        lastMessage,
        unreadCount,
      });
    }

    return summaries.sort((a, b) => {
      const timeA = new Date(a.lastMessage?.sentAt ?? a.conversation.createdAt).getTime();
      const timeB = new Date(b.lastMessage?.sentAt ?? b.conversation.createdAt).getTime();
      return timeB - timeA;
    });
  }

  getConversationById(conversationId: string): ConversationSummary | undefined {
    return this.getConversations().find((c) => c.conversation.id === conversationId);
  }

  getMessages(conversationId: string): Message[] {
    const me = this.auth.currentUser();
    if (!me) {
      return [];
    }
    const conv = this.store.state().conversations.find((c) => c.id === conversationId);
    if (!conv || !conv.participantIds.includes(me.id)) {
      return [];
    }
    const hasBlocked = conv.participantIds
      .filter((id) => id !== me.id)
      .some((id) => this.userService.isBlockedEitherWay(me.id, id));
    if (hasBlocked) {
      return [];
    }
    return this.store
      .state()
      .messages.filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
  }

  startOrOpenConversation(otherUserId: string): ActionResult<Conversation> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    if (me.id === otherUserId) {
      return { ok: false, error: 'You cannot start a conversation with yourself.' };
    }
    const recipientExists = this.store.state().users.some((u) => u.id === otherUserId);
    if (!recipientExists) {
      return { ok: false, error: 'Recipient user was not found.' };
    }
    if (this.userService.isBlockedEitherWay(me.id, otherUserId)) {
      return { ok: false, error: 'Cannot message a blocked user.' };
    }

    const existing = this.store
      .state()
      .conversations.find(
        (c) =>
          c.participantIds.length === 2 &&
          c.participantIds.includes(me.id) &&
          c.participantIds.includes(otherUserId),
      );

    if (existing) {
      return { ok: true, data: existing };
    }

    const nowIso = new Date().toISOString();
    const newConv: Conversation = {
      id: this.store.allocateId('conv'),
      createdAt: nowIso,
      participantIds: [me.id, otherUserId],
      lastReadByUser: {
        [me.id]: nowIso,
        [otherUserId]: null,
      },
    };

    this.store.updateState((draft) => {
      draft.conversations.push(newConv);
      return draft;
    });

    return { ok: true, data: newConv };
  }

  sendMessage(
    conversationId: string,
    content: string,
    options?: { includeSimulatedReply?: boolean },
  ): ActionResult<Message> {
    const me = this.auth.currentUser();
    if (!me) {
      return { ok: false, error: 'You must be signed in.' };
    }
    const text = content.trim();
    if (!text) {
      return { ok: false, error: 'Message cannot be empty.' };
    }

    const conv = this.store.state().conversations.find((c) => c.id === conversationId);
    if (!conv || !conv.participantIds.includes(me.id)) {
      return { ok: false, error: 'Conversation not found.' };
    }
    const hasBlocked = conv.participantIds
      .filter((id) => id !== me.id)
      .some((id) => this.userService.isBlockedEitherWay(me.id, id));
    if (hasBlocked) {
      return { ok: false, error: 'Cannot send messages to a blocked user.' };
    }

    const nowIso = new Date().toISOString();
    const message: Message = {
      id: this.store.allocateId('msg'),
      conversationId,
      senderId: me.id,
      content: text,
      sentAt: nowIso,
    };

    let simulatedReply: Message | null = null;
    if (options?.includeSimulatedReply) {
      const otherUserId = conv.participantIds.find((id) => id !== me.id) ?? null;
      if (otherUserId) {
        const replyTime = new Date(Date.now() + 500).toISOString();
        simulatedReply = {
          id: this.store.allocateId('msg'),
          conversationId,
          senderId: otherUserId,
          content: 'Sounds great! Let us know what time works best for our dogs.',
          sentAt: replyTime,
          isSimulatedReply: true,
        };
      }
    }

    this.store.updateState((draft) => {
      draft.messages.push(message);
      if (simulatedReply) {
        draft.messages.push(simulatedReply);
      }
      const targetConv = draft.conversations.find((c) => c.id === conversationId);
      if (targetConv) {
        targetConv.lastReadByUser[me.id] = simulatedReply ? simulatedReply.sentAt : nowIso;
      }
      return draft;
    });

    return { ok: true, data: message };
  }

  markAsRead(conversationId: string): void {
    const me = this.auth.currentUser();
    if (!me) {
      return;
    }
    const nowIso = new Date().toISOString();
    this.store.updateState((draft) => {
      const conv = draft.conversations.find((c) => c.id === conversationId);
      if (conv && conv.participantIds.includes(me.id)) {
        conv.lastReadByUser[me.id] = nowIso;
      }
      return draft;
    });
  }
}
