import pandas as pd
import numpy as np
import statsmodels.api as sm
from quarterly_and_monthly_data import get_monthly_data, get_quarterly_data
from .constants import *


def prepare_ar2_dataset(
    quarterly_data: pd.DataFrame,
    target_col: str = TARGET_COL,
):
    """
    Prepare AR(2) dataset with lag1 and lag2.
    """
    full_df = quarterly_data[[target_col]].copy().sort_index()

    full_df["lag1"] = full_df[target_col].shift(1)
    full_df["lag2"] = full_df[target_col].shift(2)

    model_df = full_df.dropna(subset=[target_col, "lag1", "lag2"]).copy()
    return full_df, model_df


def fit_ar2_model(
    quarterly_data: pd.DataFrame,
    target_col: str = TARGET_COL
):
    """
    Fit AR(2) model on quarterly GDP data.
    """
    full_df, model_df = prepare_ar2_dataset(
        quarterly_data=quarterly_data,
        target_col=target_col
    )

    X = sm.add_constant(model_df[["lag1", "lag2"]], has_constant="add")
    y = model_df[target_col]

    model = sm.OLS(y, X).fit()
    model_df["fitted_ar2"] = model.predict(X)

    return model, full_df, model_df


def nowcast_curr_quarter_ar2(
    quarterly_data: pd.DataFrame,
    model,
    target_col: str = TARGET_COL
):
    """
    Nowcast GDP for the current unreleased quarter using fitted AR(2).
    """
    df = quarterly_data.copy().sort_index()
    observed_y = df[target_col].dropna()

    if len(observed_y) < 2:
        raise ValueError("Insufficient data to nowcast with AR(2). Need at least 2 observed quarters.")

    last_obs_quarter = observed_y.index[-1]
    target_quarter = last_obs_quarter + pd.DateOffset(months=3)

    X_new = pd.DataFrame({
        "const": [1.0],
        "lag1": [observed_y.iloc[-1]],
        "lag2": [observed_y.iloc[-2]]
    })

    nowcast = float(model.predict(X_new).iloc[0])
    return target_quarter, nowcast


def iterated_ar2_forecast(
    model,
    y_lag1,
    y_lag2,
    start_quarter,
    steps: int = 2
):
    """
    Iteratively forecast future AR(2) values.

    Parameters
    ----------
    model
        Fitted statsmodels OLS model.
    y_lag1
        Most recent observed / forecast GDP value.
    y_lag2
        Second most recent observed / forecast GDP value.
    start_quarter
        Quarter timestamp for the first forecast.
    steps : int
        Number of future quarters to forecast.

    Returns
    -------
    forecast_df : pd.DataFrame
        DataFrame with columns:
        date, actual, forecast
    """
    rows = []
    current_q = pd.Timestamp(start_quarter)
    lag1 = float(y_lag1)
    lag2 = float(y_lag2)

    for _ in range(steps):
        X_new = pd.DataFrame({
            "const": [1.0],
            "lag1": [lag1],
            "lag2": [lag2]
        })

        y_hat = float(model.predict(X_new).iloc[0])

        rows.append({
            "date": current_q,
            "actual": np.nan,
            "forecast": y_hat
        })

        lag2 = lag1
        lag1 = y_hat
        current_q = current_q + pd.DateOffset(months=3)

    return pd.DataFrame(rows)


def get_ar2_backtest_output(
    quarterly_data: pd.DataFrame,
    target_col: str = TARGET_COL
):
    """
    Return AR(2) historical fitted output for evaluation:
    dates, actual, forecast
    """
    model, full_df, model_df = fit_ar2_model(
        quarterly_data=quarterly_data,
        target_col=target_col
    )

    dates = model_df.index
    actual = model_df[target_col].values
    forecast = model_df["fitted_ar2"].values

    return dates, actual, forecast


def get_ar2_full_output(
    quarterly_data: pd.DataFrame,
    target_col: str = TARGET_COL,
    n_future_steps: int = 2
):
    """
    Return AR(2) full output:
    historical fitted values + future forecast rows.

    Output format:
        dates, actual, forecast
    """
    model, full_df, model_df = fit_ar2_model(
        quarterly_data=quarterly_data,
        target_col=target_col
    )

    # Historical fitted values
    hist_df = pd.DataFrame({
        "date": model_df.index,
        "actual": model_df[target_col].values,
        "forecast": model_df["fitted_ar2"].values
    })

    # Future forecasts
    observed_y = quarterly_data[target_col].dropna().sort_index()

    if len(observed_y) < 2:
        raise ValueError("Insufficient data to generate future AR(2) forecasts.")

    first_future_quarter = observed_y.index[-1] + pd.DateOffset(months=3)

    future_df = iterated_ar2_forecast(
        model=model,
        y_lag1=observed_y.iloc[-1],
        y_lag2=observed_y.iloc[-2],
        start_quarter=first_future_quarter,
        steps=n_future_steps
    )

    full_output = pd.concat([hist_df, future_df], ignore_index=True)

    dates = full_output["date"].values
    actual = full_output["actual"].values
    forecast = full_output["forecast"].values

    return dates, actual, forecast