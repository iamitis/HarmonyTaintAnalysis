import fs from 'fs';
import path from 'path';

const BENCHMARK_DIR = __dirname;
const ARCHIVE_DIR = path.join(BENCHMARK_DIR, 'archive');

const files = ['normal.json', 'optimize.json', 'diff.json'] as const;

const name = process.argv[2] || new Date().toISOString().replace(/[:.]/g, '-');

const archive: Record<string, unknown> = {};
for (const file of files) {
    const filePath = path.join(BENCHMARK_DIR, file);
    if (fs.existsSync(filePath)) {
        archive[file.replace('.json', '')] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
}

if (Object.keys(archive).length === 0) {
    console.log('No benchmark result files found. Nothing to archive.');
    process.exit(0);
}

if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

const outPath = path.join(ARCHIVE_DIR, `${name}.json`);
fs.writeFileSync(outPath, JSON.stringify(archive, null, 2), 'utf-8');
console.log(`Archived ${Object.keys(archive).join(', ')} → ${outPath}`);
