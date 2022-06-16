import fs from 'fs'
import path from 'path'
import axios from 'axios'

import asyncPool from './async-pool.js'
import ensureDir from './ensureDir.js'

/**
 * 下载文件
 * @param {string} url 文件地址
 * @param {string} dest 目标地址
 * @returns 
 */
async function downloadFile(url, dest) {
  try {
    const { data } = await axios.get(url, { responseType: 'stream' })
    
    const writer = fs.createWriteStream(dest)
    data.pipe(writer)
    
    return { url, path: dest }
  } catch (error) {
    return Promise.reject(error)
  }
}

/**
 * 下载文件
 * @param {string | array} url 文件url
 * @param {string | function} dest 保存目录
 * @param {object} options 配置项
 * @param {string | function} options.filename 文件名
 * @param {string | function} options.destination 保存目录
 * @param {number} options.concurrency 同时下载数
 * @param {number} options.retry 错误重试次数
 * @returns 
 */
export default async function download(url, dest, options = {}) {
  if (typeof dest === 'object' && dest !== null) {
    options = dest
    dest = options.destination
  }

  if (!dest) throw Error('未设置保存路径')

  if (typeof dest === 'string') {
    await ensureDir(dest)
  }

  const urls = [].concat(url)

  const results = await asyncPool(6, urls, (url) => {
    let filePath = dest
    if (typeof dest === 'function') {
      filePath = dest.call(null, url)
      ensureDir(filePath)
    }

    let { filename } = options
    if (!filename) {
      filename = url.split('?')[0].split('/').pop()
    } else if (typeof filename === 'function') {
      filename = filename.call(null, url)
    }
    
    return downloadFile(url, path.resolve(filePath, filename))
  })

  return typeof url === 'string' ? results[0] : results
}
