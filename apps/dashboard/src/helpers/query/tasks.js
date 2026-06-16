import { toValue } from 'vue';
import _mapValues from 'lodash/mapValues';
import _uniq from 'lodash/uniq';
import _without from 'lodash/without';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/store/auth';
import { convertValues, getAxiosInstance, mapFields } from './utils';

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

  if (toValue(registered)) {
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
    const mappedVariants = variants.map((variant) => {
      const task = taskDocDict[variant.parentDoc];
      if (task) {
        return {
          id: variant.id,
          variant,
          task: task.data,
        };
      } else return undefined;
    });
    return _without(mappedVariants, undefined);
  });
};

export const fetchTaskGroups = async () => {
  const authStore = useAuthStore();
  const { roarfirekit } = storeToRefs(authStore);

  const taskGroups = await roarfirekit.value.getTaskBundles();
  return taskGroups;
};
