import { DemoAppState } from '../models';
import { deepClone } from '../../shared/utils/clone.util';
import { SEED_BREEDS } from './seed-breeds';
import { SEED_HEALTH_RECORDS } from './seed-care';
import { SEED_DOGS } from './seed-dogs';
import { SEED_EVENT_DOG_RSVPS, SEED_EVENT_INVITATIONS, SEED_EVENTS } from './seed-events';
import { SEED_PLACES } from './seed-places';
import { SEED_COMMENTS, SEED_CONVERSATIONS, SEED_MESSAGES, SEED_POSTS } from './seed-social';
import { DEFAULT_DEMO_USER_ID, SEED_USERS } from './seed-users';

export function createInitialDemoState(): DemoAppState {
  return deepClone({
    currentUserId: null,
    users: SEED_USERS,
    breeds: SEED_BREEDS,
    dogs: SEED_DOGS,
    blocks: [],
    places: SEED_PLACES,
    events: SEED_EVENTS,
    eventInvitations: SEED_EVENT_INVITATIONS,
    eventDogRsvps: SEED_EVENT_DOG_RSVPS,
    conversations: SEED_CONVERSATIONS,
    messages: SEED_MESSAGES,
    healthRecords: SEED_HEALTH_RECORDS,
    posts: SEED_POSTS,
    comments: SEED_COMMENTS,
    nextIdCounter: 1000,
  });
}

export { DEFAULT_DEMO_USER_ID, DEMO_ACCOUNT_OPTIONS, NEIGHBORHOOD_COORDINATES } from './seed-users';
