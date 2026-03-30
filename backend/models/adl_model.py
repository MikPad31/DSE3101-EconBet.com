import pandas as pd
import numpy as np
import statsmodels.api as sm
from backend.quarterly_and_monthly_data import get_monthly_data, get_quarterly_data

# defining constants (to be refactored / moved into another file later)

TARGET_COL = "GDPC1"
COVID_COL = "Covid" # need to look into relevance of including Covid column in the nowcast model
DEFAULT_GDP_LAGS = 2
DEFAULT_PREDICTOR_LAGS = 1
MAX_GDP_LAGS = 4
MAX_PREDICTOR_LAGS = 2
DEFAULT_CV_N_SPLITS = 5
MIN_CV_TRAIN_SIZE = 20

'''
FOR ADL MODELLING / NOWCASTING:
needed input from user:
    include_covid : bool = False
    target_month : str # compatible / parseable by pd.Timestamp

'''

# Prepare data set for ADL
def prepare_adl_dataset(
        quarterly_data : pd.DataFrame,
        target_col : str = TARGET_COL,
        predictor_cols : list[str] | None = None,
        target_lags: int = DEFAULT_GDP_LAGS,
        predictor_lags : int = DEFAULT_PREDICTOR_LAGS,
        include_covid : bool = False,
        covid_col : str = COVID_COL
) -> tuple[pd.DataFrame, pd.DataFrame] :
    """Prepares the dataset for ADL regression from quarterly data.
    
    Parameters
    ----------
    quarterly_data : pd.DataFrame
        Quarterly Dataframe from the preprocessing pipeline, containing target column and all predictor columns.
    target_col : str = TARGET_COL
        Target column for model, defined as GDPC1.
    predictor_cols : list[str] | None = None
        List of predictor column names to include as distributed lags, if None, all columns are included except target column.
    target_lags: int = DEFAULT_GDP_LAGS
        Number of autoregressive lags for target column (GDP) to include.
    predictor_lags : int = DEFAULT_PREDICTOR_LAGS
        Number of distributed lags per predictor.
    include_covid : bool = False
        Indicator for whether COVID dummy variable is to be included, defaults to False.
    covid_col : str = COVID_COL
        COVID dummy column to be included.

    Returns
    -------
    full_df : pd.DataFrame
        Full dataset containing all constructed lag columns, including rows with NaNs.
    model_df: pd.DataFrame
        Cleaned dataset with NaNs dropped for OLS regression.
    """

    df = quarterly_data.copy().sort_index()

    # Handle predictor columns
    if predictor_cols is None:
        exclude = {target_col, covid_col}
        predictor_cols = [col for col in df.columns if col not in exclude]

    full_df = df[[target_col]].copy()

    # AR lags for target column (GDP Growth)
    for i in range(1, target_lags + 1):
        target_lag_name = f"{target_col}_lag{i}"
        full_df[target_lag_name] = full_df[target_col].shift(i)

    # Distributed lags of monthly predictors
    for col in predictor_cols:
        for i in range(0, predictor_lags + 1):
            pred_lag_name = f"{col}_lag{i}" if i > 0 else col
            full_df[pred_lag_name] = df[col].shift[i]

    # Handling COVID Dummy variable
    if include_covid and covid_col in df.columns:
        full_df[covid_col] = df[covid_col]

    # Drop NaNs
    required_cols = [target_col] + [col for col in full_df.columns if col != target_col]
    model_df = full_df.dropna(subset = required_cols).copy()

    return full_df, model_df


# Fitting ADL model
def fit_adl_model(
        quarterly_data : pd.DataFrame,
        target_col : str = TARGET_COL,
        predictor_cols : list[str] | None = None,
        target_lags: int = DEFAULT_GDP_LAGS,
        predictor_lags : int = DEFAULT_PREDICTOR_LAGS,
        include_covid : bool = False,
        covid_col : str = COVID_COL
):
    """Function to fit the ADL model on the quarterly data using OLS.


    Parameters
    ----------
    quarterly_data : pd.DataFrame
        Quarterly Dataframe from the preprocessing pipeline, containing target column and all predictor columns.
    target_col : str = TARGET_COL
        Target column for model, defined as GDPC1.
    predictor_cols : list[str] | None = None
        List of predictor column names to include as distributed lags, if None, all columns are included except target column.
    target_lags: int = DEFAULT_GDP_LAGS
        Number of autoregressive lags for target column (GDP) to include.
    predictor_lags : int = DEFAULT_PREDICTOR_LAGS
        Number of distributed lags per predictor.
    include_covid : bool = False
        Indicator for whether COVID dummy variable is to be included, defaults to False.
    covid_col : str = COVID_COL
        COVID dummy column to be included.

    Returns
    -------
    model
        Fitted statsmodels OLS object.
    full_df : pd.DataFrame
        Full dataset containing all constructed lag columns, including rows with NaNs.
    model_df : pd.DataFrame
        Estimation sample with fitted values attached as "fitted_adl".
    feature_cols : list[str]
        List of regressor column names to be used for downstream analysis.
    """
    full_df, model_df = prepare_adl_dataset(
        quarterly_data= quarterly_data,
        target_col= target_col,
        predictor_cols= predictor_cols,
        target_lags= target_lags,
        predictor_lags= predictor_lags,
        include_covid= include_covid,
        covid_col= covid_col
    )

    feature_cols = [col for col in model_df.columns if col != target_col]

    X = sm.add_constant[model_df[feature_cols]]
    y = model_df[target_col]

    model = sm.OLS(y, X).fit()
    model_df = model_df.copy()
    model_df["fitted_adl"] = model.predict(X)

    return model, full_df, model_df, feature_cols


# Managing lag order for ADL, using AIC/BIC to optimise results
def select_adl_lag_order(
        quarterly_data : pd.DataFrame,
        target_col : str = TARGET_COL,
        predictor_cols : list[str] | None = None,
        max_target_lags: int = MAX_GDP_LAGS,
        max_predictor_lags : int = MAX_PREDICTOR_LAGS,
        include_covid : bool = False,
        covid_col : str = COVID_COL, 
        criterion : str = "AIC"
) -> dict:
    """Function that selects the optimal ADL lag order by minimising based on the specificied information criterion.

    Parameters
    ----------
    quarterly_data : pd.DataFrame
        Quarterly Dataframe from the preprocessing pipeline, containing target column and all predictor columns.
    target_col : str = TARGET_COL
        Target column for model, defined as GDPC1.
    predictor_cols : list[str] | None = None
        List of predictor column names to include as distributed lags, if None, all columns are included except target column.
    max_target_lags: int = DEFAULT_GDP_LAGS
        Maximum number of autoregressive lags for target column (GDP) to include.
    predictor_lags : int = DEFAULT_PREDICTOR_LAGS
       Maximum number of distributed lags per predictor.
    include_covid : bool = False
        Indicator for whether COVID dummy variable is to be included, defaults to False.
    covid_col : str = COVID_COL
        COVID dummy column to be included.
    criterion : str = "AIC"
        Information criterion to minimise, choice between "AIC" or "BIC". Defaults to "AIC".

    Returns
    -------
    best_lag : dict
        Dictionary with the following keys:
            "target_lags" : int
                Optimal number of AR lags for target variable (GDP growth).
            "predictor_lags" : int
                Optimal number of AR lags of distributed lags for predictors.
            criterion : float
                Value of the chosen criterion at the optimum.
            "results_grid" : pd.DataFrame
                Full grid of criterion values.    
    """

    if criterion not in ("AIC", "BIC"):
        raise ValueError("Criterion must be 'AIC' or 'BIC'.")
    
    records = []

    for p in range(1, max_target_lags + 1):
        for q in range(0, max_predictor_lags + 1):
            try:
                model, _, _, _ = fit_adl_model(
                    quarterly_data= quarterly_data,
                    target_col= target_col,
                    predictor_cols= predictor_cols,
                    target_lags= p,
                    predictor_lags= q,
                    include_covid= include_covid,
                    covid_col= covid_col
                )
                information_score = model.aic if criterion == "AIC" else model.bic
                records.append({"target_lags": p, 
                                "predictor_lags": q, 
                                criterion: information_score,})
            
            except Exception:
                continue

    results_grid = pd.DataFrame(records).sort_values(criterion).reset_index(drop = True)

    best_row = results_grid.iloc[0]

    return{
        "target_lags": int(best_row["target_lags"]),
        "predictor_lags": int(best_row["predictor_lags"]),
        criterion: float(best_row[criterion]),
        "results_grid": results_grid
    }


# Cross-validation
def cv_adl_model(
        quarterly_data : pd.DataFrame,
        target_lags : int,
        predictor_lags : int,
        target_col : str = TARGET_COL,
        predictor_cols : list[str] | None = None,
        include_covid : bool = False,
        covid_col : str = COVID_COL,
        n_splits : int = DEFAULT_CV_N_SPLITS,
        min_train_size : int = MIN_CV_TRAIN_SIZE
) -> dict:
    """Function to evaluate ADL model via expanding-window time-series cross-validation.
    
    Parameters
    ----------
    quarterly_data : pd.DataFrame
        Quarterly Dataframe from the preprocessing pipeline, containing target column and all predictor columns.
    target_lags : int
        AR lag order for target variable (GDP) (p).
    predictor_lags : int
        Distributed lag order for predictors (q).
    target_col : str = TARGET_COL
        Target column for model, defined as GDPC1.
    predictor_cols : list[str] | None = None
        List of predictor column names to include as distributed lags, if None, all columns are included except target column.
    include_covid : bool = False
        Indicator for whether COVID dummy variable is to be included, defaults to False.
    covid_col : str = COVID_COL
        COVID dummy column to be included.
    n_splits : int = DEFAULT_CV_N_SPLITS
        Number of CV folds.
    min_train_size : int = MIN_CV_TRAIN_SIZE
        Minimum number of observations required in the training window before the first fold is evaluated.

    Returns
    -------
    cv_res : dict
        Dictionary with the following keys:
            RMSE_folds : list[float]
                List of per-fold RMSE values.
            MAE_folds : list[float]
                List of per-fold MAE values
            mean_RMSE : float
                Mean RMSE across all folds.
            mean_MAE : float
                Mean MAE across all folds.
            n_folds_fit : int
                Number of folds successfully fitted.
            fold_details : list[dict]
                List of dictionaries with fold-level metadata
    """

    # Obtain model dataset without NaNs
    _, model_df = prepare_adl_dataset(
        quarterly_data= quarterly_data,
        target_col= target_col,
        predictor_cols= predictor_cols,
        target_lags= target_lags,
        predictor_lags= predictor_lags,
        include_covid= include_covid,
        covid_col= covid_col
    )

    # Resolve feature columns      
    if predictor_cols is None:
        exclude = {target_col, covid_col}
        predictor_cols = [col for col in model_df.columns if col not in exclude]

    y = model_df[target_col].values
    X = model_df[predictor_cols].values
    n = len(model_df)
    
    # Determine fold cutpoints
    max_test_start = n -1
    min_test_start = min_train_size
    test_indices = np.linspace(
        min_test_start, max_test_start, n_splits, dtype = int
    )

    # Expanding window CV
    rmse_folds = []
    mae_folds = []
    fold_details = []

    for fold, test_idx in enumerate(test_indices):
        X_train = X[:test_idx]
        y_train = y[:test_idx]

        X_test = X[[test_idx], :]
        y_test = y[[test_idx], :]

        try:
            X_train_sm = sm.add_constant(X_train, has_constant = "add")
            X_test_sm = sm.add_constant(X_test, has_constant = "add")

            fold_model = sm.OLS(y_train, X_train_sm).fit()
            y_hat = fold_model.predict(X_test_sm)[0]

            error = y_test[0] - y_hat
            rmse = float(np.sqrt(error ** 2))
            mae = float(np.abs(error))

            rmse_folds.append(rmse)
            mae_folds.append(mae)
            fold_details.append({
                "fold": fold + 1,
                "test_index": test_idx,
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
                "test_index": test_idx,
                "status": "Fold failed."
            })
            continue
    
    mean_rmse = float(np.mean(rmse_folds)) if rmse_folds else np.nan
    mean_mae = float(np.mean(mae_folds)) if mae_folds else np.nan

    return{
        "RMSE_folds": rmse_folds,
        "MAE_folds": mae_folds,
        "mean_RMSE": mean_rmse,
        "mean_MAE": mean_mae,
        "n_folds_fit": len(rmse_folds),
        "fold_details": fold_details
    }


# Nowcasting the current quarter
def nowcast_curr_quarter_adl(
        quarterly_data : pd.DataFrame,
        model,
        feature_cols : list[str],
        target_col : str = TARGET_COL,
        include_covid : bool = False,
        covid_col : str = COVID_COL
) -> tuple:
    """Nowcasts GDP growth for the current quarter using the fitted ADl model.

    Parameters
    ----------
    quarterly_data : pd.DataFrame
        Quarterly Dataframe from the preprocessing pipeline, containing target column and all predictor columns.
    model
        Fitted statsmodels OLS object as returned by fit_adl_model().
    feature_cols : list[str]
        List of regressor column names (excluding constant), as returned by fit_adl_model().
    target_col : str = TARGET_COL
        Target column for model, defined as GDPC1.
    include_covid : bool = False
        Indicator for whether COVID dummy variable is to be included, defaults to False.
    covid_col : str = COVID_COL
        COVID dummy column to be included.

    Returns
    -------
    target_quarter : pd.Timestamp
        Quarter-start date of the quarter being nowcasted.
    nowcast : float
        Predicted GDP growth rate (annualised log growth, same units as GDPC1).
    """

    df = quarterly_data.copy().sort_index()

    observed_y = df[target_col].dropna()

    if len(observed_y) < DEFAULT_GDP_LAGS:
        raise ValueError(
            f"Insufficient data to nowcast with ADL."
            f"Provide at least {DEFAULT_GDP_LAGS} observed GDP quarters."
        )
    
    last_observed_quarter = observed_y.index[-1]
    target_quarter = last_observed_quarter + pd.DateOffset(months = 3)

    # Build prediction
    pred_row = {}

    for col in feature_cols:
        # COVID Dummy column
        if col == covid_col:
            pred_row[col] = int(
                pd.Timestamp("2020-01-01") <= target_quarter <= pd.Timestamp("2021-12-01")
            )
        
        elif col in df.columns:
            pred_row[col] = float(df[col.dropna().iloc(-1)])
        
        else:
            raise KeyError(
                f"Feature '{col}' not found in quarterly_data."
                f"Ensure data preprocessing pipeline has produced this column."
            )
        
    X_new = pd.DataFrame([pred_row])[feature_cols]
    X_new = sm.add_constant(X_new, has_constant = "add")

    nowcast = float(model.predict(X_new).iloc[0])
    
    return target_quarter, nowcast


# Monthly-updating Nowcast
def adl_monthly_update_nowcast(
        quarterly_data : pd.DataFrame,
        monthly_data : pd.DataFrame,
        model,
        feature_cols : list[str],
        target_month : str,
        target_col : str = TARGET_COL,
        predictor_cols: list[str] | None = None,
        predictor_lags : int = DEFAULT_PREDICTOR_LAGS,
        include_covid : bool = False,
        covid_col : str = COVID_COL
) -> tuple:
    """Produces an ADL nowcast that updates monthly for the quarter containing the target month.

    Note to self: take user input for target_month
    
    Parameters
    ----------
    quarterly_data : pd.DataFrame
        Quarterly Dataframe from the preprocessing pipeline, containing target column and all predictor columns.
    monthly_data : pd.DataFrame
        Monthly Dataframe from the preprocessing pipeline, containing target column and all predictor columns.
    model
        Fitted statsmodels OLS object as returned by fit_adl_model().
    feature_cols : list[str]
        List of regressor column names (excluding constant), as returned by fit_adl_model().
    target_month : str
        Month as of which the nowcast is to be produced, must be parseable by pd.Timestamp.
    target_col : str = TARGET_COL
        Target column for model, defined as GDPC1.
    predictor_cols: list[str] | None = None
        List of predictor column names to include as distributed lags, if None, all columns are included except target column.
    predictor_lags : int = DEFAULT_PREDICTOR_LAGS
        Number of distributed lags per predictor.
    include_covid : bool = False
        Indicator for whether COVID dummy variable is to be included, defaults to False.
    covid_col : str = COVID_COL
        COVID dummy column to be included.
    
    Returns
    -------
    target_quarter : pd.Timestamp
        Quarter-start date of the quarter being nowcasted.
    nowcast L float
        Predicted GDP growth rate for that quarter, updated as of target_month.
    n_months_observed : int
        Number of months of within-quarter data available as of target_month (1, 2, or 3), for tracking nowcast revision patterns.
    """

    target_month = pd.Timestamp(target_month)

    # Identify target quarter
    target_quarter = target_month.to_period("Q").to_timestamp("QS")

    q_df = quarterly_data.copy().sort_index()
    m_df = monthly_data.copy().sort_index()

    observed_y = q_df.loc[q_df.index < target_quarter, target_col].dropna()

    if len(observed_y) < DEFAULT_GDP_LAGS:
        raise ValueError(
            f"Insufficient GDP data to nowcast quarter {target_quarter.data()} as of {target_month.date()}."
            f"Provide at least {DEFAULT_GDP_LAGS} observed GDP quarters."            
        )
    
    # Resolve predictor columns (using monthly data)
    if predictor_cols is None:
        exclude = {target_col, covid_col}
        predictor_cols = [col for col in m_df.columns if col not in exclude]

    # Compute partial quarterly averages
    quarter_months = m_df.loc[(m_df(m_df.index) >= target_quarter) & (m_df.index <= target_month)]
    
    n_months_observed = len(quarter_months)

    partial_q_means = {}
    for col in predictor_cols:
        # Calculate average of observed months
        if col in quarter_months.columns and n_months_observed > 0:
            partial_q_means[col] = quarter_months[col].mean()
        
        # Use pre-filled quarterly average from pre-processing pipeline
        elif col in q_df.columns:
            partial_q_means[col] = float(q_df[col].dropna().iloc[-1])

        else:
            partial_q_means[col] = np.nan

    # Build prediction
    pred_row = {}

    for col in feature_cols:
        # AR lags of GDP from prepped dataset
        if col == f"{target_col}_lag1":
            pred_row[col] = float(observed_y.iloc[-1])
        
        elif col ==f"{target_col}_lag2":
            pred_row[col] = float(observed_y.iloc[-2])

        # COVID dummy
        elif col == covid_col:
            pred_row[col] = int(
                pd.Timestamp("2020-01-01") <= target_quarter <= pd.Timestamp("2021-12-01")
            )

        # Current predictors (lag 0)
        elif col in partial_q_means:
            pred_row[col] = partial_q_means[col]

        # Lagged predictor, use prior quarter
        elif "_lag" in col:
            base_col, lag_str = col.rsplit("_lag", 1)
            lag_j = int(lag_str)
            lagged_q = target_quarter - pd.DateOffset(months = 3 * lag_j)

            # If actual average is observed / published
            if lagged_q in q_df.index and base_col in q_df.columns:
                pred_row[col]= float(q_df.loc[lagged_q, base_col])

            # Catch month indexing edge case
            elif base_col in q_df.columns:
                pred_row[col] = float(q_df[base_col].dropna().iloc[-(lag_j  +1)])

            # Unrecognised index
            else:
                pred_row[col] = np.nan

        else:
            pred_row[col] = np.nan

    X_new = pd.DataFrame([pred_row])[feature_cols]
    X_new = sm.add_constant(X_new, has_constant = "add")

    nowcast = float(model.predict(X_new).iloc[0])

    return target_quarter, nowcast, n_months_observed