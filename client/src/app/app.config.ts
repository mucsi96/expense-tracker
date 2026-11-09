import {
  ApplicationConfig,
  Provider,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import * as echarts from 'echarts';
import { NGX_ECHARTS_CONFIG } from 'ngx-echarts';

import {
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import {
  MAT_RIPPLE_GLOBAL_OPTIONS,
  RippleGlobalOptions,
} from '@angular/material/core';
import { provideAngularMaterialTheme } from '@mucsi96/angular-material-theme';
import { routes } from './app.routes';
import { errorInterceptor } from './utils/error.interceptor';
import { timezoneInterceptor } from './utils/timezone.interceptor';

const globalRippleConfig: RippleGlobalOptions = {
  disabled: true,
};

function provideECharts(): Provider {
  return {
    provide: NGX_ECHARTS_CONFIG,
    useFactory: () => ({ echarts }),
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withXsrfConfiguration({ cookieName: '__Host-XSRF-TOKEN' }),
      withInterceptors([errorInterceptor, timezoneInterceptor])
    ),
    { provide: MAT_RIPPLE_GLOBAL_OPTIONS, useValue: globalRippleConfig },
    provideAngularMaterialTheme(),
    provideECharts(),
  ],
};
