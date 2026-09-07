import { Buffer } from 'node:buffer';
import { writeFileSync } from 'node:fs';
// 120 BPM synthetic kick + ticks, alternating louder/quieter 15 s sections.
const rate = 48000,
  seconds = 40;
const buffer = Buffer.alloc(44 + rate * seconds * 2);
buffer.write('RIFF');
buffer.writeUInt32LE(buffer.length - 8, 4);
buffer.write('WAVEfmt ', 8);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(rate, 24);
buffer.writeUInt32LE(rate * 2, 28);
buffer.writeUInt16LE(2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(buffer.length - 44, 40);
for (let i = 0; i < rate * seconds; i++) {
  const t = i / rate;
  const beat = t % 0.5;
  const tick = t % 0.25;
  const gain = t < 15 ? 0.7 : 0.2;
  const sample =
    gain *
    (Math.sin(2 * Math.PI * (60 * beat + 12 * (1 - Math.exp(-beat * 30)))) * Math.exp(-beat * 18) +
      0.18 * Math.sin(2 * Math.PI * 2000 * t) * Math.exp(-tick * 160));
  buffer.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(sample * 32767))), 44 + i * 2);
}
writeFileSync('/tmp/pulso-test.wav', buffer);
function writeTone(path, amplitude) {
  const seconds = 30;
  const b = Buffer.alloc(44 + rate * seconds * 2);
  buffer.copy(b, 0, 0, 44);
  b.writeUInt32LE(b.length - 8, 4);
  b.writeUInt32LE(b.length - 44, 40);
  for (let i = 0; i < rate * seconds; i++)
    b.writeInt16LE(
      Math.max(
        -32768,
        Math.min(32767, Math.round(amplitude * Math.sin((2 * Math.PI * 1000 * i) / rate) * 32767)),
      ),
      44 + i * 2,
    );
  writeFileSync(path, b);
}
writeTone('/tmp/pulso-calibration.wav', 0.1);
writeTone('/tmp/pulso-clipping.wav', 1.5);
