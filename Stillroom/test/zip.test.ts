import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { crc32 } from 'node:zlib';
import { ZipWriter } from '../server/zip.ts';

// Read a ZIP back through its central directory, the way unzip tools do.
function readZip(zip: Buffer) {
  const end = zip.length - 22;
  assert.equal(zip.readUInt32LE(end), 0x06054b50);
  const count = zip.readUInt16LE(end + 10);
  let at = zip.readUInt32LE(end + 16);
  const files = new Map<string, Buffer>();
  for (let i = 0; i < count; i++) {
    assert.equal(zip.readUInt32LE(at), 0x02014b50);
    const crc = zip.readUInt32LE(at + 16);
    const size = zip.readUInt32LE(at + 24);
    const nameLength = zip.readUInt16LE(at + 28);
    const local = zip.readUInt32LE(at + 42);
    const name = zip.subarray(at + 46, at + 46 + nameLength).toString('utf8');
    assert.equal(zip.readUInt32LE(local), 0x04034b50);
    const dataStart = local + 30 + zip.readUInt16LE(local + 26);
    const data = zip.subarray(dataStart, dataStart + size);
    assert.equal(crc32(data), crc);
    files.set(name, data);
    at += 46 + nameLength;
  }
  return files;
}

test('the zip writer produces an archive that reads back intact', async () => {
  const out = new PassThrough();
  const chunks: Buffer[] = [];
  out.on('data', (chunk: Buffer) => chunks.push(chunk));
  const zip = new ZipWriter(out);
  await zip.add('frames/gallop_0000.webp', Buffer.from('first frame'));
  await zip.add('frames/gallop_0001.webp', Buffer.alloc(70_000, 7));
  await zip.add('manifest.json', Buffer.from('{"frames":2}'));
  await zip.finish();

  const files = readZip(Buffer.concat(chunks));
  assert.deepEqual([...files.keys()], ['frames/gallop_0000.webp', 'frames/gallop_0001.webp', 'manifest.json']);
  assert.equal(files.get('frames/gallop_0000.webp')?.toString(), 'first frame');
  assert.equal(files.get('frames/gallop_0001.webp')?.length, 70_000);
});
