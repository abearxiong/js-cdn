import fs from 'fs'

/**
 * 创建目录
 * @param {string} dir 目录
 * @param {function} callback 回调函数
 * @returns Promise
 */
export default function ensureDir(dir, callback) {
  return new Promise((resolve, reject) => {
    fs.access(dir, fs.constants.F_OK, err => {
      if (err) {
        fs.mkdir(dir, { recursive: true }, error => {
          typeof callback === 'function' && callback(error)
          error ? reject(error) : resolve()
        })
      } else {
        typeof callback === 'function' && callback(null)
        resolve()
      }
    })
  })
}
