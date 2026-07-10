import '../../../i18n/i18n';
import 'regenerator-runtime/runtime'; // async function
import 'simple-keyboard/build/css/index.css';
import i18next from 'i18next';
import { getGrade } from '@bdelab/roar-utils';
import { sessionGet, sessionSet } from './sessionHelpers';
import { SESSION_KEYS as SK } from './sessionKeys';

export const NAME_CORPUS_DEF = 'corpus-def';

const isUnsafeMergeKey = (key) => key === '__proto__' || key === 'constructor' || key === 'prototype';

export function downloadJSON(url) {
  return new Promise((resolve, reject) => {
    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Failed to load ${url}: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        resolve(data);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

export const addInPlaceJSON = (base, ext) => {
  if (!ext) return;

  if (Array.isArray(base) && Array.isArray(ext)) {
    const set = new Set(base);
    ext.forEach((item) => {
      set.add(item);
    });
    // eslint-disable-next-line no-param-reassign
    base.length = 0;
    base.push(...set);
    return;
  }

  if (base && typeof base === 'object' && ext && typeof ext === 'object') {
    Object.keys(ext).forEach((key) => {
      if (isUnsafeMergeKey(key)) return;

      const b = base[key];
      const e = ext[key];

      if (Array.isArray(b) || Array.isArray(e)) {
        const bArr = Array.isArray(b) ? b : [];
        const eArr = Array.isArray(e) ? e : [];
        // eslint-disable-next-line no-param-reassign
        base[key] = [...new Set([...bArr, ...eArr])];
      } else if (
        Object.prototype.hasOwnProperty.call(base, key) &&
        b &&
        typeof b === 'object' &&
        e &&
        typeof e === 'object'
      ) {
        addInPlaceJSON(b, e);
      } else if (b == null) {
        // eslint-disable-next-line no-param-reassign
        base[key] = e;
      }
    });
  }
};

export const keepByModeGame = (name, modeGame) => {
  if (typeof name !== 'string') return true;
  const re = new RegExp(`-(all|${modeGame})(\\.[^./]+)?$`, 'i');
  return re.test(name);
};

export const filterAssetsByModeGame = (node, modeGame) => {
  if (Array.isArray(node)) {
    return node.filter((item) => keepByModeGame(item, modeGame));
  }
  if (node && typeof node === 'object') {
    Object.keys(node).forEach((key) => {
      // eslint-disable-next-line no-param-reassign
      node[key] = filterAssetsByModeGame(node[key], modeGame);
    });
  }
  return node;
};

export const loadCorpus = async (nameTask, assets, bucketURI) => {
  const config = sessionGet(SK.CONFIG);

  const locationBase = `${bucketURI}/shared/corpora`;

  const nameCorpus = config.corpusName;
  sessionSet(SK.NAME_CORPUS, nameCorpus);
  const nameFileScript = `${locationBase}/${nameTask}-${nameCorpus}.json`;

  sessionSet(SK.NAME_TASK, nameTask);
  if (nameCorpus === NAME_CORPUS_DEF) {
    sessionSet(SK.SCRIPT_TIMELINE, undefined);
  } else {
    const scriptTimeline = await downloadJSON(nameFileScript);
    sessionSet(SK.SCRIPT_TIMELINE, scriptTimeline);

    const lng = i18next.language;
    const nameFileTranslationExt = `${locationBase}/${nameTask}-${nameCorpus}-translation-ext-${lng}.json`;
    try {
      const translationExt = await downloadJSON(nameFileTranslationExt);
      const ns = 'translation';
      // translationExt overwrites on conflicts
      i18next.addResourceBundle(lng, ns, translationExt, true, true);
    } catch (e) {
      /* optional file */
    }

    const nameFileAssetsExt = `${locationBase}/${nameTask}-${nameCorpus}-assets-ext-${lng}.json`;
    try {
      const assetsExt = await downloadJSON(nameFileAssetsExt);
      addInPlaceJSON(assets, assetsExt);
    } catch (e) {
      /* optional file */
    }
  }

  const grade = getGrade(config.userMetadata.grade);
  sessionSet(SK.GRADE, grade);
  sessionSet(SK.MODE_GAME, config.modeGameRes);
  sessionSet(SK.MODE_SEQ, config.modeSeq);

  filterAssetsByModeGame(assets, config.modeGameRes);
};
