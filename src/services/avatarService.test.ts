import { describe, it, expect } from 'vitest';
import { validateAvatarFile } from './avatarService';

describe('validateAvatarFile', () => {
  it('returns null for valid JPG under 5MB', () => {
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 1024 });
    expect(validateAvatarFile(file)).toBeNull();
  });

  it('returns null for valid PNG and WEBP', () => {
    const png = new File(['x'], 'a.png', { type: 'image/png' });
    Object.defineProperty(png, 'size', { value: 100 });
    expect(validateAvatarFile(png)).toBeNull();

    const webp = new File(['x'], 'b.webp', { type: 'image/webp' });
    Object.defineProperty(webp, 'size', { value: 100 });
    expect(validateAvatarFile(webp)).toBeNull();
  });

  it('returns error for file over 5MB', () => {
    const file = new File(['x'], 'large.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    expect(validateAvatarFile(file)).toContain('5MB');
  });

  it('returns error for disallowed type', () => {
    const file = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 100 });
    expect(validateAvatarFile(file)).toContain('JPG');
  });
});
