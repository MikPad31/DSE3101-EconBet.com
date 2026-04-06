export interface ForecastData {
  date: string;
  actual: number;
  forecast_AR: number;
  forecast_ADL: number;
  forecast_RF: number;
  forecast_Ensemble: number;
  CI_Lower: number;
  CI_Upper: number;
}

export interface PerformanceData {
  Model: string;
  RMSFE: number;
  Directional_Accuracy: number;
}


