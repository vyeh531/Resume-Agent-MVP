export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const type = formData.get('type') || 'unknown';
    if (!file) return Response.json({ error: 'No file uploaded' }, { status: 400 });

    const fileName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = fileName.toLowerCase().split('.').pop();

    let text = '';
    if (type === 'pdf' || ext === 'pdf') {
      // Dynamic require avoids module-level load failure with pdf-parse
      const { parsePDF } = require('../../../file-parser');
      text = await parsePDF(buffer);
    } else if (type === 'docx' || ext === 'docx') {
      const { parseDocx } = require('../../../file-parser');
      text = await parseDocx(buffer);
    } else if (type === 'txt' || ext === 'txt') {
      text = buffer.toString('utf-8');
    } else {
      return Response.json({ error: 'Unsupported file type: ' + ext }, { status: 400 });
    }

    if (!text || text.trim().length === 0) {
      return Response.json({ error: 'File content is empty or failed to parse' }, { status: 400 });
    }

    return Response.json({ success: true, text, fileName, length: text.length });
  } catch (error) {
    console.error('[Parser Error]', error);
    return Response.json({ error: error.message || 'Parse failed' }, { status: 500 });
  }
}
