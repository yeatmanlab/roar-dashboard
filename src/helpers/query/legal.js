import _capitalize from 'lodash/capitalize';
import { getAxiosInstance } from './utils';
import _mapValues from 'lodash/mapValues';

export const fetchLegalDocs = () => {
  const axiosInstance = getAxiosInstance('admin');
  return axiosInstance.get('/legal').then(({ data }) => {
    const docs = data.documents.map((doc) => {
      const type = _capitalize(doc.name.split('/').pop());
      const lastUpdated = new Date(doc.createTime);
      return {
        type: type,
        fileName: doc.fields.fileName,
        gitHubOrg: doc.fields.gitHubOrg,
        currentCommit: doc.fields.currentCommit,
        lastUpdated: lastUpdated.toLocaleString(),
      };
    });
    return docs;
  });
};
