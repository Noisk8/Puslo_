import { test, expect } from '@playwright/test';
test('real worklet signal, WASM tempo, stop and privacy', async ({ page }) => {
  page.on('console', (message) => console.log('BROWSER', message.text()));
  const errors: string[] = [];
  const outside: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173') && !r.url().startsWith('data:'))
      outside.push(r.url());
  });
  await page.goto('/?debug=1');
  await expect(page.getByRole('button', { name: /INICIAR MICRÓFONO/ })).toBeVisible();
  await expect(page.locator('.debug')).toContainText('"worklet": "off"');
  await page.getByRole('button', { name: /INICIAR MICRÓFONO/ }).click();
  await expect(page.locator('.debug')).toContainText('"worklet": "running"');
  await expect(page.locator('.debug')).toContainText('"essentia": "ready"', { timeout: 20000 });
  await expect
    .poll(async () =>
      Number(await page.getByLabel('Nivel de audio', { exact: true }).textContent()),
    )
    .toBeGreaterThan(-60);
  await expect
    .poll(async () => Number(await page.getByLabel('BPM', { exact: true }).textContent()), {
      timeout: 45000,
    })
    .toBeGreaterThan(100);
  const bpm = Number(await page.getByLabel('BPM', { exact: true }).textContent());
  expect(bpm).toBeLessThan(130);
  await expect(page.getByText('SPL SIN CALIBRAR', { exact: true })).toBeVisible();
  // Lower amplitude after 15 seconds must change the real displayed level.
  await expect
    .poll(
      async () => Number(await page.getByLabel('Nivel de audio', { exact: true }).textContent()),
      { timeout: 15000 },
    )
    .toBeLessThan(-26);
  await page.screenshot({ path: '/tmp/pulso-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'DETENER', exact: false }).click();
  await expect(page.locator('.debug')).toContainText('"worklet": "off"');
  expect(errors).toEqual([]);
  expect(outside).toEqual([]);
});
test('responsive layout, settings, calibration dialog and offline reload', async ({
  page,
  context,
}) => {
  page.on('console', (message) => console.log('OFFLINE', message.text()));
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('requestfailed', (r) => console.log('FAILED', r.url(), r.failure()));
  await page.goto('/');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.getByRole('button', { name: /CONFIGURACIÓN/ }).click();
  await page.getByLabel('MÍNIMO · BPM').fill('65');
  await page.getByRole('button', { name: /APLICAR CONFIGURACIÓN/ }).click();
  await page.reload();
  await page.getByRole('button', { name: /CONFIGURACIÓN/ }).click();
  await expect(page.getByLabel('MÍNIMO · BPM')).toHaveValue('65');
  await page.getByRole('button', { name: /MONITOR/ }).click();
  for (const width of [360, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/pulso-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'CALIBRAR dBA ↗' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await context.setOffline(true);
  await page.goto('/?debug=1');
  await expect(page.getByRole('button', { name: /INICIAR MICRÓFONO/ })).toBeVisible();
  await page.getByRole('button', { name: /INICIAR MICRÓFONO/ }).click();
  await expect(page.getByText('SEÑAL EN VIVO', { exact: false })).toBeVisible();
  await expect(page.locator('.debug')).toContainText('"essentia": "ready"', { timeout: 20000 });
});

test('stable reference calibrates, LAeq is available, calibration deletes cleanly', async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=/tmp/pulso-calibration.wav',
    ],
  });
  try {
    const page = await browser.newPage({ permissions: ['microphone'] });
    await page.goto('http://localhost:4173/?debug=1');
    await page.getByRole('button', { name: /INICIAR MICRÓFONO/ }).click();
    await expect
      .poll(async () =>
        Number(await page.getByLabel('Nivel de audio', { exact: true }).textContent()),
      )
      .toBeLessThan(-20);
    await page.getByRole('button', { name: 'CALIBRAR dBA ↗' }).click();
    await page.getByRole('button', { name: 'CAPTURAR REFERENCIA', exact: true }).click();
    await page.getByRole('button', { name: 'GUARDAR CALIBRACIÓN' }).click({ timeout: 12000 });
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect
      .poll(async () =>
        Number(await page.getByLabel('Nivel de audio', { exact: true }).textContent()),
      )
      .toBeGreaterThan(93.5);
    await expect(page.getByText('A / CALIBRADO', { exact: true })).toBeVisible();
    const c = await page.evaluate(
      () => JSON.parse(localStorage.getItem('pulso.settings')!).calibration,
    );
    expect(c.weighting).toBe('A');
    expect(c.sampleRate).toBe(48000);
    expect(c.offset).toBeGreaterThan(110);
    expect(c.deviceId).toBeTruthy();
    await page.getByRole('button', { name: /CONFIGURACIÓN/ }).click();
    await page.getByRole('button', { name: 'ELIMINAR CALIBRACIÓN' }).click();
    await page.getByRole('button', { name: /MONITOR/ }).click();
    await expect(page.getByText('SPL SIN CALIBRAR', { exact: true })).toBeVisible();
  } finally {
    await browser.close();
  }
});

test('clipping is detected from actual saturated samples', async () => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=/tmp/pulso-clipping.wav',
    ],
  });
  try {
    const page = await browser.newPage({ permissions: ['microphone'] });
    await page.goto('http://localhost:4173/');
    await page.getByRole('button', { name: /INICIAR MICRÓFONO/ }).click();
    await expect(page.locator('.clip.on')).toContainText('INPUT CLIPPING');
    await expect(page.locator('.alert.danger')).toBeVisible();
  } finally {
    await browser.close();
  }
});

test('permission failure is clear, delayed permission is cancelled without leaving tracks', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const request = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    let first = true;
    const tracks: MediaStreamTrack[] = [];
    Object.assign(window, { __testTracks: tracks });
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (first) {
        first = false;
        throw new DOMException('Denied', 'NotAllowedError');
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      const stream = await request(constraints);
      tracks.push(...stream.getTracks());
      return stream;
    };
  });
  await page.goto('/?debug=1');
  await page.getByRole('button', { name: /INICIAR MICRÓFONO/ }).click();
  await expect(page.getByRole('alert')).toContainText('Permiso de micrófono rechazado');
  await page.getByRole('button', { name: /INICIAR MICRÓFONO/ }).click();
  await page.getByRole('button', { name: /DETENER/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const tracks = (window as unknown as { __testTracks: MediaStreamTrack[] }).__testTracks;
        return tracks.length > 0 && tracks.every((t) => t.readyState === 'ended');
      }),
    )
    .toBe(true);
  await expect(page.locator('.debug')).toContainText('"worklet": "off"');
});
