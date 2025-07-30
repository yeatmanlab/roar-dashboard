import { redirectSignInPath } from './redirectSignInPath';
import { APP_ROUTES } from '../constants/routes';

describe('redirectSignInPath', () => {
  it('should return redirect_to if it is a valid path', () => {
    const route = { query: { redirect_to: '/game/swr' } };
    expect(redirectSignInPath(route)).toBe('/game/swr');
  });

  it('should return home if redirect_to is not a valid path', () => {
    const route = { query: { redirect_to: 'https://example.com' } };
    expect(redirectSignInPath(route)).toBe(APP_ROUTES.UNAUTHORIZED);
  });

  it('should return home if redirect_to is undefined', () => {
    const route = { query: {} };
    expect(redirectSignInPath(route)).toBe(APP_ROUTES.HOME);
  });

  it('should return unauthorized if redirect_to is a JS Scheme', () => {
    const route = { query: { redirect_to: 'javascript:alert(1)' } };
    expect(redirectSignInPath(route)).toBe(APP_ROUTES.UNAUTHORIZED);
  });

  it('should return unauthorized if redirect_to is a protocol-relative URL', () => {
    const route = { query: { redirect_to: '//example.com' } };
    expect(redirectSignInPath(route)).toBe(APP_ROUTES.UNAUTHORIZED);
  });

  it('should return unauthorized if redirect_to is a Mailto Scheme', () => {
    const route = { query: { redirect_to: 'mailto:user@example.com' } };
    expect(redirectSignInPath(route)).toBe(APP_ROUTES.UNAUTHORIZED);
  });

  it('should return unauthorized if redirect_to contains a double slash after leading slash', () => {
    const route = { query: { redirect_to: '/\\/example.com' } };
    expect(redirectSignInPath(route)).toBe(APP_ROUTES.UNAUTHORIZED);
  });
});
