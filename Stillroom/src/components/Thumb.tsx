// One thumbnail, cut from its contact sheet. Sheets are always cols x rows tiles (ffmpeg pads the
// last one), so the tile's position is a percentage and the thumbnail can take any CSS size.
import type { CSSProperties } from 'react';
import { tileOf } from '../../shared/frames.ts';
import type { VideoRow } from '../../shared/types.ts';

type Layout = Pick<VideoRow, 'sheet_cols' | 'sheet_rows' | 'tile_width' | 'tile_height'>;

export function tileStyle(video: Layout, sheets: readonly string[], sample: number): CSSProperties {
  const { sheet, col, row } = tileOf(sample, video.sheet_cols, video.sheet_rows);
  const url = sheets[sheet];
  return {
    aspectRatio: `${video.tile_width} / ${video.tile_height}`,
    backgroundImage: url ? `url("${url}")` : undefined,
    backgroundSize: `${video.sheet_cols * 100}% ${video.sheet_rows * 100}%`,
    backgroundPosition: `${(col / Math.max(1, video.sheet_cols - 1)) * 100}% ${(row / Math.max(1, video.sheet_rows - 1)) * 100}%`,
  };
}

export default function Thumb({ video, sheets, sample, className = '' }: { video: Layout; sheets: readonly string[]; sample: number; className?: string }) {
  return <span className={`thumb ${className}`} style={tileStyle(video, sheets, sample)} aria-hidden="true" />;
}
