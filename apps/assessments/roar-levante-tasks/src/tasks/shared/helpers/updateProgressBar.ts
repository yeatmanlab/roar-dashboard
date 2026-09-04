export function updateProgressBar(progress: number) {
  const progressFill = document.getElementById('progress-fill');

  if (progressFill) {
    const clampedProgress = Math.max(0, Math.min(100, progress));
    progressFill.style.width = `${clampedProgress}%`;
  }
}
