import { pdf } from 'pdf-to-img'

/**
 * Transform a PDF file pages into images
 * */
const transformPdfToImages = async (pdfPath, outputDir) => {
  const document = await pdf(pdfPath);
  const images =[];
  for await (const image of document) {
    images.push(image);
  }
  return images;

}

export { transformPdfToImages };
