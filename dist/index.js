"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = loader;
exports.raw = void 0;

var _path = _interopRequireDefault(require("path"));

var _loaderUtils = require("loader-utils");

var _schemaUtils = require("schema-utils");

var _sharp = _interopRequireDefault(require("sharp"));

var _options = _interopRequireDefault(require("./options.json"));

var _utils = require("./utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const raw = true;
exports.raw = raw;

function loader(content) {
  const options = (0, _loaderUtils.getOptions)(this);
  (0, _schemaUtils.validate)(_options.default, options, {
    name: 'Lazyload Image Loader',
    baseDataPath: 'options'
  });
  const context = options.context || this.rootContext;
  const name = options.name || '[contenthash].[ext]';
  const file = this.resourcePath;
  const url = (0, _loaderUtils.interpolateName)(this, name, {
    context,
    content,
    regExp: options.regExp
  });
  let md = {};
  const self = this;
  return Promise.resolve().then(() => {
    return (0, _sharp.default)(file).metadata().then(metadata => {
      md = metadata;

      if (metadata.format === 'svg' || metadata.hasAlpha) {
        return (0, _sharp.default)({
          create: {
            width: metadata.width,
            height: metadata.height,
            channels: 4,
            background: {
              r: 255,
              g: 255,
              b: 255,
              alpha: 0.0
            }
          }
        }).png().toBuffer({
          resolveWithObject: true
        });
      }

      let sharped = (0, _sharp.default)(file).blur(20);

      if (metadata.width > 750) {
        sharped = sharped.resize({
          width: parseInt(metadata.width / 3, 10)
        });
      }

      let outputType;
      let opt = {
        quality: 33
      };

      switch (metadata.format) {
        case 'gif':
          outputType = 'gif';
          opt = {};
          break;

        case 'png':
          outputType = 'png';
          break;

        case 'webp':
          outputType = 'webp';
          break;

        default:
          outputType = 'jpeg';
          break;
      }

      return sharped[outputType](opt).toBuffer({
        resolveWithObject: true
      });
    }).then(({
      data
    }) => data);
  }).then(data => {
    const assetInfo = {};
    const outputPath = url;
    let publicPath = `__webpack_public_path__ + ${JSON.stringify(outputPath)}`;

    if (options.publicPath) {
      if (typeof options.publicPath === 'function') {
        publicPath = options.publicPath(url, this.resourcePath, context);
      } else {
        publicPath = `${options.publicPath.endsWith('/') ? options.publicPath : `${options.publicPath}/`}${url}`;
      }

      publicPath = `${publicPath}?w=${md.width}&h=${md.height}`;
      publicPath = JSON.stringify(publicPath);
    }

    if (typeof name === 'string') {
      let normalizedName = name;
      const idx = normalizedName.indexOf('?');

      if (idx >= 0) {
        normalizedName = normalizedName.substr(0, idx);
      }

      const isImmutable = /\[([^:\]]+:)?(hash|contenthash)(:[^\]]+)?]/gi.test(normalizedName);

      if (isImmutable === true) {
        assetInfo.immutable = true;
      }
    }

    assetInfo.sourceFilename = (0, _utils.normalizePath)(_path.default.relative(self.rootContext, self.resourcePath));
    self.emitFile(outputPath, data, null, assetInfo);
    const esModule = typeof options.esModule !== 'undefined' ? options.esModule : true;
    return `${esModule ? 'export default' : 'module.exports ='} ${publicPath};`;
  }).catch(err => {
    throw Error({
      error: err
    });
  });
}