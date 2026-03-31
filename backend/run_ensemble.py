from models.evaluation_and_ensemble import (
    standardize_model_output,
    evaluate_all_models
)

from models.ar_model import get_ar2_backtest_output
from models.adl_model import get_adl_backtest_output
from random_forrest_model import get_rf_backtest_output
from quarterly_and_monthly_data import get_quarterly_data


def main():
    # ==============================
    # GET REAL DATA
    # ==============================
    quarterly_data = get_quarterly_data()

    # ==============================
    # AR MODEL (REAL OUTPUT)
    # ==============================
    ar_dates, ar_actual, ar_forecast = get_ar2_backtest_output(quarterly_data)
    ar_df = standardize_model_output(ar_dates, ar_actual, ar_forecast, "AR")

    # ==============================
    # ADL MODEL (REAL OUTPUT)
    # ==============================
    adl_dates, adl_actual, adl_forecast = get_adl_backtest_output(quarterly_data)
    adl_df = standardize_model_output(adl_dates, adl_actual, adl_forecast, "ADL")

    # ==============================
    # RF MODEL (REAL OUTPUT)
    # ==============================
    rf_dates, rf_actual, rf_forecast = get_rf_backtest_output()
    rf_df = standardize_model_output(rf_dates, rf_actual, rf_forecast, "RF")

    # ==============================
    # EVALUATION + ENSEMBLE
    # ==============================
    metrics_df, aligned_df = evaluate_all_models(
        [ar_df, adl_df, rf_df],
        ["AR", "ADL", "RF"]
    )

    # ==============================
    # SAVE OUTPUTS
    # ==============================
    metrics_df.to_csv("backend/data/model_metrics.csv", index=False)
    aligned_df.to_csv("backend/data/ensemble_forecasts.csv", index=False)

    # ==============================
    # PRINT OUTPUT
    # ==============================
    print("\n=== METRICS ===")
    print(metrics_df)

    print("\n=== FORECASTS ===")
    print(aligned_df)


if __name__ == "__main__":
    main()