// Small procedural canvas textures (wood, stucco, tiles, banknotes, water normals). Browser only.
import * as THREE from "three";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function toTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function woodDoorTexture() {
  const [c, g] = canvas(256, 512);
  const r = rand(7);
  g.fillStyle = "#7a4a33";
  g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(${40 + r() * 30},${20 + r() * 15},${10},${0.08 + r() * 0.1})`;
    g.beginPath();
    const x = r() * 256;
    g.moveTo(x, 0);
    g.bezierCurveTo(x + r() * 8 - 4, 170, x + r() * 8 - 4, 340, x + r() * 6 - 3, 512);
    g.stroke();
  }
  // Raised panels.
  g.lineWidth = 6;
  for (const [x, y, w, h] of [
    [34, 40, 188, 190],
    [34, 280, 188, 190],
  ]) {
    g.strokeStyle = "rgba(25,12,6,0.45)";
    g.strokeRect(x, y, w, h);
    g.strokeStyle = "rgba(255,220,180,0.12)";
    g.strokeRect(x + 5, y + 5, w - 10, h - 10);
  }
  return toTexture(c);
}

export function stuccoTexture(base: string) {
  const [c, g] = canvas(512, 512);
  const r = rand(11);
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    const v = r();
    g.fillStyle = v > 0.5 ? `rgba(255,240,220,${r() * 0.06})` : `rgba(60,40,25,${r() * 0.07})`;
    g.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3);
  }
  // Grime streaks at the bottom.
  const grad = g.createLinearGradient(0, 380, 0, 512);
  grad.addColorStop(0, "rgba(60,45,30,0)");
  grad.addColorStop(1, "rgba(60,45,30,0.35)");
  g.fillStyle = grad;
  g.fillRect(0, 380, 512, 132);
  // A few faded tags.
  g.font = "bold 64px Impact, sans-serif";
  for (let i = 0; i < 2; i++) {
    g.save();
    g.translate(60 + r() * 300, 260 + r() * 140);
    g.rotate(-0.15 + r() * 0.3);
    g.fillStyle = ["rgba(40,110,60,0.55)", "rgba(30,30,40,0.5)", "rgba(150,50,120,0.4)"][i % 3];
    g.fillText(["BP", "ALMA", "VP"][Math.floor(r() * 3)], 0, 0);
    g.restore();
  }
  return toTexture(c);
}

export function poolTileTexture() {
  const [c, g] = canvas(256, 256);
  g.fillStyle = "#cfe7ea";
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "#8fb8c0";
  g.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i, 256);
    g.moveTo(0, i);
    g.lineTo(256, i);
    g.stroke();
  }
  return toTexture(c);
}

export function banknoteTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = "#5f8f4e";
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = "#cfe3b8";
  g.lineWidth = 6;
  g.strokeRect(8, 8, 240, 112);
  g.fillStyle = "#e6f2d8";
  g.beginPath();
  g.ellipse(128, 64, 36, 42, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#355a2a";
  g.font = "bold 56px Impact, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText("$", 128, 66);
  g.font = "bold 26px Impact, sans-serif";
  g.fillStyle = "#e6f2d8";
  g.fillText("100", 44, 34);
  g.fillText("100", 212, 96);
  return toTexture(c);
}

export function waterNormalTexture() {
  const size = 256;
  const [c, g] = canvas(size, size);
  const img = g.createImageData(size, size);
  const h = (x: number, y: number) => {
    const u = (x / size) * Math.PI * 2;
    const v = (y / size) * Math.PI * 2;
    return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 7 - v * 5) * 0.25 + Math.sin(u * 2 - v * 9) * 0.2 + Math.sin(u * 13 + v * 11) * 0.08;
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx * 2;
      const ny = -dy * 2;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return toTexture(c, false);
}

export function poleWoodTexture() {
  const [c, g] = canvas(64, 256);
  const r = rand(3);
  g.fillStyle = "#5a4636";
  g.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 160; i++) {
    g.fillStyle = `rgba(${20 + r() * 40},${15 + r() * 25},10,${0.15 + r() * 0.2})`;
    g.fillRect(r() * 64, 0, 1 + r() * 2, 256);
  }
  return toTexture(c);
}
