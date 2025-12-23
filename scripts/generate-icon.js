const sharp = require('sharp');
const fs = require('fs');

async function generateIcon() {
  const svgPath = 'assets/JoynIcon.svg';
  const pngPath = 'assets/JoynIcon.png';
  
  console.log('📝 Reading SVG...');
  const svgBuffer = fs.readFileSync(svgPath);
  
  console.log('🎨 Converting to PNG (512x512)...');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(pngPath);
  
  console.log(`✅ Icon generated: ${pngPath}`);
  
  // Get file size
  const stats = fs.statSync(pngPath);
  console.log(`📦 Size: ${(stats.size / 1024).toFixed(2)} KB`);
}

generateIcon().catch(console.error);
