// A minimal ZIP writer (stored entries, no compression: PNG and WebP are already compressed).
// It streams: each entry goes straight to the output, and only the small central directory is kept
// in memory. ponytail: no ZIP64, so an archive must stay under 4 GB and 65,535 entries; exports are
// capped far below both.
import { crc32 } from 'node:zlib';
import { once } from 'node:events';
import type { Writable } from 'node:stream';

function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

export class ZipWriter {
  private readonly out: Writable;
  private readonly central: Buffer[] = [];
  private offset = 0;
  private count = 0;

  constructor(out: Writable) {
    this.out = out;
  }

  private async write(chunk: Buffer) {
    this.offset += chunk.length;
    if (!this.out.write(chunk)) await once(this.out, 'drain');
  }

  async add(name: string, data: Buffer, date = new Date()) {
    const fileName = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const { time, day } = dosDateTime(date);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(fileName.length, 26);
    local.writeUInt16LE(0, 28);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4); // made by
    entry.writeUInt16LE(20, 6); // needed
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(day, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(fileName.length, 28);
    entry.writeUInt32LE(this.offset, 42); // where the local header starts
    this.central.push(entry, fileName);
    this.count += 1;

    await this.write(local);
    await this.write(fileName);
    await this.write(data);
  }

  async finish() {
    const start = this.offset;
    const directory = Buffer.concat(this.central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.count, 8);
    end.writeUInt16LE(this.count, 10);
    end.writeUInt32LE(directory.length, 12);
    end.writeUInt32LE(start, 16);
    await this.write(directory);
    await this.write(end);
    this.out.end();
  }
}
