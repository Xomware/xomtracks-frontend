import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HomeComponent } from './components/home/home.component';
import { ProfileComponent } from './components/profile/profile.component';
import { SignInComponent } from './components/auth/sign-in/sign-in.component';
import { CallbackComponent } from './components/auth/callback/callback.component';
import { authGuard } from './guards/auth.guard';

/**
 * Route tree (unified home):
 *   ''            the app home — Playlists front-and-centre with the browse
 *                 feed in a slide-out panel for signed-in users; the public
 *                 landing pitch for everyone else. HomeComponent switches on
 *                 auth state, so no guard is needed here.
 *   /profile      the signed-in caller's profile / home (authed) — identity +
 *                 client-side stats. Guarded, so anonymous hits bounce to sign-in.
 *   /admin        the phone-link approval portal (authed + admin-only). The
 *                 guard only enforces sign-in; the backend 403s non-admins and
 *                 the page shows a "not authorized" notice.
 *   /feed         legacy → home (the feed now lives in the home's side panel).
 *   /playlists    legacy → home (playlists ARE the home).
 *   /auth/sign-in Hosted UI entry (SSO carry-over from any Xomware app).
 *   /auth/callback post-redirect landing.
 */
const routes: Routes = [
  { path: '', component: HomeComponent, pathMatch: 'full' },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  {
    path: 'admin',
    // Lazy — the admin-only portal stays out of every other user's bundle.
    loadComponent: () =>
      import('./components/admin/admin.component').then((m) => m.AdminComponent),
    canActivate: [authGuard],
  },
  { path: 'feed', redirectTo: '', pathMatch: 'full' },
  { path: 'playlists', redirectTo: '', pathMatch: 'full' },

  { path: 'auth/sign-in', component: SignInComponent },
  { path: 'auth/callback', component: CallbackComponent },

  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
