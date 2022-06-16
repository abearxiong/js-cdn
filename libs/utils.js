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
  if (typeof lib === 'string') {
    return {
      name: lib,
      ...defaults
    }
  }
  if (lib !== null && typeof lib === 'object') {
    return {
      ...defaults,
      ...lib,
      ...options
    }
  }
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

async function createManifest(dir, data) {
  return await fse.writeJSON(path.resolve(dir, 'manifest.json'), data, { spaces: 2 })
}

function getFileUrl(url, { name, version }) {
  return `https://cdnjs.cloudflare.com/ajax/libs/${name}/${version}/${url}`
}

function requestVersion(name) {
  return axios.get(`https://api.cdnjs.com/libraries/${name}?fields=versions`)
}

function requestFile(name, version) {
  return axios.get(`https://api.cdnjs.com/libraries/${name}/${version}?fields=name,version,files`)
}

/**
 * 查找js库版本
 * @param {object} lib js库信息
 * @returns 
 */
export async function queryVersion({ name, version }) {
  try {
    const { data } = await requestVersion(name)
    return filterVersion(data.versions, version)
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * 查找js库版本文件
 * @param {object} lib js库信息
 * @param {object} lib.name js库名
 * @param {object} lib.versions js库版本
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
 * @param {object} options.source 数据源
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
    const versions = semver.valid(version)
      ? [].concat(semver.valid(version))
      : await queryVersion(conf)

    if (versions.length === 0) return { name, versions: [], files: [] }

    const files = await queryFiles({ name, versions }, callback)
    return { name, versions, files }
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * 下载指定版本文件
 * @param {*} param0 
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
 * @param {object | string} config 配置文件
 * @returns 
 */
export async function ossUpload(config) {
  try {
    if (typeof config !== 'object') {
      const configFile = config || './.oss-sync.json'
      config = await fse.readJSON(path.resolve(configFile))
    }
    const sync = new OSync(config)
    return sync.exec()
  } catch (error) {
    return Promise.reject(error)
  }
}