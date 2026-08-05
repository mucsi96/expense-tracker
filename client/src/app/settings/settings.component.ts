import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { ExpenseService } from '../expense.service';
import { CleanupConfirmationDialogComponent } from './cleanup-confirmation-dialog.component';

@Component({
  selector: 'app-settings',
  imports: [MatButtonModule, MatDialogModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly notifications = inject(NotificationsService);
  private readonly dialog = inject(MatDialog);
  readonly cleaningUp = signal(false);

  async cleanupDatabase(): Promise<void> {
    const confirmed = await firstValueFrom(
      this.dialog.open(CleanupConfirmationDialogComponent).afterClosed()
    );
    if (!confirmed) {
      return;
    }

    this.cleaningUp.set(true);
    try {
      await this.expenseService.deleteAllExpenses();
      this.notifications.success('All transactions deleted');
    } catch {
      this.notifications.error('Failed to delete transactions');
    } finally {
      this.cleaningUp.set(false);
    }
  }
}
