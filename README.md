# JS-CDN

自建前端静态JS资源库CDN服务。

> 自建CDN服务，资源及版本可控。放在阿里云OSS上，“稳定又可靠”。 反正我信了


# Why?
前段时间，总有用户反馈公司的产品页面打不开或报错，经排查发现是`jsDelivr`服务在国内部分区域是无法访问的。(弃用`unpkg`)

以前也有遇到由于公共CDN访问不了导致的问题，辗转国内的CDN服务，也有很多问题：1. 资源不全；2. 有时访问慢；3. 还有更换访问域名的。 

真要了老命，蹭着公司的阿里云OSS服务，那就自己动手吧。

**优点：**  
1. 对于懂与不懂技术的领导，都方便甩锅：阿里云都挂了，我能怎么办 ┓( ´∀` )┏

**缺点：**  
1. 至于自建服务的缺点，那可就太多了；
2. ......硬盘空间不足了。


> `jsDelivr` 访问不了对国内用户的伤害真的太大了，估计很多国人的图床服务都是通过 `jsDelivr` 加速的 (包括本人)，毕竟免费又快速。


## Installation

```
npm install js-cdn
```

## useage

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
    destination: 'dist',
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
```

