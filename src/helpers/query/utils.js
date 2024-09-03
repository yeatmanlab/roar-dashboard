import axios from 'axios';
import Papa from 'papaparse';
import _get from 'lodash/get';
import _isEmpty from 'lodash/isEmpty';
import _fromPairs from 'lodash/fromPairs';
import _last from 'lodash/last';
import _mapValues from 'lodash/mapValues';
import _toPairs from 'lodash/toPairs';
import _union from 'lodash/union';
import _without from 'lodash/without';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { flattenObj } from '@/helpers';

export const convertValues = (value) => {
  const passThroughKeys = [
    'nullValue',
    'booleanValue',
    'timestampValue',
    'stringValue',
    'bytesValue',
    'referenceValue',
    'geoPointValue',
  ];
  const numberKeys = ['integerValue', 'doubleValue'];
  return _toPairs(value).map(([key, _value]) => {
    if (passThroughKeys.includes(key)) {
      return _value;
    } else if (numberKeys.includes(key)) {
      return Number(_value);
    } else if (key === 'arrayValue') {
      return (_value.values ?? []).map((itemValue) => convertValues(itemValue));
    } else if (key === 'mapValue') {
      return _fromPairs(_toPairs(_value.fields).map(([mapKey, mapValue]) => [mapKey, convertValues(mapValue)]));
    }
  })[0];
};

export const mapFields = (data, getParentDocId) => {
  const fields = _without(
    data.map((item) => {
      if (item.document?.fields) {
        const nameSplit = (item.document?.name ?? '').split('/');
        const result = {
          ...item.document?.fields,
          id: { stringValue: _last(nameSplit) },
        };
        if (getParentDocId) {
          result.parentDoc = { stringValue: nameSplit[nameSplit.length - 3] };
        }
        return result;
      }
      return undefined;
    }),
    undefined,
  );
  return fields.map((item) => _mapValues(item, (value) => convertValues(value)));
};

export const orderByDefault = [
  {
    field: { fieldPath: 'name' },
    direction: 'ASCENDING',
  },
];

export const getProjectId = (project = 'admin') => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);
  return roarfirekit.value.roarConfig?.[project]?.projectId;
};

export const getAxiosInstance = (db = 'admin', unauthenticated = false) => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);
  const axiosOptions = _get(roarfirekit.value.restConfig, db) ?? {};
  if (unauthenticated) {
    delete axiosOptions.headers;
  }

  // Throw error when the Axios baseUrl is not set.
  // This is a temporary solution to ensure the Axios base URL is set before making requests. This is a workaround that
  // is required because the initialization logic seems to contain a race condition that causes TanStack to make
  // requests before the base URL is set. Throwing an error ensures that TanStack identifies the request as invalid and
  // retries it after the base URL is set.
  // @TODO: Remove once initialization logic issue is identified and fixed.
  if (!axiosOptions.baseURL) {
    throw new Error('Base URL is not set.');
  }

  return axios.create(axiosOptions);
};

export const exportCsv = (data, filename) => {
  const csvData = data.map(flattenObj);
  const csvColumns = _union(...csvData.map(Object.keys));
  const csv = Papa.unparse(csvData, {
    columns: csvColumns,
  });

  const blob = new Blob([csv]);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob, { type: 'text/plain' });
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const fetchDocById = async (
  collection,
  docId,
  select,
  db = 'admin',
  unauthenticated = false,
  swallowErrors = false,
) => {
  if (!collection || !docId) {
    console.warn(
      `fetchDocById: Collection or docId not provided. Called with collection "${collection}" and docId "${docId}"`,
    );
    return {};
  }
  const docPath = `/${collection}/${docId}`;
  const axiosInstance = getAxiosInstance(db, unauthenticated);
  const queryParams = (select ?? []).map((field) => `mask.fieldPaths=${field}`);
  const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  return axiosInstance
    .get(docPath + queryString)
    .then(({ data }) => {
      return {
        id: docId,
        collection,
        ..._mapValues(data.fields, (value) => convertValues(value)),
      };
    })
    .catch((error) => {
      if (!swallowErrors) {
        console.error(error);
      }
      return {
        data: `${error.code === '404' ? 'Document not found' : error.message}`,
      };
    });
};

export const fetchDocsById = async (documents, db = 'admin') => {
  if (_isEmpty(documents)) {
    console.warn('FetchDocsById: No documents provided!');
    return [];
  }
  const axiosInstance = getAxiosInstance(db);
  const promises = [];
  for (const { collection, docId, select } of documents) {
    const docPath = `/${collection}/${docId}`;
    const queryParams = (select ?? []).map((field) => `mask.fieldPaths=${field}`);
    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    promises.push(
      axiosInstance.get(docPath + queryString).then(({ data }) => {
        return {
          id: docId,
          collection,
          ..._mapValues(data.fields, (value) => convertValues(value)),
        };
      }),
    );
  }
  return Promise.all(promises);
};

export const batchGetDocs = async (docPaths, select = [], db = 'admin') => {
  if (_isEmpty(docPaths)) {
    console.warn('BatchGetDocs: No document paths provided!');
    return [];
  }
  const axiosInstance = getAxiosInstance(db);
  const baseURL = axiosInstance.defaults.baseURL.split('googleapis.com/v1/')[1];
  const documents = docPaths.map((docPath) => `${baseURL}/${docPath}`);
  const batchDocs = await axiosInstance
    .post(':batchGet', {
      documents,
      ...(select.length > 0 && {
        mask: { fieldPaths: select },
      }),
    })
    .then(({ data }) => {
      return _without(
        data.map(({ found }) => {
          if (found) {
            const nameSplit = found.name.split('/');
            return {
              name: found.name,
              data: {
                id: nameSplit.pop(),
                collection: nameSplit.pop(),
                ..._mapValues(found.fields, (value) => convertValues(value)),
              },
            };
          }
          return undefined;
        }),
        undefined,
      );
    });

  return docPaths.map((docPath) => batchDocs.find((doc) => doc.name.includes(docPath))).map((doc) => doc?.data);
};

export const matchMode2Op = {
  equals: 'EQUAL',
  notEquals: 'NOT_EQUAL',
};

export const fetchSubcollection = async (collectionPath, subcollectionName, select = [], db = 'admin') => {
  const axiosInstance = getAxiosInstance(db);
  // Construct the path to the subcollection
  const subcollectionPath = `/${collectionPath}/${subcollectionName}`;
  const queryParams = select.map((field) => `mask.fieldPaths=${field}`).join('&');
  const queryString = queryParams ? `?${queryParams}` : '';

  return axiosInstance
    .get(subcollectionPath + queryString)
    .then(({ data }) => {
      // Assuming the API returns an array of document data in the subcollection
      return data.documents
        ? data.documents.map((doc) => {
            return {
              id: doc.name.split('/').pop(), // Extract document ID from the document name/path
              ..._mapValues(doc.fields, (value) => convertValues(value)),
            };
          })
        : [];
    })
    .catch((error) => {
      console.error(error);
      return {
        error: `${error.response?.status === 404 ? 'Subcollection not found' : error.message}`,
      };
    });
};
