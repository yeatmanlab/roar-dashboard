import { StatusCodes } from 'http-status-codes';
import type { RegistrationAgreementsQuery, RegistrationRequest } from '@roar-platform/api-contract';
import { ApiError } from '../errors/api-error';
import { RegistrationService } from '../services/registration/registration.service';
import { toErrorResponse } from '../utils/to-error-response.util';

const registrationService = RegistrationService();

/** HTTP mapping for the public pre-authentication registration surface. */
export const AuthController = {
  getRegistrationAgreements: async (query: RegistrationAgreementsQuery) => {
    try {
      const items = await registrationService.getAgreements(query.locale);
      return {
        status: StatusCodes.OK as const,
        body: { data: { items } },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [StatusCodes.INTERNAL_SERVER_ERROR]);
      }
      throw error;
    }
  },

  register: async (body: RegistrationRequest) => {
    try {
      await registrationService.register({
        email: body.email,
        password: body.password,
        name: body.name,
        location: body.location,
        agreementVersionIds: body.agreements.map(({ agreementVersionId }) => agreementVersionId),
        optIns: body.optIns,
      });

      return {
        status: StatusCodes.NO_CONTENT as const,
        body: undefined,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return toErrorResponse(error, [
          StatusCodes.BAD_REQUEST,
          StatusCodes.CONFLICT,
          StatusCodes.UNPROCESSABLE_ENTITY,
          StatusCodes.TOO_MANY_REQUESTS,
          StatusCodes.INTERNAL_SERVER_ERROR,
        ]);
      }
      throw error;
    }
  },
};
