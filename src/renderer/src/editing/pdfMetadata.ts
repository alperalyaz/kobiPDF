import { PDFDocument } from 'pdf-lib'

export const PRODUCER = `kobiPDF ${__APP_VERSION__} (Hidroteknik)`
const CREATOR = 'kobiPDF'

/**
 * Writes kobiPDF into the document info, so a PDF reader's Document Properties
 * show which program saved the file. The Producer (the program that wrote the
 * PDF) is always kobiPDF; the Creator (the program the content was made in) is
 * only filled in when it is missing or was left as pdf-lib's placeholder.
 * Returns the input unchanged if the file cannot be re-saved (e.g. encrypted).
 */
export async function withKobiMetadata(bytes: Uint8Array): Promise<Uint8Array> {
  try {
    // updateMetadata: false keeps pdf-lib from writing its own name over the existing fields.
    const pdf = await PDFDocument.load(bytes, { updateMetadata: false })
    const creator = pdf.getCreator()
    if (!creator || /pdf-lib/i.test(creator)) pdf.setCreator(CREATOR)
    pdf.setProducer(PRODUCER)
    pdf.setModificationDate(new Date())
    if (!pdf.getCreationDate()) pdf.setCreationDate(new Date())
    return await pdf.save({ updateFieldAppearances: false })
  } catch (err) {
    console.warn('Could not write kobiPDF metadata; saving without it', err)
    return bytes
  }
}
