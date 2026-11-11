import { Comment, Conversation, Message, Post } from '../models';
import { DEMO_POST_IMAGES } from './demo-images';

export const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-ana-elena',
    createdAt: '2026-11-08T10:00:00.000Z',
    participantIds: ['user-ana', 'user-elena'],
    lastReadByUser: {
      'user-ana': '2026-11-10T14:10:00.000Z',
      'user-elena': '2026-11-10T14:05:00.000Z',
    },
  },
  {
    id: 'conv-ana-mihai',
    createdAt: '2026-11-10T17:55:00.000Z',
    participantIds: ['user-ana', 'user-mihai'],
    lastReadByUser: {
      'user-ana': null,
      'user-mihai': '2026-11-10T18:02:00.000Z',
    },
  },
  {
    id: 'conv-ana-ioana',
    createdAt: '2026-11-09T09:00:00.000Z',
    participantIds: ['user-ana', 'user-ioana'],
    lastReadByUser: {
      'user-ana': '2026-11-09T09:15:00.000Z',
      'user-ioana': '2026-11-11T08:30:00.000Z',
    },
  },
  {
    id: 'conv-elena-andrei',
    createdAt: '2026-11-07T16:00:00.000Z',
    participantIds: ['user-elena', 'user-andrei'],
    lastReadByUser: {
      'user-elena': '2026-11-07T16:20:00.000Z',
      'user-andrei': '2026-11-07T16:20:00.000Z',
    },
  },
];

export const SEED_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-ana-elena',
    senderId: 'user-ana',
    content: 'Hey Elena! Are Luna and Coco joining the Saturday morning walk in Parcul Central?',
    sentAt: '2026-11-10T13:50:00.000Z',
  },
  {
    id: 'msg-2',
    conversationId: 'conv-ana-elena',
    senderId: 'user-elena',
    content: 'Yes! I marked Luna as GOING for Saturday, and Coco will join Bella on Tuesday.',
    sentAt: '2026-11-10T14:05:00.000Z',
  },
  {
    id: 'msg-3',
    conversationId: 'conv-ana-mihai',
    senderId: 'user-mihai',
    content:
      'Hi Ana! I invited you to a calm 1-on-1 playdate next Monday. Rex would be a great match to help Max practice relaxed greetings.',
    sentAt: '2026-11-10T18:02:00.000Z',
  },
  {
    id: 'msg-4',
    conversationId: 'conv-ana-ioana',
    senderId: 'user-ana',
    content: 'Hi Ioana, invited you and Mia to our small-dogs afternoon playdate!',
    sentAt: '2026-11-09T09:10:00.000Z',
  },
  {
    id: 'msg-5',
    conversationId: 'conv-ana-ioana',
    senderId: 'user-ioana',
    content: 'Thanks Ana! Checking our schedule today, Mia loves gentle indoor sessions.',
    sentAt: '2026-11-11T08:30:00.000Z',
  },
  {
    id: 'msg-6',
    conversationId: 'conv-elena-andrei',
    senderId: 'user-andrei',
    content: 'Is Rocky allowed at the Gheorgheni Retriever meetup too or is it Retriever-only?',
    sentAt: '2026-11-07T16:10:00.000Z',
  },
  {
    id: 'msg-7',
    conversationId: 'conv-elena-andrei',
    senderId: 'user-elena',
    content: 'All friendly large dogs are welcome! Come join us.',
    sentAt: '2026-11-07T16:20:00.000Z',
  },
];

export const SEED_POSTS: Post[] = [
  {
    id: 'post-1',
    authorId: 'user-ana',
    dogId: 'dog-rex',
    content:
      'Early autumn leaves in Parcul Central — Rex found the biggest stick in the park again!',
    imageUrl: DEMO_POST_IMAGES[0].dataUri,
    createdAt: '2026-11-11T07:45:00.000Z',
    likedByUserIds: ['user-elena', 'user-radu', 'user-mara'],
  },
  {
    id: 'post-2',
    authorId: 'user-elena',
    dogId: 'dog-luna',
    content:
      'Gheorgheni dog park fence has been freshly repaired and the water fountain is still working.',
    imageUrl: DEMO_POST_IMAGES[1].dataUri,
    createdAt: '2026-11-10T17:15:00.000Z',
    likedByUserIds: ['user-ana', 'user-andrei'],
  },
  {
    id: 'post-3',
    authorId: 'user-mihai',
    dogId: 'dog-max',
    content:
      'Training tip: reward calm disengagement from 5 meters away before trying nose-to-nose greetings.',
    imageUrl: null,
    createdAt: '2026-11-10T11:20:00.000Z',
    likedByUserIds: ['user-ana', 'user-ioana', 'user-elena'],
  },
  {
    id: 'post-4',
    authorId: 'user-andrei',
    dogId: 'dog-rocky',
    content:
      'Crisp 8°C morning in Zorilor — finally Husky weather! Rocky ran 7 km effortlessly.',
    imageUrl: null,
    createdAt: '2026-11-09T09:10:00.000Z',
    likedByUserIds: ['user-mihai', 'user-radu'],
  },
  {
    id: 'post-5',
    authorId: 'user-ioana',
    dogId: 'dog-toby',
    content:
      'Toby passed his annual vet check with flying colors! Reminder to keep deworming dates logged.',
    imageUrl: null,
    createdAt: '2026-11-08T18:30:00.000Z',
    likedByUserIds: ['user-ana'],
  },
  {
    id: 'post-6',
    authorId: 'user-radu',
    dogId: 'dog-daisy',
    content:
      'Looking for one calm buddy in Grigorescu for short 20-minute confidence walks with Daisy.',
    imageUrl: null,
    createdAt: '2026-11-08T14:00:00.000Z',
    likedByUserIds: ['user-ioana', 'user-ana'],
  },
  {
    id: 'post-7',
    authorId: 'user-mara',
    dogId: 'dog-oscar',
    content: 'Paws & Espresso terrace has warm blankets and dog water bowls out!',
    imageUrl: null,
    createdAt: '2026-11-07T15:45:00.000Z',
    likedByUserIds: ['user-ana', 'user-elena', 'user-andrei'],
  },
  {
    id: 'post-8',
    authorId: 'user-ana',
    dogId: 'dog-bella',
    content: 'Switched Bella to a Y-front harness today—much gentler on her breathing.',
    imageUrl: null,
    createdAt: '2026-11-06T12:15:00.000Z',
    likedByUserIds: ['user-mara', 'user-ioana'],
  },
  {
    id: 'post-9',
    authorId: 'user-elena',
    dogId: 'dog-coco',
    content: 'Coco learned "leave it" around dropped chestnuts in just three days!',
    imageUrl: null,
    createdAt: '2026-11-05T19:00:00.000Z',
    likedByUserIds: ['user-mihai'],
  },
];

export const SEED_COMMENTS: Comment[] = [
  {
    id: 'comment-1',
    postId: 'post-1',
    userId: 'user-elena',
    content: 'Classic Labrador move! See you Saturday morning!',
    createdAt: '2026-11-11T08:10:00.000Z',
  },
  {
    id: 'comment-2',
    postId: 'post-2',
    userId: 'user-ana',
    content: 'Great news, thanks for the heads up!',
    createdAt: '2026-11-10T18:00:00.000Z',
  },
  {
    id: 'comment-3',
    postId: 'post-3',
    userId: 'user-ioana',
    content: 'This helped Mia so much over the past month.',
    createdAt: '2026-11-10T12:40:00.000Z',
  },
  {
    id: 'comment-4',
    postId: 'post-8',
    userId: 'user-mara',
    content: 'Best choice for flat-faced breeds!',
    createdAt: '2026-11-06T13:05:00.000Z',
  },
];
