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

  getImageForTags(tags: string[] | undefined | null): string {
    if (!tags?.length) return this.getRandomGenericImage();

    const available = tags.filter((tag) =>
      this.knownTags.includes(tag.toLowerCase()),
    );

    if (available.length) {
      const chosen = available[Math.floor(Math.random() * available.length)];
      return `assets/tag_images/${chosen.toLowerCase()}.png`;
    }

    return this.getRandomGenericImage();
  }

  private getRandomGenericImage(): string {
    const random =
      this.genericImages[Math.floor(Math.random() * this.genericImages.length)];
    return `assets/tag_images/generic/${random}`;
  }
}
