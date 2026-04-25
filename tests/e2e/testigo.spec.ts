import { test, expect } from '@playwright/test';

test.describe('Testigo App - Flujo Principal', () => {
  test('La landing page carga correctamente', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    // Navigate to local dev server (assuming it runs on 8090 during test)
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/TESTIGO/);

    // Check landing text
    await expect(page.locator('text=La app que no te perdona')).toBeVisible();

    // Verify ENTRAR button exists and navigate to login
    await page.click('button:has-text("ENTRAR")');
    await expect(page).toHaveURL(/.*#login/);
  });

  test('La pantalla de login muestra opciones de OTP y Google', async ({ page }) => {
    await page.goto('/#login');

    // Check email input exists
    await expect(page.locator('input[type="email"]')).toBeVisible();

    // Check both buttons exist
    await expect(page.locator('button:has-text("INGRESAR CON OTP")')).toBeVisible();
    await expect(page.locator('button:has-text("CONTINUAR CON GOOGLE")')).toBeVisible();
  });
});
