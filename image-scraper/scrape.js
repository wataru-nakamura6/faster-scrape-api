require('dotenv').config();
const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

(async () => {
  const url = process.argv[2]; // 引数でURL受け取り
  if (!url) return console.log("URLが指定されていません");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/home/ec2-user/chromium/chrome/chrome',
  });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2' });

  const images = await page.$$eval('img', imgs => {
    const srcs = imgs
      .map(img => img.src)
      .filter(src => src.startsWith('http'));

    return Array.from(new Set(srcs));
  });

  console.log(images)

  // for (const src of [...new Set(images)]) {
  //   try {
  //     const response = await axios.get(src, { responseType: 'arraybuffer' });
  //     if (response.data.length < 500 * 1024) continue; // 500KB 未満はスキップ
  //
  //     // Cloudflare へPOST
  //     await axios.post(
  //       `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
  //       response.data,
  //       {
  //         headers: {
  //           Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
  //           'Content-Type': 'image/jpeg'
  //         }
  //       }
  //     );
  //
  //     console.log(`✅ ${src} uploaded`);
  //   } catch (err) {
  //     console.error(`❌ Error uploading ${src}: ${err.message}`);
  //   }
  // }

  await browser.close();
})();