# JS-CDN

自建前端静态JS资源库CDN服务。

> 自建CDN服务，资源及版本可控。放在阿里云OSS上，“稳定又可靠”。 反正我信了


## Why?
前段时间，总有用户反馈公司的产品页面打不开或报错，经排查发现是`jsDelivr`服务在国内部分区域是无法访问的。(弃用`unpkg`)

以前也有遇到由于公共CDN访问不了导致的问题，辗转国内的CDN服务，也有很多问题：1. 资源不全；2. 有时访问慢；3. 还有更换访问域名的。 

真要了老命，蹭着公司的阿里云OSS服务，那就自己动手吧。

**优点：**  
1. 对于懂与不懂技术的领导，都方便甩锅：阿里云都挂了，我能怎么办 ┓( ´∀` )┏

**缺点：**  
1. 至于自建服务的缺点，那可就太多了... 硬盘空间不够写了🤪。
2. ......


> `jsDelivr` 访问不了对国内用户的伤害真的太大了，估计很多国人的图床服务都是通过 `jsDelivr` 加速的 (包括本人)，毕竟免费又快速。


## Installation

```
npm install js-cdn
```

## Usage

**方式一**

```js
import CDN from "js-cdn"

new CDN(
  [
    'react',
    {
      name: 'vue',
      version: '>= 2.6.10 < 2.6.15'
    },
    {
      name: 'jquery',
      version: ['1.9.1', '1.12.4', '3.6.0']
    }
  ],
  {
    destination: './dist',
    upload: './.oss-sync.json',
    queryFn(error, lib) {
      if (error) {
        console.log(`query success : ${lib.name}@${lib.version}`)
      } else {
        console.log(`query failed : ${lib.name}@${lib.version}`)
      }
    },
    downloadFn(error, lib) {
      if (error) {
        console.log(`download success : ${lib.name}@${lib.version}`)
      } else {
        console.log(`download failed : ${lib.name}@${lib.version}`)
      }
    }
  }
).exec().then(data => {
  console.log('success ... ')
}).catch(error => {
  console.log('error ... ')
})

// 或者
new CDN('vue', {
  destination: './dist'
}).exec()
```


**方式二**

```js
import { query, download, manifest, upload } from "js-cdn"

const dest = './dist' // 下载文件目录

async function getLib(lib) {
  // 1. 查询库文件
  const { files } = await query(lib, (error, lib) => {})
  // 2. 下载库文件
  await download(files, dest, (error, lib) => {})
  // 3. 生成 manifest.json
  await manifest(dest)
  // 4. 上传至 OSS 服务器
  await upload({
    source: "./dist",
    dest: "uploads/libs",
    bucket: "",
    accessKeyId: "",
    secretAccessKey: "",
    endpoint: ""
  })
}

// 同步 jquery最新版本
getLib('jquery')

// 同步 vue [2.6.12, 2.6.13, 2.6.14]
getLib({
  name: 'vue',
  version: '>= 2.6.12 < 2.6.15'
})
```



## API
```js
const cdnJS = new CDN(lib, options)
cdnJS.exec()
```
- `lib: string | object | array` js库
  - `name: string` js库名
  - `version: string | array | function | RegExp` 指定js库版本，支持 `semver`
- `options: object`
  - `source: string` 数据源
  - `destination: string` 文件目录
  - `upload: object` OSS上传配置
    - `source: string` 同步到 OSS 上的目录
    - `dest: string` OSS bucket 上的目标位置
    - `accessKeyId: string` OSS accessKeyId
    - `secretAccessKey: string` OSS secretAccessKey
    - `endpoint: string` OSS 实例
    - `bucket: string` bucket 名
    - `incrementalMode: boolean` 是否使用增量模式，在增量模式的情况下 oss-sync 将只会上传那些新增和修改过的文件
    - `headers: object` 可配置上传文件的 HTTP 头设置，具体请参考OSS文档
  - `queryFn(error, lib)` 查询js库回调
  - `downloadFn(error, lib)` 下载js库文件回调
  - `uploadFn(error)` 上传回调



**methods :**

```js
import { query, download, manifest, upload } from "js-cdn"

// 查询 js库文件
query(lib, callback)

// 下载 js库文件
download(lib, dest, callback)

// 生成 manifest.json
manifest(dest)

// 上传至OSS服务器
upload(config, callback)
```

