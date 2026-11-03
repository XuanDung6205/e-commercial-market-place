const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo');
config.resolver.assetExts = config.resolver.assetExts.filter((extension) => extension !== 'svg');
if (!config.resolver.assetExts.includes('wasm')) {
  config.resolver.assetExts.push('wasm');
}
config.resolver.sourceExts.push('svg');

// Enable package.json "exports" field resolution (required for expo-sqlite/localStorage/install)
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
