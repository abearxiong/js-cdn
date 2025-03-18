// @ts-ignore
import { query, download, manifest, upload } from '@kevisual/js-cdn';

const dest = './cdn'; // 下载文件目录

async function getLib(lib) {
  // 1. 查询库文件
  // @ts-ignore
  const { files } = await query(lib, (error, lib) => {});
  // 2. 下载库文件
  await download(files, dest, (error, lib) => {});
  // 3. 生成 manifest.json
  await manifest(dest);
  // // 4. 上传至 OSS 服务器
  // await upload({
  //   source: "./dist",
  //   dest: "uploads/libs",
  //   bucket: "",
  //   accessKeyId: "",
  //   secretAccessKey: "",
  //   endpoint: ""
  // })
}

const reactLibs = [
  {
    name: 'react',
    version: '>= 18.3.1',
  },
  {
    name: 'react-dom',
    version: '>= 18.3.1',
  },
  {
    name: 'react-is',
    version: '>= 18.3.1',
  },
];
const threeLibs = [
  // {
  //   name: 'three.js',
  //   version: '>= 0.172.0',
  // },
  // {
  //   name: 'pdfjs-dist',
  //   version: '>= 5.0.375',
  // },
  // {
  //   name: 'd3',
  //   version: '>= 7.9.0',
  // },
];
let libs = [
  ...reactLibs,
  ...threeLibs,
  // {
  //   name: 'vue',
  //   version: '>= 3.5.13',
  // },
  {
    name: 'lit',
    version: '>= 3.2.0',
  },
  {
    name: 'lit-html',
    version: '>= 3.2.0',
  },
  // {
  //   name: 'jquery',
  //   version: '>= 3.7.1',
  // },
  // {
  //   name: 'lodash',
  //   version: '>= 4.17.21',
  // },
  // {
  //   name: 'axios',
  //   version: '>= 1.8.3',
  // },
];

const getLibs = async () => {
  for (const lib of libs) {
    await getLib(lib);
  }
};

getLibs();
