import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { CognitoService } from '../services/cognito.service';
import { environment } from '../../environments/environment';

/**
 * Attaches the Cognito ID token as a Bearer header on calls to the
 * xomtracks API. Ported from xomforms-frontend's jwt.interceptor.ts.
 *
 * When signed out, `getJwt()` resolves null and the request goes through
 * unmodified. Only requests to our own API base get the header.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) {
    return next(req);
  }

  const cognito = inject(CognitoService);
  return from(cognito.getJwt()).pipe(
    switchMap((token) => {
      if (!token) {
        return next(req);
      }
      const authed = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      return next(authed);
    }),
  );
};
