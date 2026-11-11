import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EventView } from '../../core/models';
import { EventService } from '../../core/services';

type EventsTab = 'PUBLIC' | 'ORGANIZED' | 'INVITATIONS' | 'ALL';

@Component({
  selector: 'app-events-page',
  imports: [RouterLink, DatePipe],
  templateUrl: './events-page.html',
})
export class EventsPageComponent {
  private readonly eventService = inject(EventService);

  readonly activeTab = signal<EventsTab>('PUBLIC');
  readonly pendingInvitationsCount = this.eventService.pendingInvitationsCount;

  readonly publicEvents = computed(() => this.eventService.getPublicUpcomingEvents());
  readonly organizedEvents = computed(() => this.eventService.getMyOrganizedEvents());
  readonly invitedEvents = computed(() => this.eventService.getMyInvitedEvents());
  readonly allVisibleEvents = computed(() => this.eventService.getVisibleEvents());

  readonly displayedEvents = computed<EventView[]>(() => {
    switch (this.activeTab()) {
      case 'PUBLIC':
        return this.publicEvents();
      case 'ORGANIZED':
        return this.organizedEvents();
      case 'INVITATIONS':
        return this.invitedEvents();
      case 'ALL':
        return this.allVisibleEvents();
    }
  });

  setTab(tab: EventsTab): void {
    this.activeTab.set(tab);
  }

  getLocationLabel(ev: EventView): string {
    if (ev.place) {
      return `${ev.place.name} (${ev.place.neighborhood})`;
    }
    return ev.locationText ?? 'Location not specified';
  }
}
