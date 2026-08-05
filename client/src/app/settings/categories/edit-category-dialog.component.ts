import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Category, CategoryAttributes } from '../../category.service';

@Component({
  selector: 'app-edit-category-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit category</h2>
    <mat-dialog-content>
      <div class="field-row">
        <mat-form-field class="emoji-field">
          <mat-label>Emoji</mat-label>
          <input matInput [(ngModel)]="emoji" />
        </mat-form-field>
        <mat-form-field class="name-field">
          <mat-label>Name</mat-label>
          <input matInput [(ngModel)]="name" cdkFocusInitial />
        </mat-form-field>
      </div>
      <mat-form-field class="description-field">
        <mat-label>Description</mat-label>
        <input matInput [(ngModel)]="description" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button
        mat-flat-button
        [mat-dialog-close]="result"
        [disabled]="!name.trim()"
      >
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .field-row {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.5rem;
    }

    .emoji-field {
      width: 5.5rem;
      flex-shrink: 0;
    }

    .name-field,
    .description-field {
      width: 100%;
    }
  `,
})
export class EditCategoryDialogComponent {
  private readonly category = inject<Category>(MAT_DIALOG_DATA);
  name = this.category.name;
  emoji = this.category.emoji ?? '';
  description = this.category.description ?? '';

  get result(): CategoryAttributes {
    return {
      name: this.name.trim(),
      emoji: this.emoji.trim(),
      description: this.description.trim(),
    };
  }
}
