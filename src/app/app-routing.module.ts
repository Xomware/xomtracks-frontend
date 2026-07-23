import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { LandingComponent } from './components/landing/landing.component';
import { FeedComponent } from './components/feed/feed.component';
import { SignInComponent } from './components/auth/sign-in/sign-in.component';
import { CallbackComponent } from './components/auth/callback/callback.component';
import { authGuard } from './guards/auth.guard';

/**
 * Route tree:
 *   ''            public landing tile — redirects signed-in users to /feed.
 *   /feed         the authed browse feed (authGuard).
 *   /auth/sign-in Hosted UI entry (SSO carry-over from any Xomware app).
 *   /auth/callback post-redirect landing.
 */
const routes: Routes = [
  { path: '', component: LandingComponent, pathMatch: 'full' },
  { path: 'feed', component: FeedComponent, canActivate: [authGuard] },

  { path: 'auth/sign-in', component: SignInComponent },
  { path: 'auth/callback', component: CallbackComponent },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
