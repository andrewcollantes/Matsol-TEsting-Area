const fs = require('fs/promises');
const path = require('path');

const dbFile = path.join(__dirname, '..', 'data', 'local-db-state.json');

async function main() {
  try {
    await fs.unlink(dbFile);
    console.log(`Deleted local DB file: ${dbFile}`);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      console.log(`Local DB file not found (already clean): ${dbFile}`);
      return;
    }

    console.error('Failed to reset local DB file.');
    console.error(error);
    process.exitCode = 1;
  }
}

main();
