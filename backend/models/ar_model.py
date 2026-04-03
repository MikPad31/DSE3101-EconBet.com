import pandas as pd
import numpy as np
import statsmodels.api as sm
from quarterly_and_monthly_data import get_monthly_data, get_quarterly_data
from constants import *


# Prepare data set for AR(2)
def prepare_ar2_dataset(
        quarterly_data : pd.DataFrame,
        target_col :str = TARGET_COL,
):
    """Function to prepare dataset with 2 time lags.
    
    Parameters
    ----------
    quarterly_data : pd.DataFrame
        Quarterly Dataframe from the preprocessing pipeline.
    target_col :str = TARGET_COL
        Target column for model, defined as GDPC1.

    Returns
    -------
    full_df
        Full dataset including NaNs
    model_df
        Cleaned dataset for regression, dropped NaNs

    """
    full_df = quarterly_data[[target_col]].copy().sort_index()

    full_df["lag1"] = full_df[target_col].shift(1)
    full_df["lag2"] = full_df[target_col].shift(2)

    model_df = full_df.dropna(subset=[target_col, "lag1", "lag2"]).copy()
    return full_df, model_df



# Fitting AR(2) model
def fit_ar2_model(
        quarterly_data : pd.DataFrame,
        target_col : str = TARGET_COL 
):
    """Function to fit AR(2) model on a given data frame.

    Parameters
    ----------
    quarterly_data : pd.DataFrame
        Pandas DataFrame of quarterly data.
    target_col : str = TARGET_COL
        Target column for model, defined as GDPC1.

    Returns
    -------
    model
        Fitted statsmodels OLS object.
    full_df : pd.DataFrame
        Full quarterly data with lags.
    model_df : pd.DataFrame
        Estimation sample with fitted values.
    
    """
    full_df, model_df = prepare_ar2_dataset(
        quarterly_data=quarterly_data,
        target_col=target_col
    )

    X = sm.add_constant(model_df[["lag1", "lag2"]])
    y = model_df[target_col]

    model = sm.OLS(y, X).fit()
    model_df["fitted_ar2"] = model.predict(X)

    return model, full_df, model_df


def nowcast_curr_quarter_ar2(
        quarterly_data : pd.DataFrame,
        model,
        target_col : str = TARGET_COL
):
    """Nowcasts the GDP for the current (unreleased) quarter using fitted AR(2) model and historical quarterly data available.
    
    Parameters
    ----------
    quarterly_data : pd.DataFrame
        Pandas DataFrame of quarterly data.
    model
        Fitted statsmodels OLS object.
    target_col :str = TARGET_COL
        Target column for model, defined as GDPC1.

    Returns
    -------
    target_quarter
        Date of the forecasted quarter.
    nowcast
        Predicted GDP growth rate.
    """

    df = quarterly_data.copy().sort_index()

    observed_y = df[target_col].dropna()
    
    # Check if there is enough data to nowcast current quarter (at least two observed quarters)
    if len(observed_y) < 2:
        raise ValueError("Insufficient data to nowcast with AR(2). Provide at least 2 observed GDP quarters.")
    
    last_obs_quarter = observed_y.index[-1]
    target_quarter = last_obs_quarter + pd.DateOffset(months = 3)

    X_new = pd.DataFrame({
        "const": [1.0],
        "lag1": [observed_y.iloc[-1]],
        "lag2": [observed_y.iloc[-2]]
    })

    nowcast = float(model.predict(X_new).iloc[0])
    return target_quarter, nowcast


# def iterated_ar2_forecast(
#         model,
#         y_lag1,
#         y_lag2
# ):
#     """Iterated AR(2) forecast.
    
#     Parameters
#     ----------
#     model
#         Fitted statsmodels OLS model.
#     y_lag1
#         Most recent observed GDP growth.
#     y_lag2
#         Second most recent observed GDP growth.

#     Returns
#     -------
#     quarterly_forecasts
#         pd.Series of forecasts indexed by quarter.
#     """

#     forecasts = []

def get_ar2_backtest_output(quarterly_data: pd.DataFrame, target_col: str = TARGET_COL):
    """
    Returns AR(2) backtest output in the exact format needed for ensemble evaluation:
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