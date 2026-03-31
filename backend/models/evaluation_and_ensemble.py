import numpy as np
import pandas as pd


def standardize_model_output(dates, actual, forecast, model_name="Model"):
    """
    Convert raw model outputs into a standard DataFrame format.
    """
    df = pd.DataFrame({
        "date": pd.to_datetime(dates),
        "actual": np.array(actual, dtype=float),
        "forecast": np.array(forecast, dtype=float)
    })
    df["model"] = model_name
    return df


def align_model_outputs(model_dfs):
    """
    Align multiple model output DataFrames on common dates.
    Each input DataFrame must have:
    date, actual, forecast, model
    """
    if not model_dfs:
        raise ValueError("No model outputs were provided.")

    base = model_dfs[0][["date", "actual"]].copy()

    for df in model_dfs:
        model_name = df["model"].iloc[0]
        temp = df[["date", "forecast"]].copy()
        temp = temp.rename(columns={"forecast": f"forecast_{model_name}"})
        base = base.merge(temp, on="date", how="inner")

    return base.sort_values("date").reset_index(drop=True)


def compute_ensemble_forecast(aligned_df, model_names):
    """
    Compute simple-average ensemble forecast across selected models.
    """
    forecast_cols = [f"forecast_{name}" for name in model_names]
    aligned_df["forecast_Ensemble"] = aligned_df[forecast_cols].mean(axis=1)
    return aligned_df


def compute_rmsfe(actual, forecast):
    """
    Root Mean Squared Forecast Error.
    """
    actual = np.array(actual, dtype=float)
    forecast = np.array(forecast, dtype=float)
    return np.sqrt(np.mean((actual - forecast) ** 2))


def compute_directional_accuracy(actual, forecast):
    """
    Percentage of times the forecast correctly predicts
    the direction of change in GDP.
    """
    actual = np.array(actual, dtype=float)
    forecast = np.array(forecast, dtype=float)

    if len(actual) < 2 or len(forecast) < 2:
        return np.nan

    actual_diff = np.diff(actual)
    forecast_diff = np.diff(forecast)

    correct = np.sign(actual_diff) == np.sign(forecast_diff)
    return np.mean(correct)


def compute_confidence_intervals(actual, forecast):
    """
    Compute 95% confidence intervals using historical forecast errors.
    """
    actual = np.array(actual, dtype=float)
    forecast = np.array(forecast, dtype=float)

    errors = actual - forecast
    std = np.std(errors, ddof=1)

    lower = forecast - 1.96 * std
    upper = forecast + 1.96 * std

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