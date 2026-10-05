// Rows as they come out of the database (supabase/schema.sql).

export interface VideoRow {
  id: string;
  user_id: string;
  title: string;
  status: 'processing' | 'ready' | 'failed';
  progress: number;
  error: string | null;
  container: string;
  size_bytes: number;
  duration_s: number;
  fps: number;
  width: number;
  height: number;
  frame_count: number;
  sample_step: number;
  sample_count: number;
  tile_width: number;
  tile_height: number;
  sheet_cols: number;
  sheet_rows: number;
  sheet_count: number;
  created_at: string;
  updated_at: string;
}

export interface KeptFrame {
  id: string;
  video_id: string;
  frame_index: number;
  label: string | null;
  created_at: string;
}
