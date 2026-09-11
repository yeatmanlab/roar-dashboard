import { mediaAssets } from './mediaAssets';
import { ModeGame } from './namingHelpers';
import { sessionGet } from './sessionHelpers';
import { SESSION_KEYS as SK } from './sessionKeys';

const paramsHtmInstructionGeneralDef = {
  animateBtn: false,
  keyImgCharacter: '',
  text1: '',
  text2: '',
  text3: '',
  text4: '',
  textBtn: '',
  keyImgBg: '',
  keyImgBtnNext: '',
  modeGameSkipResponse: ModeGame.NONE,
};

export const htmlInstructionGeneral = (paramsIn) => {
  const params = { ...paramsHtmInstructionGeneralDef, ...paramsIn };
  const modeGame = sessionGet(SK.MODE_GAME);

  const skipResponse = params.modeGameSkipResponse === ModeGame.ALL ? true : params.modeGameSkipResponse === modeGame;
  const classBtnVisible = skipResponse ? 'roav-not-visible' : '';
  const classBtnAnimate = params.animateBtn ? `roav-button-attention` : '';

  const hasImg = !!mediaAssets.images[params.keyImgCharacter];

  const classCard = hasImg ? 'roav-card-with-img-text' : 'roav-card-with-text';
  let htmlImg = '';
  if (hasImg) {
    htmlImg = `
      <div class="roav-card-img-wrap">
        <img src="${mediaAssets.images[params.keyImgCharacter]}" class="roav-card-img">
      </div>`;
  }

  const html = `
    <div class = "roav-container-viewport-adaptive" id="id-container-bg-card-button">
      <div>
        <img src="${mediaAssets.images[params.keyImgBg]}" class="roav-img-bg ${modeGame}">
      </div>
                     
      <div class="roav-card-button-container">
      <div></div>

      <div class="roav-card ${modeGame} ${classCard}">
          ${htmlImg}
          <div class="roav-card-text-wrap ${modeGame}" id="id-text-wrap">
          <div class="roav-card-text" id="id-text">
              <h2 class="header-card">${params.text1} </h2>
              <p class="text-card">${params.text2}</p>
              ${params.text3 ? `<p class="text-card">${params.text3}</p>` : ''}
              ${params.text4 ? `<p class="text-card">${params.text4}</p>` : ''}
          </div>
          </div>
      </div>

      <div class="roav-button-next-wrap" id="id-button-next-wrap">
          <button class="roav-button roav-button-next ${classBtnVisible}" id="id-button-next">
          <img class="${classBtnAnimate}" src="${mediaAssets.images[params.keyImgBtnNext]}" alt="" />
          <span class="roav-button-next-label-wrap" id="id-button-next-label-wrap">
              <span class="roav-button-next-label" id="id-button-next-label">${params.textBtn}</span>
          </span>      
          </button>
      </div>

      </div>
    </div>
    `;
  return html;
};
