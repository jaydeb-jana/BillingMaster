const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const frontendRoot = path.resolve(__dirname, '..');
const sourceIcon = path.join(frontendRoot, 'public', 'icon.png');
const resDir = path.join(frontendRoot, 'android', 'app', 'src', 'main', 'res');

// Icon densities and sizes
const iconSizes = [
  { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
  { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
  { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
  { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
  { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 },
];

// Splash densities and sizes
const splashSizes = [
  { dir: 'drawable', width: 480, height: 800 },
  { dir: 'drawable-port-mdpi', width: 320, height: 480 },
  { dir: 'drawable-port-hdpi', width: 480, height: 800 },
  { dir: 'drawable-port-xhdpi', width: 720, height: 1280 },
  { dir: 'drawable-port-xxhdpi', width: 960, height: 1600 },
  { dir: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
  { dir: 'drawable-land-mdpi', width: 480, height: 320 },
  { dir: 'drawable-land-hdpi', width: 800, height: 480 },
  { dir: 'drawable-land-xhdpi', width: 1280, height: 720 },
  { dir: 'drawable-land-xxhdpi', width: 1600, height: 960 },
  { dir: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
];

async function run() {
  console.log('Generating high-resolution BillingMaster mobile assets...');

  if (!fs.existsSync(sourceIcon)) {
    throw new Error('Source icon not found at: ' + sourceIcon);
  }

  // 1. Extract and mask the dark squircle icon onto a transparent background
  // The dark squircle in public/icon.png is located at x:74..438, y:84..448 (364x364)
  const squircleSize = 364;
  const squircleMask = Buffer.from(
    `<svg width="${squircleSize}" height="${squircleSize}"><rect width="${squircleSize}" height="${squircleSize}" rx="78" ry="78" fill="#000" /></svg>`
  );

  const transparentSquircle = await sharp(sourceIcon)
    .extract({ left: 74, top: 84, width: squircleSize, height: squircleSize })
    .composite([{ input: squircleMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // 2. Generate Launcher Icons for each Android density
  for (const { dir, size, fgSize } of iconSizes) {
    const targetDir = path.join(resDir, dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // A. ic_launcher.png (standard square/squircle icon)
    await sharp(transparentSquircle)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(targetDir, 'ic_launcher.png'));

    // B. ic_launcher_round.png (circular launcher icon)
    const circleMask = Buffer.from(
      `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#000" /></svg>`
    );
    await sharp(transparentSquircle)
      .resize(size, size, { fit: 'cover' })
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_round.png'));

    // C. ic_launcher_foreground.png (adaptive foreground icon)
    // Keyline safe zone in 108dp adaptive grid is inner 72dp (~66.7%)
    const safeLogoSize = Math.round(fgSize * 0.65);
    const foregroundLogo = await sharp(transparentSquircle)
      .resize(safeLogoSize, safeLogoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    const left = Math.round((fgSize - safeLogoSize) / 2);
    const top = Math.round((fgSize - safeLogoSize) / 2);

    await sharp({
      create: {
        width: fgSize,
        height: fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: foregroundLogo, left, top }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Generated ${dir} icons (${size}x${size}, fg: ${fgSize}x${fgSize})`);
  }

  // 3. Remove obsolete vector foreground from drawable-v24 if exists
  const vectorFgPath = path.join(resDir, 'drawable-v24', 'ic_launcher_foreground.xml');
  if (fs.existsSync(vectorFgPath)) {
    fs.unlinkSync(vectorFgPath);
    console.log('Removed obsolete default vector foreground in drawable-v24');
  }

  // 4. Update adaptive background color to #181A20
  const bgXmlPath = path.join(resDir, 'values', 'ic_launcher_background.xml');
  fs.writeFileSync(
    bgXmlPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#181A20</color>\n</resources>\n`,
    'utf-8'
  );

  // 5. Generate Splash Screens with Centered Brand Logo & Typography
  const brandBg = { r: 24, g: 26, b: 32, alpha: 1 }; // #181A20

  for (const { dir, width, height } of splashSizes) {
    const targetDir = path.join(resDir, dir);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const minDim = Math.min(width, height);
    // Proportion logo appropriately based on screen width/height
    const logoSize = Math.max(90, Math.min(260, Math.round(minDim * 0.32)));

    const logoBuffer = await sharp(transparentSquircle)
      .resize(logoSize, logoSize, { fit: 'contain' })
      .toBuffer();

    const isPortrait = height >= width;
    const textSvgHeight = isPortrait ? 60 : 50;
    const fontSizeTitle = isPortrait ? Math.max(18, Math.min(28, Math.round(width * 0.05))) : 20;
    const fontSizeSub = Math.round(fontSizeTitle * 0.48);

    const textSvg = Buffer.from(
      `<svg width="${width}" height="${textSvgHeight}">
        <text x="50%" y="${fontSizeTitle + 2}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${fontSizeTitle}" font-weight="800" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">
          Billing<tspan fill="#F87418">Master</tspan>
        </text>
        <text x="50%" y="${fontSizeTitle + fontSizeSub + 10}" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="${fontSizeSub}" font-weight="600" fill="#94A3B8" text-anchor="middle" letter-spacing="0.5">
          Calm Billing for Growing Shops
        </text>
      </svg>`
    );

    const totalContentHeight = logoSize + 16 + textSvgHeight;
    const startY = Math.round((height - totalContentHeight) / 2);
    const logoY = startY;
    const textY = logoY + logoSize + 16;
    const logoX = Math.round((width - logoSize) / 2);

    await sharp({
      create: {
        width,
        height,
        channels: 4,
        background: brandBg,
      },
    })
      .composite([
        { input: logoBuffer, left: logoX, top: logoY },
        { input: textSvg, left: 0, top: textY },
      ])
      .png()
      .toFile(path.join(targetDir, 'splash.png'));

    console.log(`Generated splash screen for ${dir} (${width}x${height})`);
  }

  // Cleanup any test files
  const testFiles = ['test-crop.png', 'test-transparent-icon.png'];
  for (const file of testFiles) {
    const p = path.join(frontendRoot, file);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  console.log('Mobile assets generation complete!');
}

run().catch((err) => {
  console.error('Error generating mobile assets:', err);
  process.exit(1);
});
