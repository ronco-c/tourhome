// Renders marketing/reel.html to tourhome-reel-21s.mp4 (1080x1920, 30fps) with the tour's own audio.
// Needs the tour frames first:  ffmpeg -i assets/house-tour.mp4 -vf "fps=30,scale=1080:1920:flags=lanczos" -q:v 3 .reel-frames/v%04d.jpg
// Usage: node render-reel.js [framesOutDir] [--preview t1,t2,...]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
(async () => {
  const out = process.argv[2] || path.join(__dirname, '.reel-out');
  const prev = process.argv.indexOf('--preview');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await pg.goto('file://' + path.join(__dirname, 'reel.html'));
  await pg.evaluate(() => document.fonts.ready);
  const shot = async (t, file) => { await pg.evaluate(t => render(t), t); await pg.evaluate(() => ready()); await pg.screenshot({ path: file }); };
  if (prev > 0) {
    for (const t of process.argv[prev + 1].split(',').map(Number)) await shot(t, path.join(out, `prev-${t}.png`));
  } else {
    const FPS = 30, DUR = await pg.evaluate(() => DURATION);
    for (let f = 0; f < FPS * DUR; f++) await shot(f / FPS, path.join(out, `f${String(f).padStart(4, '0')}.png`));
    const silent = path.join(out, 'silent.mp4'), mp4 = path.join(__dirname, 'tourhome-reel-21s.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(out, 'f%04d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', silent]);
    // tour audio: starts with the reel at 4.0s, fades in on the tap (5.0s), fades out as we leave the apartment
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', path.join(__dirname, 'assets/house-tour.mp4'),
      '-filter_complex', `[1:a]afade=t=in:st=1.0:d=0.6,afade=t=out:st=9.2:d=0.8,adelay=4000|4000,apad=whole_dur=${DUR}[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', mp4]);
    console.log('wrote', mp4);
  }
  await b.close();
})();
