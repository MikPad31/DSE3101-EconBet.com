import numpy as np
import pandas as pd


def standardize_model_output(dates, actual, forecast, model_name="Model"):
    """
    Convert raw model outputs into a standard DataFrame format.
    """
    df = pd.DataFrame({
        "date": pd.to_datetime(dates),
        "actual": pd.to_numeric(pd.Series(actual), errors="coerce"),
        "forecast": pd.to_numeric(pd.Series(forecast), errors="coerce")
    })
    df["model"] = model_name
    return df


def align_model_outputs(model_dfs):
    """
    Align multiple model output DataFrames on all available dates.

    Each input DataFrame must have:
    date, actual, forecast, model

    Uses OUTER merge so future forecast rows (actual = NaN) are preserved.
    """
    if not model_dfs:
        raise ValueError("No model outputs were provided.")

    base = pd.DataFrame({"date": pd.to_datetime([])})

    # Merge all forecast columns
    for df in model_dfs:
        model_name = df["model"].iloc[0]

        temp = df[["date", "actual", "forecast"]].copy()
        temp = temp.rename(columns={"forecast": f"forecast_{model_name}"})

        if base.empty:
            base = temp[["date", "actual", f"forecast_{model_name}"]].copy()
        else:
            base = base.merge(
                temp[["date", "actual", f"forecast_{model_name}"]],
                on="date",
                how="outer"
            )

            # Keep actual from whichever model has it
            if "actual_x" in base.columns and "actual_y" in base.columns:
                base["actual"] = base["actual_x"].combine_first(base["actual_y"])
                base = base.drop(columns=["actual_x", "actual_y"])

    return base.sort_values("date").reset_index(drop=True)


def compute_ensemble_forecast(aligned_df, model_names):
    """
    Compute simple-average ensemble forecast across selected models.
    Uses available model forecasts row-wise.
    """
    forecast_cols = [f"forecast_{name}" for name in model_names]
    aligned_df["forecast_Ensemble"] = aligned_df[forecast_cols].mean(axis=1, skipna=True)
    return aligned_df


def _get_valid_metric_data(actual, forecast):
    """
    Keep only rows where both actual and forecast are available.
    """
    actual = np.array(actual, dtype=float)
    forecast = np.array(forecast, dtype=float)

    mask = ~np.isnan(actual) & ~np.isnan(forecast)
    return actual[mask], forecast[mask]


def compute_rmsfe(actual, forecast):
    """
    Root Mean Squared Forecast Error.
    Only uses rows with non-missing actual and forecast.
    """
    actual_clean, forecast_clean = _get_valid_metric_data(actual, forecast)

    if len(actual_clean) == 0:
        return np.nan

    return np.sqrt(np.mean((actual_clean - forecast_clean) ** 2))


def compute_directional_accuracy(actual, forecast):
    """
    Percentage of times the forecast correctly predicts
    the direction of change in GDP.

    Only uses rows where actual and forecast are both observed.
    Future rows with actual = NaN are excluded.
    """
    actual_clean, forecast_clean = _get_valid_metric_data(actual, forecast)

    if len(actual_clean) < 2 or len(forecast_clean) < 2:
        return np.nan

    actual_diff = np.diff(actual_clean)
    forecast_diff = np.diff(forecast_clean)

    correct = np.sign(actual_diff) == np.sign(forecast_diff)
    return np.mean(correct)


def compute_confidence_intervals(actual, forecast):
    """
    Compute 95% confidence intervals using historical forecast errors.

    The standard deviation is estimated only from rows
    where actual and forecast are both available.
    Then CI bands are applied to the full forecast series.
    """
    actual_full = np.array(actual, dtype=float)
    forecast_full = np.array(forecast, dtype=float)

    actual_clean, forecast_clean = _get_valid_metric_data(actual_full, forecast_full)

    if len(actual_clean) < 2:
        lower = np.full_like(forecast_full, np.nan, dtype=float)
        upper = np.full_like(forecast_full, np.nan, dtype=float)
        return lower, upper

    errors = actual_clean - forecast_clean
    std = np.std(errors, ddof=1)

    lower = forecast_full - 1.96 * std
    upper = forecast_full + 1.96 * std

    return lower, upper


def evaluate_all_models(model_dfs, model_names):
    """
    Evaluate all individual models and the ensemble.

    Returns:
        metrics_df: summary table of evaluation metrics
        aligned_df: aligned forecast DataFrame with ensemble and CI bands
    """
    aligned_df = align_model_outputs(model_dfs)
    aligned_df = compute_ensemble_forecast(aligned_df, model_names)

    results = []

    for name in model_names + ["Ensemble"]:
        forecast_col = f"forecast_{name}"

        rmsfe = compute_rmsfe(aligned_df["actual"], aligned_df[forecast_col])
        da = compute_directional_accuracy(aligned_df["actual"], aligned_df[forecast_col])

        results.append({
            "Model": name,
            "RMSFE": rmsfe,
            "Directional_Accuracy": da
        })

    metrics_df = pd.DataFrame(results)

    lower, upper = compute_confidence_intervals(
        aligned_df["actual"],
        aligned_df["forecast_Ensemble"]
    )

    aligned_df["CI_Lower"] = lower
    aligned_df["CI_Upper"] = upper

    return metrics_df, aligned_df