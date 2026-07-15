import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AgGridAngular } from 'ag-grid-angular';
import {
  type ColDef,
  type GridReadyEvent,
  ModuleRegistry,
  ClientSideRowModelModule,
  ValidationModule,
  ColumnAutoSizeModule,
  themeMaterial,
  colorSchemeDarkBlue,
} from 'ag-grid-community';
import { BarLoaderComponent } from '@mucsi96/angular-material-theme';
import { Expense, ExpenseService } from '../expense.service';
import { InsightService } from '../insight.service';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ValidationModule,
  ColumnAutoSizeModule,
]);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    BarLoaderComponent,
    MatButtonModule,
    MatCardModule,
    AgGridAngular,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly expenseService = inject(ExpenseService);
  readonly expenses = this.expenseService.expenses;
  readonly insight = inject(InsightService).insight;
  readonly uploading = signal(false);

  readonly theme = themeMaterial.withPart(colorSchemeDarkBlue).withParams({
    backgroundColor: 'hsl(215, 28%, 17%)',
    foregroundColor: 'hsl(220, 13%, 91%)',
    headerBackgroundColor: 'hsl(217, 19%, 27%)',
    headerTextColor: 'hsl(220, 13%, 91%)',
    headerFontWeight: 500,
    rowHoverColor: 'hsl(217, 19%, 22%)',
    accentColor: 'hsl(220, 89%, 53%)',
    fontFamily: 'system-ui',
  });

  readonly columnDefs: ColDef<Expense>[] = [
    {
      headerName: 'Date',
      field: 'date',
      width: 150,
      sortable: true,
      valueFormatter: (params) => {
        if (!params.value) return '';
        return new Date(params.value).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      },
    },
    {
      headerName: 'Description',
      field: 'description',
      flex: 1,
      minWidth: 200,
      sortable: true,
    },
    {
      headerName: 'Category',
      field: 'category',
      width: 180,
      sortable: true,
    },
    {
      headerName: 'Amount',
      field: 'amount',
      width: 130,
      sortable: true,
      valueFormatter: (params) =>
        params.value != null ? `${params.value} ${params.data?.currency}` : '',
    },
    {
      headerName: 'Type',
      field: 'type',
      width: 110,
      sortable: true,
    },
    {
      headerName: 'Method',
      field: 'method',
      width: 150,
      sortable: true,
    },
  ];

  readonly defaultColDef: ColDef = {
    resizable: true,
  };

  onGridReady(event: GridReadyEvent): void {
    event.api.sizeColumnsToFit();
  }

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
