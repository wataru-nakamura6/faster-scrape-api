//
// 開発用
//
require('dotenv').config();
const puppeteer = require('puppeteer');
const axios = require('axios');
const FormData = require('form-data');

const logger = require('./logger');

(async () => {
  const url = 'https://www.leggings-rank.info/?category_id=1';
  console.log('START')
  // ここから
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: '/home/ec2-user/chromium/chrome/chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process'
      ]
    });

    const page = await browser.newPage();
    await page.goto(url, {waitUntil: 'networkidle2'});

    const images = await page.$$eval('img', imgs => {
      const srcs = imgs
        .map(img => img.src)
        .filter(src => src.startsWith('http'));
      return Array.from(new Set(srcs));
    });

    let uploaded = [];
    let i = 0;

    for (const src of images) {
      if(i ===3){
        const response = await axios.get(src, {responseType: 'arraybuffer'});
        const match = src.match(/\/([^\/]+)\.\w+$/);
        let name = match ? match[1] : 'image';

        // サイズ制限（500KB以上）
        // if (response.data.length < 500 * 1024) continue;

        const form = new FormData();
        form.append('file', Buffer.from(response.data), name);
        const uploadRes = await axios.post(
          `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
          form,
          {
            headers: {
              Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
              ...form.getHeaders(),
            },
          }
        );

        // イメージID
        console.log(uploadRes.data.result.id)
        // 画像のソース
        console.log(src)
        uploaded.push({src, result: uploadRes.data});
      }
      i++;
    }

    await browser.close();
    // return res.json({uploaded});

  // ここまで
  } catch (err) {
    console.log(`❌ スクレイピング中にエラーが発生しました${err}`);
  }
})();
