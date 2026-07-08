import { svgStrToSrc } from '../../shared/trials/svgHelpers';
import { loadCorpus, downloadJSON } from '../../shared/helpers/loadCorpus';
import { ModeAdaptBlock, ModeAdaptStim } from '../../shared/helpers/namingHelpers';
import { sessionGet, sessionSet } from '../../shared/helpers/sessionHelpers';
import { RVP_SESSION_KEYS as SK } from './rvp_sessionKeys';

const LOC_CONFIG_DEF = 'shared/corpora/config';
export const NAME_CONFIG_STIM_DEF = 'config-stim-def';
export const NAME_CONFIG_BLOCK_DEF = 'config-block-def';

const loadSvgStim = async (configsStim, bucketURI) => {
  const mapsStim = {};
  await Promise.all(
    Object.entries(configsStim).map(async ([typeStim, cs]) => {
      mapsStim[typeStim] = await Promise.all(
        cs.stimulus.map(async (filename) => {
          const url = `${bucketURI}/shared/corpora/svg/${typeStim}/${filename}`;
          const strSvg = await (await fetch(url)).text();
          return {
            name: filename.replace('.svg', ''),
            src: svgStrToSrc(strSvg),
          };
        }),
      );
    }),
  );
  sessionSet(SK.MAPS_STIM, mapsStim);
};

export const rvp_loadCorpus = async (nameTask, assets, bucketURI) => {
  // sessionSet(SK.URI_BUCKET, bucketURI);
  await loadCorpus(nameTask, assets, bucketURI);
  const locConfig = `${bucketURI}/${LOC_CONFIG_DEF}`;
  const config = sessionGet(SK.CONFIG);
  // stimuli
  const { nameConfigStim } = config;
  const nameFileConfigStim = `${locConfig}/${nameTask}-${nameConfigStim}.json`;
  const configStim = await downloadJSON(nameFileConfigStim);
  sessionSet(SK.CONFIGS_STIM, configStim.configsStim);
  await loadSvgStim(configStim.configsStim, bucketURI);
  // blocks
  const { nameConfigBlock } = config;
  const nameFileConfigBlock = `${locConfig}/${nameTask}-${nameConfigBlock}.json`;
  const configBlock = await downloadJSON(nameFileConfigBlock);
  sessionSet(SK.CONFIG_BLOCK, configBlock);
  sessionSet(SK.MODE_ADAPT_STIM, configBlock.modeAdaptStim ?? ModeAdaptStim.NONE);
  sessionSet(SK.MODE_ADAPT_BLOCK, configBlock.modeAdaptBlock ?? ModeAdaptBlock.NONE);
};
