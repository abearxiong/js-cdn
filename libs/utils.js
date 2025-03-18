import path from 'path'
import axios from 'axios'
import fse from 'fs-extra'
import { globby } from 'globby'
import semver from 'semver'
import OSync from 'oss-sync'

import download from './download.js'
import asyncPool from './async-pool.js'

const VersonRegexp = /^(\d|([1-9](\d*)))(\.(\d|([1-9](\d*)))){1,2}$/

/**
 * js库配置
 * @param {*} lib js库
 * @param {*} options 选项
 * @returns 
 */
export function getConfig(lib, options = {}) {
  const defaults = {
    version: 'latest',
    source: 'cdnjs'
  }

  lib = typeof lib === 'string'
    ? { name: lib }
    : lib !== null && typeof lib === 'object' ? lib : {}
  
  return Object.assign({}, defaults, options, lib)
}

/**
 * 过滤版本号
 * @param {array} versions 版本号列表
 * @param {any} filter 过滤器
 * @returns 
 */
function filterVersion(versions = [], filter) {
  try {
    if (!versions || versions.length === 1) return versions
  
    if (typeof filter === 'string') {
      if (filter === 'latest') {
        return versions.filter(version => VersonRegexp.test(version)).sort().slice(-1)
      }
      if (semver.validRange(filter)) {
        return versions.filter(version => semver.satisfies(version, filter))
      }
    } else if (Array.isArray(filter)) {
      return versions.filter(version => filter.includes(version))
    } else if (filter instanceof RegExp) {
      return versions.filter(version => filter.test(version))
    } else if (typeof filter === 'function') {
      return versions.filter(version => filter.call(null, version))
    } else {
      return versions
    }
  } catch (error) {
    return []
  }
}

function createManifest(dir, data) {
  return fse.writeJSON(path.resolve(dir, 'manifest.json'), data, { spaces: 2 })
}

function getFileUrl(url, { name, version }) {
  return `https://cdnjs.cloudflare.com/ajax/libs/${name}/${version}/${url}`
}

function requestVersion(name) {
  const url = `https://api.cdnjs.com/libraries/${name}?fields=versions`
  
  console.log('url', url)
  return axios.get(url)
}

function requestFile(name, version) {
  return axios.get(`https://api.cdnjs.com/libraries/${name}/${version}?fields=name,version,files`)
}

/**
 * 查找js库版本
 * @param {object} lib js库信息
 * @returns 
 */
async function queryVersion({ name, version }) {
  try {
    console.log('name', name)
    const { data } = await requestVersion(name)
    return filterVersion(data.versions, version)
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * get manifest
 * @param {string | array} url manifest文件地址
 * @returns 
 */
export async function getManifest(url) {
  try {
    if (Array.isArray(url)) return url

    const regx = /^http(s)?:\/\/.+/
    if (regx.test(url)) {
      const { data } = await axios.get(url)
      return data
    } else {
      return await fse.readJSON(path.resolve(url))
    }
  } catch (error) {
    return []
  }
}

/**
 * 查找js库版本文件
 * @param {object} lib js库信息
 * @param {string} lib.name js库名
 * @param {array<string>} lib.versions js库版本
 * @param {function} callback callback
 * @returns 
 */
export function queryFiles({ name, versions }, callback) {
  try {
    return asyncPool(6, versions, (version) => {
      return requestFile(name, version).then(({ data }) => {
        typeof callback === 'function' && callback(null, data)
        return data
      }).catch(error => {
        typeof callback === 'function' && callback(error)
        return Promise.reject(error, { name, version })
      })
    })
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * 查找js不同版本文件
 * @param {string | object} lib js库文件
 * @param {object} options 配置
 * @param {string} options.source 数据源
 * @param {string} options.manifest 已存在库
 * @param {function} callback callback
 * @returns 
 */
export async function queryLib(lib, options = {}, callback) {
  try {
    if(typeof options === 'function') {
      callback = options
      options = {}
    }
    const conf = getConfig(lib, options)
    const { name, version } = conf
    let versions = semver.valid(version)
      ? [].concat(semver.valid(version))
      : await queryVersion(conf)
    
    // 对比本地已存在的js库
    if (conf.manifest && versions.length > 0) {
      const libList = await getManifest(conf.manifest)
      let libVersions = []
      for (const item of libList) {
        if (item.name === name && item.versions) {
          libVersions = [].concat(item.versions)
          break
        }
      }
      // 移除已存在的版本
      if (libVersions.length > 0) {
        versions = versions.filter(item => !libVersions.includes(item))
      }
    }

    if (versions.length === 0) return { name, versions: [], files: [] }

    const files = await queryFiles({ name, versions }, callback)
    return { name, versions, files }
  } catch (error) {
    console.log('name', lib)
    return Promise.reject(error)
  }
}

/**
 * 下载指定版本文件
 * @param {object} lib 
 * @param {*} dest 
 * @returns 
 */
function downloadVersion({ name, version, files }, dest) {
  try {
    return download(
      files.map(url => getFileUrl(url, { name, version })),
      (url) => {
        const urlArr = url.split(`/${version}/`)[1].split('/')
        urlArr.pop()
        return path.resolve(dest, `${name}/${version}`, urlArr.join('/'))
      }
    )
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * 下载js库版本文件
 * @param {object} files 版本文件列表
 * @param {string} dest 下载目录
 * @param {function} callback callback
 * @returns 
 */
export async function downloadLib(files, dest = 'dist', callback) {
  try {
    if (!Array.isArray(files) || files.length === 0) return []
    
    const results = []
    for (let i = 0, len = files.length; i < len; i++) {
      const item = files[i]
      results[i] = await downloadVersion(item, dest).then(data => {
        typeof callback === 'function' && callback(null, item)
        return data
      }).catch(error => {
        typeof callback === 'function' && callback(error, item)
        return Promise.reject(error)
      })
    }
    return results
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * 生成manifest.json文件
 * @param {string} dir 目录
 */
export async function generateManifest(dir) {
  try {
    const results = []
    const pattern = dir + (dir.endsWith('/') ? '*' : '/*')
    const dirArr = await globby(pattern, { onlyDirectories: true })
    const libs = dirArr.map(item => item.split('/').pop())
    
    for (const lib of libs) {
      const libDir = path.resolve(dir, lib)
      const libFiles = await globby([libDir, '!**/manifest.json'], { onlyFiles: true })
      const libMap = {
        name: lib,
        versions: [],
        files: []
      }

      const versionFiles = libFiles.reduce((acc, item) => {
        const itemArr = item.split(`/${lib}/`)[1].split('/')
        const version = itemArr[0]
        const file = itemArr.slice(1).join('/')
        acc[version] = (acc[version] || []).concat(file)
        return acc
      }, {})

      Object.keys(versionFiles).forEach(version => {
        libMap.versions.push(version)
        libMap.files.push({
          name: lib,
          version,
          files: versionFiles[version]
        })
      })
      
      results.push(libMap)
      createManifest(libDir, libMap)
    }
    await createManifest(dir, results)
    return results
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * 上传至aliyun-OSS服务器
 * @param {object | string} config OSS配置文件
 * @param {string} config.source 同步到 OSS 上的目录
 * @param {string} config.dest OSS bucket 上的目标位置
 * @param {string} config.accessKeyId OSS accessKeyId
 * @param {string} config.secretAccessKey OSS secretAccessKey
 * @param {string} config.endpoint OSS 实例
 * @param {string} config.bucket bucket 名
 * @param {boolean} config.incrementalMode 是否使用增量模式，在增量模式的情况下 oss-sync 将只会上传那些新增和修改过的文件
 * @param {object} config.headers 可配置上传文件的 HTTP 头设置，具体请参考OSS文档
 * @param {function} callback callback
 * @returns 
 */
export async function ossUpload(config, callback) {
  try {
    if (typeof config !== 'object') {
      const configFile = config || './.oss-sync.json'
      config = await fse.readJSON(path.resolve(configFile))
    }
    const sync = new OSync(config)
    return sync.exec().then(data => {
      typeof callback === 'function' && callback(null, data)
      return data
    }).catch(error => {
      typeof callback === 'function' && callback(error)
      return Promise.reject(error)
    })
  } catch (error) {
    return Promise.reject(error)
  }
}