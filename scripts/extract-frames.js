const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
const path = require('path');
const fs = require('fs');

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

const inputVideo = path.join(__dirname, '../public/video-landing.mp4');
const outputDir = path.join(__dirname, '../public/frames');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Obteniendo metadatos del video...');

ffmpeg.ffprobe(inputVideo, (err, metadata) => {
  if (err) {
    console.error('Error procesando video:', err);
    process.exit(1);
  }

  const duration = metadata.format.duration;
  console.log(`Duración del video: ${duration} segundos`);
  
  // Extraer a un minimo de 35 FPS para garantizar una animación ultra suave (el doble de frames de lo que teniamos)
  let targetFps = 35;
  console.log(`Buscando ultra-fluidez. Extrayendo a ${targetFps} fotogramas por segundo real...`);

  console.log(`Extrayendo fotogramas a ${targetFps} fps... Esto puede tardar unos minutos.`);

  ffmpeg(inputVideo)
    .outputOptions([
      `-vf fps=${targetFps},scale=-1:1080`,
      '-c:v libwebp',
      '-quality 80'
    ])
    .output(path.join(outputDir, 'frame_%04d.webp'))
    .on('progress', (progress) => {
      if (progress.frames) {
        process.stdout.write(`\rProcesado: ${progress.frames} frames`);
      }
    })
    .on('end', () => {
      console.log('\n✅ Fotogramas extraídos exitosamente en public/frames');
    })
    .on('error', (err) => {
      console.error('\n❌ Error extrayendo fotogramas:', err);
    })
    .run();
});
