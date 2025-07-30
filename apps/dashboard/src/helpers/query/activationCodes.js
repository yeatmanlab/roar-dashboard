import { FIRESTORE_COLLECTIONS } from '../../constants/firebase';
import { getAxiosInstance } from './utils';
import { toValue } from 'vue';
/**
 * Helper function for generating request body to fetch Activation Codes for an orgId.
 * @param orgId The target orgId for which activation codes we want to return
 *  @returns {Promise<Array<Object>>} A promise that resolves to an array of activation codes.
 */
export const getActivationCodesRequestBody = ({ orgId }) => {
  const requestBody = {
    structuredQuery: {
      from: [
        {
          collectionId: FIRESTORE_COLLECTIONS.ACTIVATION_CODES,
          allDescendants: false,
        },
      ],
      where: {
        fieldFilter: {
          field: { fieldPath: 'orgId' },
          op: 'EQUAL',
          value: { stringValue: toValue(orgId) },
        },
      },
    },
  };

  return requestBody;
};

/**
 *  Fetches activation code for an orgId
 *  @param orgId The target orgId for which activation codes we want to return
 *  @returns {Promise<Array<Object>>} A promise that resolves to an array of activation codes.
 * */
export const getActivationCodesByOrgId = async (orgId) => {
  const axiosInstance = getAxiosInstance('admin');
  const requestBody = getActivationCodesRequestBody({ orgId: toValue(orgId) });
  const response = await axiosInstance.post('/:runQuery', requestBody);
  return response.data;
};
