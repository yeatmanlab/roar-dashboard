import store from 'store2';
import lerp from 'lerp';

const rad_180 = Math.PI * 2;
const rad_90 = Math.PI / 2;

const drawDonutTimer = (
  ctx,
  width,
  height,
  x_c,
  y_c,
  radius,
  inner_radius,
  arc_radius,
  remainingTime,
  totalTime,
  color,
) => {
  const progress = remainingTime / totalTime;

  // Clear the canvas
  ctx.clearRect(0, 0, width, height);

  // Draw the background circle
  ctx.beginPath();
  ctx.arc(x_c, y_c, radius, 0, rad_180);
  ctx.fillStyle = 'rgb(128, 128, 128)';
  ctx.fill();

  // Draw the remaining time arc
  ctx.beginPath();
  ctx.arc(x_c, y_c, arc_radius, -rad_90, -rad_90 + rad_180 * progress, false);
  ctx.lineWidth = radius - inner_radius;
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.stroke();

  // Draw the inner circle
  ctx.beginPath();
  ctx.arc(x_c, y_c, inner_radius, 0, rad_180);
  ctx.fillStyle = '#fff';
  ctx.fill();

  /*
    //Write time
    ctx.font = '20px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(remainingTime/10)} s`, width / 2, height / 2);*/
};

export const startTimer = (countdownTime) => {
  const step = 20;
  const interval = Math.round(1000 / step);
  const totalTime = countdownTime * step; // Total time in seconds
  const canvas = document.getElementById('canvas-timer');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const x_c = width / 2;
  const y_c = height / 2;
  const radius = canvas.offsetWidth / 2;
  const inner_radius = Math.floor(radius * 0.6);
  const arc_radius = Math.floor(radius * 0.8);

  let colorCodes = {
    info: {
      color: 'green',
    },
    warning: {
      color: 'orange',
      threshold: Math.floor(totalTime / 2),
      transitionEnd: Math.floor(totalTime / 2) - step,
    },
    alert: {
      color: 'red',
      threshold: Math.floor(totalTime / 4),
      transitionEnd: Math.floor(totalTime / 4) - step,
    },
  };

  canvas.style.visibility = 'visible';

  let remainingTime = totalTime;

  const { alert, warning, info } = colorCodes;
  let startColor = { r: 65, g: 184, b: 131 };
  let endColor = startColor;
  let color = startColor;
  let r, g, b, t;

  let intervalId = setInterval(() => {
    remainingTime--;

    if (remainingTime <= alert.threshold) {
      let elapsedTime = alert.threshold - remainingTime;
      endColor = { r: 255, g: 0, b: 0 };
      if (elapsedTime < step) {
        t = elapsedTime / step;
        r = lerp(startColor.r, endColor.r, t);
        g = lerp(startColor.g, endColor.g, t);
        b = lerp(startColor.b, endColor.b, t);
        color = { r, g, b };
      } else {
        color = endColor;
        startColor = endColor;
      }
    } else if (remainingTime <= warning.threshold) {
      let elapsedTime = warning.threshold - remainingTime;
      endColor = { r: 255, g: 165, b: 0 };
      if (elapsedTime < step) {
        t = elapsedTime / step;
        r = lerp(startColor.r, endColor.r, t);
        g = lerp(startColor.g, endColor.g, t);
        b = lerp(startColor.b, endColor.b, t);
        color = { r, g, b };
      } else {
        color = endColor;
        startColor = endColor;
      }
    }
    drawDonutTimer(ctx, width, height, x_c, y_c, radius, inner_radius, arc_radius, remainingTime, totalTime, color);
  }, interval);

  store.session.set('intervalId', intervalId);
};
