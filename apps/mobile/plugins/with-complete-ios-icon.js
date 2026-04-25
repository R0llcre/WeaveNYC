/**
 * Expo config plugin: rewrites AppIcon.appiconset with complete multi-size
 * icon entries (60@2x, 60@3x, 1024 marketing) instead of the iOS 17+ single-
 * image format that Xcode 26 actool emits by default.
 *
 * Why: TestFlight + Apple install service look up icons by exact (idiom,size,
 * scale) tuples. The single 1024×1024 entry expo prebuild ships works for
 * Xcode local build/run but not reliably for distribution on iOS 16, so the
 * iPhone shows "The requested app is not available or doesn't exist."
 */
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const SIZES = [
  { size: '60x60', scale: '2x', idiom: 'iphone', file: 'icon-60@2x.png' },
  { size: '60x60', scale: '3x', idiom: 'iphone', file: 'icon-60@3x.png' },
  { size: '1024x1024', scale: '1x', idiom: 'ios-marketing', file: 'icon-1024.png' },
];

module.exports = function withCompleteIosIcon(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const projRoot = cfg.modRequest.projectRoot;
      const iosRoot = cfg.modRequest.platformProjectRoot;
      const appName = cfg.modRequest.projectName || 'WeaveNYC';
      const iconSetDir = path.join(iosRoot, appName, 'Images.xcassets', 'AppIcon.appiconset');
      fs.mkdirSync(iconSetDir, { recursive: true });

      const sourceIconsDir = path.join(projRoot, 'assets', 'icons');
      for (const entry of SIZES) {
        const src = path.join(sourceIconsDir, entry.file);
        if (!fs.existsSync(src)) {
          console.warn('[with-complete-ios-icon] missing ' + src);
          continue;
        }
        fs.copyFileSync(src, path.join(iconSetDir, entry.file));
      }

      const contents = {
        images: SIZES.map(({ size, scale, idiom, file }) => ({
          filename: file, idiom, scale, size,
        })),
        info: { author: 'weavenyc-plugin', version: 1 },
      };
      fs.writeFileSync(
        path.join(iconSetDir, 'Contents.json'),
        JSON.stringify(contents, null, 2) + '\n',
      );

      console.log('[with-complete-ios-icon] wrote ' + SIZES.length + ' icon entries to ' + iconSetDir);
      return cfg;
    },
  ]);
};
