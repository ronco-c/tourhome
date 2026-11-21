// Renders marketing/ad.html to a 1080x1920 MP4 (30fps). Usage: node render.js [outDir] [--preview t1,t2,...]
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
(async () => {
  const out = process.argv[2] || path.join(__dirname, 'frames');
  const prevArg = process.argv.indexOf('--preview');
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });
  await pg.goto('file://' + path.join(__dirname, 'ad.html'));
  await pg.evaluate(() => document.fonts.ready);
  await pg.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
  await pg.waitForTimeout(500);
  if (prevArg > 0) {
    for (const t of process.argv[prevArg + 1].split(',').map(Number)) {
      await pg.evaluate(t => render(t), t);
      await pg.screenshot({ path: path.join(out, `prev-${String(t).padStart(5, '0')}.png`) });
    }
  } else {
    const FPS = 30, DUR = 45;
    for (let f = 0; f < FPS * DUR; f++) {
      await pg.evaluate(t => render(t), f / FPS);
      await pg.screenshot({ path: path.join(out, `f${String(f).padStart(4, '0')}.png`) });
    }
    const mp4 = path.join(__dirname, 'tourhome-ad-45s.mp4');
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(out, 'f%04d.png'),
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
    console.log('wrote', mp4);
  }
  await b.close();
})();
