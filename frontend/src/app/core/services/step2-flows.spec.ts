import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from '../../app.routes';
import { DogDetailPageComponent } from '../../features/dogs/dog-detail-page';
import { ProfilePageComponent } from '../../features/profile/profile-page';
import { SearchPageComponent } from '../../features/search/search-page';
import { DEMO_STORAGE_KEY, DemoStateService } from '../state/demo-state.service';
import { DemoAuthService } from './demo-auth.service';
import { DogService } from './dog.service';
import { MessageService } from './message.service';
import { DEFAULT_SEARCH_FILTERS, SearchService } from './search.service';
import { UserService } from './user.service';

describe('STEP 2 Core Flows', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('supports Enter Demo, Account Switching, and Reset Demo Data', () => {
    const auth = TestBed.inject(DemoAuthService);
    const dogService = TestBed.inject(DogService);
    const stateService = TestBed.inject(DemoStateService);

    expect(auth.isAuthenticated()).toBe(false);

    const enterRes = auth.enterDemo();
    expect(enterRes.ok).toBe(true);
    expect(auth.currentUser()?.id).toBe('user-ana');
    expect(dogService.myDogs().map((d) => d.name)).toEqual(['Rex', 'Bella']);

    auth.switchDemoAccount('user-mihai');
    expect(auth.currentUser()?.id).toBe('user-mihai');
    expect(dogService.myDogs().map((d) => d.name)).toEqual(['Max']);

    stateService.resetDemoData({ keepSeededSession: true });
    expect(auth.currentUser()?.id).toBe('user-mihai');
  });

  it('persists changes in localStorage and recovers from corrupted data', () => {
    const auth = TestBed.inject(DemoAuthService);
    const dogService = TestBed.inject(DogService);

    auth.enterDemo('user-ana');
    const addRes = dogService.addDog({
      name: 'Sparky',
      breedId: 'breed-mixed',
      birthDate: '2024-01-10',
      sex: 'MALE',
      size: 'MEDIUM',
      temperament: 'FRIENDLY',
      neutered: true,
      photoUrl: null,
    });
    expect(addRes.ok).toBe(true);

    const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
    expect(stored).toContain('Sparky');

    // Simulate corrupted localStorage on next boot
    TestBed.resetTestingModule();
    window.localStorage.setItem(DEMO_STORAGE_KEY, '{corrupted-json');
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });

    const recoveredState = TestBed.inject(DemoStateService);
    expect(recoveredState.state().users.length).toBeGreaterThanOrEqual(7);
    expect(recoveredState.state().dogs.some((d) => d.name === 'Sparky')).toBe(false);
  });

  it('filters dogs in Search and hides blocked owners bidirectionally', () => {
    const auth = TestBed.inject(DemoAuthService);
    const searchService = TestBed.inject(SearchService);
    const userService = TestBed.inject(UserService);
    const dogService = TestBed.inject(DogService);

    auth.enterDemo('user-ana');

    const reactiveResults = searchService.searchDogs({
      ...DEFAULT_SEARCH_FILTERS,
      temperament: 'REACTIVE',
      maxDistanceKm: 20,
    });
    expect(reactiveResults.map((r) => r.dog.name)).toEqual(['Max']);

    userService.blockUser('user-mihai');
    const afterBlock = searchService.searchDogs({
      ...DEFAULT_SEARCH_FILTERS,
      temperament: 'REACTIVE',
      maxDistanceKm: 20,
    });
    expect(afterBlock).toEqual([]);
    expect(dogService.getDogById('dog-max')).toBeUndefined();

    userService.unblockUser('user-mihai');
    expect(dogService.getDogById('dog-max')?.dog.name).toBe('Max');
  });

  it('supports My Dogs CRUD and keeps ProfilePage messages on save', async () => {
    const auth = TestBed.inject(DemoAuthService);
    const dogService = TestBed.inject(DogService);
    auth.enterDemo('user-ana');

    const fixture = TestBed.createComponent(ProfilePageComponent);
    await fixture.whenStable();
    const page = fixture.componentInstance;

    page.profileForm.patchValue({ bio: 'Updated demo bio' });
    page.onSaveProfile();
    expect(page.profileMessage()).toBe('Profile updated in demo state.');

    const initialCount = dogService.myDogs().length;
    page.onOpenAddDog();
    page.dogForm.patchValue({ name: 'Biscuit', breedId: 'breed-beagle' });
    page.onSubmitDog();
    expect(dogService.myDogs().length).toBe(initialCount + 1);

    const added = dogService.myDogs().find((d) => d.name === 'Biscuit');
    expect(added).toBeDefined();
    page.onConfirmDeleteDog(added!.id);
    expect(dogService.myDogs().length).toBe(initialCount);
  });

  it('navigates from DogDetailPage to Messages and Invite to Playdate with context', async () => {
    const auth = TestBed.inject(DemoAuthService);
    const messageService = TestBed.inject(MessageService);
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    auth.enterDemo('user-ana');

    const searchFixture = TestBed.createComponent(SearchPageComponent);
    await searchFixture.whenStable();
    expect(searchFixture.componentInstance.results().length).toBeGreaterThan(0);

    const detailFixture = TestBed.createComponent(DogDetailPageComponent);
    detailFixture.componentRef.setInput('id', 'dog-luna');
    await detailFixture.whenStable();

    const detailPage = detailFixture.componentInstance;
    expect(detailPage.details()?.dog.name).toBe('Luna');

    detailPage.onSendMessage('user-elena');
    const conv = messageService.startOrOpenConversation('user-elena').data!;
    expect(navigateSpy).toHaveBeenCalledWith(['/messages', conv.id]);

    detailPage.onInviteToPlaydate('user-elena');
    expect(navigateSpy).toHaveBeenCalledWith(['/events/new'], {
      queryParams: {
        inviteUserId: 'user-elena',
        type: 'PLAYDATE',
        visibility: 'PRIVATE',
      },
    });
  });
});
