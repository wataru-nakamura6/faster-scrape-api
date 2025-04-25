//
// 本番用
// サーバー起動
// node.jsの起動: pm2 start scrape.js
//
require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const bodyParser = require('body-parser');
const FormData = require('form-data');

const app = express();
const PORT = process.env.PORT || 3000;

const logger = require('./logger');

app.use(bodyParser.json());

app.post('/scrape', async (request, res) => {
  const url = request.body.url;
  if (!url) return res.status(400).json({error: 'URLが指定されていません'});

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
      try {
        if (i === 0) {
          const response = await axios.get(src, {responseType: 'arraybuffer'});

          // 画像名の取得
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

          uploaded.push({src, result: uploadRes.data});
        }
      } catch (err) {
        logger.error(`❌ アップロード中にエラーが発生しました ${src}: ${err.message}`);
      }
    }

    await browser.close();
    return res.json(images);
  } catch (err) {
    logger.error(`❌ スクレイピング中にエラーが発生しました ${src}: ${err}`);
    return res.status(500).json({error: 'スクレイピング中にエラーが発生しました'});
  }
});

app.listen(PORT, '0.0.0.0');
