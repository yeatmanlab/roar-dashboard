import { LEVANTE_BUCKET_URL } from '@/constants/bucket';
import { logger } from '@/logger';
import { useQuery, UseQueryReturnType } from '@tanstack/vue-query';
import axios from 'axios';
import { computed, MaybeRefOrGetter, toValue } from 'vue';

interface BucketTaskTranslation {
  audioKey: string;
  translationText: string;
  englishSourceString: string | null;
}

const fetchBucketTaskTranslations = async (taskId?: string, locale?: string) => {
  if (!taskId || !locale) return [];

  const url = `${LEVANTE_BUCKET_URL}/translations/itembank/${taskId}/${locale}/item-bank-translations.json`;
  const enUrl = `${LEVANTE_BUCKET_URL}/translations/itembank/${taskId}/en-US/item-bank-translations.json`;

  try {
    const shouldFetchEnglish = locale.toLowerCase() !== 'en-us';
    const [translationResponse, enTranslationResponse] = await Promise.all([
      axios.get<Record<string, string>>(url),
      shouldFetchEnglish ? axios.get<Record<string, string>>(enUrl) : Promise.resolve(null),
    ]);
    const translations = translationResponse.data;
    const enTranslations = enTranslationResponse?.data ?? {};

    return Object.keys(translations).map((key) => ({
      audioKey: key,
      translationText: translations[key],
      englishSourceString: enTranslations[key] ?? null,
    }));
  } catch (error) {
    logger.capture(`Failed to fetch translations for ${taskId} in ${locale}`, { error });
    throw error;
  }
};

export const useBucketTaskTranslationsQuery = (
  taskId?: MaybeRefOrGetter<string | undefined>,
  locale?: MaybeRefOrGetter<string | undefined>,
): UseQueryReturnType<BucketTaskTranslation[], Error> => {
  return useQuery({
    queryKey: computed(() => ['bucket-task-translations', toValue(taskId), toValue(locale)]),
    queryFn: () => fetchBucketTaskTranslations(toValue(taskId), toValue(locale)),
    enabled: computed(() => !!toValue(taskId) && !!toValue(locale)),
  });
};
