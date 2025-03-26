/**
 * Fetches Activation Codes for an orgId.
 * @param orgId The target orgId for which activation codes we want to return
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of legal document objects.
 */
export const getActivationCodesRequestBody = ({ orgId }) => {
  const requestBody = {
    structuredQuery: {
      from: [
        {
          collectionId: 'activationCodes',
          allDescendants: false,
        },
      ],
    },
  };

  if (orgId) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'orgId' },
        op: 'EQUAL',
        value: { stringValue: orgId },
      },
    };
  }

  return requestBody;
};

export const activationCodeFetcher = async (orgId) => {
  const axiosInstance = getAxiosInstance('admin');
  const requestBody = getActivationCodesRequestBody({ orgId });
  const response = await axiosInstance.post('/:runQuery', requestBody);
  return response.data;
};
