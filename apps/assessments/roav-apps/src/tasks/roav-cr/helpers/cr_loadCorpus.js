import { svgStrToSrc } from '../../shared/trials/svgHelpers';
import { loadCorpus, downloadJSON } from '../../shared/helpers/loadCorpus';
import { sessionGet, sessionSet } from '../../shared/helpers/sessionHelpers';
import { CR_SESSION_KEYS as SK } from './cr_sessionKeys';

const LOC_CONFIG_DEF = 'shared/corpora/config';
// TODO: see whether constants belong here or in cr_constants...
export const NAME_CONFIG_QUEST_DEF = 'config-quest-def';
export const NAME_CONFIG_STIM_DEF = 'config-stim-def';
export const NAME_CONFIG_ET_DEF = 'config-et-def';
export const NAME_CONFIG_BLOCK_DEF = 'config-block-def';
export const SUBVAR_DEF = 'sv1'; // TODO: think whether "sv1" or "sv3" should be default

const loadSvgStim = async (configStim, bucketURI) => {
  const mapStim = await Promise.all(
    configStim.map(async (filename) => {
      const url = `${bucketURI}/shared/corpora/svg/${filename}`;
      const strSvg = await (await fetch(url)).text();
      return {
        name: filename.replace('.svg', ''),
        src: svgStrToSrc(strSvg),
      };
    }),
  );
  sessionSet(SK.MAP_STIM, mapStim);
};

export const cr_loadCorpus = async (nameTask, assets, bucketURI) => {
  await loadCorpus(nameTask, assets, bucketURI);
  const locConfig = `${bucketURI}/${LOC_CONFIG_DEF}`;
  const config = sessionGet(SK.CONFIG);
  // stimuli
  const { nameConfigStim } = config;
  const nameFileConfigStim = `${locConfig}/${nameTask}-${nameConfigStim}.json`;
  const configStim = await downloadJSON(nameFileConfigStim);
  sessionSet(SK.CONFIG_STIM, configStim.stimulus);
  await loadSvgStim(configStim.stimulus, bucketURI);
  // blocks
  const { nameConfigBlock } = config;
  const nameFileConfigBlock = `${locConfig}/${nameTask}-${nameConfigBlock}.json`;
  const configBlock = await downloadJSON(nameFileConfigBlock);
  sessionSet(SK.CONFIG_BLOCK, configBlock);
  const { nameConfigQuest } = config;
  const nameFileConfigQuest = `${locConfig}/${nameTask}-${nameConfigQuest}.json`;
  const configQuest = await downloadJSON(nameFileConfigQuest);
  sessionSet(SK.CONFIG_QUEST, configQuest);
  const { nameConfigEt } = config;
  const nameFileConfigEt = `${locConfig}/${nameTask}-${nameConfigEt}.json`;
  const configEt = await downloadJSON(nameFileConfigEt);
  sessionSet(SK.CONFIG_ET, configEt);
};
