// Live pictures of the network cameras (RTSP) for the browser: ffmpeg turns the stream into
// MJPEG, which an <img> shows directly (/cam/<name>.mjpg), plus a single picture
// (/cam/<name>.jpg). One ffmpeg per open picture; it stops when the page closes it.
// STRIDECAST_CAMERAS=name=rtsp://…,name=rtsp://… replaces the list.

import { spawn } from 'node:child_process';

const DEFAULT = {
  printer: 'rtsp://prusa-coreone-camera.fritz.box/live', // Buddy3D camera in the Prusa Core One
  rig: 'rtsp://192.168.178.141/live', // the RasQberry rig's LED panels
};

export const cameras = process.env.STRIDECAST_CAMERAS
  ? Object.fromEntries(process.env.STRIDECAST_CAMERAS.split(',').map((e) => e.split(/=(.*)/s).slice(0, 2)))
  : DEFAULT;

function ffmpeg(url, args) {
  return spawn('ffmpeg', ['-loglevel', 'error', '-rtsp_transport', 'tcp', '-i', url, '-an', ...args, 'pipe:1'], {
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

// Answers /cam/<name>.mjpg and /cam/<name>.jpg; false for any other path.
export function handleCamera(pathname, req, res) {
  const m = pathname.match(/^\/cam\/([\w-]+)\.(mjpg|jpg)$/);
  if (!m) return false;
  const url = cameras[m[1]];
  if (!url) {
    res.writeHead(404).end();
    return true;
  }
  if (m[2] === 'mjpg') {
    const p = ffmpeg(url, ['-vf', 'fps=10,scale=960:-2', '-q:v', '6', '-f', 'mpjpeg', '-boundary_tag', 'frame']);
    res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=frame', 'Cache-Control': 'no-store' });
    p.stdout.pipe(res);
    p.on('exit', () => res.end());
    req.on('close', () => p.kill('SIGKILL'));
  } else {
    const p = ffmpeg(url, ['-frames:v', '1', '-q:v', '4', '-f', 'image2', '-c:v', 'mjpeg']);
    const chunks = [];
    p.stdout.on('data', (c) => chunks.push(c));
    const timer = setTimeout(() => p.kill('SIGKILL'), 20000);
    p.on('exit', () => {
      clearTimeout(timer);
      const body = Buffer.concat(chunks);
      if (body.length) res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }).end(body);
      else res.writeHead(504).end();
    });
  }
  return true;
}
