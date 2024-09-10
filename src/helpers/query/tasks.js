import { toValue } from 'vue';
import _mapValues from 'lodash/mapValues';
import _uniq from 'lodash/uniq';
import _without from 'lodash/without';
import { convertValues, getAxiosInstance, mapFields, fetchDocsById } from './utils';
import { FIRESTORE_DATABASES, FIRESTORE_COLLECTIONS } from '../../constants/firebase';

export const getTasksRequestBody = ({
  registered = true,
  allData = false,
  orderBy,
  aggregationQuery,
  pageLimit,
  page,
  paginate = false,
  select = ['name'],
}) => {
  const requestBody = { structuredQuery: {} };

  if (orderBy) {
    requestBody.structuredQuery.orderBy = orderBy;
  }

  if (!aggregationQuery) {
    if (paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }

    if (!allData) {
      requestBody.structuredQuery.select = {
        fields: select.map((field) => ({ fieldPath: field })),
      };
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: 'tasks',
      allDescendants: false,
    },
  ];

  if (registered) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'registered' },
        op: 'EQUAL',
        value: { booleanValue: true },
      },
    };
  }

  if (aggregationQuery) {
    return {
      structuredAggregationQuery: {
        ...requestBody,
        aggregations: [
          {
            alias: 'count',
            count: {},
          },
        ],
      },
    };
  }

  return requestBody;
};

export const taskFetcher = async (registered = true, allData = false, select = ['name', 'testData', 'demoData']) => {
  const axiosInstance = getAxiosInstance('app');
  const requestBody = getTasksRequestBody({
    registered,
    allData,
    aggregationQuery: false,
    paginate: false,
    select: allData ? '' : select,
  });

  return axiosInstance.post(':runQuery', requestBody).then(({ data }) => mapFields(data));
};

/**
 * Fetch task documents by their IDs.
 *
 * @param {Array<String>} taskIds – The array of task IDs to fetch.
 * @returns {Promise<Array<Object>>} The array of task documents.
 */
export const fetchByTaskId = async (taskIds) => {
  const taskDocs = toValue(taskIds).map((taskId) => ({
    collection: FIRESTORE_COLLECTIONS.TASKS,
    docId: taskId,
  }));

  return fetchDocsById(taskDocs, FIRESTORE_DATABASES.APP);
};

export const getVariantsRequestBody = ({ registered = false, aggregationQuery, pageLimit, page, paginate = false }) => {
  const requestBody = { structuredQuery: {} };

  if (!aggregationQuery) {
    if (paginate) {
      requestBody.structuredQuery.limit = pageLimit;
      requestBody.structuredQuery.offset = page * pageLimit;
    }
  }

  requestBody.structuredQuery.from = [
    {
      collectionId: 'variants',
      allDescendants: true,
    },
  ];

  if (registered) {
    requestBody.structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: 'registered' },
        op: 'EQUAL',
        value: { booleanValue: true },
      },
    };
  }

  if (aggregationQuery) {
    return {
      structuredAggregationQuery: {
        ...requestBody,
        aggregations: [
          {
            alias: 'count',
            count: {},
          },
        ],
      },
    };
  }

  return requestBody;
};

export const variantsFetcher = async (registered = false) => {
  const axiosInstance = getAxiosInstance('app');
  const requestBody = getVariantsRequestBody({
    registered,
    aggregationQuery: false,
    paginate: false,
  });

  return axiosInstance.post(':runQuery', requestBody).then(async ({ data }) => {
    // Convert to regular object. Second arg is true to return parent doc ID as well.
    const variants = mapFields(data, true);

    // Retrieve all paths to the parent task documents. Note that there will be
    // duplicates so we use _uniq. We also use _without to remove undefined
    // values. The undefined values come from continuation tokens when the query
    // is paginated.
    const taskDocPaths = _uniq(
      _without(
        data.map((taskDoc) => {
          if (taskDoc.document?.name) {
            return taskDoc.document.name.split('/variants/')[0];
          } else {
            return undefined;
          }
        }),
        undefined,
      ),
    );

    // Use batchGet to get all task docs with one post request
    const batchTaskDocs = await axiosInstance
      .post(':batchGet', {
        documents: taskDocPaths,
      })
      .then(({ data }) => {
        return _without(
          data.map(({ found }) => {
            if (found) {
              return {
                name: found.name,
                data: {
                  id: found.name.split('/tasks/')[1],
                  ..._mapValues(found.fields, (value) => convertValues(value)),
                },
              };
            }
            return undefined;
          }),
          undefined,
        );
      });

    const taskDocDict = batchTaskDocs.reduce((acc, task) => {
      acc[task.data.id] = { ...task };
      return acc;
    }, {});

    // But the order of batchGet is not guaranteed, so we need to match the task
    // docs back with their variants.
    return variants.map((variant) => {
      const task = taskDocDict[variant.parentDoc];
      return {
        id: variant.id,
        variant,
        task: task.data,
      };
    });
  });
};
