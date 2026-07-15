import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { ExpenseService } from '../expense.service';
import { InsightService } from '../insight.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    DatePipe,
    BarLoaderComponent,
    MatButtonModule,
    MatCardModule,
    MatTableModule,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly expenseService = inject(ExpenseService);
  readonly expenses = this.expenseService.expenses;
  readonly insight = inject(InsightService).insight;
  readonly uploading = signal(false);
  readonly displayedColumns = [
    'date',
    'description',
    'category',
    'amount',
    'type',
    'method',
  ];

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    this.uploading.set(true);
    try {
      await this.expenseService.uploadStatement(file);
      this.insight.reload();
    } finally {
      this.uploading.set(false);
    }
  }
}
