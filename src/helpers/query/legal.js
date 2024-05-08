import _capitalize from 'lodash/capitalize';
import { getAxiosInstance } from './utils';
import _mapValues from 'lodash/mapValues';

export const fetchLegalDocs = () => {
  const axiosInstance = getAxiosInstance('admin');
  return axiosInstance.get('/test-legal').then(({ data }) => {
    const docs = data.documents.map((doc) => {
      const type = _capitalize(doc.name.split('/').pop());
      const lastUpdated = new Date(doc.createTime);
      return {
        type: type,
        fileName: doc.fields.fileName,
        gitHubOrg: doc.fields.gitHubOrg,
        gitHubRepository: doc.fields.gitHubRepository,
        currentCommit: doc.fields.currentCommit,
        lastUpdated: lastUpdated.toLocaleString(),
        params: doc.fields.params,
      };
    });
    return docs;
  });
};
