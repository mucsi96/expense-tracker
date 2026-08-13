import { Component, inject } from '@angular/core';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { CategoryService } from '../category.service';

export type CategoryPickerResult =
  | { action: 'assign'; category: string }
  | { action: 'drop' };

@Component({
  selector: 'app-category-picker-sheet',
  imports: [BarLoaderComponent, MatButtonModule, MatIconModule, RouterLink],
  template: `
    <h2 class="sheet-title">Choose category</h2>
    @if (categories.isLoading()) {
    <bt-bar-loader class="sheet-loading" label="Loading categories" />
    } @else {
    <ul class="category-options">
      @for (category of categories.value() ?? []; track category.id) {
      <li>
        <button
          mat-button
          class="category-option"
          (click)="select(category.name)"
        >
          <span class="option-label">
            @if (category.emoji) {
            <span class="option-emoji" aria-hidden="true">{{
              category.emoji
            }}</span>
            }
            {{ category.name }}
          </span>
          @if (category.description) {
          <span class="option-description">{{ category.description }}</span>
          }
        </button>
      </li>
      } @empty {
      <li class="empty-state">
        No categories yet.
        <a routerLink="/settings/categories" (click)="dismiss()"
          >Manage categories</a
        >
      </li>
      }
    </ul>
    <button mat-button class="drop-option" (click)="drop()">
      <mat-icon>delete_outline</mat-icon>
      Drop transaction
    </button>
    }
  `,
  styles: `
    :host {
      display: block;
      padding-bottom: env(safe-area-inset-bottom);
    }

    .sheet-title {
      color: var(--bt-text-strong);
      font-size: 1rem;
      margin: 0.5rem 0;
    }

    .category-options {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .category-option {
      width: 100%;
      min-height: 44px;
      justify-content: flex-start;
      text-align: left;
    }

    .category-option ::ng-deep .mdc-button__label {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.125rem;
      padding: 0.375rem 0;
    }

    .option-description {
      color: var(--bt-text-muted);
      font-size: 0.8rem;
      font-weight: normal;
      overflow-wrap: anywhere;
      white-space: normal;
    }

    .drop-option {
      width: 100%;
      min-height: 44px;
      margin-top: 0.5rem;
      border-top: 1px solid var(--bt-outline);
      border-radius: 0;
      color: var(--bt-error);
      justify-content: flex-start;
    }

    .sheet-loading {
      display: flex;
      justify-content: center;
      margin: 1rem auto;
    }

    .empty-state {
      color: var(--bt-text-muted);
      padding: 1rem 0;
    }
  `,
})
export class CategoryPickerSheetComponent {
  private readonly sheetRef =
    inject<MatBottomSheetRef<CategoryPickerSheetComponent, CategoryPickerResult>>(
      MatBottomSheetRef
    );
  readonly categories = inject(CategoryService).categories;

  select(category: string): void {
    this.sheetRef.dismiss({ action: 'assign', category });
  }

  drop(): void {
    this.sheetRef.dismiss({ action: 'drop' });
  }

  dismiss(): void {
    this.sheetRef.dismiss();
  }
}
