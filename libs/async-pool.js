/**
 * 控制异步任务并发数 (有多个任务，只能同时进行几个)
 * @param {number} concurrency 限制并发数
 * @param {array} items 任务列表
 * @param {function} fn 迭代函数，处理每个任务项且返回Promise对象
 * @returns 
 */
export default async function asyncPool(concurrency, items, fn) {
  const promises = [] // 存储所有的异步任务
  const pool = new Set() // 存储正在执行的异步任务
  for (const item of items) {
    // 调用 fn创建异步任务 (兼容错误，仅在结果中返回错误)
    const p = Promise.resolve().then(() => fn(item, items)).catch(error => error)
    promises.push(p) // 保存新的异步任务
    pool.add(p)
    const clean = () => pool.delete(p)
    p.then(clean, clean) // 任务完成后，从正在执行的任务数组中移除已完成的任务

    // 当concurrency值小于或等于总任务个数时，进行并发控制
    if (pool.size >= concurrency) {
      await Promise.race(pool) // 等待较快的任务执行完成
    }
  }
  return Promise.all(promises)
}
