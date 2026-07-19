import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ImageHelperService {
  private knownTags = [
    'breakfast',
    'appetizer',
    'beverage',
    'dessert',
    'dinner',
    'lunch',
    'main course',
    'salad',
    'sandwich',
    'side',
    'snack',
    'soup',
  ];

  private genericImages = [
    'generic1.png',
    'generic2.png',
    'generic3.png',
    'generic4.png',
  ];

  /**
   * Pick a tag-appropriate placeholder image. The choice is *deterministic*:
   * the same recipe always maps to the same image. `seed` (a stable value like
   * the recipe id) drives the pick; without it the tags themselves seed it.
   *
   * This must not use Math.random() -- these are called directly from templates
   * on every change-detection cycle, so a random pick would make images flicker
   * and throw NG0100 (ExpressionChangedAfterItHasBeenChecked).
   */
  getImageForTags(tags: string[] | undefined | null, seed?: string): string {
    const key = seed || (tags || []).join('|');
    const h = this.hash(key);

    const available = (tags || []).filter((tag) =>
      this.knownTags.includes(tag.toLowerCase()),
    );

    if (available.length) {
      const chosen = available[h % available.length];
      return `assets/tag_images/${chosen.toLowerCase()}.png`;
    }

    return `assets/tag_images/generic/${this.genericImages[h % this.genericImages.length]}`;
  }

  private hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
}
