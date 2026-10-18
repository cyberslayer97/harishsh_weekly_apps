const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// The pose model is bundled as an asset.
config.resolver.assetExts.push('tflite')

module.exports = config
