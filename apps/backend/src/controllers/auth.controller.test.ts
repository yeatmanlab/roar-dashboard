import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../errors/api-error';
import { ApiErrorCode } from '../enums/api-error-code.enum';
import { ApiErrorMessage } from '../enums/api-error-message.enum';
import { RegistrationService } from '../services/registration/registration.service';

vi.mock('../services/registration/registration.service', () => ({
  RegistrationService: vi.fn(),
}));

const mockGetAgreements = vi.fn();
const mockRegister = vi.fn();

describe('AuthController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(RegistrationService).mockReturnValue({
      getAgreements: mockGetAgreements,
      register: mockRegister,
    });
  });

  it('returns public registration agreements', async () => {
    const items = [
      {
        agreementId: '00000000-0000-4000-8000-000000000001',
        agreementVersionId: '00000000-0000-4000-8000-000000000002',
        agreementType: 'consent' as const,
        name: 'Research consent',
        locale: 'en-US',
        content: '# Research consent',
      },
    ];
    mockGetAgreements.mockResolvedValue(items);
    const { AuthController } = await import('./auth.controller');

    const result = await AuthController.getRegistrationAgreements({ locale: 'en-US' });

    expect(result).toEqual({ status: StatusCodes.OK, body: { data: { items } } });
    expect(mockGetAgreements).toHaveBeenCalledWith('en-US');
  });

  it('maps the registration request and returns 204', async () => {
    const body = {
      email: 'parent@example.com',
      password: 'password123',
      name: { first: 'Pat', last: 'Parent' },
      agreements: [{ agreementVersionId: '00000000-0000-4000-8000-000000000002' }],
      optIns: { researchContact: false },
    };
    const { AuthController } = await import('./auth.controller');

    const result = await AuthController.register(body);

    expect(result).toEqual({ status: StatusCodes.NO_CONTENT, body: undefined });
    expect(mockRegister).toHaveBeenCalledWith({
      email: body.email,
      password: body.password,
      name: body.name,
      location: undefined,
      agreementVersionIds: [body.agreements[0]!.agreementVersionId],
      optIns: body.optIns,
    });
  });

  it.each([
    StatusCodes.CONFLICT,
    StatusCodes.UNPROCESSABLE_ENTITY,
    StatusCodes.TOO_MANY_REQUESTS,
    StatusCodes.INTERNAL_SERVER_ERROR,
  ])('maps registration ApiError status %s', async (statusCode) => {
    mockRegister.mockRejectedValue(
      new ApiError(ApiErrorMessage.UNPROCESSABLE_ENTITY, {
        statusCode,
        code: ApiErrorCode.RESOURCE_UNPROCESSABLE,
      }),
    );
    const { AuthController } = await import('./auth.controller');

    const result = await AuthController.register({
      email: 'parent@example.com',
      password: 'password123',
      name: { first: 'Pat', last: 'Parent' },
      agreements: [{ agreementVersionId: '00000000-0000-4000-8000-000000000002' }],
      optIns: { researchContact: false },
    });

    expect(result.status).toBe(statusCode);
    expect(result.body).toHaveProperty('error');
  });

  it('rethrows unexpected errors', async () => {
    mockGetAgreements.mockRejectedValue(new Error('unexpected'));
    const { AuthController } = await import('./auth.controller');

    await expect(AuthController.getRegistrationAgreements({ locale: 'en-US' })).rejects.toThrow('unexpected');
  });
});
