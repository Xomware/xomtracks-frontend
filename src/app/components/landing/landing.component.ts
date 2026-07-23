import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { CognitoService } from '../../services/cognito.service';

/**
 * Public landing tile. A signed-in visitor (incl. SSO carry-over from
 * another Xomware app) is sent straight to the feed; everyone else gets the
 * pitch + a sign-in call to action.
 */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.component.html',
  styleUrls: ['./landing.component.scss'],
})
export class LandingComponent implements OnInit, OnDestroy {
  private sub?: Subscription;

  constructor(
    public cognito: CognitoService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.sub = this.cognito.isReady$
      .pipe(
        filter((ready) => ready),
        take(1),
      )
      .subscribe(() => {
        if (this.cognito.isAuthenticated()) {
          this.router.navigateByUrl('/feed');
        }
      });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }
}
