import os

from models.evaluation_and_ensemble import (
    standardize_model_output,
    evaluate_all_models
)

from models.ar_model import get_ar2_full_output
from models.adl_model import get_adl_full_output
from models.random_forest_model import get_rf_full_output
from quarterly_and_monthly_data import get_quarterly_data, get_monthly_data


def main():
    # ==============================
    # GET REAL DATA
    # ==============================
    quarterly_data = get_quarterly_data()
    monthly_data = get_monthly_data()
    target_month = monthly_data.index.max()

    # ==============================
    # AR MODEL (HISTORICAL + FUTURE)
    # ==============================
    ar_dates, ar_actual, ar_forecast = get_ar2_full_output(quarterly_data)
    ar_df = standardize_model_output(ar_dates, ar_actual, ar_forecast, "AR")

    # ==============================
    # ADL MODEL (HISTORICAL + FUTURE)
    # ==============================
    adl_dates, adl_actual, adl_forecast = get_adl_full_output(
        quarterly_data,
        monthly_data,
        target_month=target_month
    )
    adl_df = standardize_model_output(adl_dates, adl_actual, adl_forecast, "ADL")

    # ==============================
    # RF MODEL (HISTORICAL + FUTURE)
    # ==============================
    rf_dates, rf_actual, rf_forecast = get_rf_full_output()
    rf_df = standardize_model_output(rf_dates, rf_actual, rf_forecast, "RF")

    # ==============================
    # EVALUATION + ENSEMBLE
    # ==============================
    metrics_df, aligned_df = evaluate_all_models(
        [ar_df, adl_df, rf_df],
        ["AR", "ADL", "RF"]
    )

    metrics_df = metrics_df.round(3)
    aligned_df = aligned_df.sort_values("date").reset_index(drop=True)
    aligned_df["date"] = aligned_df["date"].astype(str)
    aligned_df = aligned_df.round(3)

    # ==============================
    # SAVE OUTPUTS
    # ==============================
    os.makedirs("../public", exist_ok=True)

    metrics_df.to_csv("../public/performance.csv", index=False)
    aligned_df.to_csv("../public/ensemble_forecasts.csv", index=False)

    # ==============================
    # PRINT OUTPUT
    # ==============================
    print("\n=== METRICS ===")
    print(metrics_df)

    print("\n=== FORECASTS ===")
    print(aligned_df.tail(10))


if __name__ == "__main__":
    main()