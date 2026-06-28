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
    this.shopping.save(this.week, this.items).subscribe();
  }

  get remaining(): number {
    return this.items.filter((i) => !i.checked).length;
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
