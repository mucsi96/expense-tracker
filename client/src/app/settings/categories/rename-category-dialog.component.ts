import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Category } from '../../category.service';

@Component({
  selector: 'app-rename-category-dialog',
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Rename category</h2>
    <mat-dialog-content>
      <mat-form-field class="name-field">
        <mat-label>Name</mat-label>
        <input matInput [(ngModel)]="name" cdkFocusInitial />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button [mat-dialog-close]="name" [disabled]="!name.trim()">
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .name-field {
      width: 100%;
      margin-top: 0.5rem;
    }
  `,
})
export class RenameCategoryDialogComponent {
  name = inject<Category>(MAT_DIALOG_DATA).name;
}
