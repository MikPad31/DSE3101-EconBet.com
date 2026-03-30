import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import TimeSeriesSplit
from quarterly_and_monthly_data import get_quarterly_data_rf

# ---------------------------------------------------------------------------
# 1. Load data
# ---------------------------------------------------------------------------
quarterly_data = get_quarterly_data_rf()

df = quarterly_data.copy()
df.index = pd.to_datetime(df.index)
df = df.sort_index()

# ---------------------------------------------------------------------------
# 2. Feature engineering — computed on the FULL series before splitting,
#    but only on raw levels (no diff across the split boundary issue here
#    since we take log-diffs within the series consistently).
#    The key fix: keep TWO extra rows so the diff-based features at the
#    split boundary are computed from real data, not future data.
#    All diff() calls are on the full timeline — no leakage.
# ---------------------------------------------------------------------------
df['spread']       = df['BAA'] - df['AAA']         # credit spread (levels)
df['term_spread']  = df['GS10'] - df['TB3MS']       # term spread (levels)
df['INDPRO_growth'] = np.log(df['INDPRO']).diff()
df['HOUST_growth']  = np.log(df['HOUST']).diff()
df['INVEST_growth'] = np.log(df['INVEST']).diff()

FEATURE_COLS = ['spread', 'term_spread', 'INDPRO_growth', 'HOUST_growth', 'UNRATE', 'INVEST_growth']

# Drop rows where any feature or target is NaN
df_model = df[FEATURE_COLS + ['GDPC1']].dropna()

X = df_model[FEATURE_COLS]
y = df_model['GDPC1']

# ---------------------------------------------------------------------------
# 3. Train / test split (80 / 20, time-ordered — no shuffling)
# ---------------------------------------------------------------------------
split_index = int(len(X) * 0.8)
X_train, X_test = X.iloc[:split_index], X.iloc[split_index:]
y_train, y_test = y.iloc[:split_index], y.iloc[split_index:]

# ---------------------------------------------------------------------------
# 4. Hyperparameter search using TimeSeriesSplit cross-validation
#    This prevents accidentally tuning to a single lucky test window and
#    respects the temporal ordering of the data.
# ---------------------------------------------------------------------------
n_estimators_list = list(range(100, 501, 100))
max_depth_list    = list(range(3, 16, 2)) + [None]

tscv = TimeSeriesSplit(n_splits=5)

grid_results = []
best_cv_rmse = float('inf')
best_params  = None

print("--- Hyperparameter search (TimeSeriesSplit CV) ---")
for n in n_estimators_list:
    for d in max_depth_list:
        fold_rmses = []
        for train_idx, val_idx in tscv.split(X_train):
            X_cv_train = X_train.iloc[train_idx]
            y_cv_train = y_train.iloc[train_idx]
            X_cv_val   = X_train.iloc[val_idx]
            y_cv_val   = y_train.iloc[val_idx]

            rf_cv = RandomForestRegressor(n_estimators=n, max_depth=d, random_state=42, n_jobs=-1)
            rf_cv.fit(X_cv_train, y_cv_train)
            preds = rf_cv.predict(X_cv_val)
            fold_rmses.append(np.sqrt(mean_squared_error(y_cv_val, preds)))

        mean_rmse = np.mean(fold_rmses)
        grid_results.append((n, d, mean_rmse))
        print(f"  n={n:3d}, depth={str(d):4s} → CV RMSE={mean_rmse:.4f}")

        if mean_rmse < best_cv_rmse:
            best_cv_rmse = mean_rmse
            best_params  = (n, d)

best_n, best_d = best_params
print(f"\nBest CV params: n_estimators={best_n}, max_depth={best_d}, CV RMSE={best_cv_rmse:.4f}")

# ---------------------------------------------------------------------------
# 5. Retrain best model on full training set, evaluate on held-out test set
# ---------------------------------------------------------------------------
rf = RandomForestRegressor(n_estimators=best_n, max_depth=best_d, random_state=42, n_jobs=-1)
rf.fit(X_train, y_train)

y_pred_test = rf.predict(X_test)
test_rmse   = np.sqrt(mean_squared_error(y_test, y_pred_test))
print(f"Hold-out test RMSE: {test_rmse:.4f}")
print(f"Pred std:   {np.std(y_pred_test):.4f}")
print(f"Actual std: {np.std(y_test):.4f}")

# ---------------------------------------------------------------------------
# 6. Nowcast current quarter
#
#    FIX: computing log-diffs on a single row always yields NaN.
#    Solution: take the last TWO rows from the full (non-model-filtered)
#    dataframe, compute the diff on that 2-row window, then take tail(1)
#    to get the current quarter's features.
# ---------------------------------------------------------------------------
# Use the last 2 rows of the raw quarterly data so .diff() has a previous row
nowcast_window = df.tail(2).copy()
nowcast_window['spread']        = nowcast_window['BAA'] - nowcast_window['AAA']
nowcast_window['term_spread']   = nowcast_window['GS10'] - nowcast_window['TB3MS']
nowcast_window['INDPRO_growth'] = np.log(nowcast_window['INDPRO']).diff()
nowcast_window['HOUST_growth']  = np.log(nowcast_window['HOUST']).diff()
nowcast_window['INVEST_growth'] = np.log(nowcast_window['INVEST']).diff()

X_current = nowcast_window[FEATURE_COLS].tail(1)

# Sanity check — warn if any feature is still NaN
if X_current.isnull().any(axis=None):
    print("\nWARNING: Current quarter features contain NaN — nowcast may be unreliable.")
    print(X_current)

current_gdp_nowcast = rf.predict(X_current)[0]
nowcast_date        = X_current.index[0].date()

print(f"\nGDP Nowcast ({nowcast_date}): {current_gdp_nowcast:.4f} (annualised log-diff × 400)")

# ---------------------------------------------------------------------------
# 7. Feature importance
# ---------------------------------------------------------------------------
importances = pd.Series(rf.feature_importances_, index=FEATURE_COLS).sort_values(ascending=False)
print("\nFeature importances:")
print(importances.to_string())

# ---------------------------------------------------------------------------
# 8. Public function: actual vs predicted + nowcast row
# ---------------------------------------------------------------------------
def predicted_vs_actual_gdp():
    """
    Returns a DataFrame with:
      - Actual_GDP and Predicted_GDP for the hold-out test period
      - A final row with the current-quarter nowcast (Actual_GDP = NaN)
    """
    results = pd.DataFrame({
        'Actual_GDP':    y_test.values,
        'Predicted_GDP': y_pred_test
    }, index=y_test.index)

    nowcast_row = pd.DataFrame({
        'Actual_GDP':    [np.nan],
        'Predicted_GDP': [current_gdp_nowcast]
    }, index=[X_current.index[0]])

    return pd.concat([results, nowcast_row])

print(predicted_vs_actual_gdp().tail(10))  # Show last 10 rows including nowcast