import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from '../../app.routes';
import { DEMO_STORAGE_KEY, DemoStateService } from '../state/demo-state.service';
import { DemoAuthService } from './demo-auth.service';
import { DogService } from './dog.service';
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

  it('hides blocked owners bidirectionally in DogService', () => {
    const auth = TestBed.inject(DemoAuthService);
    const userService = TestBed.inject(UserService);
    const dogService = TestBed.inject(DogService);

    auth.enterDemo('user-ana');

    // Căutarea e pe API acum (testată în search.service.spec.ts)
    userService.blockUser('user-mihai');
    expect(dogService.getDogById('dog-max')).toBeUndefined();

    userService.unblockUser('user-mihai');
    expect(dogService.getDogById('dog-max')?.dog.name).toBe('Max');
  });
});
