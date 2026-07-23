import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { HomeComponent } from './components/home/home.component';
import { LandingComponent } from './components/landing/landing.component';
import { FeedComponent } from './components/feed/feed.component';
import { FeedPanelComponent } from './components/feed-panel/feed-panel.component';
import { ShareCardComponent } from './components/share-card/share-card.component';
import { RatingStarsComponent } from './components/rating-stars/rating-stars.component';
import { TrackDetailModalComponent } from './components/track-detail-modal/track-detail-modal.component';
import { PlaylistsComponent } from './components/playlists/playlists.component';
import { LinkPhoneModalComponent } from './components/link-phone-modal/link-phone-modal.component';
import { SignInComponent } from './components/auth/sign-in/sign-in.component';
import { CallbackComponent } from './components/auth/callback/callback.component';

import { jwtInterceptor } from './interceptors/jwt.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    LandingComponent,
    FeedComponent,
    FeedPanelComponent,
    ShareCardComponent,
    RatingStarsComponent,
    TrackDetailModalComponent,
    PlaylistsComponent,
    LinkPhoneModalComponent,
    SignInComponent,
    CallbackComponent,
  ],
  imports: [BrowserModule, AppRoutingModule, FormsModule],
  // provideHttpClient(withInterceptors(...)) registers the functional
  // HttpInterceptorFn even in an NgModule app — mirrors xomforms-frontend.
  providers: [provideHttpClient(withInterceptors([jwtInterceptor]))],
  bootstrap: [AppComponent],
})
export class AppModule {}
