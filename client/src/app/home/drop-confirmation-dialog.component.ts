import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-drop-confirmation-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Drop transaction?</h2>
    <mat-dialog-content>
      <p class="transaction">{{ description }}</p>
      This permanently removes the transaction instead of categorizing it. This
      action cannot be undone.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button class="drop-button" [mat-dialog-close]="true">
        Drop
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .transaction {
      color: var(--bt-text-strong);
      margin: 0 0 0.5rem;
      overflow-wrap: anywhere;
    }

    .drop-button {
      --mat-button-filled-container-color: var(--bt-error);
      --mat-button-filled-label-text-color: var(--bt-text-on-brand);
    }
  `,
})
export class DropConfirmationDialogComponent {
  readonly description = inject<string>(MAT_DIALOG_DATA);
}
