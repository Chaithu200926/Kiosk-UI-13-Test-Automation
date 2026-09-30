// Records the kiosk area of the screen to MP4 with ffmpeg (gdigrab), for the report's test video.
// Recording can be paused while private values are on screen; each resume starts a new part (kiosk-2.mp4, ...).
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';

export interface ScreenArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class ScreenVideo {
  private ffmpeg?: ChildProcess;
  private area?: ScreenArea;
  private readonly parts: string[] = [];

  constructor(private readonly file: string) {}

  /** Starts recording the given screen area. Returns false (and records nothing) when ffmpeg is missing. */
  start(area: ScreenArea): boolean {
    this.area = area;
    return this.record();
  }

  /** Ends the current part, e.g. while the club card number or mobile is on screen. */
  async pause() {
    await this.finish();
  }

  /** Starts a new part after a pause. */
  resume() {
    if (this.area && !this.ffmpeg) this.record();
  }

  /** Stops recording and returns the recorded parts, in order. */
  async stop(): Promise<string[]> {
    await this.finish();
    return this.parts.filter((f) => fs.existsSync(f) && fs.statSync(f).size > 0);
  }

  private record(): boolean {
    const exe = path.join(config.ffmpegDir, 'ffmpeg.exe');
    if (!fs.existsSync(exe) || !this.area) return false;
    const file = this.parts.length ? this.file.replace(/\.mp4$/, `-${this.parts.length + 1}.mp4`) : this.file;
    this.parts.push(file);
    // H.264 needs even sizes.
    const even = (n: number) => Math.max(2, Math.floor(n / 2) * 2);
    this.ffmpeg = spawn(exe, [
      '-y', '-loglevel', 'error',
      '-f', 'gdigrab', '-framerate', String(config.videoFps), '-draw_mouse', '0',
      '-offset_x', String(this.area.x), '-offset_y', String(this.area.y),
      '-video_size', `${even(this.area.width)}x${even(this.area.height)}`,
      '-i', 'desktop',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      file,
    ], { stdio: ['pipe', 'ignore', 'ignore'] });
    return true;
  }

  /** Stops ffmpeg cleanly (it finishes the file when it receives "q"). */
  private async finish() {
    const ffmpeg = this.ffmpeg;
    if (!ffmpeg) return;
    this.ffmpeg = undefined;
    const exited = new Promise<void>((resolve) => ffmpeg.once('exit', () => resolve()));
    ffmpeg.stdin?.write('q');
    ffmpeg.stdin?.end();
    const timer = setTimeout(() => ffmpeg.kill(), 10_000);
    await exited;
    clearTimeout(timer);
  }
}
