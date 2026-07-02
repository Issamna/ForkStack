import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ShoppingListService, ShoppingItem } from './shopping-list.service';

@Component({
  selector: 'app-shopping-list',
  templateUrl: './shopping-list.component.html',
})
export class ShoppingListComponent implements OnInit {
  week = '';
  items: ShoppingItem[] = [];
  loading = true;
  generating = false;
  newItem = '';

  constructor(
    private route: ActivatedRoute,
    private shopping: ShoppingListService,
  ) {}

  ngOnInit(): void {
    this.week = this.route.snapshot.queryParamMap.get('week') || this.thisMonday();
    // Generate fresh from the current plan on open (checks are preserved).
    this.generate();
  }

  thisMonday(): string {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  generate(): void {
    this.generating = true;
    this.shopping.generate(this.week).subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.loading = false;
        this.generating = false;
      },
      error: () => {
        this.loading = false;
        this.generating = false;
      },
    });
  }

  toggle(item: ShoppingItem): void {
    item.checked = !item.checked;
    this.save();
  }

  remove(item: ShoppingItem): void {
    if (item.custom) {
      // User-added items are simply deleted.
      this.items = this.items.filter((i) => i !== item);
    } else {
      // Recipe items are hidden so a regenerate doesn't bring them back.
      item.removed = true;
    }
    this.save();
  }

  restoreRemoved(): void {
    this.items.forEach((i) => (i.removed = false));
    this.save();
  }

  private save(): void {
    // The server assigns categories, so sync back its version of the list.
    this.shopping.save(this.week, this.items).subscribe((res) => {
      if (res.items) this.items = res.items;
    });
  }

  addItem(): void {
    const text = this.newItem.trim();
    if (!text) return;
    // A leading number becomes the quantity ("2 paper towels").
    const m = text.match(/^(\d+(?:[.\/]\d+)?)\s+(.+)$/);
    this.items.push({
      name: m ? m[2] : text,
      unit: '',
      quantity: m ? m[1] : '',
      sources: [],
      checked: false,
      custom: true,
      removed: false,
    });
    this.items.sort((a, b) =>
      a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
    );
    this.newItem = '';
    this.save();
  }

  readonly categoryOrder = [
    'produce', 'meat', 'dairy', 'bakery', 'pantry',
    'spices', 'frozen', 'beverages', 'household', 'other',
  ];
  readonly categoryLabels: { [key: string]: string } = {
    produce: 'Produce',
    meat: 'Meat & Seafood',
    dairy: 'Dairy & Eggs',
    bakery: 'Bakery',
    pantry: 'Pantry',
    spices: 'Spices & Seasonings',
    frozen: 'Frozen',
    beverages: 'Beverages',
    household: 'Household',
    other: 'Other',
  };

  get grouped(): { label: string; items: ShoppingItem[] }[] {
    const visible = this.visible;
    return this.categoryOrder
      .map((c) => ({
        label: this.categoryLabels[c],
        items: visible.filter((i) => (i.category || 'other') === c),
      }))
      .filter((g) => g.items.length);
  }

  get visible(): ShoppingItem[] {
    return this.items.filter((i) => !i.removed);
  }

  get removedCount(): number {
    return this.items.filter((i) => i.removed).length;
  }

  get remaining(): number {
    return this.visible.filter((i) => !i.checked).length;
  }

  get weekLabel(): string {
    const start = new Date(this.week + 'T00:00:00');
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }
}
