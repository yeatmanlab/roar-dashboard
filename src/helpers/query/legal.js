import { getAxiosInstance, mapFields, orderByDefault } from './utils';

export const fetchLegalDocs = async ({ orderBy, pageLimit, page }) => {
  const axiosInstance = getAxiosInstance();

  const requestBody = {
    structuredQuery: {
      orderBy: orderBy ?? orderByDefault,
      limit: pageLimit,
      offset: page * pageLimit,
      select: {
        fields: [
          { fieldPath: 'currentCommit' },
          { fieldPath: 'fileName' },
          { fieldPath: 'gitHubOrg' },
          { fieldPath: 'gitHubRepository' },
        ],
      },
      from: [{ collectionId: 'legal' }],
    },
  };

  try {
    const response = await axiosInstance.post(':runQuery', requestBody);
    const data = response.data;
    console.log('response data: ', data);
    const mappedData = mapFields(data);
    console.log('Data from runQuery:', mappedData);
    return mappedData;
  } catch (error) {
    console.error('Error fetching legal documents:', error);
    throw error;
  }
};
