import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

@Component({
  selector: 'app-cleanup-confirmation-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Clear all transactions?</h2>
    <mat-dialog-content>
      This permanently deletes every transaction from the database. This action
      cannot be undone.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-flat-button bt-color="error" [mat-dialog-close]="true">Delete</button>
    </mat-dialog-actions>
  `,
})
export class CleanupConfirmationDialogComponent {}
