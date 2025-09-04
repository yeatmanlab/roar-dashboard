import { describe, it, expect, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { FirebaseCoreClient } from './firebase-core.client';
import {
  initializeApp,
  getApp as getAdminApp,
  getApps as getAdminApps,
  applicationDefault,
  cert,
} from 'firebase-admin/app';

const getAppsMock = getAdminApps as unknown as Mock;
const getAppMock = getAdminApp as unknown as Mock;
const initializeAppMock = initializeApp as unknown as Mock;
const applicationDefaultMock = applicationDefault as unknown as Mock;
const certMock = cert as unknown as Mock;

const clearAuthEnv = () => {
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_CREDENTIALS;
};

beforeEach(() => {
  FirebaseCoreClient.clearCache();
  clearAuthEnv();
});

describe('FirebaseCoreClient', () => {
  it('returns existing default app if one is already initialized', () => {
    const mockDefaultApp = { name: 'mock-default-app' };
    getAppsMock.mockReturnValue([{}]);
    getAppMock.mockReturnValue(mockDefaultApp);

    const app = FirebaseCoreClient.getApp();

    expect(app).toBe(mockDefaultApp);
    expect(initializeAppMock).not.toHaveBeenCalled();
    expect(applicationDefaultMock).not.toHaveBeenCalled();
    expect(certMock).not.toHaveBeenCalled();
  });

  it('initializes with application default credentials when environment signals default credentials', () => {
    process.env.GOOGLE_CLOUD_PROJECT = 'mock-gcp-project';

    const mockApp = { name: 'mock-adc-app' };
    const defaultCredentials = { __type: 'mock-adc-credential' };

    getAppsMock.mockReturnValue([]);
    applicationDefaultMock.mockReturnValue(defaultCredentials);
    initializeAppMock.mockImplementation((cfg) => {
      expect(cfg).toEqual({ credential: defaultCredentials });
      return mockApp;
    });

    const app = FirebaseCoreClient.getApp();

    expect(applicationDefaultMock).toHaveBeenCalledTimes(1);
    expect(certMock).not.toHaveBeenCalled();
    expect(initializeAppMock).toHaveBeenCalledTimes(1);
    expect(app).toBe(mockApp);
  });

  it('initializes with service account credentials when FIREBASE_SERVICE_ACCOUNT_CREDENTIALS is set', () => {
    const mockServiceAccountCredentials = { project_id: 'p', client_email: 'e', private_key: 'k' };
    process.env.FIREBASE_SERVICE_ACCOUNT_CREDENTIALS = Buffer.from(
      JSON.stringify(mockServiceAccountCredentials),
      'utf8',
    ).toString('base64');

    const mockApp = { name: 'sa-app' };
    getAppsMock.mockReturnValue([]);

    certMock.mockImplementation((json) => ({ __type: 'mock-cert-credential', json }));
    initializeAppMock.mockReturnValue(mockApp);

    const app = FirebaseCoreClient.getApp();

    expect(certMock).toHaveBeenCalledWith(mockServiceAccountCredentials);
    expect(applicationDefaultMock).not.toHaveBeenCalled();
    expect(initializeAppMock).toHaveBeenCalledWith({
      credential: {
        __type: 'mock-cert-credential',
        json: mockServiceAccountCredentials,
      },
    });
    expect(app).toBe(mockApp);
  });

  it('falls back to application default credentials when no credentials are configured', () => {
    const mockApp = { name: 'mock-app' };
    getAppsMock.mockReturnValue([]);

    const defaultCredentials = { __type: 'mock-adc-credential' };
    applicationDefaultMock.mockReturnValue(defaultCredentials);
    initializeAppMock.mockReturnValue(mockApp);

    const app = FirebaseCoreClient.getApp();

    expect(applicationDefaultMock).toHaveBeenCalledTimes(1);
    expect(certMock).not.toHaveBeenCalled();
    expect(initializeAppMock).toHaveBeenCalledWith({ credential: defaultCredentials });
    expect(app).toBe(mockApp);
  });

  it('logs and falls back to application default credentials when service account credentials cannot be parsed', () => {
    const mockApp = { name: 'mock-app' };
    getAppsMock.mockReturnValue([]);

    const invalidJsonB64 = Buffer.from('invalid json', 'utf8').toString('base64');
    process.env.FIREBASE_SERVICE_ACCOUNT_CREDENTIALS = invalidJsonB64;

    const defaultCredentials = { __type: 'mock-adc-credential' };
    applicationDefaultMock.mockReturnValue(defaultCredentials);
    initializeAppMock.mockReturnValue(mockApp);

    const app = FirebaseCoreClient.getApp();

    expect(applicationDefaultMock).toHaveBeenCalledTimes(1);
    expect(certMock).not.toHaveBeenCalled();
    expect(initializeAppMock).toHaveBeenCalledWith({ credential: defaultCredentials });
    expect(app).toBe(mockApp);
  });

  it('clearCache resets the cached app and allows re-initialization', () => {
    getAppsMock.mockReturnValue([]);

    const mockApp1 = { name: 'mock-app-1' };
    const mockApp2 = { name: 'mock-app-2' };

    initializeAppMock.mockReturnValueOnce(mockApp1).mockReturnValueOnce(mockApp2);

    const first = FirebaseCoreClient.getApp();
    expect(first).toBe(mockApp1);
    expect(initializeAppMock).toHaveBeenCalledTimes(1);

    FirebaseCoreClient.clearCache();

    const second = FirebaseCoreClient.getApp();
    expect(second).toBe(mockApp2);
  });
});
