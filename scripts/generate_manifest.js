const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../public/data');
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json');

function generateManifest() {
  console.log('Generating manifest from:', DATA_DIR);
  
  if (!fs.existsSync(DATA_DIR)) {
    console.error('Data directory does not exist!');
    return;
  }

  const files = fs.readdirSync(DATA_DIR);
  const manifest = {};

  files.forEach(file => {
    if (file.endsWith('.json') && file !== 'manifest.json') {
      const filePath = path.join(DATA_DIR, file);
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);
        if (Array.isArray(data)) {
          const slug = path.basename(file, '.json');
          manifest[slug] = data.length;
          console.log(`- Found ${slug}: ${data.length} questions`);
        }
      } catch (e) {
        console.error(`Error processing ${file}:`, e.message);
      }
    }
  });

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log('Manifest generated successfully at:', MANIFEST_PATH);
}

generateManifest();
