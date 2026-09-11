import { SESSION_KEYS } from '../../shared/helpers/sessionKeys';

export const RVP_SESSION_KEYS = {
  ...SESSION_KEYS,
  CONFIGS_STIM: 'configsStim',
  MAPS_STIM: 'mapsStim',
  IND_BLOCK_ADAPT: 'indBlockAdapt',
  CNT_BLOCK_REPEAT: 'cntBlockRepeat',

  RVP_METAPARAMS_BLOCK: 'rvpMetaparamsBlock',
  RVP_INFO_BLOCK: 'rvpInfoBlock',
  RVP_ARR_METAPARAMS_TRIAL: 'rvpArrMetaparamsTrial',
};
