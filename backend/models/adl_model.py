import pandas as pd
import numpy as np
import statsmodels.api as sm

from quarterly_and_monthly_data import get_monthly_data, get_quarterly_data

TARGET_COL = "GDPC1"
COVID_COL = "Covid"
DEFAULT_GDP_LAGS = 2
DEFAULT_PREDICTOR_LAGS = 1
MAX_GDP_LAGS = 4
MAX_PREDICTOR_LAGS = 2
DEFAULT_CV_N_SPLITS = 5
MIN_CV_TRAIN_SIZE = 20


def prepare_adl_dataset(
    quarterly_data: pd.DataFrame,
    target_col: str = TARGET_COL,
    predictor_cols: list[str] | None = None,
    target_lags: int = DEFAULT_GDP_LAGS,
    predictor_lags: int = DEFAULT_PREDICTOR_LAGS,
    include_covid: bool = False,
    covid_col: str = COVID_COL
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Prepare the dataset for ADL regression from quarterly data.
    """
    df = quarterly_data.copy().sort_index()

    if predictor_cols is None:
        exclude = {target_col, covid_col}
        predictor_cols = [col for col in df.columns if col not in exclude]

    # Start with target and predictors
    cols_to_keep = [target_col] + predictor_cols
    if include_covid and covid_col in df.columns:
        cols_to_keep.append(covid_col)

    full_df = df[cols_to_keep].copy()

    # GDP lags
    for i in range(1, target_lags + 1):
        full_df[f"{target_col}_lag{i}"] = full_df[target_col].shift(i)

    # Predictor lags
    for col in predictor_cols:
        for i in range(1, predictor_lags + 1):
            full_df[f"{col}_lag{i}"] = full_df[col].shift(i)

    required_cols = list(full_df.columns)
    model_df = full_df.dropna(subset=required_cols).copy()

    return full_df, model_df


def fit_adl_model(
    quarterly_data: pd.DataFrame,
    target_col: str = TARGET_COL,
    predictor_cols: list[str] | None = None,
    target_lags: int = DEFAULT_GDP_LAGS,
    predictor_lags: int = DEFAULT_PREDICTOR_LAGS,
    include_covid: bool = False,
    covid_col: str = COVID_COL
):
    """
    Fit the ADL model using OLS.
    """
    full_df, model_df = prepare_adl_dataset(
        quarterly_data=quarterly_data,
        target_col=target_col,
        predictor_cols=predictor_cols,
        target_lags=target_lags,
        predictor_lags=predictor_lags,
        include_covid=include_covid,
        covid_col=covid_col
    )

    feature_cols = [col for col in model_df.columns if col != target_col]

    X = sm.add_constant(model_df[feature_cols], has_constant="add")
    y = model_df[target_col]

    model = sm.OLS(y, X).fit()
    model_df = model_df.copy()
    model_df["fitted_adl"] = model.predict(X)

    return model, full_df, model_df, feature_cols


def get_adl_backtest_output(
    quarterly_data: pd.DataFrame,
    target_col: str = TARGET_COL,
    predictor_cols: list[str] | None = None,
    target_lags: int = DEFAULT_GDP_LAGS,
    predictor_lags: int = DEFAULT_PREDICTOR_LAGS,
    include_covid: bool = False,
    covid_col: str = COVID_COL
):
    """
    Return ADL backtest output in the exact format needed for ensemble evaluation:
    dates, actual, forecast
    """
    model, full_df, model_df, feature_cols = fit_adl_model(
        quarterly_data=quarterly_data,
        target_col=target_col,
        predictor_cols=predictor_cols,
        target_lags=target_lags,
        predictor_lags=predictor_lags,
        include_covid=include_covid,
        covid_col=covid_col
    )

    dates = model_df.index
    actual = model_df[target_col].values
    forecast = model_df["fitted_adl"].values

    return dates, actual, forecast


def select_adl_lag_order(
    quarterly_data: pd.DataFrame,
    target_col: str = TARGET_COL,
    predictor_cols: list[str] | None = None,
    max_target_lags: int = MAX_GDP_LAGS,
    max_predictor_lags: int = MAX_PREDICTOR_LAGS,
    include_covid: bool = False,
    covid_col: str = COVID_COL,
    criterion: str = "AIC"
) -> dict:
    """
    Select the optimal ADL lag order by minimizing AIC or BIC.
    """
    if criterion not in ("AIC", "BIC"):
        raise ValueError("Criterion must be 'AIC' or 'BIC'.")

    records = []

    for p in range(1, max_target_lags + 1):
        for q in range(0, max_predictor_lags + 1):
            try:
                model, _, _, _ = fit_adl_model(
                    quarterly_data=quarterly_data,
                    target_col=target_col,
                    predictor_cols=predictor_cols,
                    target_lags=p,
                    predictor_lags=q,
                    include_covid=include_covid,
                    covid_col=covid_col
                )
                information_score = model.aic if criterion == "AIC" else model.bic
                records.append({
                    "target_lags": p,
                    "predictor_lags": q,
                    criterion: information_score
                })
            except Exception:
                continue

    if not records:
        raise ValueError("No valid ADL specification could be estimated.")

    results_grid = pd.DataFrame(records).sort_values(criterion).reset_index(drop=True)
    best_row = results_grid.iloc[0]

    return {
        "target_lags": int(best_row["target_lags"]),
        "predictor_lags": int(best_row["predictor_lags"]),
        criterion: float(best_row[criterion]),
        "results_grid": results_grid
    }


def cv_adl_model(
    quarterly_data: pd.DataFrame,
    target_lags: int,
    predictor_lags: int,
    target_col: str = TARGET_COL,
    predictor_cols: list[str] | None = None,
    include_covid: bool = False,
    covid_col: str = COVID_COL,
    n_splits: int = DEFAULT_CV_N_SPLITS,
    min_train_size: int = MIN_CV_TRAIN_SIZE
) -> dict:
    """
    Evaluate ADL via expanding-window time-series cross-validation.
    """
    _, model_df = prepare_adl_dataset(
        quarterly_data=quarterly_data,
        target_col=target_col,
        predictor_cols=predictor_cols,
        target_lags=target_lags,
        predictor_lags=predictor_lags,
        include_covid=include_covid,
        covid_col=covid_col
    )

    feature_cols = [col for col in model_df.columns if col != target_col]

    y = model_df[target_col].values
    X = model_df[feature_cols].values
    n = len(model_df)

    if n <= min_train_size:
        raise ValueError("Not enough observations for cross-validation.")

    max_test_start = n - 1
    min_test_start = min_train_size
    test_indices = np.linspace(min_test_start, max_test_start, n_splits, dtype=int)

    rmse_folds = []
    mae_folds = []
    fold_details = []

    for fold, test_idx in enumerate(test_indices):
        X_train = X[:test_idx]
        y_train = y[:test_idx]

        X_test = X[[test_idx], :]
        y_test = y[[test_idx]]

        try:
            X_train_sm = sm.add_constant(X_train, has_constant="add")
            X_test_sm = sm.add_constant(X_test, has_constant="add")

            fold_model = sm.OLS(y_train, X_train_sm).fit()
            y_hat = fold_model.predict(X_test_sm)[0]

            error = y_test[0] - y_hat
            rmse = float(np.sqrt(error ** 2))
            mae = float(np.abs(error))

            rmse_folds.append(rmse)
            mae_folds.append(mae)

            fold_details.append({
                "fold": fold + 1,
                "test_index": int(test_idx),
                "test_date": model_df.index[test_idx],
                "y_actual": float(y_test[0]),
                "y_hat": float(y_hat),
                "error": float(error),
                "rmse": rmse,
                "mae": mae,
                "n_train": int(test_idx)
            })
        except Exception:
            fold_details.append({
                "fold": fold + 1,
                "test_index": int(test_idx),
                "status": "Fold failed."
            })

    mean_rmse = float(np.mean(rmse_folds)) if rmse_folds else np.nan
    mean_mae = float(np.mean(mae_folds)) if mae_folds else np.nan

    return {
        "RMSE_folds": rmse_folds,
        "MAE_folds": mae_folds,
        "mean_RMSE": mean_rmse,
        "mean_MAE": mean_mae,
        "n_folds_fit": len(rmse_folds),
        "fold_details": fold_details
    }


def nowcast_curr_quarter_adl(
    quarterly_data: pd.DataFrame,
    model,
    feature_cols: list[str],
    target_col: str = TARGET_COL,
    include_covid: bool = False,
    covid_col: str = COVID_COL
) -> tuple:
    """
    Nowcast GDP growth for the current quarter using the fitted ADL model.
    """
    df = quarterly_data.copy().sort_index()
    observed_y = df[target_col].dropna()

    target_lag_count = len([c for c in feature_cols if c.startswith(f"{target_col}_lag")])

    if len(observed_y) < target_lag_count:
        raise ValueError(
            f"Insufficient data to nowcast with ADL. Need at least {target_lag_count} observed GDP quarters."
        )

    last_observed_quarter = observed_y.index[-1]
    target_quarter = last_observed_quarter + pd.DateOffset(months=3)

    pred_row = {}

    for col in feature_cols:
        if col == covid_col:
            pred_row[col] = int(
                pd.Timestamp("2020-01-01") <= target_quarter <= pd.Timestamp("2021-12-01")
            )

        elif col.startswith(f"{target_col}_lag"):
            lag_num = int(col.replace(f"{target_col}_lag", ""))
            pred_row[col] = float(observed_y.iloc[-lag_num])

        elif "_lag" in col:
            base_col, lag_str = col.rsplit("_lag", 1)
            lag_num = int(lag_str)

            if base_col not in df.columns:
                raise KeyError(f"Feature '{base_col}' not found in quarterly_data.")

            series = df[base_col].dropna()
            if len(series) <= lag_num:
                raise ValueError(f"Not enough history for predictor '{base_col}' lag {lag_num}.")

            pred_row[col] = float(series.iloc[-(lag_num + 1)])

        else:
            if col not in df.columns:
                raise KeyError(f"Feature '{col}' not found in quarterly_data.")

            pred_row[col] = float(df[col].dropna().iloc[-1])

    X_new = pd.DataFrame([pred_row])[feature_cols]
    X_new = sm.add_constant(X_new, has_constant="add")

    nowcast = float(model.predict(X_new).iloc[0])

    return target_quarter, nowcast


def adl_monthly_update_nowcast(
    quarterly_data: pd.DataFrame,
    monthly_data: pd.DataFrame,
    model,
    feature_cols: list[str],
    target_month: str,
    target_col: str = TARGET_COL,
    predictor_cols: list[str] | None = None,
    predictor_lags: int = DEFAULT_PREDICTOR_LAGS,
    include_covid: bool = False,
    covid_col: str = COVID_COL
) -> tuple:
    """
    Produce an ADL nowcast that updates monthly for the quarter containing target_month.
    """
    target_month = pd.Timestamp(target_month)
    target_quarter = target_month.to_period("Q").to_timestamp()

    q_df = quarterly_data.copy().sort_index()
    m_df = monthly_data.copy().sort_index()

    observed_y = q_df.loc[q_df.index < target_quarter, target_col].dropna()

    if len(observed_y) < DEFAULT_GDP_LAGS:
        raise ValueError(
            f"Insufficient GDP data to nowcast quarter {target_quarter.date()} as of {target_month.date()}."
        )

    if predictor_cols is None:
        exclude = {target_col, covid_col}
        predictor_cols = [col for col in m_df.columns if col not in exclude]

    quarter_months = m_df.loc[
        (m_df.index >= target_quarter) & (m_df.index <= target_month)
    ]

    n_months_observed = len(quarter_months)

    partial_q_means = {}
    for col in predictor_cols:
        if col in quarter_months.columns and n_months_observed > 0:
            partial_q_means[col] = float(quarter_months[col].mean())
        elif col in q_df.columns and not q_df[col].dropna().empty:
            partial_q_means[col] = float(q_df[col].dropna().iloc[-1])
        else:
            partial_q_means[col] = np.nan

    pred_row = {}

    for col in feature_cols:
        if col == f"{target_col}_lag1":
            pred_row[col] = float(observed_y.iloc[-1])

        elif col == f"{target_col}_lag2":
            pred_row[col] = float(observed_y.iloc[-2])

        elif col == covid_col:
            pred_row[col] = int(
                pd.Timestamp("2020-01-01") <= target_quarter <= pd.Timestamp("2021-12-01")
            )

        elif col in partial_q_means:
            pred_row[col] = partial_q_means[col]

        elif "_lag" in col:
            base_col, lag_str = col.rsplit("_lag", 1)
            lag_j = int(lag_str)
            lagged_q = target_quarter - pd.DateOffset(months=3 * lag_j)

            if lagged_q in q_df.index and base_col in q_df.columns:
                pred_row[col] = float(q_df.loc[lagged_q, base_col])
            elif base_col in q_df.columns and len(q_df[base_col].dropna()) > lag_j:
                pred_row[col] = float(q_df[base_col].dropna().iloc[-(lag_j + 1)])
            else:
                pred_row[col] = np.nan

        else:
            pred_row[col] = np.nan

    X_new = pd.DataFrame([pred_row])[feature_cols]
    X_new = sm.add_constant(X_new, has_constant="add")

    nowcast = float(model.predict(X_new).iloc[0])

    return target_quarter, nowcast, n_months_observeds