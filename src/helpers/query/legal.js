import _capitalize from 'lodash/capitalize';
import { convertValues, getAxiosInstance } from './utils';

export const fetchLegalDocs = () => {
  const axiosInstance = getAxiosInstance('admin');
  return axiosInstance.get('/legal').then(({ data }) => {
    console.log('legal docs:', data.documents);
    const docs = data.documents.map((doc) => {
      const type = _capitalize(doc.name.split('/').pop());
      const lastUpdated = new Date(doc.createTime);
      return {
        type: type,
        fileName: convertValues(doc.fields.fileName),
        gitHubOrg: convertValues(doc.fields.gitHubOrg),
        gitHubRepository: convertValues(doc.fields.gitHubRepository),
        currentCommit: convertValues(doc.fields.currentCommit),
        lastUpdated: lastUpdated.toLocaleString(),
        params: convertValues(doc.fields.params),
      };
    });
    return docs;
  });
};
