import { logger } from '@/logger';
import { useQuery, type UseQueryReturnType } from '@tanstack/vue-query';
import axios from 'axios';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';

export interface SurveyOption {
  id: string;
  name: string;
}

const fetchSurvey = async (bucketId?: string, surveyId?: string) => {
  if (!bucketId || !surveyId) return null;

  return axios
    .get<Record<string, unknown>>(`https://storage.googleapis.com/${bucketId}/surveys/${surveyId}.json`)
    .then((response) => response.data)
    .catch((error) => {
      logger.capture(`Failed to fetch survey ${surveyId}`, { error });
      throw error;
    });
};

export const useSurveyQuery = (
  bucketId?: MaybeRefOrGetter<string | undefined>,
  surveyId?: MaybeRefOrGetter<string | undefined>,
): UseQueryReturnType<Record<string, unknown> | null, Error> => {
  return useQuery({
    queryKey: computed(() => ['survey', toValue(bucketId), toValue(surveyId)]),
    queryFn: () => fetchSurvey(toValue(bucketId), toValue(surveyId)),
    enabled: computed(() => !!toValue(bucketId) && !!toValue(surveyId)),
  });
};
