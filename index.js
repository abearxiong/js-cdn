import {
  queryLib,
  downloadLib,
  generateManifest,
  ossUpload,
  getManifest
} from './libs/utils.js'

export const query = queryLib
export const download = downloadLib
export const manifest = generateManifest
export const upload = ossUpload

export default class JsCDN {
  static query = queryLib
  static download = downloadLib
  static manifest = generateManifest
  static upload = ossUpload

  /**
   * constructor
   * @param {string | object | array} lib js库
   * @param {string} lib.name js库名
   * @param {string | function | array | RegExp} lib.version 版本
   * @param {object} options 配置
   * @param {string} options.source 数据源
   * @param {string} options.manifest 本地库表
   * @param {string} options.destination 文件目录
   * @param {object} options.upload OSS上传配置
   * @param {function} options.queryFn 查询js库回调
   * @param {function} options.downloadFn 下载js库文件回调
   * @param {function} options.uploadFn 配置
   */
  constructor(lib, options) {
    this.config = Object.assign({
      destination: 'dist'
    }, options)
    this.libs = Array.isArray(lib) ? lib : [].concat(lib)
  }
  
  async exec() {
    try {
      const { libs, config } = this
      const { destination, manifest, upload, queryFn, downloadFn, uploadFn } = config

      if (manifest) {
        const libList = await getManifest(manifest)
        config.manifest = libList
      }

      for (const lib of libs) {
        const { files } = await queryLib(lib, config, queryFn)
        await downloadLib(files, destination, downloadFn)
      }

      await generateManifest(destination)
      if (upload) {
        await ossUpload(upload, uploadFn)
      }

      return this
    } catch (error) {
      return Promise.reject(error)
    }
  }
}
