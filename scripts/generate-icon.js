const sharp = require('sharp');
const fs = require('fs');

const svgBuffer = fs.readFileSync('resources/icons/claude-logo.svg');

sharp(svgBuffer)
  .resize(128, 128)
  .png()
  .toFile('resources/icons/claude-logo.png')
  .then(() => {
    console.log('✓ Generated claude-logo.png (128x128)');
  })
  .catch(err => {
    console.error('Error generating PNG:', err);
    process.exit(1);
  });
