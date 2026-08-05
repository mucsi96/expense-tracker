import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  BarLoaderComponent,
  NotificationsService,
} from '@mucsi96/angular-material-theme';
import { Category, CategoryService } from '../../category.service';
import { EditCategoryDialogComponent } from './edit-category-dialog.component';

@Component({
  selector: 'app-categories',
  imports: [
    BarLoaderComponent,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css',
})
export class CategoriesComponent {
  private readonly categoryService = inject(CategoryService);
  private readonly notifications = inject(NotificationsService);
  private readonly dialog = inject(MatDialog);
  readonly categories = this.categoryService.categories;
  readonly newCategoryName = signal('');
  readonly newCategoryEmoji = signal('');
  readonly newCategoryDescription = signal('');
  readonly saving = signal(false);

  async addCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name) {
      return;
    }

    this.saving.set(true);
    try {
      await this.categoryService.addCategory({
        name,
        emoji: this.newCategoryEmoji().trim(),
        description: this.newCategoryDescription().trim(),
      });
      this.newCategoryName.set('');
      this.newCategoryEmoji.set('');
      this.newCategoryDescription.set('');
      this.notifications.success('Category added');
    } catch {
      this.notifications.error('Failed to add category');
    } finally {
      this.saving.set(false);
    }
  }

  async editCategory(category: Category): Promise<void> {
    const attributes = await firstValueFrom(
      this.dialog
        .open(EditCategoryDialogComponent, { data: category })
        .afterClosed()
    );
    if (!attributes) {
      return;
    }

    try {
      await this.categoryService.updateCategory(category.id, attributes);
      this.notifications.success('Category updated');
    } catch {
      this.notifications.error('Failed to update category');
    }
  }

  async deleteCategory(category: Category): Promise<void> {
    try {
      await this.categoryService.deleteCategory(category.id);
      this.notifications.success('Category deleted');
    } catch {
      this.notifications.error('Failed to delete category');
    }
  }
}
