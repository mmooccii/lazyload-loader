import path from 'path';

import { getOptions, interpolateName } from 'loader-utils';
import { validate } from 'schema-utils';

import sharp from 'sharp';

import schema from './options.json';
import { normalizePath } from './utils';

export const raw = true;

export default function loader(content) {
  const options = getOptions(this);

  validate(schema, options, {
    name: 'Lazyload Image Loader',
    baseDataPath: 'options',
  });

  const context = options.context || this.rootContext;
  const name = options.name || '[contenthash].[ext]';
  const file = this.resourcePath;

  const url = interpolateName(this, name, {
    context,
    content,
    regExp: options.regExp,
  });

  let md = {};
  const self = this;

  return Promise.resolve()
    .then(() => {
      return sharp(file)
        .metadata()
        .then((metadata) => {
          md = metadata;
          if (metadata.format === 'svg' || metadata.hasAlpha) {
            return sharp({
              create: {
                width: metadata.width,
                height: metadata.height,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 0.0 },
              },
            })
              .png()
              .toBuffer({ resolveWithObject: true });
          }

          let sharped = sharp(file).blur(20);
          if (metadata.width > 750) {
            sharped = sharped.resize({
              width: parseInt(metadata.width / 3, 10),
            });
          }

          let outputType;
          let opt = { quality: 33 };
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

          return sharped[outputType](opt).toBuffer({ resolveWithObject: true });
        })
        .then(({ data }) => data);
    })
    .then((data) => {
      const assetInfo = {};

      const outputPath = url;
      let publicPath = `__webpack_public_path__ + ${JSON.stringify(
        outputPath
      )}`;

      if (options.publicPath) {
        if (typeof options.publicPath === 'function') {
          publicPath = options.publicPath(url, this.resourcePath, context);
        } else {
          publicPath = `${
            options.publicPath.endsWith('/')
              ? options.publicPath
              : `${options.publicPath}/`
          }${url}`;
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

        const isImmutable = /\[([^:\]]+:)?(hash|contenthash)(:[^\]]+)?]/gi.test(
          normalizedName
        );

        if (isImmutable === true) {
          assetInfo.immutable = true;
        }
      }

      assetInfo.sourceFilename = normalizePath(
        path.relative(self.rootContext, self.resourcePath)
      );

      self.emitFile(outputPath, data, null, assetInfo);

      const esModule =
        typeof options.esModule !== 'undefined' ? options.esModule : true;
      return `${
        esModule ? 'export default' : 'module.exports ='
      } ${publicPath};`;
    })
    .catch((err) => {
      throw Error({ error: err });
    });
}
