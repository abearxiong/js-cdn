import {
  queryLib,
  downloadLib,
  generateManifest,
  ossUpload
} from './libs/utils.js'

export const query = queryLib
export const download = downloadLib
export const manifest = generateManifest
export const upload = ossUpload

const defaults = {
  source: 'cdnjs',
  destination: 'dist'
}

export default class JsCDN {
  /**
   * 
   * @param {object | array} lib js库
   * @param {object} options 配置
   * @param {object} options.source 配置
   * @param {object} options.destination 配置
   * @param {object} options.upload 配置
   * @param {object} options.queryFn 配置
   * @param {object} options.downloadFn 配置
   * @param {object} options.uploadFn 配置
   */
  constructor(lib, options) {
    this.config = {
      ...defaults,
      ...options
    }
    this.libs = Array.isArray(lib) ? lib : [].concat(lib)
  }

  async exec() {
    try {
      const { libs, config } = this
      const { destination, upload, queryFn, downloadFn } = config

      for (const lib of libs) {
        const { files } = await queryLib(lib, queryFn)
        await downloadLib(files, destination, downloadFn)
      }

      await generateManifest(destination)
      if (upload) {
        await ossUpload(upload)
      }
      return this.libs
    } catch (error) {
      return Promise.reject(error)
    }
  }
}
