import { loadCorpus, downloadJSON, NAME_CORPUS_DEF } from '../../shared/helpers/loadCorpus';
import { sessionGet, sessionSet } from '../../shared/helpers/sessionHelpers';
import { MP_SESSION_KEYS as SK } from './mp_sessionKeys';

const LOC_CONFIG_DEF = 'shared/corpora/config';
const NAME_CONFIG_BLOCK_DEF = 'config-block-def';
const NAME_CONFIG_QUEST_DEF = 'config-quest-def';

export const mp_loadCorpus = async (nameTask, assets, bucketURI) => {
  // bucketURI = https://storage.googleapis.com/roav-mp
  await loadCorpus(nameTask, assets, bucketURI);
  const nameCorpus = sessionGet(SK.NAME_CORPUS);
  if (nameCorpus === NAME_CORPUS_DEF) {
    const locConfig = `${bucketURI}/${LOC_CONFIG_DEF}`;
    const nameFileConfigBlock = `${locConfig}/${nameTask}-${NAME_CONFIG_BLOCK_DEF}.json`;
    const configBlock = await downloadJSON(nameFileConfigBlock);
    sessionSet(SK.RDK_CONFIG_BLOCK, configBlock);
    const nameFileConfigQuest = `${locConfig}/${nameTask}-${NAME_CONFIG_QUEST_DEF}.json`;
    const configQuest = await downloadJSON(nameFileConfigQuest);
    sessionSet(SK.RDK_CONFIG_QUEST, configQuest);
  }
};
