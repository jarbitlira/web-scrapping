import playwright from 'playwright';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { transformPdfToImages } from './utils/pdf-to-image.js';

const imageScrapingTargets = [
  {
    folderName: 'Imou',
    url: 'https://player.flipsnack.com/?hash=QkZCN0I5REQ3NUUrZGNsZ2k4aWhwOA%3D%3D&t=1741844306',
    classImg: '.PageBackground__PageImg-sc-17hm0la-1',
    pageTimeOut: 10000,
    buttonNextSelector: "#btn-next"
  },
  {
    folderName: 'Ezviz',
    url: 'https://cdnc.heyzine.com/files/uploaded/v2/bf52649ba25980496a784f4a9e323ff154472345.pdf',
  },
];

/**
 * Download image from a URL
 * @param url
 * @param page = undefined
 * @returns {Promise<any|null>}
 */
const getBufferFile = async (url, page = undefined) => {
  try {

    // Handle playwright blob URLs
    if (url.startsWith('blob:')) {
      // Evaluate the blob URL in the browser context
      const blobContent = await page.evaluate(async (url) => {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return Array.from(new Uint8Array(arrayBuffer)); // Convert to an array for transfer
      }, url);

      return Buffer.from(blobContent);
    }

    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
  } catch (error) {
    console.error(`Failed to download image from ${ url }:`, error.message);
    return null;
  }
};

const storeImage = (imageData, filePath) => {
  try {
    fs.writeFileSync(filePath, imageData);
    console.log(`Image saved to ${ filePath }`);
  } catch (error) {
    console.error(`Failed to save image to ${ filePath }:`, error.message);
  }
};

const processPage = async (target) => {
  const { url, classImg, folderName, pageTimeOut, buttonNextSelector } = target;

  const folderPath = path.join('..', 'images', folderName);
  fs.mkdirSync(folderPath, { recursive: true });

  try {
    if (url.endsWith('.pdf')) {
      console.log(`Processing PDF file: ${ url }`);
      const pdfFile = await getBufferFile(url);
      const pdfImages = await transformPdfToImages(pdfFile, folderPath);
      const ImagePromises = pdfImages.map((pdfImage, i) =>
        storeImage(pdfImage, path.join(folderPath, `page-${ i + 1 }.jpg`))
      );
      return await Promise.all(ImagePromises);
    }

    console.log(`Navigating to ${ url }`);
    const imageUrls = new Set();

    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "load" });
    const btnNext = page.locator(buttonNextSelector);
    await page.waitForSelector(buttonNextSelector); // Wait for the element to appear

    do {
      const images = page.locator(classImg);
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const imgSrc = await images.nth(i).getAttribute('src');
        if (imgSrc && !imageUrls.has(imgSrc)) {
          imageUrls.add(imgSrc);
        }
      }

      await btnNext.click();
      await page.waitForTimeout(1000); // Wait for the button to be visible
    } while (await btnNext.isVisible())
    console.log(`Found ${ imageUrls.size } images on ${ url }`);

    [...imageUrls].map(async (imgSrc, i) => {
      const imgData = await getBufferFile(imgSrc, page);
      if (imgData) {
        const imgPath = path.join(folderPath, `image-${ i + 1 }.jpg`);
        storeImage(imgData, imgPath);
      }
    });

    await page.close();
    return browser.close();
  } catch (error) {
    console.error(`Error processing page ${ url }:`, error.message);
  }

};

(async () => {
  for (const target of imageScrapingTargets) {
    try {
      await processPage(target);
    } catch (error) {
      console.error(`Error scraping:`, error.message);
    }
  }
})();
