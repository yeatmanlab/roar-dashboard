import { LEVANTE_BUCKET_URL } from '@/constants/bucket';
import { useQuery } from '@tanstack/vue-query';
import axios from 'axios';

export const TASK_DISPLAY_NAMES: { [key: string]: string } = {
  'child-survey': 'Child Survey',
  'egma-math': 'Math',
  'hearts-and-flowers': 'Hearts and Flowers',
  'hostile-attribution': 'Hostile Attribution',
  'location-selection': 'Location Selection',
  'matrix-reasoning': 'Pattern Matching',
  'memory-game': 'Memory Game',
  'mental-rotation': 'Mental Rotation',
  'same-different-selection': 'Same Different Selection',
  'theory-of-mind': 'Stories',
  general: 'Intro/General',
  trog: 'Sentence Understanding',
  vocab: 'Vocabulary',
};

interface GcsObject {
  name: string;
}

interface GcsListResponse {
  items?: Array<GcsObject>;
  nextPageToken?: string;
  prefixes?: Array<string>;
}

const fetchBucketTaskList = async () => {
  const url = new URL(`${LEVANTE_BUCKET_URL}/translations/itembank`);
  const [, bucketName, ...prefixParts] = url.pathname.split('/');
  const prefix = prefixParts.filter(Boolean).join('/');
  const normalizedPrefix = prefix ? `${prefix}/` : '';
  const listApiUrl = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o`;
  const { data } = await axios.get<GcsListResponse>(listApiUrl, {
    params: {
      prefix: normalizedPrefix,
      delimiter: '/',
    },
  });

  return (data.prefixes ?? [])
    .map((directory) => {
      const key = directory.replace(normalizedPrefix, '').replace(/\/$/, '');

      return {
        label: TASK_DISPLAY_NAMES[key] || key,
        value: key,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const useBucketTaskListQuery = () => {
  return useQuery({
    queryKey: ['bucket-task-list'],
    queryFn: () => fetchBucketTaskList(),
  });
};
