import { LEVANTE_BUCKET_STORAGE_LIST_API, LEVANTE_BUCKET_URL } from '@/constants/bucket';
import { logger } from '@/logger';
import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import axios from 'axios';
import { computed, MaybeRefOrGetter, toValue } from 'vue';

interface GcsObject {
  name: string;
  contentType?: string;
}

interface GcsListResponse {
  items?: GcsObject[];
  nextPageToken?: string;
}

interface BucketAudioFile {
  audioKey: string;
  name: string;
  url: string;
}

const fetchBucketAudioList = async (locale?: string): Promise<BucketAudioFile[]> => {
  if (!locale) return [];

  const prefix = `audio/${locale}/`;
  const items: GcsObject[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const { data } = await axios.get<GcsListResponse>(LEVANTE_BUCKET_STORAGE_LIST_API, {
        params: {
          prefix,
          pageToken,
        },
      });

      items.push(...(data.items ?? []));
      pageToken = data.nextPageToken;
    } while (pageToken);

    return items
      .filter((item) => item.contentType?.startsWith('audio/') || item.name.match(/\.(mp3|wav|ogg|m4a)$/i))
      .map((item) => {
        const fileName = item.name.split('/').at(-1) ?? item.name;
        const audioKey = fileName.replace(/\.[^/.]+$/, '');

        return {
          audioKey,
          name: item.name,
          url: `${LEVANTE_BUCKET_URL}/${item.name}`,
        };
      });
  } catch (error) {
    logger.capture(`Failed to fetch audio list for ${locale}`, { error });
    throw error;
  }
};

export const useBucketAudioListQuery = (
  locale?: MaybeRefOrGetter<string | undefined>,
): UseQueryReturnType<BucketAudioFile[], Error> => {
  return useQuery({
    queryKey: computed(() => ['bucket-audio-list', toValue(locale)]),
    queryFn: () => fetchBucketAudioList(toValue(locale)),
    enabled: computed(() => !!toValue(locale)),
  });
};
