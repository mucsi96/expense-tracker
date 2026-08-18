import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NotificationsService } from '@mucsi96/angular-material-theme';
import { ExpenseService } from '../expense.service';
import { SettingsService } from '../settings.service';
import { CleanupConfirmationDialogComponent } from './cleanup-confirmation-dialog.component';

@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly settingsService = inject(SettingsService);
  private readonly notifications = inject(NotificationsService);
  private readonly dialog = inject(MatDialog);
  readonly cleaningUp = signal(false);
  readonly savingClosingDay = signal(false);

  // Editable copy of the stored closing day; re-seeded whenever the settings
  // reload
  readonly closingDay = linkedSignal<number | null>(
    () => this.settingsService.closingDay() ?? null
  );

  readonly closingDayValid = computed<boolean>(() => {
    const day = this.closingDay();
    return day !== null && Number.isInteger(day) && day >= 1 && day <= 31;
  });

  async saveClosingDay(): Promise<void> {
    if (!this.closingDayValid()) {
      return;
    }

    this.savingClosingDay.set(true);
    try {
      await this.settingsService.updateClosingDay(this.closingDay()!);
      this.notifications.success('Closing day saved');
    } catch {
      this.notifications.error('Failed to save closing day');
    } finally {
      this.savingClosingDay.set(false);
    }
  }

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
