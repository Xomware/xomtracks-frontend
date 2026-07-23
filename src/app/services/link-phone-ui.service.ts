import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { LinkPhoneResult } from '../models/me.model';

/**
 * A tiny UI bus so the "Link your number" modal (hosted once in AppComponent)
 * can be opened from anywhere — the header entry and the feed's "Mine" tab
 * prompt both call `requestOpen()`. When a link succeeds, `notifyLinked()`
 * lets interested views (the Mine tab) refresh without prop-drilling.
 */
@Injectable({ providedIn: 'root' })
export class LinkPhoneUiService {
  private readonly openSubject = new Subject<void>();
  private readonly linkedSubject = new Subject<LinkPhoneResult>();

  /** Emits when something asks to open the link modal. */
  readonly open$: Observable<void> = this.openSubject.asObservable();
  /** Emits after a successful link, carrying the result. */
  readonly linked$: Observable<LinkPhoneResult> = this.linkedSubject.asObservable();

  requestOpen(): void {
    this.openSubject.next();
  }

  notifyLinked(result: LinkPhoneResult): void {
    this.linkedSubject.next(result);
  }
}
