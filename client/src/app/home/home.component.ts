import { Component, inject, signal } from '@angular/core';
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
import {
  BarLoaderComponent,
  NotificationsService,
} from '@mucsi96/angular-material-theme';
import { Expense, ExpenseService } from '../expense.service';

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  ValidationModule,
  ColumnAutoSizeModule,
]);

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [BarLoaderComponent, AgGridAngular],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly expenseService = inject(ExpenseService);
  private readonly notifications = inject(NotificationsService);
  readonly expenses = this.expenseService.expenses;
  readonly uploading = signal(false);
  readonly dragOver = signal(false);

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

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    // dragleave also fires when moving onto a child of the dropzone
    const dropzone = event.currentTarget as HTMLElement;
    if (event.relatedTarget && dropzone.contains(event.relatedTarget as Node)) {
      return;
    }
    this.dragOver.set(false);
  }

  async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragOver.set(false);

    const files = Array.from(event.dataTransfer?.files ?? []);
    if (!files.length) {
      return;
    }

    const csvFiles = files.filter((file) =>
      file.name.toLowerCase().endsWith('.csv')
    );
    if (!csvFiles.length) {
      this.notifications.error('Only CSV statements are supported');
      return;
    }

    this.uploading.set(true);
    try {
      // Sequential so server-side duplicate detection sees earlier imports
      for (const file of csvFiles) {
        await this.uploadFile(file);
      }
    } finally {
      this.uploading.set(false);
    }
  }

  private async uploadFile(file: File): Promise<void> {
    try {
      const response = await this.expenseService.uploadStatement(file);
      this.notifications.success(
        `${response.importedCount} expense(s) imported from ${file.name}`
      );
    } catch {
      this.notifications.error(`Failed to import ${file.name}`);
    }
  }
}
