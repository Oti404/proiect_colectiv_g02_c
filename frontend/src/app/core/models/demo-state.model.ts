import { HealthRecord } from './care.model';
import { Breed, Dog } from './dog.model';
import { Event, EventDogRsvp, EventInvitation } from './event.model';
import { Comment, Post } from './feed.model';
import { Conversation, Message } from './messaging.model';
import { Place } from './place.model';
import { BlockRelation, User } from './user.model';

export interface DemoAppState {
  currentUserId: string | null;
  users: User[];
  breeds: Breed[];
  dogs: Dog[];
  blocks: BlockRelation[];
  places: Place[];
  events: Event[];
  eventInvitations: EventInvitation[];
  eventDogRsvps: EventDogRsvp[];
  conversations: Conversation[];
  messages: Message[];
  healthRecords: HealthRecord[];
  posts: Post[];
  comments: Comment[];
  nextIdCounter: number;
}

export interface PersistedDemoEnvelope {
  version: number;
  state: DemoAppState;
}

export interface ActionResult<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}
