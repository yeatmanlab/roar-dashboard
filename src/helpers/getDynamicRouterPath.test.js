import { describe, it, expect } from 'vitest';
import { getDynamicRouterPath } from './getDynamicRouterPath';

describe('getDynamicRouterPath', () => {
  it('should return the correct path with dynamic parameters', () => {
    const route = '/users/:userId/posts/:postId';
    const mapping = { userId: '123', postId: '456' };
    const expected = '/users/123/posts/456';
    const result = getDynamicRouterPath(route, mapping);
    expect(result).toBe(expected);
  });

  it('should return the correct path with missing dynamic parameters', () => {
    const route = '/users/:userId/posts/:postId';
    const mapping = { userId: '123' };
    const expected = '/users/123/posts/:postId';
    const result = getDynamicRouterPath(route, mapping);
    expect(result).toBe(expected);
  });

  it('should return the correct path with no dynamic parameters', () => {
    const route = '/about';
    const mapping = {};
    const expected = '/about';
    const result = getDynamicRouterPath(route, mapping);
    expect(result).toBe(expected);
  });

  it('should return the correct path with empty route', () => {
    const route = '';
    const mapping = {};
    const expected = '/';
    const result = getDynamicRouterPath(route, mapping);
    expect(result).toBe(expected);
  });

  it('should throw an error when route is not a string', () => {
    const route = 123;
    const mapping = { userId: '123' };
    expect(() => getDynamicRouterPath(route, mapping)).toThrow('Route must be a string');
  });

  it('should throw an error when mapping is not an object', () => {
    const route = '/users/:userId';
    const mapping = 'invalid';
    expect(() => getDynamicRouterPath(route, mapping)).toThrow('Mapping must be an object');
  });
});
